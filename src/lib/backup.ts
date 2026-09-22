import type { Banco, Parametro } from './banco-tipos';
import { VERSAO } from './db.ts';

/**
 * Cópia do banco local em JSON, para o backup na nuvem.
 * O SQLite do aparelho continua sendo o principal; isto só exporta e importa.
 */

/** Tabelas do diário, na ordem de inserção (pais antes dos filhos). */
export const TABELAS = [
  'perfil',
  'alimentos_personalizados',
  'registros',
  'favoritos',
  'config',
  'pratos',
  'prato_itens',
] as const;

export type Tabela = (typeof TABELAS)[number];
export type Linha = Record<string, Parametro>;
export type Instantaneo = { versaoEsquema: number; tabelas: Partial<Record<Tabela, Linha[]>> };

/** Tabelas que contam como "dados do diário". `config` (tema) sozinha não conta. */
const TABELAS_COM_DADOS: Tabela[] = ['perfil', 'alimentos_personalizados', 'registros', 'favoritos', 'pratos'];

export async function exportar(db: Banco): Promise<Instantaneo> {
  const tabelas: Instantaneo['tabelas'] = {};
  for (const t of TABELAS) {
    tabelas[t] = await db.getAllAsync<Linha>(`SELECT * FROM ${t} ORDER BY rowid`);
  }
  return { versaoEsquema: VERSAO, tabelas };
}

/**
 * Substitui todos os dados do aparelho pelos do instantâneo, numa transação.
 * Se algo falhar, nada muda. Colunas desconhecidas são ignoradas.
 */
export async function importar(db: Banco, inst: Instantaneo): Promise<void> {
  if (!inst || typeof inst.versaoEsquema !== 'number' || typeof inst.tabelas !== 'object') {
    throw new Error('Backup em formato inválido.');
  }
  if (inst.versaoEsquema > VERSAO) {
    throw new Error('Este backup é de uma versão mais nova do app. Atualize o app e tente de novo.');
  }

  const colunas = new Map<Tabela, Set<string>>();
  for (const t of TABELAS) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
    colunas.set(t, new Set(info.map((c) => c.name)));
  }

  await db.withTransactionAsync(async () => {
    for (const t of [...TABELAS].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABELAS) {
      const validas = colunas.get(t)!;
      for (const linha of inst.tabelas[t] ?? []) {
        const nomes = Object.keys(linha).filter((c) => validas.has(c));
        if (nomes.length === 0) continue;
        await db.runAsync(
          `INSERT INTO ${t} (${nomes.join(', ')}) VALUES (${nomes.map(() => '?').join(', ')})`,
          ...nomes.map((c) => linha[c] ?? null),
        );
      }
    }
  });
}

/** Verdadeiro se não há nada do diário (só tema ou nada). */
export function vazio(inst: Instantaneo | null | undefined): boolean {
  if (!inst) return true;
  return TABELAS_COM_DADOS.every((t) => (inst.tabelas[t]?.length ?? 0) === 0);
}

export type Acao = 'enviar' | 'perguntar' | 'nada';

/**
 * O que fazer ao sincronizar, para nunca apagar dados sem querer.
 * - Nuvem sem dados: envia o aparelho (se ele tiver algo).
 * - Nuvem com dados e aparelho vazio: pergunta se restaura.
 * - Nuvem com dados e este aparelho nunca sincronizou com esta conta: pergunta
 *   (pode ser um celular novo, com dados diferentes dos da nuvem).
 * - Senão: envia.
 */
export function decidir(p: { localVazio: boolean; nuvemVazia: boolean; jaSincronizou: boolean }): Acao {
  if (p.nuvemVazia) return p.localVazio ? 'nada' : 'enviar';
  if (p.localVazio || !p.jaSincronizou) return 'perguntar';
  return 'enviar';
}
