/**
 * Gasto de calorias dos treinos, sempre líquido.
 *
 * Líquido quer dizer sem o que o corpo gastaria parado no mesmo tempo, por isso o
 * `MET − 1`. O gasto de repouso já está na meta diária, vindo do nível de atividade
 * do perfil; sem esse desconto o treino contaria duas vezes.
 */

export type TipoExercicio = 'musculacao' | 'corrida' | 'caminhada' | 'bike' | 'outro';
export type Intensidade = 'moderado' | 'intenso';
/** Só para musculação: o que o treino puxou mais. */
export type Foco = 'composto' | 'isolado';
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

export const FOCOS: { id: Foco; nome: string; dica: string }[] = [
  { id: 'composto', nome: 'Pernas ou corpo todo', dica: 'agachamento, terra, leg press, treino completo' },
  { id: 'isolado', nome: 'Superiores ou isolados', dica: 'braço, ombro, supino, máquinas de um músculo só' },
];

/**
 * METs do Compêndio de Atividades Físicas, por tipo e intensidade.
 * Moderado e intenso mudam junto com o ritmo: caminhar a 5,5 km/h é 4,3,
 * caminhar rápido ou em subida é 5,3; pedalar a 19 km/h é 6,8 e a 25 km/h é 10.
 */
const METS: Record<'caminhada' | 'bike', Record<Intensidade, number>> = {
  caminhada: { moderado: 4.3, intenso: 5.3 },
  bike: { moderado: 6.8, intenso: 10.0 },
};

/**
 * Musculação sem a lista de exercícios. É o modo rápido: o app só sabe o foco e
 * o tempo, então usa a faixa do compêndio para treino com peso (3,5 moderado,
 * 6,0 vigoroso) puxada para o meio. Quem registra o treino exercício a exercício
 * não passa por aqui; o cálculo detalhado é mais fiel e costuma dar menos.
 */
const METS_MUSCULACAO: Record<Foco, Record<Intensidade, number>> = {
  composto: { moderado: 4.0, intenso: 5.5 },
  isolado: { moderado: 3.0, intenso: 4.0 },
};

/**
 * Musculação, exercício a exercício.
 *
 * Medir gasto de musculação com um número só nunca fecha: agachamento move
 * corpo inteiro, rosca direta move um braço. Os estudos que mediram consumo de
 * oxigênio durante a série acham valores bem altos (agachamento perto de 10 a
 * 19 kcal/min, supino de 10 a 16, conforme a carga), mas a série dura segundos e
 * o descanso domina o relógio. Por isso o app separa as duas coisas: o tempo sob
 * tensão de cada exercício, no MET dele, mais o descanso, que não volta ao
 * repouso — fica perto de 3 METs enquanto a respiração e o coração baixam.
 *
 * Somando, uma sessão inteira cai na faixa que os estudos medem na prática, de
 * 4 a 8 kcal por minuto contando o descanso.
 */
export type GrupoExercicio = 'pernas' | 'costas' | 'peito' | 'ombro' | 'braco' | 'core';

export type ExercicioCatalogo = {
  id: string;
  nome: string;
  grupo: GrupoExercicio;
  /** MET durante a série, não na sessão inteira. */
  met: number;
};

/** Exercício que não está na lista. Fica no meio da tabela. */
export const MET_PADRAO = 6.0;
/** Quanto o corpo ainda gasta entre as séries, acima do repouso. */
export const MET_DESCANSO = 3.0;
/** Uma repetição completa, subindo e descendo, leva perto disso. */
export const SEGUNDOS_POR_REP = 3;

