import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { BancoSqlJs } from './banco-web.ts';
import { decidir, exportar, importar, vazio, type Instantaneo } from './backup.ts';
import { migrar, registrar, registrarAgua, registrarExercicio, salvarConfig, salvarPerfil, salvarPrato, VERSAO } from './db.ts';
import type { Alimento } from './foods.ts';

async function bancoNovo() {
  const SQL = await initSqlJs();
  const db = new BancoSqlJs(new SQL.Database(), async () => {});
  await migrar(db);
  return db;
}

const arroz: Alimento = { origem: 'taco', id: 1, nome: 'Arroz', categoria: '', kcal: 128, proteina: 2.5, carboidrato: 28.1, gordura: 0.2 };

async function bancoComDados() {
  const db = await bancoNovo();
  await salvarPerfil(db, { sexo: 'masculino', idade: 25, alturaCm: 180, pesoKg: 80, atividade: 'leve', objetivo: 'manter', metaManual: null });
  await registrar(db, '2026-09-22', 'almoco', arroz, 150);
  await salvarPrato(db, { nome: 'PF', itens: [{ alimento: arroz, gramas: 200 }] });
  await registrarAgua(db, '2026-09-22', 500);
  await registrarExercicio(db, '2026-09-22', {
    tipo: 'musculacao', intensidade: 'moderado', minutos: 60, distanciaKm: null, kcal: 200,
  });
  await salvarConfig(db, 'tema', 'escuro');
  return db;
}

test('exportar e importar ida e volta preservam tudo', async () => {
  const origem = await bancoComDados();
  const inst = await exportar(origem);
  assert.equal(inst.versaoEsquema, VERSAO);

  // Passa pelo JSON, como na nuvem.
  const volta: Instantaneo = JSON.parse(JSON.stringify(inst));
  const destino = await bancoNovo();
  await registrar(destino, '2020-01-01', 'jantar', arroz, 10); // será substituído
  await importar(destino, volta);

  assert.deepEqual(await exportar(destino), inst);
});

test('importar ignora colunas desconhecidas e aceita tabelas ausentes', async () => {
  const db = await bancoNovo();
  await importar(db, {
    versaoEsquema: 1,
    tabelas: { config: [{ chave: 'tema', valor: 'claro', coluna_que_nao_existe: 'x' }] },
  });
  const inst = await exportar(db);
  assert.deepEqual(inst.tabelas.config, [{ chave: 'tema', valor: 'claro' }]);
  assert.equal(inst.tabelas.registros?.length, 0);
});

test('importar recusa backup de versão mais nova e não mexe nos dados', async () => {
  const db = await bancoComDados();
  const antes = await exportar(db);
  await assert.rejects(importar(db, { versaoEsquema: VERSAO + 1, tabelas: {} }));
  assert.deepEqual(await exportar(db), antes);
});

test('importar desfaz tudo se uma linha falhar', async () => {
  const db = await bancoComDados();
  const antes = await exportar(db);
  // registros.nome é NOT NULL
  await assert.rejects(importar(db, { versaoEsquema: VERSAO, tabelas: { registros: [{ data: '2026-01-01', nome: null }] } }));
  assert.deepEqual(await exportar(db), antes);
});

test('água e exercícios entram no backup', async () => {
  const inst = await exportar(await bancoComDados());
  assert.equal(inst.tabelas.agua?.length, 1);
  assert.equal(inst.tabelas.exercicios?.length, 1);
  assert.equal(inst.tabelas.exercicios?.[0].kcal, 200);

  const destino = await bancoNovo();
  await importar(destino, JSON.parse(JSON.stringify(inst)));
  assert.deepEqual(await exportar(destino), inst);
});

test('só água já conta como diário com dados', async () => {
  const db = await bancoNovo();
  await registrarAgua(db, '2026-09-22', 300);
  assert.equal(vazio(await exportar(db)), false);
});

test('vazio considera só dados do diário, não o tema', async () => {
  const db = await bancoNovo();
  await salvarConfig(db, 'tema', 'escuro');
  assert.equal(vazio(await exportar(db)), true);
  assert.equal(vazio(await exportar(await bancoComDados())), false);
  assert.equal(vazio(null), true);
});

test('decidir: enviar, restaurar ou perguntar', () => {
  assert.equal(decidir({ localVazio: true, nuvemVazia: true, jaSincronizou: false }), 'nada');
  assert.equal(decidir({ localVazio: false, nuvemVazia: true, jaSincronizou: false }), 'enviar');
  assert.equal(decidir({ localVazio: true, nuvemVazia: false, jaSincronizou: true }), 'perguntar');
  assert.equal(decidir({ localVazio: false, nuvemVazia: false, jaSincronizou: false }), 'perguntar');
  assert.equal(decidir({ localVazio: false, nuvemVazia: false, jaSincronizou: true }), 'enviar');
});
