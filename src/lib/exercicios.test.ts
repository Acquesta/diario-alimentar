import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acharExercicio,
  buscarExercicios,
  CATALOGO,
  descrever,
  gastoDetalhado,
  gastoDoDia,
  gastoTreino,
  itensValidos,
  MET_DESCANSO,
  minutosSobTensao,
  volumeCarga,
  type ItemTreino,
  type Treino,
} from './exercicios.ts';
import { metaAgua, metaDiaria, type Perfil } from './nutrition.ts';

const base: Treino = {
  tipo: 'musculacao', intensidade: 'moderado', foco: 'composto', minutos: 60, distanciaKm: null, kcal: null,
};

test('musculação sem lista usa o MET líquido do foco', () => {
  // Composto: (4,0 − 1) × 80 kg × 1 h = 240
  assert.equal(gastoTreino(base, 80), 240);
  // Composto intenso: (5,5 − 1) × 80 × 0,75 h = 270
  assert.equal(gastoTreino({ ...base, intensidade: 'intenso', minutos: 45 }, 80), 270);
  // Isolado: (3,0 − 1) × 80 × 1 h = 160
  assert.equal(gastoTreino({ ...base, foco: 'isolado' }, 80), 160);
  // Isolado intenso: (4,0 − 1) × 80 × 1 h = 240
  assert.equal(gastoTreino({ ...base, foco: 'isolado', intensidade: 'intenso' }, 80), 240);
});

test('treino de pernas gasta mais que treino de braço no mesmo tempo', () => {
  const composto = gastoTreino(base, 80);
  const isolado = gastoTreino({ ...base, foco: 'isolado' }, 80);
  assert.ok(composto > isolado, `composto ${composto} devia passar isolado ${isolado}`);
});

test('sem foco escolhido, musculação vale como composto', () => {
  assert.equal(gastoTreino({ ...base, foco: null }, 80), gastoTreino(base, 80));
});

test('caminhada e bike usam os próprios METs', () => {
  // (4,3 − 1) × 70 × 0,5 h = 115,5 -> 116
  assert.equal(gastoTreino({ ...base, tipo: 'caminhada', minutos: 30 }, 70), 116);
  // (6,8 − 1) × 70 × 1 h = 406
  assert.equal(gastoTreino({ ...base, tipo: 'bike', minutos: 60 }, 70), 406);
});

test('cada tipo gasta diferente no mesmo tempo e intensidade', () => {
  const trinta = (tipo: Treino['tipo']) => gastoTreino({ ...base, tipo, foco: 'isolado', minutos: 30 }, 80);
  const musculacao = trinta('musculacao');
  const caminhada = trinta('caminhada');
  const bike = trinta('bike');
  assert.ok(musculacao < caminhada, `musculação ${musculacao} devia gastar menos que caminhada ${caminhada}`);
  assert.ok(caminhada < bike, `caminhada ${caminhada} devia gastar menos que bike ${bike}`);
});

test('corrida é 1 kcal por kg por km', () => {
  const corrida: Treino = { tipo: 'corrida', intensidade: null, minutos: null, distanciaKm: 5, kcal: null };
  assert.equal(gastoTreino(corrida, 80), 400);
  assert.equal(gastoTreino({ ...corrida, distanciaKm: 2.5 }, 60), 150);
});

test('outro usa o valor digitado, nunca negativo', () => {
  const outro: Treino = { tipo: 'outro', intensidade: null, minutos: null, distanciaKm: null, kcal: 250 };
  assert.equal(gastoTreino(outro, 80), 250);
  assert.equal(gastoTreino({ ...outro, kcal: -10 }, 80), 0);
});

test('sem informação o gasto é zero, não NaN', () => {
  assert.equal(gastoTreino({ ...base, minutos: null }, 80), 0);
  assert.equal(gastoTreino(base, 0), 0);
  assert.equal(gastoTreino({ tipo: 'corrida', intensidade: null, minutos: null, distanciaKm: null, kcal: null }, 80), 0);
});

test('gasto do dia soma os treinos', () => {
  assert.equal(gastoDoDia([{ kcal: 200 }, { kcal: 150 }]), 350);
  assert.equal(gastoDoDia([]), 0);
});

const item = (catalogo: string, series = 3, repeticoes = 10, cargaKg: number | null = 40): ItemTreino => ({
  catalogo,
  nome: acharExercicio(catalogo)?.nome ?? catalogo,
  series,
  repeticoes,
  cargaKg,
});

test('tempo sob tensão: 3 s por repetição', () => {
  // 3 séries × 10 reps × 3 s = 90 s = 1,5 min
  assert.equal(minutosSobTensao([item('supino')]), 1.5);
  assert.equal(minutosSobTensao([]), 0);
  assert.equal(minutosSobTensao([item('supino', 0, 10)]), 0);
});

test('exercícios diferentes gastam diferente nas mesmas séries', () => {
  const agachamento = gastoDetalhado([item('agachamento')], null, 80);
  const supino = gastoDetalhado([item('supino')], null, 80);
  const rosca = gastoDetalhado([item('rosca-direta')], null, 80);
  assert.ok(agachamento > supino, `agachamento ${agachamento} devia passar supino ${supino}`);
  assert.ok(supino > rosca, `supino ${supino} devia passar rosca ${rosca}`);
  // Agachamento: (9,0 − 1) × 80 × (90 s / 3600) = 16
  assert.equal(agachamento, 16);
});

test('mais séries e mais repetições gastam mais', () => {
  const tres = gastoDetalhado([item('supino', 3, 10)], null, 80);
  const cinco = gastoDetalhado([item('supino', 5, 10)], null, 80);
  const quinze = gastoDetalhado([item('supino', 3, 15)], null, 80);
  assert.ok(cinco > tres && quinze > tres);
});

