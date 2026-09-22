import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alimentoDoProduto, codigoValido, converter } from './openfoodfacts.ts';

const resposta = (produto: Record<string, unknown>) => ({ status: 1, product: produto });

test('converte produto com kcal por 100 g', () => {
  const r = converter('7891000100103', resposta({
    product_name: 'Leite Condensado',
    brands: 'Moça, Nestlé',
    nutriments: { 'energy-kcal_100g': 321, proteins_100g: 7.6, carbohydrates_100g: 55.4, fat_100g: 7.5 },
  }));
  assert.deepEqual(r, {
    tipo: 'achado',
    produto: {
      codigo: '7891000100103',
      nome: 'Leite Condensado',
      marca: 'Moça',
      kcal: 321,
      proteina: 7.6,
      carboidrato: 55.4,
      gordura: 7.5,
    },
  });
});

test('usa o nome em português quando existe e converte kJ', () => {
  const r = converter('123', resposta({
    product_name: 'Whole milk',
    product_name_pt: 'Leite integral',
    nutriments: { energy_100g: 272 },
  }));
  assert.equal(r.tipo, 'achado');
  if (r.tipo !== 'achado') return;
  assert.equal(r.produto.nome, 'Leite integral');
  // 272 kJ / 4,184 = 65,0 kcal
  assert.equal(r.produto.kcal, 65);
  assert.equal(r.produto.marca, null);
  assert.equal(r.produto.proteina, 0);
});

test('produto sem calorias ou sem nome conta como sem dados', () => {
  assert.equal(converter('123', resposta({ product_name: 'Café', nutriments: {} })).tipo, 'sem-dados');
  assert.equal(converter('123', resposta({ nutriments: { 'energy-kcal_100g': 100 } })).tipo, 'sem-dados');
  assert.equal(converter('123', resposta({ product_name: 'Água', nutriments: { 'energy-kcal_100g': 0 } })).tipo, 'sem-dados');
});

test('produto inexistente', () => {
  assert.equal(converter('123', { status: 0 }).tipo, 'nao-encontrado');
  assert.equal(converter('123', null).tipo, 'nao-encontrado');
});

test('nome do alimento junta produto e marca', () => {
  const a = alimentoDoProduto(
    { codigo: '1', nome: 'Leite Condensado', marca: 'Moça', kcal: 321, proteina: 7.6, carboidrato: 55.4, gordura: 7.5 },
    7,
  );
  assert.equal(a.nome, 'Leite Condensado (Moça)');
  assert.equal(a.origem, 'custom');
  assert.equal(a.id, 7);
});

test('código de barras válido', () => {
  assert.ok(codigoValido('7891000100103'));
  assert.ok(codigoValido('12345678'));
  assert.ok(!codigoValido('123'));
  assert.ok(!codigoValido('789100010010a'));
});
