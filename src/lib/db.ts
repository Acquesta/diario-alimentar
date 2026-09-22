import type { Banco } from './banco-tipos';
import type { Alimento, Origem, Refeicao } from './foods';
import { porcao, type Macros, type Perfil } from './nutrition';

/** Todo acesso ao banco passa por aqui, para facilitar trocar o armazenamento se precisar. */

export const NOME_BANCO = 'diario.db';
const VERSAO = 3;

export async function migrar(db: Banco): Promise<void> {
  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const atual = linha?.user_version ?? 0;
  if (atual >= VERSAO) return;

  if (atual < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS perfil (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        sexo TEXT NOT NULL,
        idade INTEGER NOT NULL,
        altura_cm REAL NOT NULL,
        peso_kg REAL NOT NULL,
        atividade TEXT NOT NULL,
        objetivo TEXT NOT NULL,
        meta_manual INTEGER
      );
      CREATE TABLE IF NOT EXISTS alimentos_personalizados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        kcal REAL NOT NULL,
        proteina REAL NOT NULL,
        carboidrato REAL NOT NULL,
        gordura REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS registros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        refeicao TEXT NOT NULL,
        origem TEXT NOT NULL,
        alimento_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        gramas REAL NOT NULL,
        kcal REAL NOT NULL,
        proteina REAL NOT NULL,
        carboidrato REAL NOT NULL,
        gordura REAL NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_registros_data ON registros (data);
      CREATE TABLE IF NOT EXISTS favoritos (
        origem TEXT NOT NULL,
        alimento_id INTEGER NOT NULL,
        gramas REAL NOT NULL,
        PRIMARY KEY (origem, alimento_id)
      );
    `);
  }

  if (atual < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS config (
        chave TEXT PRIMARY KEY NOT NULL,
        valor TEXT NOT NULL
      );
    `);
  }

  if (atual < 3) {
    // Pratos prontos: combinação de alimentos com gramas, registrada em um toque.
    // Os itens guardam os valores por 100 g, para o prato continuar certo mesmo se a base mudar.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pratos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS prato_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prato_id INTEGER NOT NULL REFERENCES pratos (id) ON DELETE CASCADE,
        origem TEXT NOT NULL,
        alimento_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        gramas REAL NOT NULL,
        kcal REAL NOT NULL,
        proteina REAL NOT NULL,
        carboidrato REAL NOT NULL,
        gordura REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_prato_itens_prato ON prato_itens (prato_id);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${VERSAO}`);
}

// Pratos prontos

export type ItemPrato = { alimento: Alimento; gramas: number };
export type Prato = { id: number; nome: string; itens: ItemPrato[] };

type ItemPratoLinha = Macros & {
  prato_id: number;
  origem: Origem;
  alimento_id: number;
  nome: string;
  gramas: number;
};

export async function listarPratos(db: Banco): Promise<Prato[]> {
  const pratos = await db.getAllAsync<{ id: number; nome: string }>('SELECT id, nome FROM pratos ORDER BY nome');
  const itens = await db.getAllAsync<ItemPratoLinha>(
    'SELECT prato_id, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura FROM prato_itens ORDER BY id',
  );
  return pratos.map((p) => ({
    ...p,
    itens: itens
      .filter((i) => i.prato_id === p.id)
      .map((i) => ({
        gramas: i.gramas,
        alimento: {
          origem: i.origem,
          id: i.alimento_id,
          nome: i.nome,
          categoria: '',
          kcal: i.kcal,
          proteina: i.proteina,
          carboidrato: i.carboidrato,
          gordura: i.gordura,
        },
      })),
  }));
}

/** Cria (sem id) ou substitui (com id) um prato e seus itens. Retorna o id. */
export async function salvarPrato(
  db: Banco,
  prato: { id?: number; nome: string; itens: ItemPrato[] },
): Promise<number> {
  let id = prato.id;
  await db.withTransactionAsync(async () => {
    if (id) {
      await db.runAsync('UPDATE pratos SET nome = ? WHERE id = ?', prato.nome, id);
      await db.runAsync('DELETE FROM prato_itens WHERE prato_id = ?', id);
    } else {
      id = (await db.runAsync('INSERT INTO pratos (nome) VALUES (?)', prato.nome)).lastInsertRowId;
    }
    for (const { alimento: a, gramas } of prato.itens) {
      await db.runAsync(
        `INSERT INTO prato_itens (prato_id, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id!, a.origem, a.id, a.nome, gramas, a.kcal, a.proteina, a.carboidrato, a.gordura,
      );
    }
  });
  return id!;
}