test('o descanso entra no cálculo, acima do repouso', () => {
  const itens = [item('agachamento')];
  const so_series = gastoDetalhado(itens, null, 80);
  const com_descanso = gastoDetalhado(itens, 30, 80);
  // Descanso: (3,0 − 1) × 80 × (28,5 min / 60) = 76
  assert.equal(com_descanso - so_series, 76);
  assert.equal(MET_DESCANSO, 3.0);
  // Duração menor que o tempo das séries não vira desconto.
  assert.equal(gastoDetalhado(itens, 1, 80), so_series);
});

test('treino inteiro fica na faixa que os estudos medem', () => {
  // Sessão de 60 min, 80 kg: 4 a 8 kcal/min contando o descanso, já com o
  // repouso somado de volta (1 MET × 80 kg × 1 h = 80 kcal).
  const treino = [
    item('agachamento', 4, 10),
    item('leg-press', 3, 12),
    item('supino', 4, 10),
    item('remada-curvada', 3, 10),
    item('rosca-direta', 3, 12),
    item('triceps-corda', 3, 12),
  ];
  const liquido = gastoDetalhado(treino, 60, 80);
  const porMinuto = (liquido + 80) / 60;
  assert.ok(porMinuto > 4 && porMinuto < 8, `${porMinuto.toFixed(1)} kcal/min fora da faixa`);
});

test('lista detalhada manda no cálculo do treino', () => {
  const comLista: Treino = { ...base, itens: [item('rosca-direta', 3, 12)] };
  const semLista = gastoTreino(base, 80);
  assert.equal(gastoTreino(comLista, 80), gastoDetalhado(comLista.itens!, 60, 80));
  assert.notEqual(gastoTreino(comLista, 80), semLista);
  // Lista vazia volta para o modo rápido.
  assert.equal(gastoTreino({ ...base, itens: [] }, 80), semLista);
});

test('exercício fora do catálogo usa o MET do meio', () => {
  const fora: ItemTreino = { catalogo: null, nome: 'Escada', series: 3, repeticoes: 10, cargaKg: null };
  // (6,0 − 1) × 80 × (90 s / 3600) = 10
  assert.equal(gastoDetalhado([fora], null, 80), 10);
});

test('sem peso ou sem exercício o gasto detalhado é zero', () => {
  assert.equal(gastoDetalhado([item('supino')], 60, 0), 0);
  assert.equal(gastoDetalhado([], 60, 80), 0);
});

test('volume de carga soma o que foi levantado', () => {
  // 3 × 10 × 40 kg + 3 × 12 × 20 kg = 1200 + 720
  assert.equal(volumeCarga([item('supino', 3, 10, 40), item('rosca-direta', 3, 12, 20)]), 1920);
  assert.equal(volumeCarga([item('barra-fixa', 3, 8, null)]), 0);
});

test('busca de exercício ignora acento e maiúscula', () => {
  assert.ok(buscarExercicios('triceps').some((e) => e.id === 'triceps-corda'));
  assert.ok(buscarExercicios('AGACH').some((e) => e.id === 'agachamento'));
  assert.equal(buscarExercicios('xyz').length, 0);
  assert.ok(buscarExercicios('').length > 0);
});

test('catálogo não tem id repetido e todo MET é positivo', () => {
  const ids = new Set(CATALOGO.map((e) => e.id));
  assert.equal(ids.size, CATALOGO.length);
  assert.ok(CATALOGO.every((e) => e.met > 1));
});

test('descrição do treino', () => {
  assert.equal(descrever(base), 'Musculação · 60 min · moderado · pernas ou corpo todo');
  assert.equal(
    descrever({ ...base, itens: [item('supino'), item('rosca-direta', 4, 10)] }),
    'Musculação · 60 min · 2 exercícios · 7 séries',
  );
  assert.equal(
    descrever({ tipo: 'corrida', intensidade: null, minutos: null, distanciaKm: 5.5, kcal: null }),
    'Corrida · 5,5 km',
  );
});

const perfil: Perfil = {
  sexo: 'masculino',
  idade: 25,
  alturaCm: 180,
  pesoKg: 80,
  atividade: 'moderado',
  objetivo: 'manter',
  metaManual: 2800,
};

test('o treino soma na meta do dia', () => {
  assert.equal(metaDiaria(perfil).kcal, 2800);
  assert.equal(metaDiaria(perfil, 300).kcal, 3100);
  // As calorias a mais vão para os macros do dia, sem mexer na proteína por kg.
  const semTreino = metaDiaria(perfil);
  const comTreino = metaDiaria(perfil, 300);
  assert.equal(comTreino.proteina, semTreino.proteina);
  assert.ok(comTreino.carboidrato > semTreino.carboidrato);
  // Gasto negativo ou zero não muda nada.
  assert.equal(metaDiaria(perfil, -100).kcal, 2800);
});

test('meta de água: 35 ml por kg, arredondada para 100 ml', () => {
  assert.equal(metaAgua({ pesoKg: 80 }), 2800);
  assert.equal(metaAgua({ pesoKg: 62 }), 2200);
  assert.equal(metaAgua({ pesoKg: 45.5 }), 1600);
});

test('série ou repetição zerada invalida o treino', () => {
  assert.equal(itensValidos([item('supino', 3, 10)]), true);
  assert.equal(itensValidos([]), true);
  assert.equal(itensValidos([item('supino', 0, 10)]), false);
  assert.equal(itensValidos([item('supino', 3, 0)]), false);
  assert.equal(itensValidos([item('supino', 3, 10, null)]), true);
  assert.equal(itensValidos([item('supino', 3, 10, -5)]), false);
});
