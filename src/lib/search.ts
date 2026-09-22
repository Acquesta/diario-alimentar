/** Minúsculas e sem acento, para "pao" achar "Pão". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra itens cujo nome contém todos os termos da busca, em qualquer ordem.
 * Ordena por relevância: nome que começa com o primeiro termo vem antes, depois nome mais curto.
 */
export function buscar<T extends { nome: string }>(itens: T[], consulta: string, limite = 50): T[] {
  const termos = normalizar(consulta).split(/[\s,]+/).filter(Boolean);
  if (termos.length === 0) return [];

  const achados: { item: T; nome: string }[] = [];
  for (const item of itens) {
    const nome = normalizar(item.nome);
    if (termos.every((t) => nome.includes(t))) achados.push({ item, nome });
  }

  const primeiro = termos[0];
  achados.sort((a, b) => {
    const ia = a.nome.startsWith(primeiro) ? 0 : 1;
    const ib = b.nome.startsWith(primeiro) ? 0 : 1;
    return ia - ib || a.nome.length - b.nome.length;
  });

  return achados.slice(0, limite).map((a) => a.item);
}
