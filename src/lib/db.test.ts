import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { BancoSqlJs } from './banco-web.ts';
import {
  apagarRotina,
  lerPerfil,
  lerPeso,
  lerRotina,
  listarDiasComRotina,
  listarAgua,
  listarExercicios,
  migrar,
  registrarExercicio,
  removerExercicio,
  restaurarExercicio,
  salvarPerfil,
  salvarPeso,
  salvarRotina,
  VERSAO,
} from './db.ts';
import type { Banco } from './banco-tipos.ts';

async function bancoVazio(): Promise<Banco> {
  const SQL = await initSqlJs();
  return new BancoSqlJs(new SQL.Database(), async () => {});
}

/** Banco como ficava na entrega 1.5: esquema na versão 3, com dados. */
async function bancoNaVersao3(): Promise<Banco> {
  const db = await bancoVazio();
  await db.execAsync(`
    CREATE TABLE perfil (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      sexo TEXT NOT NULL, idade INTEGER NOT NULL, altura_cm REAL NOT NULL, peso_kg REAL NOT NULL,
      atividade TEXT NOT NULL, objetivo TEXT NOT NULL, meta_manual INTEGER
    );
    CREATE TABLE alimentos_personalizados (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, kcal REAL NOT NULL,
      proteina REAL NOT NULL, carboidrato REAL NOT NULL, gordura REAL NOT NULL
    );
    CREATE TABLE registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, refeicao TEXT NOT NULL, origem TEXT NOT NULL,
      alimento_id INTEGER NOT NULL, nome TEXT NOT NULL, gramas REAL NOT NULL, kcal REAL NOT NULL,
      proteina REAL NOT NULL, carboidrato REAL NOT NULL, gordura REAL NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE favoritos (origem TEXT NOT NULL, alimento_id INTEGER NOT NULL, gramas REAL NOT NULL, PRIMARY KEY (origem, alimento_id));
    CREATE TABLE config (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);
    CREATE TABLE pratos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL);
    CREATE TABLE prato_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, prato_id INTEGER NOT NULL REFERENCES pratos (id) ON DELETE CASCADE,
      origem TEXT NOT NULL, alimento_id INTEGER NOT NULL, nome TEXT NOT NULL, gramas REAL NOT NULL,
      kcal REAL NOT NULL, proteina REAL NOT NULL, carboidrato REAL NOT NULL, gordura REAL NOT NULL
    );
    INSERT INTO perfil (id, sexo, idade, altura_cm, peso_kg, atividade, objetivo, meta_manual)
      VALUES (1, 'masculino', 25, 180, 80, 'leve', 'ganhar', NULL);
    INSERT INTO alimentos_personalizados (nome, kcal, proteina, carboidrato, gordura)
      VALUES ('Leite da caixinha', 60, 3, 4.8, 3.2);
    INSERT INTO registros (data, refeicao, origem, alimento_id, nome, gramas, kcal, proteina, carboidrato, gordura)
      VALUES ('2026-09-20', 'cafe', 'custom', 1, 'Leite da caixinha', 200, 120, 6, 9.6, 6.4);
    PRAGMA user_version = 3;
  `);
  return db;
}

test('migrar da versão 3 para a 4 mantém os dados e cria o que falta', async () => {
  const db = await bancoNaVersao3();
  await migrar(db);

  const versao = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  assert.equal(versao?.user_version, VERSAO);

  // Nada do que já existia se perde.
  const perfil = await lerPerfil(db);
  assert.equal(perfil?.pesoKg, 80);
  assert.equal(perfil?.objetivo, 'ganhar');
  const registros = await db.getAllAsync('SELECT id FROM registros');
  assert.equal(registros.length, 1);

  // As tabelas novas existem e a coluna do código de barras foi acrescentada.
  assert.deepEqual(await listarAgua(db, '2026-09-22'), []);
  const colunas = await db.getAllAsync<{ name: string }>('PRAGMA table_info(alimentos_personalizados)');
  assert.ok(colunas.some((c) => c.name === 'codigo_barras'));
});

