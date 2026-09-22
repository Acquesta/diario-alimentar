import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscar, normalizar } from './search.ts';

const itens = [
  { nome: 'Arroz, tipo 1, cozido' },
  { nome: 'Pão, trigo, francês' },
  { nome: 'Feijão, carioca, cozido' },
  { nome: 'Frango, peito, sem pele, grelhado' },
  { nome: 'Farinha, de arroz, enriquecida' },
];

test('ignora acento e caixa', () => {
  assert.equal(normalizar('  Pão Francês '), 'pao frances');
  assert.deepEqual(buscar(itens, 'pao').map((i) => i.nome), ['Pão, trigo, francês']);
});

test('todos os termos, em qualquer ordem', () => {
  assert.deepEqual(buscar(itens, 'grelhado frango').map((i) => i.nome), ['Frango, peito, sem pele, grelhado']);
  assert.deepEqual(buscar(itens, 'feijao cru'), []);
});

test('nome que começa com o termo vem antes', () => {
  assert.deepEqual(buscar(itens, 'arroz').map((i) => i.nome), ['Arroz, tipo 1, cozido', 'Farinha, de arroz, enriquecida']);
});

test('busca vazia não retorna nada', () => {
  assert.deepEqual(buscar(itens, '   '), []);
});
