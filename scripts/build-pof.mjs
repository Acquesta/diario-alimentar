// Gera src/data/pof.json a partir da tabela do IBGE.
//
// Fonte: IBGE, Pesquisa de Orçamentos Familiares 2008-2009, "Tabela de Composição
// Nutricional dos Alimentos Consumidos no Brasil" (tabelacompleta.zip).
// Baixe o arquivo, descompacte em scripts/dados/ e rode:
//   npm install && node scripts/build-pof.mjs
//
// Esta tabela é de comida como ela é comida: arroz cozido, feijoada, coxinha,
// pão na chapa. Complementa a TACO, que é quase toda de ingrediente cru.
import { existsSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';

const ARQUIVO = new URL('./dados/tabelacompleta.xls', import.meta.url);
const ABA = 'Tabela de Composição ';

/** Colunas da planilha, na ordem em que aparecem. */
const COL = {
  codigoAlimento: 0,
  alimento: 1,
  codigoPreparacao: 2,
  preparacao: 3,
  kcal: 6,
  proteina: 7,
  gordura: 8,
  carboidrato: 9,
  fibra: 10,
};

/**
 * Os dois primeiros dígitos do código do alimento dizem o grupo. Os nomes abaixo
 * são uma leitura do conteúdo de cada faixa, não um rótulo oficial do IBGE: o
 * grupo 77, por exemplo, junta conserva com prato pronto (feijoada, yakissoba).
 */
const GRUPOS = {
  63: 'Cereais e grãos',
  64: 'Raízes e tubérculos',
  65: 'Farinhas e mingaus',
  66: 'Castanhas e coco',
  67: 'Verduras e legumes',
  68: 'Frutas',
  69: 'Açúcares e doces',
  70: 'Temperos e molhos',
  71: 'Carnes',
  72: 'Peixes do mar',
  74: 'Peixes de água doce',
  76: 'Peixes',
  77: 'Conservas e pratos prontos',
  78: 'Aves e ovos',
  79: 'Leites e derivados',
  80: 'Pães e bolos',
  81: 'Carnes salgadas e embutidos',
  82: 'Bebidas',
  83: 'Bebidas alcoólicas',
  84: 'Óleos e gorduras',
  85: 'Salgados e lanches',
  88: 'Outros',
};

/**
 * A planilha vem em caixa alta e sem acento. Isto devolve a grafia das palavras
 * mais comuns; o que não está aqui fica sem acento mesmo, e a busca do app
 * ignora acentos de qualquer jeito.
 */
const ACENTOS = {
  acai: 'açaí', acafrao: 'açafrão', acucar: 'açúcar', agua: 'água', aipo: 'aipo',
  alcool: 'álcool', alcoolica: 'alcoólica', alcaparra: 'alcaparra', algodao: 'algodão',
  amendoim: 'amendoim', anis: 'anis', aperitivo: 'aperitivo', araca: 'araçá',
  atum: 'atum', aveia: 'aveia', azeitona: 'azeitona', bacia: 'bacia', bebida: 'bebida',
  biscoito: 'biscoito', cacau: 'cacau', cafe: 'café', caju: 'caju', calabresa: 'calabresa',
  camarao: 'camarão', canjica: 'canjica', capuccino: 'capuccino', caqui: 'caqui',
  cha: 'chá', chocolate: 'chocolate', coco: 'coco', codorna: 'codorna', cogumelo: 'cogumelo',
  colonia: 'colônia', condimento: 'condimento', conserva: 'conserva', coracao: 'coração',
  cuscuz: 'cuscuz', doce: 'doce', ervilha: 'ervilha', especificada: 'especificada',
  especificado: 'especificado', farofa: 'farofa', feijao: 'feijão', figado: 'fígado',
  file: 'filé', frances: 'francês', fuba: 'fubá', galinha: 'galinha', geleia: 'geleia',
  grao: 'grão', graos: 'grãos', hamburguer: 'hambúrguer', inhame: 'inhame',
  integral: 'integral', jiló: 'jiló', jilo: 'jiló', leite: 'leite', limao: 'limão',
  linguica: 'linguiça', maca: 'maçã', macarrao: 'macarrão', mamao: 'mamão',
  mandioca: 'mandioca', manteiga: 'manteiga', maracuja: 'maracujá', melao: 'melão',
  melancia: 'melancia', molho: 'molho', mortadela: 'mortadela', nao: 'não',
  organico: 'orgânico', organica: 'orgânica', pacova: 'pacová', pao: 'pão',
  paes: 'pães', pastel: 'pastel', pate: 'patê', peixe: 'peixe', pequi: 'pequi',
  pimentao: 'pimentão', pinhao: 'pinhão', pirao: 'pirão', porcao: 'porção',
  porco: 'porco', presunto: 'presunto', proteina: 'proteína', queijo: 'queijo',
  refeicao: 'refeição', refrigerante: 'refrigerante', requeijao: 'requeijão',
  rucula: 'rúcula', salsicha: 'salsicha', sanduiche: 'sanduíche', sardinha: 'sardinha',
  sertao: 'sertão', suco: 'suco', suina: 'suína', suino: 'suíno', tapioca: 'tapioca',
  tempero: 'tempero', torresmo: 'torresmo', trigo: 'trigo', uva: 'uva', vinagre: 'vinagre',
  yakult: 'yakult', iogurte: 'iogurte', melado: 'melado', mel: 'mel',
};

const num = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const umaCasa = (n) => Math.round(n * 10) / 10;

/** Caixa alta sem acento vira texto normal, com a grafia conhecida onde dá. */
function arrumarTexto(bruto) {
  const limpo = String(bruto)
    .toLowerCase()
    // Parênteses que só listam exemplos ("(polido, parboilizado, etc)") saem do nome.
    .replace(/\s*\([^)]*etc\.?\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const comAcento = limpo.replace(/[a-zà-ú]+/g, (palavra) => ACENTOS[palavra] ?? palavra);
  return comAcento.charAt(0).toUpperCase() + comAcento.slice(1);
}

/** "COZIDO(A)" vira "cozido"; "GRELHADO(A)/BRASA/CHURRASCO" vira "grelhado". */
function arrumarPreparacao(bruto) {
  const texto = String(bruto).toLowerCase().split('/')[0].replace(/\(a\)/g, '').replace(/\s+/g, ' ').trim();
  return texto.replace(/[a-zà-ú]+/g, (palavra) => ACENTOS[palavra] ?? palavra);
}

if (!existsSync(ARQUIVO)) {
  console.error('Falta scripts/dados/tabelacompleta.xls. Baixe em:');
  console.error('https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/tabelacompleta.zip');
  process.exit(1);
}

const planilha = XLSX.readFile(ARQUIVO.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const linhas = XLSX.utils
  .sheet_to_json(planilha.Sheets[ABA], { header: 1, raw: true })
  .filter((l) => typeof l[COL.codigoAlimento] === 'number');

const semPreparacao = /^n[aã]o se aplica$/i;
const vistos = new Set();
const alimentos = [];
let descartados = 0;

for (const linha of linhas) {
  const codigo = linha[COL.codigoAlimento];
  const preparacao = arrumarPreparacao(linha[COL.preparacao] ?? '');
  const base = arrumarTexto(linha[COL.alimento]);
  const nome = semPreparacao.test(preparacao) ? base : `${base}, ${preparacao}`;

  // O par alimento + preparação é único na tabela e dá um id estável.
  const id = codigo * 100 + Number(linha[COL.codigoPreparacao] ?? 0);
  if (vistos.has(id)) continue;
  vistos.add(id);

  const kcal = Math.round(num(linha[COL.kcal]));
  const proteina = umaCasa(num(linha[COL.proteina]));
  const carboidrato = umaCasa(num(linha[COL.carboidrato]));
  const gordura = umaCasa(num(linha[COL.gordura]));

  // Sem nenhum valor analisado, o item só somaria zero por engano.
  if (kcal === 0 && proteina === 0 && carboidrato === 0 && gordura === 0) {
    descartados++;
    continue;
  }

  alimentos.push({
    id,
    nome,
    categoria: GRUPOS[String(codigo).slice(0, 2)] ?? 'Outros',
    kcal,
    proteina,
    carboidrato,
    gordura,
    fibra: umaCasa(num(linha[COL.fibra])),
  });
}

alimentos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
const saida = new URL('../src/data/pof.json', import.meta.url);
writeFileSync(saida, JSON.stringify(alimentos));
console.log(`${alimentos.length} alimentos gravados em src/data/pof.json (${descartados} sem dados descartados).`);
console.log('Exemplos:', alimentos.slice(0, 5).map((a) => a.nome).join(' | '));
