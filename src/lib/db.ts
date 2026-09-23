import type { Banco } from './banco-tipos';
import type { Alimento, Origem, Refeicao } from './foods';
import { porcao, type Macros, type Perfil } from './nutrition.ts';
import type { Foco, Intensidade, ItemTreino, TipoExercicio } from './exercicios.ts';
import { agora } from './dates.ts';

/** Todo acesso ao banco passa por aqui, para facilitar trocar o armazenamento se precisar. */

export const NOME_BANCO = 'diario.db';
export const VERSAO = 8;

export async function migrar(db: Banco): Promise<void> {
  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const atual = linha?.user_version ?? 0;
  if (atual >= VERSAO) return;

  // Refazer tabela com chave estrangeira pede a checagem desligada, e o PRAGMA
  // não vale dentro de transação. Volta a ligar no fim, junto com a versão nova.
  await db.execAsync('PRAGMA foreign_keys = OFF');

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

  if (atual < 4) {
    // Água e exercícios (entrega 2). O gasto do treino fica gravado no registro,
    // para o histórico não mudar se o peso do perfil mudar depois.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS agua (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        ml REAL NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_agua_data ON agua (data);
      CREATE TABLE IF NOT EXISTS exercicios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        tipo TEXT NOT NULL,
        intensidade TEXT,
        minutos REAL,
        distancia_km REAL,
        kcal REAL NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_exercicios_data ON exercicios (data);
    `);
    // Código de barras do produto, para reencontrar o alimento na próxima leitura.
    const colunas = await db.getAllAsync<{ name: string }>('PRAGMA table_info(alimentos_personalizados)');
    if (!colunas.some((c) => c.name === 'codigo_barras')) {
      await db.execAsync('ALTER TABLE alimentos_personalizados ADD COLUMN codigo_barras TEXT');
    }
  }

  if (atual < 5) {
    // Foco do treino de musculação (composto ou isolado), que muda o gasto.
    const colunas = await db.getAllAsync<{ name: string }>('PRAGMA table_info(exercicios)');
    if (!colunas.some((c) => c.name === 'foco')) {
      await db.execAsync('ALTER TABLE exercicios ADD COLUMN foco TEXT');
    }
  }

  if (atual < 6) {
    // Treino de musculação exercício a exercício, para o gasto sair mais fiel.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS exercicio_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercicio_id INTEGER NOT NULL,
        catalogo TEXT,
        nome TEXT NOT NULL,
        series INTEGER NOT NULL,
        repeticoes INTEGER NOT NULL,
        carga_kg REAL,
        ordem INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_exercicio_itens_treino ON exercicio_itens (exercicio_id);
    `);
  }

  if (atual < 7) {
    // Rotina de treino por dia da semana: cadastra a segunda uma vez e repete.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS rotinas (
        dia_semana INTEGER PRIMARY KEY CHECK (dia_semana BETWEEN 0 AND 6),
        minutos REAL,
        atualizado_em TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rotina_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dia_semana INTEGER NOT NULL,
        catalogo TEXT,
        nome TEXT NOT NULL,
        series INTEGER NOT NULL,
        repeticoes INTEGER NOT NULL,
        carga_kg REAL,
        ordem INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rotina_itens_dia ON rotina_itens (dia_semana);
    `);
  }

  if (atual < 8) {
    // Arrumo de casa no banco, antes que o app cresça mais:
    //  - chave estrangeira de verdade em quem é filho de outra tabela, com
    //    ON DELETE CASCADE, no lugar de apagar pai e filho na mão;
    //  - peso numa fonte só, dentro do perfil, que passa a aceitar campo vazio;
    //  - CHECK no que não pode ser zero.
    // Tabela antiga no SQLite não recebe chave estrangeira: precisa ser refeita.
    await db.execAsync('DELETE FROM exercicio_itens WHERE exercicio_id NOT IN (SELECT id FROM exercicios)');
    await db.execAsync('DELETE FROM rotina_itens WHERE dia_semana NOT IN (SELECT dia_semana FROM rotinas)');
    await db.execAsync('DELETE FROM prato_itens WHERE prato_id NOT IN (SELECT id FROM pratos)');

    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE exercicio_itens_novo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exercicio_id INTEGER NOT NULL REFERENCES exercicios (id) ON DELETE CASCADE,
          catalogo TEXT,
          nome TEXT NOT NULL,
          series INTEGER NOT NULL CHECK (series > 0),
          repeticoes INTEGER NOT NULL CHECK (repeticoes > 0),
          carga_kg REAL CHECK (carga_kg IS NULL OR carga_kg >= 0),
          ordem INTEGER NOT NULL
        );
        INSERT INTO exercicio_itens_novo (id, exercicio_id, catalogo, nome, series, repeticoes, carga_kg, ordem)
          SELECT id, exercicio_id, catalogo, nome, max(series, 1), max(repeticoes, 1),
                 CASE WHEN carga_kg >= 0 THEN carga_kg END, ordem
          FROM exercicio_itens;
        DROP TABLE exercicio_itens;
        ALTER TABLE exercicio_itens_novo RENAME TO exercicio_itens;
        CREATE INDEX IF NOT EXISTS idx_exercicio_itens_treino ON exercicio_itens (exercicio_id);

        CREATE TABLE rotina_itens_novo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dia_semana INTEGER NOT NULL REFERENCES rotinas (dia_semana) ON DELETE CASCADE,
          catalogo TEXT,
          nome TEXT NOT NULL,
          series INTEGER NOT NULL CHECK (series > 0),
          repeticoes INTEGER NOT NULL CHECK (repeticoes > 0),
          carga_kg REAL CHECK (carga_kg IS NULL OR carga_kg >= 0),
          ordem INTEGER NOT NULL
        );
        INSERT INTO rotina_itens_novo (id, dia_semana, catalogo, nome, series, repeticoes, carga_kg, ordem)
          SELECT id, dia_semana, catalogo, nome, max(series, 1), max(repeticoes, 1),
                 CASE WHEN carga_kg >= 0 THEN carga_kg END, ordem
          FROM rotina_itens;
        DROP TABLE rotina_itens;
        ALTER TABLE rotina_itens_novo RENAME TO rotina_itens;
        CREATE INDEX IF NOT EXISTS idx_rotina_itens_dia ON rotina_itens (dia_semana);

        CREATE TABLE prato_itens_novo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prato_id INTEGER NOT NULL REFERENCES pratos (id) ON DELETE CASCADE,
          origem TEXT NOT NULL,
          alimento_id INTEGER NOT NULL,
          nome TEXT NOT NULL,
          gramas REAL NOT NULL CHECK (gramas > 0),
          kcal REAL NOT NULL,
          proteina REAL NOT NULL,
          carboidrato REAL NOT NULL,
          gordura REAL NOT NULL
        );
        INSERT INTO prato_itens_novo (id, prato_id, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura)
          SELECT id, prato_id, origem, alimento_id, nome, max(gramas, 0.1), kcal, proteina, carboidrato, gordura
          FROM prato_itens;
        DROP TABLE prato_itens;
        ALTER TABLE prato_itens_novo RENAME TO prato_itens;
        CREATE INDEX IF NOT EXISTS idx_prato_itens_prato ON prato_itens (prato_id);

        CREATE TABLE perfil_novo (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          sexo TEXT,
          idade INTEGER,
          altura_cm REAL,
          peso_kg REAL CHECK (peso_kg IS NULL OR peso_kg > 0),
          atividade TEXT,
          objetivo TEXT,
          meta_manual INTEGER
        );
        INSERT INTO perfil_novo (id, sexo, idade, altura_cm, peso_kg, atividade, objetivo, meta_manual)
          SELECT id, sexo, idade, altura_cm, peso_kg, atividade, objetivo, meta_manual FROM perfil;
        DROP TABLE perfil;
        ALTER TABLE perfil_novo RENAME TO perfil;
      `);

      // O peso morava também em `config`. Fica só no perfil, e a chave sai.
      const guardado = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM config WHERE chave = 'peso_kg'",
      );
      const peso = Number(guardado?.valor);
      if (Number.isFinite(peso) && peso > 0) {
        await db.runAsync(
          `INSERT INTO perfil (id, peso_kg) VALUES (1, ?)
           ON CONFLICT (id) DO UPDATE SET peso_kg = excluded.peso_kg`,
          peso,
        );
      }
      await db.execAsync("DELETE FROM config WHERE chave = 'peso_kg'");
    });
  }

  await db.execAsync(`PRAGMA user_version = ${VERSAO}`);
  await db.execAsync('PRAGMA foreign_keys = ON');
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

