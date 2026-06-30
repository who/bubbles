// Framework-agnostic /api/prices request handler.
//
// Returns a connect-style (req, res) middleware that Vite's dev and preview
// servers and the standalone Node server (index.ts) all mount. Keeps a short
// in-memory TTL cache so repeated polls don't hammer Unusual Whales.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchPrices, type PriceQuote, type PriceResult } from './prices.ts';

export type PricesHandlerOptions = {
  // UW key; resolved from env by the caller. When absent the handler responds
  // 500 so a misconfigured deploy fails loudly instead of silently.
  apiKey: string | undefined;
  // How long a resolved quote stays fresh. Default 15s.
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  baseUrl?: string;
};

type CacheEntry = { quote: PriceQuote; expiresAt: number };

// Pull contract identifiers from the query string. Supports both repeated
// `id=` params and a single comma-separated `ids=` param.
export function parseIdsFromUrl(rawUrl: string): string[] {
  const query = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  const ids = [
    ...params.getAll('id'),
    ...params.getAll('ids').flatMap((value) => value.split(',')),
  ];
  return ids.map((id) => id.trim()).filter((id) => id !== '');
}

export function createPricesHandler(options: PricesHandlerOptions) {
  const ttlMs = options.cacheTtlMs ?? 15_000;
  const now = options.now ?? (() => new Date());
  const cache = new Map<string, CacheEntry>();

  return async function handlePrices(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const sendJson = (status: number, body: unknown): void => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };

    if (req.method && req.method !== 'GET') {
      sendJson(405, { error: 'Method not allowed' });
      return;
    }

    if (!options.apiKey) {
      sendJson(500, {
        error: 'UNUSUAL_WHALES_SECRET is not configured on the server.',
      });
      return;
    }

    const ids = parseIdsFromUrl(req.url ?? '');
    if (ids.length === 0) {
      sendJson(200, { prices: {}, misses: [] });
      return;
    }

    const nowMs = now().getTime();
    const prices: Record<string, PriceQuote> = {};
    const toFetch: string[] = [];
    const seen = new Set<string>();

    ids.forEach((id) => {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      const cached = cache.get(id);
      if (cached && cached.expiresAt > nowMs) {
        prices[id] = cached.quote;
      } else {
        toFetch.push(id);
      }
    });

    let misses: string[] = [];
    if (toFetch.length > 0) {
      try {
        const fetched: PriceResult = await fetchPrices(toFetch, {
          apiKey: options.apiKey,
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
          now,
          ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
        });
        misses = fetched.misses;
        const expiresAt = nowMs + ttlMs;
        Object.entries(fetched.prices).forEach(([id, quote]) => {
          prices[id] = quote;
          cache.set(id, { quote, expiresAt });
        });
      } catch {
        sendJson(502, { error: 'Failed to fetch prices from upstream.' });
        return;
      }
    }

    sendJson(200, { prices, misses });
  };
}
