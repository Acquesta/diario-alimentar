// Gera src/data/taco.json a partir de scripts/taco_composicao.csv.
// Fonte: TACO 4a edição (NEPA/UNICAMP), normalizada em https://github.com/brolesi/taco
import { readFileSync, writeFileSync } from 'node:fs';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

const [header, ...lines] = parseCsv(readFileSync(new URL('./taco_composicao.csv', import.meta.url), 'utf8'));
const col = (name) => header.indexOf(name);
const num = (v) => {
  const n = Number(v);
  // TACO usa 1e-05 para "traço" e vazio para "não analisado": ambos viram 0.
  return v === '' || !Number.isFinite(n) || n < 0.001 ? 0 : Math.round(n * 10) / 10;
};

const foods = lines.map((r) => ({
  id: Number(r[col('numero_alimento')]),
  nome: r[col('descricao')],
  categoria: r[col('categoria')],
  kcal: Math.round(Number(r[col('energia_kcal')]) || 0),
  proteina: num(r[col('proteina_g')]),
  carboidrato: num(r[col('carboidrato_g')]),
  gordura: num(r[col('lipideos_g')]),
  fibra: num(r[col('fibra_g')]),
}));

// Alguns itens não têm nenhum valor analisado na TACO (ex.: leite integral).
// Ficam de fora para não somar zero por engano. Sal tem mesmo 0 kcal e fica.
const semDados = (f) => f.kcal === 0 && f.proteina === 0 && f.carboidrato === 0 && f.gordura === 0 && !/^Sal,/.test(f.nome);
const validos = foods.filter((f) => !semDados(f));

writeFileSync(new URL('../src/data/taco.json', import.meta.url), JSON.stringify(validos));
console.log(`${validos.length} alimentos gravados, ${foods.length - validos.length} sem dados descartados:`);
foods.filter(semDados).forEach((f) => console.log(`  - ${f.nome}`));
