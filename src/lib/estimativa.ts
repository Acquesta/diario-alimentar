import type { Alimento } from './foods.ts';

/**
 * Estimativa de um prato a partir de uma foto.
 *
 * A Edge Function `estimar-foto` chama o Gemini e devolve os itens com a
 * quantidade e os valores da porção inteira. Aqui a resposta é conferida e
 * convertida para o formato que o resto do app usa, que é por 100 g.
 */

export type Confianca = 'alta' | 'media' | 'baixa';

export type ItemEstimado = {
  nome: string;
  gramas: number;
  /** Valores da porção inteira, como o modelo devolve. */
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  confianca: Confianca;
};

const numero = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const umaCasa = (n: number) => Math.round(n * 10) / 10;

/** Limites de sanidade: acima disso é erro do modelo, não comida. */
const MAX_GRAMAS = 3000;
const MAX_KCAL = 5000;

/**
 * Valida a resposta da função. Item sem nome, sem gramas ou sem caloria cai fora,
 * porque entraria no diário somando zero ou um número absurdo.
 */
export function lerEstimativa(corpo: unknown): ItemEstimado[] {
  const lista = (corpo as { itens?: unknown })?.itens;
  if (!Array.isArray(lista)) return [];

  const itens: ItemEstimado[] = [];
  for (const bruto of lista) {
    const i = bruto as Record<string, unknown>;
    const nome = typeof i.nome === 'string' ? i.nome.trim() : '';
    const gramas = Math.round(numero(i.gramas));
    const kcal = Math.round(numero(i.kcal));
    if (!nome || gramas <= 0 || gramas > MAX_GRAMAS || kcal <= 0 || kcal > MAX_KCAL) continue;

    itens.push({
      nome: nome.charAt(0).toUpperCase() + nome.slice(1),
      gramas,
      kcal,
      proteina: umaCasa(numero(i.proteina)),
      carboidrato: umaCasa(numero(i.carboidrato)),
      gordura: umaCasa(numero(i.gordura)),
      confianca: i.confianca === 'alta' || i.confianca === 'baixa' ? i.confianca : 'media',
    });
  }
  return itens;
}

/**
 * O app guarda alimento por 100 g; o modelo responde pela porção.
 * Esta conversão mantém o registro certo quando ele muda a quantidade depois.
 */
export function por100g(item: ItemEstimado): Omit<Alimento, 'origem' | 'id' | 'categoria'> {
  const f = item.gramas > 0 ? 100 / item.gramas : 0;
  return {
    nome: item.nome,
    kcal: Math.round(item.kcal * f),
    proteina: umaCasa(item.proteina * f),
    carboidrato: umaCasa(item.carboidrato * f),
    gordura: umaCasa(item.gordura * f),
  };
}

/** Total em kcal da lista, para a tela de conferência. */
export function totalKcal(itens: ItemEstimado[]): number {
  return Math.round(itens.reduce((soma, i) => soma + i.kcal, 0));
}

/** Recalcula as calorias e os macros quando ele corrige a quantidade. */
export function comGramas(item: ItemEstimado, gramas: number): ItemEstimado {
  if (!(item.gramas > 0) || !(gramas > 0)) return { ...item, gramas: Math.max(0, Math.round(gramas)) };
  const f = gramas / item.gramas;
  return {
    ...item,
    gramas: Math.round(gramas),
    kcal: Math.round(item.kcal * f),
    proteina: umaCasa(item.proteina * f),
    carboidrato: umaCasa(item.carboidrato * f),
    gordura: umaCasa(item.gordura * f),
  };
}

/** Como a tela descreve a confiança do modelo naquele item. */
export function rotuloConfianca(c: Confianca): string {
  return c === 'alta' ? 'estimativa mais segura' : c === 'baixa' ? 'chute' : 'estimativa';
}
