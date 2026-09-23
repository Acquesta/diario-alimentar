import pof from '@/data/pof.json';
import taco from '@/data/taco.json';
import type { Macros } from './nutrition';

/**
 * De onde vem o alimento:
 * - `taco`: tabela TACO (NEPA/UNICAMP), ingredientes crus e cozidos simples.
 * - `pof`: tabela do IBGE (POF 2008-2009), comida como ela é comida.
 * - `custom`: cadastrado no aparelho, inclusive produto vindo do Open Food Facts.
 */
export type Origem = 'taco' | 'pof' | 'custom';

/** O que cada origem quer dizer na tela. */
export const NOME_ORIGEM: Record<Origem, string> = {
  taco: 'TACO',
  pof: 'Prato pronto',
  custom: 'Meus alimentos',
};

/** Alimento com valores por 100 g. */
export type Alimento = Macros & {
  origem: Origem;
  id: number;
  nome: string;
  categoria: string;
};

type TabelaJson = {
  id: number;
  nome: string;
  categoria: string;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
};

function daTabela(linhas: TabelaJson[], origem: Origem): Alimento[] {
  return linhas.map((a) => ({
    origem,
    id: a.id,
    nome: a.nome,
    categoria: a.categoria,
    kcal: a.kcal,
    proteina: a.proteina,
    carboidrato: a.carboidrato,
    gordura: a.gordura,
  }));
}

export const ALIMENTOS_TACO: Alimento[] = daTabela(taco as TabelaJson[], 'taco');

/** Comida preparada, da tabela do IBGE: feijoada, coxinha, pão com manteiga. */
export const ALIMENTOS_POF: Alimento[] = daTabela(pof as TabelaJson[], 'pof');

/**
 * As duas tabelas juntas, na ordem em que a busca deve considerá-las.
 * A POF vem primeiro porque descreve o prato pronto, que é o que se come.
 */
export const ALIMENTOS_BASE: Alimento[] = [...ALIMENTOS_POF, ...ALIMENTOS_TACO];

export function chave(a: Pick<Alimento, 'origem' | 'id'>): string {
  return `${a.origem}:${a.id}`;
}

export const REFEICOES = [
  { id: 'cafe', nome: 'Café da manhã' },
  { id: 'almoco', nome: 'Almoço' },
  { id: 'lanche', nome: 'Lanche' },
  { id: 'jantar', nome: 'Jantar' },
] as const;

export type Refeicao = (typeof REFEICOES)[number]['id'];

export function nomeRefeicao(id: string): string {
  return REFEICOES.find((r) => r.id === id)?.nome ?? id;
}
