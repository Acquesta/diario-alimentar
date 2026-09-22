export type Sexo = 'masculino' | 'feminino';
export type Atividade = 'sedentario' | 'leve' | 'moderado' | 'intenso' | 'muito_intenso';
export type Objetivo = 'emagrecer' | 'manter' | 'ganhar';

export type Perfil = {
  sexo: Sexo;
  idade: number;
  alturaCm: number;
  pesoKg: number;
  atividade: Atividade;
  objetivo: Objetivo;
  /** Meta digitada pelo usuário. Quando existe, substitui a meta calculada. */
  metaManual: number | null;
};

export type Macros = {
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
};

export const FATOR_ATIVIDADE: Record<Atividade, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muito_intenso: 1.9,
};

const AJUSTE_OBJETIVO: Record<Objetivo, number> = {
  emagrecer: -500,
  manter: 0,
  ganhar: 300,
};

/** Proteína em g por kg de peso corporal, conforme o objetivo. */
const PROTEINA_POR_KG: Record<Objetivo, number> = {
  emagrecer: 1.8,
  manter: 1.6,
  ganhar: 1.8,
};

/** Fração das calorias vinda de gordura. */
const FRACAO_GORDURA = 0.25;

/** Menor meta aceita, para não sugerir dietas muito restritivas. */
const META_MINIMA: Record<Sexo, number> = {
  masculino: 1500,
  feminino: 1200,
};

/** Taxa metabólica basal pela equação de Mifflin-St Jeor. */
export function taxaMetabolicaBasal(p: Pick<Perfil, 'sexo' | 'idade' | 'alturaCm' | 'pesoKg'>): number {
  const base = 10 * p.pesoKg + 6.25 * p.alturaCm - 5 * p.idade;
  return base + (p.sexo === 'masculino' ? 5 : -161);
}

/** Gasto energético total estimado por dia. */
export function gastoDiario(p: Perfil): number {
  return taxaMetabolicaBasal(p) * FATOR_ATIVIDADE[p.atividade];
}

export function metaCalculada(p: Perfil): number {
  const meta = gastoDiario(p) + AJUSTE_OBJETIVO[p.objetivo];
  return arredondar(Math.max(meta, META_MINIMA[p.sexo]), 10);
}

/**
 * Meta do dia. `kcalExercicio` é o gasto líquido dos treinos do dia, que entra
 * como calorias a mais para comer: meta de hoje = base + exercício.
 */
export function metaDiaria(p: Perfil, kcalExercicio = 0): Macros {
  const kcal = (p.metaManual ?? metaCalculada(p)) + Math.max(0, Math.round(kcalExercicio));
  const proteina = Math.round(p.pesoKg * PROTEINA_POR_KG[p.objetivo]);
  const gordura = Math.round((kcal * FRACAO_GORDURA) / 9);
  const carboidrato = Math.max(0, Math.round((kcal - proteina * 4 - gordura * 9) / 4));
  return { kcal, proteina, carboidrato, gordura };
}

/** Meta de água do dia em ml: 35 ml por kg, arredondada para 100 ml. */
export function metaAgua(p: Pick<Perfil, 'pesoKg'>): number {
  return arredondar(35 * p.pesoKg, 100);
}

/** Valores de uma porção a partir dos valores por 100 g. */
export function porcao(por100g: Macros, gramas: number): Macros {
  const f = gramas / 100;
  return {
    kcal: Math.round(por100g.kcal * f),
    proteina: umaCasa(por100g.proteina * f),
    carboidrato: umaCasa(por100g.carboidrato * f),
    gordura: umaCasa(por100g.gordura * f),
  };
}

export function somar(itens: Macros[]): Macros {
  const total = itens.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteina: acc.proteina + m.proteina,
      carboidrato: acc.carboidrato + m.carboidrato,
      gordura: acc.gordura + m.gordura,
    }),
    { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0 },
  );
  return {
    kcal: Math.round(total.kcal),
    proteina: umaCasa(total.proteina),
    carboidrato: umaCasa(total.carboidrato),
    gordura: umaCasa(total.gordura),
  };
}

function umaCasa(n: number): number {
  return Math.round(n * 10) / 10;
}

function arredondar(n: number, passo: number): number {
  return Math.round(n / passo) * passo;
}