// Peso

/**
 * O peso mora no perfil, e só lá. As outras colunas do perfil aceitam vazio,
 * então água e exercícios funcionam com o peso sozinho, sem exigir idade e
 * altura, que só servem para calcular a meta de calorias.
 */
export async function salvarPeso(db: Banco, pesoKg: number): Promise<void> {
  await db.runAsync(
    'INSERT INTO perfil (id, peso_kg) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET peso_kg = excluded.peso_kg',
    pesoKg,
  );
}

export async function lerPeso(db: Banco): Promise<number | null> {
  const linha = await db.getFirstAsync<{ peso_kg: number | null }>('SELECT peso_kg FROM perfil WHERE id = 1');
  return linha?.peso_kg && linha.peso_kg > 0 ? linha.peso_kg : null;
}

// Perfil

type PerfilLinha = {
  sexo: Perfil['sexo'] | null;
  idade: number | null;
  altura_cm: number | null;
  peso_kg: number | null;
  atividade: Perfil['atividade'] | null;
  objetivo: Perfil['objetivo'] | null;
  meta_manual: number | null;
};

export async function lerPerfil(db: Banco): Promise<Perfil | null> {
  const l = await db.getFirstAsync<PerfilLinha>('SELECT * FROM perfil WHERE id = 1');
  // A linha pode existir só com o peso, gravado pela aba Água ou Exercícios.
  if (!l || !l.sexo || !l.idade || !l.altura_cm || !l.peso_kg || !l.atividade || !l.objetivo) return null;
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
  a: Macros & { nome: string; codigoBarras?: string | null },
): Promise<Alimento> {
  const r = await db.runAsync(
    'INSERT INTO alimentos_personalizados (nome, kcal, proteina, carboidrato, gordura, codigo_barras) VALUES (?, ?, ?, ?, ?, ?)',
    a.nome, a.kcal, a.proteina, a.carboidrato, a.gordura, a.codigoBarras ?? null,
  );
  return { ...a, id: r.lastInsertRowId, origem: 'custom', categoria: 'Meus alimentos' };
}

