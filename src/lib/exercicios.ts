/**
 * Gasto de calorias dos treinos, sempre líquido.
 *
 * Líquido quer dizer sem o que o corpo gastaria parado no mesmo tempo, por isso o
 * `MET − 1`. O gasto de repouso já está na meta diária, vindo do nível de atividade
 * do perfil; sem esse desconto o treino contaria duas vezes.
 */

export type TipoExercicio = 'musculacao' | 'corrida' | 'caminhada' | 'bike' | 'outro';
export type Intensidade = 'moderado' | 'intenso';
/** O que o app pede na tela para cada tipo. */
export type Medida = 'tempo' | 'distancia' | 'kcal';

export const TIPOS: { id: TipoExercicio; nome: string; medida: Medida }[] = [
  { id: 'musculacao', nome: 'Musculação', medida: 'tempo' },
  { id: 'corrida', nome: 'Corrida', medida: 'distancia' },
  { id: 'caminhada', nome: 'Caminhada', medida: 'tempo' },
  { id: 'bike', nome: 'Bike', medida: 'tempo' },
  { id: 'outro', nome: 'Outro', medida: 'kcal' },
];

export const INTENSIDADES: { id: Intensidade; nome: string }[] = [
  { id: 'moderado', nome: 'Moderado' },
  { id: 'intenso', nome: 'Intenso' },
];

/**
 * METs do Compêndio de Atividades Físicas, por tipo e intensidade.
 * Moderado e intenso mudam junto com o ritmo: caminhar a 5,5 km/h é 4,3,
 * caminhar rápido ou em subida é 5,3; pedalar a 19 km/h é 6,8 e a 25 km/h é 10.
 */
const METS: Record<'musculacao' | 'caminhada' | 'bike', Record<Intensidade, number>> = {
  musculacao: { moderado: 3.5, intenso: 6.0 },
  caminhada: { moderado: 4.3, intenso: 5.3 },
  bike: { moderado: 6.8, intenso: 10.0 },
};

/** Corrida: cerca de 1 kcal por kg a cada km, já perto do valor líquido. */
const KCAL_POR_KG_POR_KM = 1;

export type Treino = {
  tipo: TipoExercicio;
  intensidade: Intensidade | null;
  minutos: number | null;
  distanciaKm: number | null;
  /** Só para o tipo "outro": o valor que a pessoa digitou. */
  kcal: number | null;
};

export function nomeTipo(tipo: TipoExercicio): string {
  return TIPOS.find((t) => t.id === tipo)?.nome ?? tipo;
}

export function medidaDoTipo(tipo: TipoExercicio): Medida {
  return TIPOS.find((t) => t.id === tipo)?.medida ?? 'kcal';
}

/** Calorias gastas no treino, arredondadas. Retorna 0 quando falta informação. */
export function gastoTreino(t: Treino, pesoKg: number): number {
  if (t.tipo === 'outro') return Math.max(0, Math.round(t.kcal ?? 0));
  if (!(pesoKg > 0)) return 0;

  if (t.tipo === 'corrida') {
    const km = t.distanciaKm ?? 0;
    return km > 0 ? Math.round(KCAL_POR_KG_POR_KM * pesoKg * km) : 0;
  }

  const minutos = t.minutos ?? 0;
  if (!(minutos > 0)) return 0;
  const met = METS[t.tipo][t.intensidade ?? 'moderado'];
  return Math.round((met - 1) * pesoKg * (minutos / 60));
}

/** Soma o gasto de vários treinos do dia. */
export function gastoDoDia(treinos: { kcal: number }[]): number {
  return Math.round(treinos.reduce((total, t) => total + t.kcal, 0));
}

/** Como a tela descreve o treino (ex.: "Musculação · 45 min · moderado"). */
export function descrever(t: Treino): string {
  const partes: string[] = [nomeTipo(t.tipo)];
  if (t.tipo === 'corrida' && t.distanciaKm) partes.push(`${t.distanciaKm} km`.replace('.', ','));
  else if (t.minutos) partes.push(`${t.minutos} min`);
  if (t.intensidade && t.tipo !== 'corrida' && t.tipo !== 'outro') {
    partes.push(INTENSIDADES.find((i) => i.id === t.intensidade)!.nome.toLowerCase());
  }
  return partes.join(' · ');
}