export const CATALOGO: ExercicioCatalogo[] = [
  // Pernas e corpo todo: a maior massa muscular em movimento.
  { id: 'agachamento', nome: 'Agachamento livre', grupo: 'pernas', met: 9.0 },
  { id: 'agachamento-hack', nome: 'Agachamento hack', grupo: 'pernas', met: 8.0 },
  { id: 'leg-press', nome: 'Leg press', grupo: 'pernas', met: 8.0 },
  { id: 'terra', nome: 'Levantamento terra', grupo: 'pernas', met: 9.0 },
  { id: 'stiff', nome: 'Stiff', grupo: 'pernas', met: 7.5 },
  { id: 'afundo', nome: 'Afundo ou passada', grupo: 'pernas', met: 8.0 },
  { id: 'bulgaro', nome: 'Agachamento búlgaro', grupo: 'pernas', met: 8.0 },
  { id: 'extensora', nome: 'Cadeira extensora', grupo: 'pernas', met: 5.0 },
  { id: 'flexora', nome: 'Mesa flexora', grupo: 'pernas', met: 5.0 },
  { id: 'panturrilha', nome: 'Panturrilha', grupo: 'pernas', met: 4.5 },
  { id: 'gluteo', nome: 'Glúteo na polia', grupo: 'pernas', met: 5.0 },
  // Costas.
  { id: 'barra-fixa', nome: 'Barra fixa', grupo: 'costas', met: 8.0 },
  { id: 'puxada', nome: 'Puxada na frente', grupo: 'costas', met: 7.0 },
  { id: 'remada-curvada', nome: 'Remada curvada', grupo: 'costas', met: 7.5 },
  { id: 'remada-baixa', nome: 'Remada baixa', grupo: 'costas', met: 7.0 },
  { id: 'remada-unilateral', nome: 'Remada unilateral', grupo: 'costas', met: 6.5 },
  // Peito.
  { id: 'supino', nome: 'Supino reto', grupo: 'peito', met: 7.0 },
  { id: 'supino-inclinado', nome: 'Supino inclinado', grupo: 'peito', met: 7.0 },
  { id: 'flexao', nome: 'Flexão de braço', grupo: 'peito', met: 7.0 },
  { id: 'paralelas', nome: 'Paralelas', grupo: 'peito', met: 7.5 },
  { id: 'crucifixo', nome: 'Crucifixo', grupo: 'peito', met: 5.0 },
  { id: 'crossover', nome: 'Crossover', grupo: 'peito', met: 5.0 },
  // Ombro.
  { id: 'desenvolvimento', nome: 'Desenvolvimento', grupo: 'ombro', met: 7.0 },
  { id: 'elevacao-lateral', nome: 'Elevação lateral', grupo: 'ombro', met: 5.0 },
  { id: 'elevacao-frontal', nome: 'Elevação frontal', grupo: 'ombro', met: 5.0 },
  { id: 'crucifixo-inverso', nome: 'Crucifixo inverso', grupo: 'ombro', met: 5.0 },
  { id: 'encolhimento', nome: 'Encolhimento', grupo: 'ombro', met: 5.0 },
  // Braço.
  { id: 'rosca-direta', nome: 'Rosca direta', grupo: 'braco', met: 5.0 },
  { id: 'rosca-martelo', nome: 'Rosca martelo', grupo: 'braco', met: 5.0 },
  { id: 'triceps-corda', nome: 'Tríceps na corda', grupo: 'braco', met: 5.0 },
  { id: 'triceps-testa', nome: 'Tríceps testa', grupo: 'braco', met: 5.0 },
  { id: 'triceps-banco', nome: 'Tríceps no banco', grupo: 'braco', met: 5.5 },
  // Core.
  { id: 'abdominal', nome: 'Abdominal', grupo: 'core', met: 4.5 },
  { id: 'elevacao-pernas', nome: 'Elevação de pernas', grupo: 'core', met: 4.5 },
];

/** Um exercício dentro do treino, do jeito que a pessoa registra na tela. */
export type ItemTreino = {
  /** Id do catálogo, ou null quando a pessoa digitou o nome. */
  catalogo: string | null;
  nome: string;
  series: number;
  repeticoes: number;
  cargaKg: number | null;
};

