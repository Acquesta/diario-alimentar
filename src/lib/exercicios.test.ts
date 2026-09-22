import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descrever, gastoDoDia, gastoTreino, type Treino } from './exercicios.ts';
import { metaAgua, metaDiaria, type Perfil } from './nutrition.ts';

const base: Treino = {
  tipo: 'musculacao', intensidade: 'moderado', foco: 'composto', minutos: 60, distanciaKm: null, kcal: null,
};

test('musculação usa o MET líquido, conforme o foco do treino', () => {
  // Composto: (5,0 − 1) × 80 kg × 1 h = 320
  assert.equal(gastoTreino(base, 80), 320);
  // Composto intenso: (6,5 − 1) × 80 × 0,75 h = 330
  assert.equal(gastoTreino({ ...base, intensidade: 'intenso', minutos: 45 }, 80), 330);
  // Isolado: (3,5 − 1) × 80 × 1 h = 200
  assert.equal(gastoTreino({ ...base, foco: 'isolado' }, 80), 200);
  // Isolado intenso: (5,0 − 1) × 80 × 1 h = 320
  assert.equal(gastoTreino({ ...base, foco: 'isolado', intensidade: 'intenso' }, 80), 320);
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

test('descrição do treino', () => {
  assert.equal(descrever(base), 'Musculação · 60 min · moderado · pernas ou corpo todo');
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
