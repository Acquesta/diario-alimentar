/** Datas no formato YYYY-MM-DD, sempre no fuso local do aparelho. */

export function hoje(): string {
  return formatar(new Date());
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number);
  return formatar(new Date(a, m - 1, d + dias));
}

export function rotulo(data: string): string {
  if (data === hoje()) return 'Hoje';
  if (data === somarDias(hoje(), -1)) return 'Ontem';
  if (data === somarDias(hoje(), 1)) return 'Amanhã';
  const [a, m, d] = data.split('-').map(Number);
  const texto = new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatar(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
