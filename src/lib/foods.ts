import taco from '@/data/taco.json';
import type { Macros } from './nutrition';

export type Origem = 'taco' | 'custom';

/** Alimento com valores por 100 g. */
export type Alimento = Macros & {
  origem: Origem;
  id: number;
  nome: string;
  categoria: string;
};

type TacoJson = {
  id: number;
  nome: string;
  categoria: string;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
};

export const ALIMENTOS_TACO: Alimento[] = (taco as TacoJson[]).map((a) => ({
  origem: 'taco',
  id: a.id,
  nome: a.nome,
  categoria: a.categoria,
  kcal: a.kcal,
  proteina: a.proteina,
  carboidrato: a.carboidrato,
  gordura: a.gordura,
}));

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
