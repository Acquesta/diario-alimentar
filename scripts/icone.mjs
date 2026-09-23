// Gera o ícone do app a partir de um desenho em SVG.
// Uso: npm install --no-save sharp && node scripts/icone.mjs
//
// A marca é um anel de progresso aberto (quanto ainda falta comer no dia, que é a
// pergunta do app) com um garfo no meio. Sem letras, para ler bem em tamanho pequeno.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const VERDE = '#5CC08F';
const VERDE_ESCURO = '#2F7D5B';
const FUNDO = '#11201A';
const CLARO = '#F2F6F4';

/** Anel aberto em cima, como um prato visto de cima com uma parte já comida. */
function anel(cor, largura = 84) {
  return `
    <circle cx="512" cy="512" r="330" fill="none" stroke="${cor}" stroke-opacity="0.22" stroke-width="${largura}" />
    <path d="M 512 182 A 330 330 0 1 1 256 838" fill="none" stroke="${cor}"
          stroke-width="${largura}" stroke-linecap="round" />`;
}

/** Garfo simples: três dentes, cabo reto. */
function garfo(cor) {
  return `
    <g fill="${cor}">
      <rect x="404" y="318" width="30" height="190" rx="15" />
      <rect x="497" y="318" width="30" height="190" rx="15" />
      <rect x="590" y="318" width="30" height="190" rx="15" />
      <path d="M 404 486 h 216 v 34 a 60 60 0 0 1 -60 60 h -96 a 60 60 0 0 1 -60 -60 z" />
      <rect x="484" y="560" width="56" height="196" rx="28" />
    </g>`;
}

const svgIcone = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${FUNDO}" />
  ${anel(VERDE)}
  ${garfo(CLARO)}
</svg>`;

/** Para a tela de abertura e o Android, só a marca, sem fundo. */
const svgMarca = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${anel(VERDE)}
  ${garfo(CLARO)}
</svg>`;

const svgMonocromatico = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${anel('#FFFFFF')}
  ${garfo('#FFFFFF')}
</svg>`;

const svgFundoAndroid = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${FUNDO}" />
</svg>`;

/** O ícone do Android fica dentro de uma máscara, então a marca entra menor. */
const svgMarcaAndroid = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(0.62) translate(-512 -512)">
    ${anel(VERDE)}
    ${garfo(CLARO)}
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
console.log('desenho em assets/icone.svg. Cor de fundo:', FUNDO, '· anel:', VERDE, '· escuro:', VERDE_ESCURO);
