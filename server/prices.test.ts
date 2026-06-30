import { describe, expect, it, vi } from 'vitest';
import { fetchPrices, markFromContract } from './prices.ts';

// Minimal Response stub — fetchPrices only ever reads `.ok` and `.json()`.
function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

const FIXED_NOW = new Date('2026-06-30T15:00:00.000Z');
const now = () => FIXED_NOW;

describe('markFromContract', () => {
  it('uses the NBBO midpoint when a two-sided quote exists', () => {
    expect(markFromContract({ nbbo_bid: '1.45', nbbo_ask: '1.52', last_price: '1.45' }))
      .toBeCloseTo(1.485);
  });

  it('falls back to last_price when the quote is one-sided', () => {
    expect(markFromContract({ nbbo_bid: '0', nbbo_ask: '0.55', last_price: '0.49' }))
      .toBe(0.49);
  });

  it('returns null when nothing is priceable', () => {
    expect(markFromContract({ nbbo_bid: '0', nbbo_ask: '0', last_price: '0' })).toBeNull();
  });
});

describe('fetchPrices', () => {
  it('prices a contract from its OCC symbol via the NBBO midpoint', async () => {
    const fetchImpl = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => jsonResponse({
      data: [
        { option_symbol: 'AAPL260701C00290000', nbbo_bid: '1.45', nbbo_ask: '1.52', last_price: '1.45' },
      ],
    }));

    const result = await fetchPrices(['AAPL260701C00290000'], {
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now,
      baseUrl: 'https://uw.test',
    });

    expect(result.misses).toEqual([]);
    expect(result.prices.AAPL260701C00290000?.price).toBeCloseTo(1.485);
    expect(result.prices.AAPL260701C00290000?.asOf).toBe(FIXED_NOW.toISOString());

    // The request carries the bearer token and the option_symbol filter.
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const url = call?.[0] ?? '';
    const init = call?.[1];
    expect(url).toContain('/api/stock/AAPL/option-contracts');
    expect(url).toContain('option_symbol%5B%5D=AAPL260701C00290000');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer secret',
    });
  });

  it('accepts a fill description and keys the result by the original id', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      data: [
        { option_symbol: 'TSLA260429C00420000', nbbo_bid: '5.00', nbbo_ask: '5.20' },
      ],
    }));

    const result = await fetchPrices(['TSLA 4/29/2026 Call $420.00'], {
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now,
    });

    expect(result.prices['TSLA 4/29/2026 Call $420.00']).toEqual({
      price: 5.1,
      asOf: FIXED_NOW.toISOString(),
    });
  });

  it('reports unparseable identifiers as misses without calling UW', async () => {
    const fetchImpl = vi.fn();
    const result = await fetchPrices(['not a contract'], {
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now,
    });
    expect(result.prices).toEqual({});
    expect(result.misses).toEqual(['not a contract']);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports a parseable but unpriceable contract as a miss', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));
    const result = await fetchPrices(['FAKE260701C00010000'], {
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now,
    });
    expect(result.prices).toEqual({});
    expect(result.misses).toEqual(['FAKE260701C00010000']);
  });

  it('treats a non-OK upstream response as misses for that ticker', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));
    const result = await fetchPrices(['AAPL260701C00290000'], {
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now,
    });
    expect(result.misses).toEqual(['AAPL260701C00290000']);
  });

  it('groups requests by ticker, querying each underlying once', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/stock/AAPL/')) {
        return jsonResponse({ data: [{ option_symbol: 'AAPL260701C00290000', last_price: '1.45' }] });
      }
      return jsonResponse({ data: [{ option_symbol: 'TSLA260429C00420000', last_price: '5.00' }] });
    });

    const result = await fetchPrices(
      ['AAPL260701C00290000', 'TSLA260429C00420000', 'AAPL260701C00290000'],
      { apiKey: 'secret', fetchImpl: fetchImpl as unknown as typeof fetch, now },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.prices.AAPL260701C00290000?.price).toBe(1.45);
    expect(result.prices.TSLA260429C00420000?.price).toBe(5);
    expect(result.misses).toEqual([]);
  });
});
