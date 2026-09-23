// Gera o ícone do app a partir de um desenho em SVG.
// Uso: npm install --no-save sharp && node scripts/icone.mjs
//
// A marca é um anel de progresso aberto (quanto ainda falta comer no dia, que é a
// pergunta do app) com um garfo no meio. Sem letras, para ler bem em tamanho pequeno.
import { mkdirSync, writeFileSync } from 'node:fs';
import { mdiArmFlexOutline } from '@mdi/js';
import sharp from 'sharp';

const VERDE = '#5CC08F';
const VERDE_ESCURO = '#2F7D5B';
const FUNDO = '#11201A';
const CLARO = '#F2F6F4';

/**
 * Braço flexionado em traçado, o desenho arm-flex-outline do Material Design Icons
 * (Pictogrammers, Apache-2.0). Fica no centro, com folga nas bordas.
 */
function braco(cor) {
  return `<g transform="translate(104 128) scale(34.6)"><path d="${mdiArmFlexOutline}" fill="${cor}" /></g>`;
}

/** Garfo simples: três dentes, cabo reto. `contorno` abre espaço quando ele cruza o braço. */
function garfo(cor, contorno) {
  const traco = contorno ? `stroke="${contorno}" stroke-width="46" stroke-linejoin="round"` : '';
  return `
    <g fill="${cor}" ${traco}>
      <rect x="404" y="318" width="30" height="190" rx="15" />
      <rect x="497" y="318" width="30" height="190" rx="15" />
      <rect x="590" y="318" width="30" height="190" rx="15" />
      <path d="M 404 486 h 216 v 34 a 60 60 0 0 1 -60 60 h -96 a 60 60 0 0 1 -60 -60 z" />
      <rect x="484" y="560" width="56" height="196" rx="28" />
    </g>`;
}

/** O garfo entra no músculo pela direita, inclinado, com os dentes fincados. */
function garfoEspetado(cor) {
  // Centro do garfo em (660, 372), virado 215 graus: os dentes entram no músculo.
  // O primeiro desenho, na cor do fundo, abre a folga por onde ele atravessa o braço.
  const posicao = 'translate(626 430) rotate(215) scale(0.72) translate(-512 -512)';
  return `
    <g transform="${posicao}">${garfo(FUNDO, FUNDO)}</g>
    <g transform="${posicao}">${garfo(cor)}</g>`;
}

const svgIcone = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${FUNDO}" />
  ${braco(VERDE)}
  ${garfoEspetado(CLARO)}
</svg>`;

/** Para a tela de abertura e o Android, só a marca, sem fundo. */
const svgMarca = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${braco(VERDE)}
  ${garfoEspetado(CLARO)}
</svg>`;

const svgMonocromatico = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${braco('#FFFFFF')}
  ${garfoEspetado('#FFFFFF')}
</svg>`;

const svgFundoAndroid = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${FUNDO}" />
</svg>`;

/** O ícone do Android fica dentro de uma máscara, então a marca entra menor. */
const svgMarcaAndroid = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(0.62) translate(-512 -512)">
    ${braco(VERDE)}
    ${garfoEspetado(CLARO)}
  </g>
</svg>`;

const arquivos = [
  ['assets/icon.png', svgIcone, 1024],
  ['assets/splash-icon.png', svgMarca, 512],
  ['assets/favicon.png', svgIcone, 64],
  ['assets/android-icon-foreground.png', svgMarcaAndroid, 1024],
  ['assets/android-icon-background.png', svgFundoAndroid, 1024],
  ['assets/android-icon-monochrome.png', svgMonocromatico, 1024],
];

mkdirSync('assets', { recursive: true });
for (const [caminho, svg, tamanho] of arquivos) {
  await sharp(Buffer.from(svg)).resize(tamanho, tamanho).png().toFile(caminho);
  console.log('gerado', caminho, `${tamanho}x${tamanho}`);
}

// Guarda o desenho, para poder ajustar depois sem refazer tudo.
writeFileSync('assets/icone.svg', svgIcone);
console.log('desenho em assets/icone.svg. Fundo:', FUNDO, '· braço:', VERDE, '· garfo:', CLARO);
