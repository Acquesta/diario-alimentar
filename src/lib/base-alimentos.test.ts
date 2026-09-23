import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buscar, normalizar } from './search.ts';

/**
 * Os dados das tabelas, lidos direto do disco. O módulo `foods.ts` usa o atalho
 * `@/data/...`, que só o empacotador do app entende.
 */
type Linha = { id: number; nome: string; categoria: string; kcal: number };
const ler = (arquivo: string): Linha[] =>
  JSON.parse(readFileSync(new URL(`../data/${arquivo}`, import.meta.url), 'utf8'));

const pof = ler('pof.json');
const taco = ler('taco.json');
const base = [...pof, ...taco];

test('as duas tabelas têm itens e nenhum id repetido dentro de cada uma', () => {
  assert.ok(pof.length > 1500, `POF com apenas ${pof.length} itens`);
  assert.ok(taco.length > 500, `TACO com apenas ${taco.length} itens`);
  for (const [nome, tabela] of [['POF', pof], ['TACO', taco]] as const) {
    const ids = new Set(tabela.map((a) => a.id));
    assert.equal(ids.size, tabela.length, `${nome} tem id repetido`);
  }
});

test('nenhum item entra sem caloria nem nome', () => {
  for (const a of base) {
    assert.ok(a.nome.trim().length > 1, `nome vazio no id ${a.id}`);
    assert.ok(Number.isFinite(a.kcal) && a.kcal >= 0, `kcal inválida em ${a.nome}`);
  }
});

test('comida de verdade aparece na busca', () => {
  for (const termo of ['feijoada', 'coxinha', 'pão com manteiga', 'estrogonofe', 'arroz cozido']) {
    const achados = buscar(base, termo);
    assert.ok(achados.length > 0, `nada encontrado para "${termo}"`);
  }
});

test('busca sem acento acha nome com acento', () => {
  assert.ok(buscar(base, 'pao de queijo').length > 0);
  assert.ok(buscar(base, 'feijao').length > 0);
});

test('quando o alimento existe nas duas tabelas, as duas aparecem', () => {
  // Feijão está nas duas tabelas. O app mostra as duas, com a origem na linha,
  // em vez de escolher uma e esconder a outra.
  const achados = buscar(base, 'feijao');
  const idsPof = new Set(pof.map((a) => a.id));
  const idsTaco = new Set(taco.map((a) => a.id));
  assert.ok(achados.some((a) => idsPof.has(a.id)), 'nenhum item da POF');
  assert.ok(achados.some((a) => idsTaco.has(a.id)), 'nenhum item da TACO');
});

test('nome da POF não carrega lista de exemplos entre parênteses', () => {
  const comEtc = pof.filter((a) => /etc/i.test(a.nome));
  assert.equal(comEtc.length, 0, `ainda há ${comEtc.length} nomes com "etc", ex.: ${comEtc[0]?.nome}`);
});

test('a busca continua instantânea com a base inteira', () => {
  const termos = ['arroz', 'frango grelhado', 'pao', 'feijoada', 'queijo', 'banana'];
  const inicio = performance.now();
  for (let i = 0; i < 10; i++) for (const t of termos) buscar(base, t);
  const media = (performance.now() - inicio) / (10 * termos.length);
  assert.ok(media < 100, `busca levou ${media.toFixed(1)} ms por consulta`);
  console.log(`  busca em ${base.length} alimentos: ${media.toFixed(1)} ms por consulta`);
});

test('normalizar tira acento e caixa', () => {
  assert.equal(normalizar('Pão de Queijo'), 'pao de queijo');
});
