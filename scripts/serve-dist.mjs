// Serve o export web (dist/) com os headers que o expo-sqlite precisa.
// Uso: npm run build:web && npm run serve:web
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const port = Number(process.env.PORT) || 8081;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
};

createServer(async (req, res) => {
  // SEM_ISOLAMENTO=1 simula um host sem os headers, para testar o plano B de armazenamento.
  if (!process.env.SEM_ISOLAMENTO) {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname).split('/').filter((p) => p && p !== '..');
  let file = normalize(join(root, ...path));
  try {
    if (!file.startsWith(normalize(root)) || !(await stat(file)).isFile()) throw new Error();
  } catch {
    file = join(root, 'index.html'); // SPA: rotas desconhecidas caem no index
  }
  try {
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
