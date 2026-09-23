import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comGramas, lerEstimativa, por100g, rotuloConfianca, totalKcal } from './estimativa.ts';

const resposta = (itens: unknown[]) => ({ itens });

test('lê os itens da resposta e arruma o nome', () => {
  const itens = lerEstimativa(resposta([
    { nome: 'arroz branco', gramas: 150, kcal: 193, proteina: 3.6, carboidrato: 42, gordura: 0.3, confianca: 'alta' },
  ]));
  assert.equal(itens.length, 1);
  assert.equal(itens[0].nome, 'Arroz branco');
  assert.equal(itens[0].confianca, 'alta');
});

test('descarta item sem nome, sem gramas, sem caloria ou fora de escala', () => {
  const itens = lerEstimativa(resposta([
    { nome: '', gramas: 100, kcal: 100 },
    { nome: 'Sem gramas', gramas: 0, kcal: 100 },
    { nome: 'Sem caloria', gramas: 100, kcal: 0 },
    { nome: 'Prato absurdo', gramas: 9000, kcal: 100 },
    { nome: 'Caloria absurda', gramas: 100, kcal: 90000 },
    { nome: 'Feijão', gramas: 120, kcal: 91 },
  ]));
  assert.deepEqual(itens.map((i) => i.nome), ['Feijão']);
});

test('resposta quebrada ou vazia não derruba a tela', () => {
  assert.deepEqual(lerEstimativa(null), []);
  assert.deepEqual(lerEstimativa({}), []);
  assert.deepEqual(lerEstimativa({ itens: 'nada' }), []);
  assert.deepEqual(lerEstimativa(resposta([])), []);
});

test('confiança desconhecida vira média', () => {
  const [item] = lerEstimativa(resposta([{ nome: 'Arroz', gramas: 100, kcal: 128, confianca: 'talvez' }]));
  assert.equal(item.confianca, 'media');
  assert.equal(item.proteina, 0);
});

test('converte a porção para valores por 100 g', () => {
  const [item] = lerEstimativa(resposta([
    { nome: 'Arroz', gramas: 200, kcal: 260, proteina: 5, carboidrato: 56, gordura: 0.6 },
  ]));
  assert.deepEqual(por100g(item), { nome: 'Arroz', kcal: 130, proteina: 2.5, carboidrato: 28, gordura: 0.3 });
});

test('mudar a quantidade recalcula caloria e macros', () => {
  const [item] = lerEstimativa(resposta([
    { nome: 'Arroz', gramas: 100, kcal: 130, proteina: 2.5, carboidrato: 28, gordura: 0.3 },
  ]));
  const dobro = comGramas(item, 200);
  assert.equal(dobro.gramas, 200);
  assert.equal(dobro.kcal, 260);
  assert.equal(dobro.proteina, 5);
  const zero = comGramas(item, 0);
  assert.equal(zero.gramas, 0);
});

test('total do prato', () => {
  const itens = lerEstimativa(resposta([
    { nome: 'Arroz', gramas: 150, kcal: 193 },
    { nome: 'Feijão', gramas: 120, kcal: 91 },
  ]));
  assert.equal(totalKcal(itens), 284);
  assert.equal(totalKcal([]), 0);
});

test('rótulo da confiança', () => {
  assert.equal(rotuloConfianca('alta'), 'estimativa mais segura');
  assert.equal(rotuloConfianca('media'), 'estimativa');
  assert.equal(rotuloConfianca('baixa'), 'chute');
});
