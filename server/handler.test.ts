import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createPricesHandler, parseIdsFromUrl } from './handler.ts';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

type Captured = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
};

function fakeReqRes(url: string, method = 'GET') {
  const captured: Captured = { statusCode: 0, headers: {}, body: undefined };
  const req = { url, method } as IncomingMessage;
  let statusCode = 0;
  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(value: number) {
      statusCode = value;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
    end(chunk?: string) {
      captured.statusCode = statusCode;
      captured.body = chunk ? JSON.parse(chunk) : undefined;
    },
    writableEnded: false,
  } as unknown as ServerResponse;
  return { req, res, captured };
}

describe('parseIdsFromUrl', () => {
  it('reads repeated id params', () => {
    expect(parseIdsFromUrl('/api/prices?id=A&id=B')).toEqual(['A', 'B']);
  });

  it('splits a comma-separated ids param', () => {
    expect(parseIdsFromUrl('/api/prices?ids=A,B,C')).toEqual(['A', 'B', 'C']);
  });

  it('trims and drops blanks', () => {
    expect(parseIdsFromUrl('/api/prices?ids=A,%20,B')).toEqual(['A', 'B']);
  });

  it('returns empty when there are no ids', () => {
    expect(parseIdsFromUrl('/api/prices')).toEqual([]);
  });
});

describe('createPricesHandler', () => {
  const now = () => new Date('2026-06-30T15:00:00.000Z');

  it('rejects non-GET methods with 405', async () => {
    const handler = createPricesHandler({ apiKey: 'secret', now });
    const { req, res, captured } = fakeReqRes('/?id=A', 'POST');
    await handler(req, res);
    expect(captured.statusCode).toBe(405);
  });

  it('returns 500 when the API key is not configured', async () => {
    const handler = createPricesHandler({ apiKey: undefined, now });
    const { req, res, captured } = fakeReqRes('/?id=AAPL260701C00290000');
    await handler(req, res);
    expect(captured.statusCode).toBe(500);
  });

  it('short-circuits an empty id list without calling upstream', async () => {
    const fetchImpl = vi.fn();
    const handler = createPricesHandler({
      apiKey: 'secret',
      now,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const { req, res, captured } = fakeReqRes('/');
    await handler(req, res);
    expect(captured.statusCode).toBe(200);
    expect(captured.body).toEqual({ prices: {}, misses: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns prices and misses from upstream', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      data: [{ option_symbol: 'AAPL260701C00290000', last_price: '1.45' }],
    }));
    const handler = createPricesHandler({
      apiKey: 'secret',
      now,
      baseUrl: 'https://uw.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const { req, res, captured } = fakeReqRes('/?id=AAPL260701C00290000&id=bogus');
    await handler(req, res);
    expect(captured.statusCode).toBe(200);
    expect(captured.body).toMatchObject({
      prices: { AAPL260701C00290000: { price: 1.45 } },
      misses: ['bogus'],
    });
  });

  it('serves a second request from cache within the TTL', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      data: [{ option_symbol: 'AAPL260701C00290000', last_price: '1.45' }],
    }));
    const handler = createPricesHandler({
      apiKey: 'secret',
      now,
      cacheTtlMs: 60_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const first = fakeReqRes('/?id=AAPL260701C00290000');
    await handler(first.req, first.res);
    const second = fakeReqRes('/?id=AAPL260701C00290000');
    await handler(second.req, second.res);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second.captured.body).toMatchObject({
      prices: { AAPL260701C00290000: { price: 1.45 } },
    });
  });

  it('returns 502 when the upstream fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const handler = createPricesHandler({
      apiKey: 'secret',
      now,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const { req, res, captured } = fakeReqRes('/?id=AAPL260701C00290000');
    await handler(req, res);
    expect(captured.statusCode).toBe(502);
  });
});
