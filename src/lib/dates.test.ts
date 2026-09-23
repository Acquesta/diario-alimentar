import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaDaSemana, nomeDiaDaSemana, somarDias } from './dates.ts';

test('dia da semana da data, no fuso do aparelho', () => {
  // 2026-09-21 é segunda-feira.
  assert.equal(diaDaSemana('2026-09-21'), 1);
  assert.equal(diaDaSemana('2026-09-23'), 3);
  assert.equal(diaDaSemana('2026-09-20'), 0);
  // Uma semana depois cai no mesmo dia.
  assert.equal(diaDaSemana(somarDias('2026-09-21', 7)), 1);
});

test('nome do dia da semana', () => {
  assert.equal(nomeDiaDaSemana(1), 'segunda-feira');
  assert.equal(nomeDiaDaSemana(6), 'sábado');
  assert.equal(nomeDiaDaSemana(9), '');
});

test('somar dias vira o mês e o ano', () => {
  assert.equal(somarDias('2026-09-30', 1), '2026-10-01');
  assert.equal(somarDias('2026-01-01', -1), '2025-12-31');
});