export async function removerPrato(db: Banco, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM prato_itens WHERE prato_id = ?', id);
    await db.runAsync('DELETE FROM pratos WHERE id = ?', id);
  });
}

/** Registra todos os itens do prato na refeição, cada um como um registro. */
export async function registrarPrato(
  db: Banco,
  data: string,
  refeicao: Refeicao,
  prato: Prato,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const { alimento, gramas } of prato.itens) {
      await registrar(db, data, refeicao, alimento, gramas);
    }
  });
}

/** Itens de uma refeição registrada, no formato de prato, para "Salvar como prato". */
export async function itensDaRefeicao(
  db: Banco,
  data: string,
  refeicao: Refeicao,
): Promise<ItemPrato[]> {
  const regs = (await listarRegistros(db, data)).filter((r) => r.refeicao === refeicao);
  return regs.map((r) => {
    // O registro guarda o total da porção; volta para valores por 100 g.
    const f = r.gramas > 0 ? 100 / r.gramas : 0;
    const um = (v: number) => Math.round(v * f * 10) / 10;
    return {
      gramas: r.gramas,
      alimento: {
        origem: r.origem,
        id: r.alimentoId,
        nome: r.nome,
        categoria: '',
        kcal: Math.round(r.kcal * f),
        proteina: um(r.proteina),
        carboidrato: um(r.carboidrato),
        gordura: um(r.gordura),
      },
    };
  });
}

// Configurações (ex.: tema)

export async function lerConfig(db: Banco, chave: string): Promise<string | null> {
  const l = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM config WHERE chave = ?', chave);
  return l?.valor ?? null;
}

export async function salvarConfig(db: Banco, chave: string, valor: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
    chave, valor,
  );
}

// Perfil

type PerfilLinha = {
  sexo: Perfil['sexo'];
  idade: number;
  altura_cm: number;
  peso_kg: number;
  atividade: Perfil['atividade'];
  objetivo: Perfil['objetivo'];
  meta_manual: number | null;
};

export async function lerPerfil(db: Banco): Promise<Perfil | null> {
  const l = await db.getFirstAsync<PerfilLinha>('SELECT * FROM perfil WHERE id = 1');
  if (!l) return null;
  return {
    sexo: l.sexo,
    idade: l.idade,
    alturaCm: l.altura_cm,
    pesoKg: l.peso_kg,
    atividade: l.atividade,
    objetivo: l.objetivo,
    metaManual: l.meta_manual,
  };
}

export async function salvarPerfil(db: Banco, p: Perfil): Promise<void> {
  await db.runAsync(
    `INSERT INTO perfil (id, sexo, idade, altura_cm, peso_kg, atividade, objetivo, meta_manual)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       sexo = excluded.sexo, idade = excluded.idade, altura_cm = excluded.altura_cm,
       peso_kg = excluded.peso_kg, atividade = excluded.atividade,
       objetivo = excluded.objetivo, meta_manual = excluded.meta_manual`,
    p.sexo, p.idade, p.alturaCm, p.pesoKg, p.atividade, p.objetivo, p.metaManual,
  );
}

// Alimentos personalizados

export async function listarPersonalizados(db: Banco): Promise<Alimento[]> {
  const linhas = await db.getAllAsync<Omit<Alimento, 'origem' | 'categoria'>>(
    'SELECT id, nome, kcal, proteina, carboidrato, gordura FROM alimentos_personalizados ORDER BY nome',
  );
  return linhas.map((l) => ({ ...l, origem: 'custom', categoria: 'Meus alimentos' }));
}

export async function criarPersonalizado(
  db: Banco,
  a: Macros & { nome: string },
): Promise<Alimento> {
  const r = await db.runAsync(
    'INSERT INTO alimentos_personalizados (nome, kcal, proteina, carboidrato, gordura) VALUES (?, ?, ?, ?, ?)',
    a.nome, a.kcal, a.proteina, a.carboidrato, a.gordura,
  );
  return { ...a, id: r.lastInsertRowId, origem: 'custom', categoria: 'Meus alimentos' };
}

// Registros

