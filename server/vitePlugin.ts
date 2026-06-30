// Vite plugin that mounts /api/prices on both the dev server (`npm run dev`)
// and the preview server (`npm run preview`). Production hosting that does not
// use Vite should use the standalone server in ./index.ts instead.

import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import { createPricesHandler } from './handler.ts';

const ROUTE = '/api/prices';

export function pricesApiPlugin(): Plugin {
  const handler = createPricesHandler({
    apiKey: process.env.UNUSUAL_WHALES_SECRET,
  });

  const mount = (server: ViteDevServer | PreviewServer): void => {
    server.middlewares.use(ROUTE, (req, res) => {
      handler(req, res).catch(() => {
        if (!res.writableEnded) {
          res.statusCode = 500;
          res.end();
        }
      });
    });
  };

  return {
    name: 'bubbles-prices-api',
    configureServer(server) {
      mount(server);
    },
    configurePreviewServer(server) {
      mount(server);
    },
  };
}
