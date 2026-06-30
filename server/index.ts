// Standalone production server: serves the built SPA from ./dist and handles
// GET /api/prices. Use this for any deploy target that is not running Vite
// (e.g. Railway). Build first with `npm run build`, then:
//
//   UNUSUAL_WHALES_SECRET=... node --experimental-strip-types server/index.ts
//
// or compile it alongside your bundler of choice. PORT defaults to 8080.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPricesHandler } from './handler.ts';

const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
};

const handlePrices = createPricesHandler({
  apiKey: process.env.UNUSUAL_WHALES_SECRET,
});

// Resolve a request path to a file inside DIST_DIR, guarding against traversal.
function resolveStaticPath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  return join(DIST_DIR, relative);
}

const server = createServer((req, res) => {
  const url = req.url ?? '/';

  if (url === '/api/prices' || url.startsWith('/api/prices?')) {
    handlePrices(req, res).catch(() => {
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end();
      }
    });
    return;
  }

  (async () => {
    let filePath = resolveStaticPath(url);
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) {
        filePath = join(filePath, 'index.html');
      }
      const body = await readFile(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME_TYPES[extname(filePath)] ?? 'application/octet-stream');
      res.end(body);
    } catch {
      // SPA fallback: unknown non-asset paths get index.html.
      try {
        const body = await readFile(join(DIST_DIR, 'index.html'));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(body);
      } catch {
        res.statusCode = 404;
        res.end('Not found');
      }
    }
  })();
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`bubbles server listening on http://localhost:${PORT}`);
});
