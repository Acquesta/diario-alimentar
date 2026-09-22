/** Valores aceitos como parâmetro de consulta. */
export type Parametro = string | number | null;

/**
 * O que o app usa de um banco SQLite. Cumprido pelo expo-sqlite (celular e web com OPFS)
 * e pelo plano B da web (sql.js salvo no IndexedDB). As consultas SQL são as mesmas nos dois.
 */
export interface Banco {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: Parametro[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, ...params: Parametro[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: Parametro[]): Promise<T[]>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

export type TipoArmazenamento = 'sqlite' | 'indexeddb';
