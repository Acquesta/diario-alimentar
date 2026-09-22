import type { Alimento } from './foods.ts';

/**
 * Produtos de embalagem pelo código de barras, no Open Food Facts.
 * A base é colaborativa: produto sem calorias existe e é tratado como não encontrado.
 */

const URL_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const CAMPOS = 'product_name,product_name_pt,generic_name,brands,nutriments';
const LIMITE_MS = 8000;
/** O Open Food Facts pede um User-Agent que identifique o app. */
const USER_AGENT = 'DiarioAlimentar/1.0 (app pessoal)';

export type Produto = {
  codigo: string;
  nome: string;
  marca: string | null;
  /** Valores por 100 g ou 100 ml. */
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
};

export type Resposta =
  | { tipo: 'achado'; produto: Produto }
  | { tipo: 'sem-dados' }
  | { tipo: 'nao-encontrado' }
  | { tipo: 'sem-internet' };

export async function buscarPorCodigo(codigo: string, limiteMs = LIMITE_MS): Promise<Resposta> {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), limiteMs);
  try {
    const r = await fetch(`${URL_BASE}/${encodeURIComponent(codigo)}.json?fields=${CAMPOS}`, {
      signal: controle.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (r.status === 404) return { tipo: 'nao-encontrado' };
    if (!r.ok) return { tipo: 'sem-internet' };
    return converter(codigo, await r.json());
  } catch {
    return { tipo: 'sem-internet' };
  } finally {
    clearTimeout(t);
  }
}

/** Converte a resposta da API em produto. Separado da rede para poder testar. */
export function converter(codigo: string, json: unknown): Resposta {
  const corpo = json as { status?: number; product?: Record<string, unknown> } | null;
  const p = corpo?.product;
  if (!p || corpo?.status === 0) return { tipo: 'nao-encontrado' };

  const nome = texto(p.product_name_pt) ?? texto(p.product_name) ?? texto(p.generic_name);
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kcal = numero(n['energy-kcal_100g']) ?? kcalDeKj(numero(n.energy_100g));
  if (!nome || kcal === null || kcal <= 0) return { tipo: 'sem-dados' };

  return {
    tipo: 'achado',
    produto: {
      codigo,
      nome,
      marca: texto(p.brands)?.split(',')[0]?.trim() ?? null,
      kcal: Math.round(kcal),
      proteina: umaCasa(numero(n.proteins_100g) ?? 0),
      carboidrato: umaCasa(numero(n.carbohydrates_100g) ?? 0),
      gordura: umaCasa(numero(n.fat_100g) ?? 0),
    },
  };
}

/** Nome mostrado na lista de alimentos: produto e marca. */
export function alimentoDoProduto(produto: Produto, id: number): Alimento {
  return {
    origem: 'custom',
    id,
    nome: produto.marca ? `${produto.nome} (${produto.marca})` : produto.nome,
    categoria: 'Meus alimentos',
    kcal: produto.kcal,
    proteina: produto.proteina,
    carboidrato: produto.carboidrato,
    gordura: produto.gordura,
  };
}

/** Código de barras de produto: EAN-13, EAN-8 ou UPC-A. */
export function codigoValido(codigo: string): boolean {
  return /^\d{8}$|^\d{12,13}$/.test(codigo.trim());
}

function kcalDeKj(kj: number | null): number | null {
  return kj === null ? null : kj / 4.184;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function numero(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function umaCasa(n: number): number {
  return Math.round(n * 10) / 10;
}
