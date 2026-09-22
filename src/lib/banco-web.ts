import type { Database, InitSqlJsStatic, SqlJsStatic } from 'sql.js';
import type { Banco, Parametro } from './banco-tipos';

/**
 * Plano B da web: SQLite em WebAssembly (sql.js) rodando na página, sem worker e sem SharedArrayBuffer.
 * O banco inteiro fica em memória e é gravado no IndexedDB depois de cada alteração.
 * Serve para navegadores onde o expo-sqlite não abre (ex.: Safari sem isolamento de origem).
 */

const NOME_IDB = 'diario-alimentar';
const LOJA = 'bancos';
const ESPERA_GRAVAR_MS = 250;

export async function abrirBancoIndexedDb(nome: string): Promise<Banco> {
  const SQL = await carregarSqlJs();
  const bytes = await lerIdb(nome);
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  return new BancoSqlJs(db, (dados) => gravarIdb(nome, dados));
}

export class BancoSqlJs implements Banco {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private emTransacao = false;

  constructor(
    private readonly db: Database,
    private readonly persistir: (dados: Uint8Array) => Promise<void>,
  ) {
    if (typeof document !== 'undefined') {
      // Grava na hora se o app for para segundo plano, para não perder a última alteração.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.gravarAgora();
      });
    }
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
    this.agendarGravacao();
  }

  async runAsync(sql: string, ...params: Parametro[]) {
    this.db.run(sql, params);
    const changes = this.db.getRowsModified();
    const id = this.db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0];
    this.agendarGravacao();
    return { lastInsertRowId: Number(id ?? 0), changes };
  }

  async getAllAsync<T>(sql: string, ...params: Parametro[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const linhas: T[] = [];
      while (stmt.step()) linhas.push(stmt.getAsObject() as T);
      return linhas;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T>(sql: string, ...params: Parametro[]): Promise<T | null> {
    return (await this.getAllAsync<T>(sql, ...params))[0] ?? null;
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    // Transação aninhada vira parte da externa.
    if (this.emTransacao) return fn();
    this.emTransacao = true;
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    } finally {
      this.emTransacao = false;
      this.agendarGravacao();
    }
  }

  private agendarGravacao() {
    if (this.emTransacao) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.gravarAgora(), ESPERA_GRAVAR_MS);
  }

  private gravarAgora() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.persistir(this.db.export()).catch((e) => console.error('Falha ao gravar no IndexedDB', e));
  }
}

/** Carrega public/sqljs/sql-wasm.js fora do bundle (ele usa módulos do Node que o Metro não empacota). */
async function carregarSqlJs(): Promise<SqlJsStatic> {
  if (!('initSqlJs' in globalThis)) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/sqljs/sql-wasm.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Não foi possível carregar /sqljs/sql-wasm.js'));
      document.head.appendChild(script);
    });
  }
  const init = (globalThis as unknown as { initSqlJs: InitSqlJsStatic }).initSqlJs;
  return init({ locateFile: (arquivo) => `/sqljs/${arquivo}` });
}

function abrirIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME_IDB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function lerIdb(chave: string): Promise<Uint8Array | null> {
  const idb = await abrirIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(LOJA, 'readonly').objectStore(LOJA).get(chave);
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
    req.onerror = () => reject(req.error);
  });
}

async function gravarIdb(chave: string, dados: Uint8Array): Promise<void> {
  const idb = await abrirIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(LOJA, 'readwrite');
    tx.objectStore(LOJA).put(dados, chave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