export type Registro = Macros & {
  id: number;
  data: string;
  refeicao: Refeicao;
  origem: Origem;
  alimentoId: number;
  nome: string;
  gramas: number;
};

type RegistroLinha = Omit<Registro, 'alimentoId'> & { alimento_id: number };

export async function listarRegistros(db: Banco, data: string): Promise<Registro[]> {
  const linhas = await db.getAllAsync<RegistroLinha>(
    `SELECT id, data, refeicao, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura
     FROM registros WHERE data = ? ORDER BY id`,
    data,
  );
  return linhas.map(({ alimento_id, ...l }) => ({ ...l, alimentoId: alimento_id }));
}

export async function registrar(
  db: Banco,
  data: string,
  refeicao: Refeicao,
  alimento: Alimento,
  gramas: number,
): Promise<void> {
  const m = porcao(alimento, gramas);
  await db.runAsync(
    `INSERT INTO registros (data, refeicao, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data, refeicao, alimento.origem, alimento.id, alimento.nome, gramas,
    m.kcal, m.proteina, m.carboidrato, m.gordura,
  );
}

export async function removerRegistro(db: Banco, id: number): Promise<void> {
  await db.runAsync('DELETE FROM registros WHERE id = ?', id);
}

/** Desfaz uma remoção: grava o registro de volta com o mesmo id. */
export async function restaurarRegistro(db: Banco, r: Registro): Promise<void> {
  await db.runAsync(
    `INSERT INTO registros (id, data, refeicao, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.id, r.data, r.refeicao, r.origem, r.alimentoId, r.nome, r.gramas, r.kcal, r.proteina, r.carboidrato, r.gordura,
  );
}

/** Copia os itens de uma refeição de outro dia. Retorna quantos itens copiou. */
export async function repetirRefeicao(
  db: Banco,
  deData: string,
  paraData: string,
  refeicao: Refeicao,
): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO registros (data, refeicao, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura)
     SELECT ?, refeicao, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura
     FROM registros WHERE data = ? AND refeicao = ? ORDER BY id`,
    paraData, deData, refeicao,
  );
  return r.changes;
}

/** Último dia antes de `data` em que a refeição foi registrada. */
export async function ultimaDataDaRefeicao(
  db: Banco,
  data: string,
  refeicao: Refeicao,
): Promise<string | null> {
  const l = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM registros WHERE data < ? AND refeicao = ? ORDER BY data DESC LIMIT 1',
    data, refeicao,
  );
  return l?.data ?? null;
}

// Favoritos

export type Favorito = { origem: Origem; alimentoId: number; gramas: number };

export async function listarFavoritos(db: Banco): Promise<Favorito[]> {
  const linhas = await db.getAllAsync<{ origem: Origem; alimento_id: number; gramas: number }>(
    'SELECT origem, alimento_id, gramas FROM favoritos',
  );
  return linhas.map((l) => ({ origem: l.origem, alimentoId: l.alimento_id, gramas: l.gramas }));
}

export async function favoritar(db: Banco, a: Alimento, gramas: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO favoritos (origem, alimento_id, gramas) VALUES (?, ?, ?)
     ON CONFLICT (origem, alimento_id) DO UPDATE SET gramas = excluded.gramas`,
    a.origem, a.id, gramas,
  );
}

export async function desfavoritar(db: Banco, a: Pick<Alimento, 'origem' | 'id'>): Promise<void> {
  await db.runAsync('DELETE FROM favoritos WHERE origem = ? AND alimento_id = ?', a.origem, a.id);
}

/** Alimentos mais usados, para sugerir na tela de adicionar. */
export async function maisUsados(
  db: Banco,
  limite = 10,
): Promise<{ origem: Origem; alimentoId: number; gramas: number }[]> {
  const linhas = await db.getAllAsync<{ origem: Origem; alimento_id: number; gramas: number }>(
    `SELECT origem, alimento_id, gramas FROM registros r
     WHERE id = (SELECT MAX(id) FROM registros WHERE origem = r.origem AND alimento_id = r.alimento_id)
     ORDER BY (SELECT COUNT(*) FROM registros WHERE origem = r.origem AND alimento_id = r.alimento_id) DESC, id DESC
     LIMIT ?`,
    limite,
  );
  return linhas.map((l) => ({ origem: l.origem, alimentoId: l.alimento_id, gramas: l.gramas }));
}
