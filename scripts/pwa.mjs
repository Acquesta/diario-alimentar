// Depois do `expo export`, transforma dist/ em PWA instalável no iPhone:
// manifest, ícone e metatags para "Adicionar à Tela de Início" no Safari.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

copyFileSync(new URL('../assets/icon.png', import.meta.url), new URL('icon.png', dist));

writeFileSync(
  new URL('manifest.json', dist),
  JSON.stringify(
    {
      name: app.web.name,
      short_name: app.web.shortName,
      lang: 'pt-BR',
      start_url: '/',
      display: 'standalone',
      background_color: app.web.backgroundColor,
      theme_color: app.web.themeColor,
      icons: [{ src: '/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }],
    },
    null,
    2,
  ),
);

const tags = [
  '<link rel="manifest" href="/manifest.json" />',
  '<link rel="apple-touch-icon" href="/icon.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  `<meta name="apple-mobile-web-app-title" content="${app.web.shortName}" />`,
  `<meta name="theme-color" content="${app.web.themeColor}" />`,
  '<meta name="color-scheme" content="light dark" />',
  // Fundo certo enquanto o app carrega, para não piscar branco no modo escuro.
  // touch-action tira o atraso do toque duplo; o destaque azul do toque no iPhone some.
  '<style>body{background:#F6F7F4}@media (prefers-color-scheme: dark){body{background:#0F1412}}' +
    '*{-webkit-tap-highlight-color:transparent}html{touch-action:manipulation}</style>',
].join('\n    ');

const indexUrl = new URL('index.html', dist);
let html = readFileSync(indexUrl, 'utf8');
if (!html.includes('rel="manifest"')) {
  html = html
    .replace('<html lang="en">', '<html lang="pt-BR">')
    .replace('</head>', `    ${tags}\n  </head>`);
  writeFileSync(indexUrl, html);
}
console.log('PWA pronta em dist/');