/** Alimento já cadastrado com este código de barras, para não pedir os valores de novo. */
export async function personalizadoPorCodigo(db: Banco, codigo: string): Promise<Alimento | null> {
  const l = await db.getFirstAsync<Omit<Alimento, 'origem' | 'categoria'>>(
    'SELECT id, nome, kcal, proteina, carboidrato, gordura FROM alimentos_personalizados WHERE codigo_barras = ?',
    codigo,
  );
  return l ? { ...l, origem: 'custom', categoria: 'Meus alimentos' } : null;
}

// Água

export type RegistroAgua = { id: number; data: string; ml: number; criado_em: string };

export async function listarAgua(db: Banco, data: string): Promise<RegistroAgua[]> {
  return db.getAllAsync<RegistroAgua>(
    'SELECT id, data, ml, criado_em FROM agua WHERE data = ? ORDER BY id',
    data,
  );
}

export async function registrarAgua(db: Banco, data: string, ml: number): Promise<void> {
  // A hora fica no fuso do aparelho; o datetime('now') do SQLite grava em UTC.
  await db.runAsync('INSERT INTO agua (data, ml, criado_em) VALUES (?, ?, ?)', data, ml, agora());
}

export async function removerAgua(db: Banco, id: number): Promise<void> {
  await db.runAsync('DELETE FROM agua WHERE id = ?', id);
}

/** Desfaz uma remoção: grava o registro de volta com o mesmo id. */
export async function restaurarAgua(db: Banco, r: RegistroAgua): Promise<void> {
  await db.runAsync(
    'INSERT INTO agua (id, data, ml, criado_em) VALUES (?, ?, ?, ?)',
    r.id, r.data, r.ml, r.criado_em,
  );
}

// Exercícios

export type RegistroExercicio = {
  id: number;
  data: string;
  tipo: TipoExercicio;
  intensidade: Intensidade | null;
  foco: Foco | null;
  minutos: number | null;
  distancia_km: number | null;
  kcal: number;
  criado_em: string;
  /** Exercícios do treino, quando foi registrado em detalhe. */
  itens?: ItemTreino[];
};

export async function listarExercicios(db: Banco, data: string): Promise<RegistroExercicio[]> {
  const treinos = await db.getAllAsync<RegistroExercicio>(
    'SELECT id, data, tipo, intensidade, foco, minutos, distancia_km, kcal, criado_em FROM exercicios WHERE data = ? ORDER BY id',
    data,
  );
  if (treinos.length === 0) return treinos;

  // Uma consulta só para os itens do dia; cada treino recebe os seus.
  const marcas = treinos.map(() => '?').join(', ');
  const itens = await db.getAllAsync<LinhaItemTreino>(
    `SELECT exercicio_id, catalogo, nome, series, repeticoes, carga_kg FROM exercicio_itens
     WHERE exercicio_id IN (${marcas}) ORDER BY exercicio_id, ordem`,
    ...treinos.map((t) => t.id),
  );
  return treinos.map((t) => ({
    ...t,
    itens: itens.filter((i) => i.exercicio_id === t.id).map(itemDaLinha),
  }));
}

type LinhaItemTreino = {
  exercicio_id: number;
  catalogo: string | null;
  nome: string;
  series: number;
  repeticoes: number;
  carga_kg: number | null;
};