export function acharExercicio(id: string | null): ExercicioCatalogo | undefined {
  return id ? CATALOGO.find((e) => e.id === id) : undefined;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca por pedaço do nome, sem acento e sem ligar para maiúscula. */
export function buscarExercicios(texto: string, limite = 8): ExercicioCatalogo[] {
  const alvo = semAcento(texto.trim());
  if (!alvo) return CATALOGO.slice(0, limite);
  return CATALOGO.filter((e) => semAcento(e.nome).includes(alvo)).slice(0, limite);
}

const metDoItem = (i: ItemTreino) => acharExercicio(i.catalogo)?.met ?? MET_PADRAO;

/** Repetições válidas de um item: série sem repetição não conta. */
const repeticoesDoItem = (i: ItemTreino) => Math.max(0, i.series) * Math.max(0, i.repeticoes);

/** Tempo somado das séries, em minutos. O resto da sessão é descanso. */
export function minutosSobTensao(itens: ItemTreino[]): number {
  const segundos = itens.reduce((total, i) => total + repeticoesDoItem(i) * SEGUNDOS_POR_REP, 0);
  return segundos / 60;
}

/** Carga total levantada no treino, em kg. Serve para acompanhar a evolução. */
export function volumeCarga(itens: ItemTreino[]): number {
  return Math.round(itens.reduce((total, i) => total + repeticoesDoItem(i) * (i.cargaKg ?? 0), 0));
}

/**
 * Gasto líquido do treino registrado exercício a exercício.
 *
 * Cada série entra no MET do exercício e pelo tempo que ela dura. O que sobra da
 * duração informada é descanso, contado em `MET_DESCANSO`. Sem duração, só as
 * séries contam.
 */
export function gastoDetalhado(itens: ItemTreino[], minutos: number | null, pesoKg: number): number {
  if (!(pesoKg > 0) || itens.length === 0) return 0;
  const porHora = (met: number, minutosDisso: number) => (met - 1) * pesoKg * (minutosDisso / 60);

  const series = itens.reduce(
    (total, i) => total + porHora(metDoItem(i), (repeticoesDoItem(i) * SEGUNDOS_POR_REP) / 60),
    0,
  );
  const tensao = minutosSobTensao(itens);
  const descanso = minutos && minutos > tensao ? porHora(MET_DESCANSO, minutos - tensao) : 0;
  return Math.round(series + descanso);
}

/** Corrida: cerca de 1 kcal por kg a cada km, já perto do valor líquido. */
const KCAL_POR_KG_POR_KM = 1;

export type Treino = {
  tipo: TipoExercicio;
  intensidade: Intensidade | null;
  /** Só para musculação, e só no modo rápido. */
  foco?: Foco | null;
  /** Musculação registrada exercício a exercício. Quando tem lista, manda ela. */
  itens?: ItemTreino[];
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

  if (t.tipo === 'musculacao' && t.itens && t.itens.length > 0) {
    return gastoDetalhado(t.itens, t.minutos, pesoKg);
  }

  if (t.tipo === 'corrida') {
    const km = t.distanciaKm ?? 0;
    return km > 0 ? Math.round(KCAL_POR_KG_POR_KM * pesoKg * km) : 0;
  }

  const minutos = t.minutos ?? 0;
  if (!(minutos > 0)) return 0;
  const intensidade = t.intensidade ?? 'moderado';
  const met =
    t.tipo === 'musculacao'
      ? METS_MUSCULACAO[t.foco ?? 'composto'][intensidade]
      : METS[t.tipo][intensidade];
  return Math.round((met - 1) * pesoKg * (minutos / 60));
}

/** Soma o gasto de vários treinos do dia. */
export function gastoDoDia(treinos: { kcal: number }[]): number {
  return Math.round(treinos.reduce((total, t) => total + t.kcal, 0));
}

/** Como a tela mostra um exercício (ex.: "Agachamento livre · 4×10 · 60 kg"). */
export function descreverItem(i: ItemTreino): string {
  const partes = [i.nome, `${i.series}×${i.repeticoes}`];
  if (i.cargaKg && i.cargaKg > 0) partes.push(`${String(i.cargaKg).replace('.', ',')} kg`);
  return partes.join(' · ');
}

/** Como a tela descreve o treino (ex.: "Musculação · 45 min · moderado"). */
export function descrever(t: Treino): string {
  const partes: string[] = [nomeTipo(t.tipo)];
  if (t.tipo === 'corrida' && t.distanciaKm) partes.push(`${t.distanciaKm} km`.replace('.', ','));
  else if (t.minutos) partes.push(`${t.minutos} min`);

  if (t.tipo === 'musculacao' && t.itens && t.itens.length > 0) {
    const series = t.itens.reduce((total, i) => total + Math.max(0, i.series), 0);
    partes.push(`${t.itens.length} ${t.itens.length === 1 ? 'exercício' : 'exercícios'}`);
    partes.push(`${series} ${series === 1 ? 'série' : 'séries'}`);
    return partes.join(' · ');
  }
  if (t.intensidade && t.tipo !== 'corrida' && t.tipo !== 'outro') {
    partes.push(INTENSIDADES.find((i) => i.id === t.intensidade)!.nome.toLowerCase());
  }
  if (t.tipo === 'musculacao' && t.foco) {
    partes.push(FOCOS.find((f) => f.id === t.foco)!.nome.toLowerCase());
  }
  return partes.join(' · ');
}
