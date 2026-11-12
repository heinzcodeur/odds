import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, createApiMiddleware } from './database.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = join(root, 'dist');
const api = createApiMiddleware();
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = createServer((request, response) => {
  api(request, response, async () => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let path;
    try { path = resolve(dist, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`); }
    catch { response.writeHead(400); return response.end('Bad request'); }
    if (!path.startsWith(`${dist}/`) && path !== join(dist, 'index.html')) { response.writeHead(403); return response.end('Forbidden'); }
    try {
      const file = await readFile(path);
      response.writeHead(200, { 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream' });
      response.end(file);
    } catch {
      try {
        const file = await readFile(join(dist, 'index.html'));
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(file);
      } catch {
        response.writeHead(500);
        response.end('Build the frontend first with npm run build.');
      }
    }
  });
});

const port = Number(process.env.PORT ?? 5173);
server.listen(port, '127.0.0.1', () => {
  console.log(`OddsBoost disponible sur http://localhost:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await closeDatabase(); }));
