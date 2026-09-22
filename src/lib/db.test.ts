import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { BancoSqlJs } from './banco-web.ts';
import { lerPerfil, listarAgua, migrar, VERSAO } from './db.ts';
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