test('migrar duas vezes não quebra nem apaga nada', async () => {
  const db = await bancoNaVersao3();
  await migrar(db);
  await migrar(db);
  assert.equal((await lerPerfil(db))?.pesoKg, 80);
});

test('banco novo já nasce na versão atual', async () => {
  const db = await bancoVazio();
  await migrar(db);
  const versao = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  assert.equal(versao?.user_version, VERSAO);
  assert.equal(await lerPerfil(db), null);
});

test('o peso é guardado sozinho, sem precisar do perfil completo', async () => {
  const db = await bancoVazio();
  await migrar(db);
  assert.equal(await lerPeso(db), null);

  await salvarPeso(db, 68);
  assert.equal(await lerPeso(db), 68);
  // Sem idade e altura ainda não há perfil, e isso não atrapalha a água nem os treinos.
  assert.equal(await lerPerfil(db), null);
});

test('salvar o perfil também atualiza o peso solto', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await salvarPeso(db, 68);
  await salvarPerfil(db, {
    sexo: 'masculino', idade: 25, alturaCm: 180, pesoKg: 82, atividade: 'leve', objetivo: 'manter', metaManual: null,
  });
  assert.equal(await lerPeso(db), 82);
});

test('quem já tinha perfil antes continua com peso, mesmo sem o valor em config', async () => {
  const db = await bancoNaVersao3();
  await migrar(db);
  assert.equal(await lerPeso(db), 80);
});

test('migrar para a versão 5 acrescenta o foco sem mexer nos treinos já gravados', async () => {
  const db = await bancoNaVersao3();
  await migrar(db);
  await db.runAsync(
    'INSERT INTO exercicios (data, tipo, intensidade, minutos, distancia_km, kcal, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
    '2026-09-22', 'musculacao', 'moderado', 60, null, 200, '2026-09-22 10:00:00',
  );
  await migrar(db);

  const treinos = await listarExercicios(db, '2026-09-22');
  assert.equal(treinos.length, 1);
  assert.equal(treinos[0].kcal, 200);
  assert.equal(treinos[0].foco, null);
});

test('treino detalhado grava, lê e remove os exercícios junto', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await registrarExercicio(db, '2026-09-23', {
    tipo: 'musculacao',
    intensidade: 'moderado',
    foco: null,
    minutos: 60,
    distanciaKm: null,
    kcal: 210,
    itens: [
      { catalogo: 'agachamento', nome: 'Agachamento livre', series: 4, repeticoes: 10, cargaKg: 80 },
      { catalogo: null, nome: 'Escada', series: 3, repeticoes: 12, cargaKg: null },
    ],
  });

  const treinos = await listarExercicios(db, '2026-09-23');
  assert.equal(treinos.length, 1);
  assert.deepEqual(treinos[0].itens?.map((i) => i.nome), ['Agachamento livre', 'Escada']);
  assert.equal(treinos[0].itens?.[0].cargaKg, 80);
  assert.equal(treinos[0].itens?.[1].catalogo, null);

  await removerExercicio(db, treinos[0].id);
  const sobrou = await db.getAllAsync('SELECT id FROM exercicio_itens');
  assert.equal(sobrou.length, 0);
});

test('desfazer a remoção traz o treino e os exercícios de volta', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await registrarExercicio(db, '2026-09-23', {
    tipo: 'musculacao',
    intensidade: 'moderado',
    foco: null,
    minutos: 45,
    distanciaKm: null,
    kcal: 180,
    itens: [{ catalogo: 'supino', nome: 'Supino reto', series: 3, repeticoes: 10, cargaKg: 60 }],
  });
  const [treino] = await listarExercicios(db, '2026-09-23');
  await removerExercicio(db, treino.id);
  await restaurarExercicio(db, treino);

  const [voltou] = await listarExercicios(db, '2026-09-23');
  assert.equal(voltou.id, treino.id);
  assert.deepEqual(voltou.itens, treino.itens);
});