const itemDaLinha = (l: LinhaItemTreino): ItemTreino => ({
  catalogo: l.catalogo,
  nome: l.nome,
  series: l.series,
  repeticoes: l.repeticoes,
  cargaKg: l.carga_kg,
});

async function gravarItens(db: Banco, exercicioId: number, itens: ItemTreino[]): Promise<void> {
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    await db.runAsync(
      'INSERT INTO exercicio_itens (exercicio_id, catalogo, nome, series, repeticoes, carga_kg, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)',
      exercicioId, item.catalogo, item.nome, item.series, item.repeticoes, item.cargaKg, i,
    );
  }
}

export async function registrarExercicio(
  db: Banco,
  data: string,
  e: {
    tipo: TipoExercicio;
    intensidade: Intensidade | null;
    foco: Foco | null;
    minutos: number | null;
    distanciaKm: number | null;
    kcal: number;
    itens?: ItemTreino[];
  },
): Promise<void> {
  // Treino e exercícios entram juntos: ou grava tudo, ou não grava nada.
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      'INSERT INTO exercicios (data, tipo, intensidade, foco, minutos, distancia_km, kcal, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      data, e.tipo, e.intensidade, e.foco, e.minutos, e.distanciaKm, e.kcal, agora(),
    );
    if (e.itens && e.itens.length > 0) await gravarItens(db, r.lastInsertRowId, e.itens);
  });
}

export async function removerExercicio(db: Banco, id: number): Promise<void> {
  // Os exercícios do treino saem junto, pelo ON DELETE CASCADE.
  await db.runAsync('DELETE FROM exercicios WHERE id = ?', id);
}

/** Desfaz uma remoção: grava o registro de volta com o mesmo id e os exercícios. */
export async function restaurarExercicio(db: Banco, r: RegistroExercicio): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO exercicios (id, data, tipo, intensidade, foco, minutos, distancia_km, kcal, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      r.id, r.data, r.tipo, r.intensidade, r.foco, r.minutos, r.distancia_km, r.kcal, r.criado_em,
    );
    if (r.itens && r.itens.length > 0) await gravarItens(db, r.id, r.itens);
  });
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

// Rotina de treino por dia da semana

export type Rotina = {
  diaSemana: number;
  minutos: number | null;
  itens: ItemTreino[];
};

/** Guarda (ou troca) a rotina daquele dia da semana. */
export async function salvarRotina(
  db: Banco,
  diaSemana: number,
  minutos: number | null,
  itens: ItemTreino[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Apagar a rotina leva os exercícios dela junto, pelo ON DELETE CASCADE.
    await db.runAsync('DELETE FROM rotinas WHERE dia_semana = ?', diaSemana);
    if (itens.length === 0) return;

    await db.runAsync(
      'INSERT INTO rotinas (dia_semana, minutos, atualizado_em) VALUES (?, ?, ?)',
      diaSemana, minutos, agora(),
    );
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      await db.runAsync(
        'INSERT INTO rotina_itens (dia_semana, catalogo, nome, series, repeticoes, carga_kg, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)',
        diaSemana, item.catalogo, item.nome, item.series, item.repeticoes, item.cargaKg, i,
      );
    }
  });
}

export async function lerRotina(db: Banco, diaSemana: number): Promise<Rotina | null> {
  const cabeca = await db.getFirstAsync<{ dia_semana: number; minutos: number | null }>(
    'SELECT dia_semana, minutos FROM rotinas WHERE dia_semana = ?',
    diaSemana,
  );
  if (!cabeca) return null;
  const itens = await db.getAllAsync<LinhaItemRotina>(
    'SELECT catalogo, nome, series, repeticoes, carga_kg FROM rotina_itens WHERE dia_semana = ? ORDER BY ordem',
    diaSemana,
  );
  return { diaSemana, minutos: cabeca.minutos, itens: itens.map(itemDaRotina) };
}

/** Em quais dias da semana já existe rotina, para a tela mostrar os atalhos. */
export async function listarDiasComRotina(db: Banco): Promise<number[]> {
  const linhas = await db.getAllAsync<{ dia_semana: number }>(
    'SELECT dia_semana FROM rotinas ORDER BY dia_semana',
  );
  return linhas.map((l) => l.dia_semana);
}

export async function apagarRotina(db: Banco, diaSemana: number): Promise<void> {
  await salvarRotina(db, diaSemana, null, []);
}

type LinhaItemRotina = {
  catalogo: string | null;
  nome: string;
  series: number;
  repeticoes: number;
  carga_kg: number | null;
};

const itemDaRotina = (l: LinhaItemRotina): ItemTreino => ({
  catalogo: l.catalogo,
  nome: l.nome,
  series: l.series,
  repeticoes: l.repeticoes,
  cargaKg: l.carga_kg,
});
