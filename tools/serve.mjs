import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureHTML } from '../tests/fixtures/article.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
      const html = fixtureHTML({ dark: url.searchParams.get('theme') === 'dark', semantic: url.searchParams.get('kind') === 'article' });
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(html.replace('</body>', '<script type="module" src="/tools/demo.js"></script></body>'));
      return;
    }
    const path = decodeURIComponent(url.pathname);
    if (!path.startsWith('/src/') && !path.startsWith('/icons/') && path !== '/tools/demo.js') throw new Error('Not allowed');
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(resolve(root) + sep)) throw new Error('Invalid path');
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(content);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`x-reader local demo → http://127.0.0.1:${port}\nThis preview uses local sample text, not a live X page.`));