test('treino sem lista de exercícios vem sem itens', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await registrarExercicio(db, '2026-09-23', {
    tipo: 'caminhada',
    intensidade: 'moderado',
    foco: null,
    minutos: 30,
    distanciaKm: null,
    kcal: 116,
  });
  const [treino] = await listarExercicios(db, '2026-09-23');
  assert.deepEqual(treino.itens, []);
});

test('rotina do dia da semana guarda, lê e troca', async () => {
  const db = await bancoVazio();
  await migrar(db);
  const segunda = [
    { catalogo: 'agachamento', nome: 'Agachamento livre', series: 4, repeticoes: 10, cargaKg: 80 },
    { catalogo: 'leg-press', nome: 'Leg press', series: 3, repeticoes: 12, cargaKg: 120 },
  ];
  await salvarRotina(db, 1, 60, segunda);

  const lida = await lerRotina(db, 1);
  assert.equal(lida?.minutos, 60);
  assert.deepEqual(lida?.itens, segunda);
  assert.deepEqual(await listarDiasComRotina(db), [1]);
  assert.equal(await lerRotina(db, 2), null);

  // Salvar de novo troca a rotina inteira, sem duplicar exercício.
  await salvarRotina(db, 1, 45, [segunda[0]]);
  const trocada = await lerRotina(db, 1);
  assert.equal(trocada?.itens.length, 1);
  assert.equal(trocada?.minutos, 45);
});

test('apagar rotina some com o dia da lista', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await salvarRotina(db, 3, 40, [{ catalogo: 'supino', nome: 'Supino reto', series: 3, repeticoes: 10, cargaKg: 60 }]);
  await apagarRotina(db, 3);
  assert.equal(await lerRotina(db, 3), null);
  assert.deepEqual(await listarDiasComRotina(db), []);
});

test('rotina sem exercício não é guardada', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await salvarRotina(db, 5, 30, []);
  assert.equal(await lerRotina(db, 5), null);
});

test('treino antigo continua depois de migrar para a versão 7', async () => {
  const db = await bancoNaVersao3();
  await migrar(db);
  await registrarExercicio(db, '2026-09-23', {
    tipo: 'musculacao',
    intensidade: 'moderado',
    foco: 'composto',
    minutos: 60,
    distanciaKm: null,
    kcal: 240,
  });
  await migrar(db);
  const [treino] = await listarExercicios(db, '2026-09-23');
  assert.equal(treino.kcal, 240);
  assert.deepEqual(await listarDiasComRotina(db), []);
});

test('versão 8: apagar treino leva os exercícios junto, pela chave estrangeira', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await registrarExercicio(db, '2026-09-23', {
    tipo: 'musculacao', intensidade: null, foco: null, minutos: 60, distanciaKm: null, kcal: 200,
    itens: [{ catalogo: 'supino', nome: 'Supino reto', series: 3, repeticoes: 10, cargaKg: 60 }],
  });
  const [treino] = await listarExercicios(db, '2026-09-23');

  await db.runAsync('DELETE FROM exercicios WHERE id = ?', treino.id);
  const sobrou = await db.getAllAsync('SELECT id FROM exercicio_itens');
  assert.equal(sobrou.length, 0);
});

test('versão 8: apagar a rotina leva os exercícios dela junto', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await salvarRotina(db, 2, 45, [
    { catalogo: 'agachamento', nome: 'Agachamento livre', series: 4, repeticoes: 10, cargaKg: 80 },
  ]);
  await db.runAsync('DELETE FROM rotinas WHERE dia_semana = ?', 2);
  const sobrou = await db.getAllAsync('SELECT id FROM rotina_itens');
  assert.equal(sobrou.length, 0);
});

test('versão 8: exercício com série zero não entra, e o treino não fica pela metade', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await assert.rejects(() =>
    registrarExercicio(db, '2026-09-23', {
      tipo: 'musculacao', intensidade: null, foco: null, minutos: 60, distanciaKm: null, kcal: 200,
      itens: [{ catalogo: 'supino', nome: 'Supino reto', series: 0, repeticoes: 10, cargaKg: 60 }],
    }),
  );
  // A transação desfez o treino junto com o exercício recusado.
  assert.deepEqual(await listarExercicios(db, '2026-09-23'), []);
});

