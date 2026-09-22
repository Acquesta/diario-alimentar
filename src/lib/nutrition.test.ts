import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metaCalculada, metaDiaria, porcao, somar, taxaMetabolicaBasal, type Perfil } from './nutrition.ts';

const base: Perfil = {
  sexo: 'masculino',
  idade: 25,
  alturaCm: 180,
  pesoKg: 80,
  atividade: 'moderado',
  objetivo: 'manter',
  metaManual: null,
};

test('TMB pela Mifflin-St Jeor', () => {
  // 10*80 + 6.25*180 - 5*25 + 5 = 1805
  assert.equal(taxaMetabolicaBasal(base), 1805);
  // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
  assert.equal(taxaMetabolicaBasal({ sexo: 'feminino', idade: 30, alturaCm: 165, pesoKg: 60 }), 1320.25);
});

test('meta ajusta pelo objetivo e arredonda de 10 em 10', () => {
  // 1805 * 1.55 = 2797.75
  assert.equal(metaCalculada(base), 2800);
  assert.equal(metaCalculada({ ...base, objetivo: 'emagrecer' }), 2300);
  assert.equal(metaCalculada({ ...base, objetivo: 'ganhar' }), 3100);
});

test('meta nunca fica abaixo do mínimo', () => {
  const p: Perfil = { ...base, sexo: 'feminino', pesoKg: 45, alturaCm: 150, idade: 60, atividade: 'sedentario', objetivo: 'emagrecer' };
  assert.equal(metaCalculada(p), 1200);
});

test('meta manual substitui a calculada e macros fecham as calorias', () => {
  const m = metaDiaria({ ...base, metaManual: 2000 });
  assert.equal(m.kcal, 2000);
  assert.equal(m.proteina, 128); // 80 * 1.6
  const kcalDosMacros = m.proteina * 4 + m.carboidrato * 4 + m.gordura * 9;
  assert.ok(Math.abs(kcalDosMacros - 2000) < 10, `macros somam ${kcalDosMacros}`);
});

test('porção é proporcional aos 100 g', () => {
  const arroz = { kcal: 128, proteina: 2.5, carboidrato: 28.1, gordura: 0.2 };
  assert.deepEqual(porcao(arroz, 150), { kcal: 192, proteina: 3.8, carboidrato: 42.2, gordura: 0.3 });
});

test('soma do dia', () => {
  const total = somar([
    { kcal: 192, proteina: 3.8, carboidrato: 42.2, gordura: 0.3 },
    { kcal: 100, proteina: 6.1, carboidrato: 0.1, gordura: 0.2 },
  ]);
  assert.deepEqual(total, { kcal: 292, proteina: 9.9, carboidrato: 42.3, gordura: 0.5 });
});