test('versão 8: o peso mora só no perfil, e a chave antiga em config some', async () => {
  const db = await bancoNaVersao3();
  await migrar(db);
  await salvarPeso(db, 82);
  assert.equal(await lerPeso(db), 82);

  const emConfig = await db.getFirstAsync("SELECT valor FROM config WHERE chave = 'peso_kg'");
  assert.equal(emConfig, null);
  const noPerfil = await db.getFirstAsync<{ peso_kg: number }>('SELECT peso_kg FROM perfil WHERE id = 1');
  assert.equal(noPerfil?.peso_kg, 82);
});

test('versão 8: peso guardado em config numa versão antiga vai para o perfil', async () => {
  const db = await bancoVazio();
  await db.execAsync(`
    CREATE TABLE config (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);
    INSERT INTO config (chave, valor) VALUES ('peso_kg', '77.5');
    PRAGMA user_version = 7;
  `);
  // Antes da 8 o app criava as tabelas nas versões anteriores; aqui basta o que a 8 toca.
  await db.execAsync(`
    CREATE TABLE perfil (
      id INTEGER PRIMARY KEY CHECK (id = 1), sexo TEXT NOT NULL, idade INTEGER NOT NULL,
      altura_cm REAL NOT NULL, peso_kg REAL NOT NULL, atividade TEXT NOT NULL,
      objetivo TEXT NOT NULL, meta_manual INTEGER
    );
    CREATE TABLE pratos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL);
    CREATE TABLE prato_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, prato_id INTEGER NOT NULL, origem TEXT NOT NULL,
      alimento_id INTEGER NOT NULL, nome TEXT NOT NULL, gramas REAL NOT NULL, kcal REAL NOT NULL,
      proteina REAL NOT NULL, carboidrato REAL NOT NULL, gordura REAL NOT NULL
    );
    CREATE TABLE exercicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, tipo TEXT NOT NULL, intensidade TEXT,
      foco TEXT, minutos REAL, distancia_km REAL, kcal REAL NOT NULL, criado_em TEXT NOT NULL
    );
    CREATE TABLE exercicio_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, exercicio_id INTEGER NOT NULL, catalogo TEXT,
      nome TEXT NOT NULL, series INTEGER NOT NULL, repeticoes INTEGER NOT NULL, carga_kg REAL,
      ordem INTEGER NOT NULL
    );
    CREATE TABLE rotinas (dia_semana INTEGER PRIMARY KEY, minutos REAL, atualizado_em TEXT NOT NULL);
    CREATE TABLE rotina_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, dia_semana INTEGER NOT NULL, catalogo TEXT,
      nome TEXT NOT NULL, series INTEGER NOT NULL, repeticoes INTEGER NOT NULL, carga_kg REAL,
      ordem INTEGER NOT NULL
    );
    INSERT INTO exercicios (data, tipo, intensidade, foco, minutos, distancia_km, kcal, criado_em)
      VALUES ('2026-09-22', 'musculacao', 'moderado', NULL, 60, NULL, 240, '2026-09-22 10:00:00');
    INSERT INTO exercicio_itens (exercicio_id, catalogo, nome, series, repeticoes, carga_kg, ordem)
      VALUES (1, 'supino', 'Supino reto', 3, 10, 60, 0);
  `);

  await migrar(db);

  assert.equal(await lerPeso(db), 77.5);
  assert.equal(await db.getFirstAsync("SELECT valor FROM config WHERE chave = 'peso_kg'"), null);
  // O treino e o exercício dele continuam lá depois da tabela ser refeita.
  const [treino] = await listarExercicios(db, '2026-09-22');
  assert.equal(treino.kcal, 240);
  assert.deepEqual(treino.itens?.map((i) => i.nome), ['Supino reto']);
});

test('versão 8: perfil só com peso não vira perfil completo', async () => {
  const db = await bancoVazio();
  await migrar(db);
  await salvarPeso(db, 80);
  assert.equal(await lerPerfil(db), null);
  assert.equal(await lerPeso(db), 80);
});
