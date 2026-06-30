// Core /api/prices logic: resolve a set of open-position contract identifiers
// to current option marks sourced from Unusual Whales.
//
// This module is deliberately free of Node/HTTP specifics so it can be unit
// tested with an injected fetch. The HTTP plumbing (env, routing) lives in
// handler.ts / vitePlugin.ts / index.ts.

import { parseContractId } from './occ.ts';

export type PriceQuote = {
  price: number;
  asOf: string;
};

export type PriceResult = {
  prices: Record<string, PriceQuote>;
  misses: string[];
};

export type FetchPricesDeps = {
  apiKey: string;
  // Injected so tests can stub UW and prod can pass global fetch.
  fetchImpl?: typeof fetch;
  // Injected clock for deterministic `asOf` stamps.
  now?: () => Date;
  // UW API base; overridable for tests. Defaults to the public API host.
  baseUrl?: string;
};

const DEFAULT_BASE_URL = 'https://api.unusualwhales.com';

// A single contract row from UW's option-contracts response. All numeric
// fields arrive as strings; only the ones we price off of are typed here.
type UwContract = {
  option_symbol?: string;
  last_price?: string | number | null;
  nbbo_bid?: string | number | null;
  nbbo_ask?: string | number | null;
};

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// Current mark for a contract: NBBO midpoint when a two-sided quote exists,
// otherwise the last traded price. Returns null when nothing is priceable.
export function markFromContract(contract: UwContract): number | null {
  const bid = toNumber(contract.nbbo_bid);
  const ask = toNumber(contract.nbbo_ask);
  if (bid !== null && ask !== null && bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }
  const last = toNumber(contract.last_price);
  if (last !== null && last > 0) {
    return last;
  }
  return null;
}

// UW wraps contract arrays under varying keys across endpoints; pull whichever
// is present.
function extractContracts(payload: unknown): UwContract[] {
  if (Array.isArray(payload)) {
    return payload as UwContract[];
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const key = ['data', 'chains', 'result'].find((k) => Array.isArray(record[k]));
    if (key) {
      return record[key] as UwContract[];
    }
  }
  return [];
}

async function fetchTickerMarks(
  ticker: string,
  occSymbols: string[],
  deps: Required<Pick<FetchPricesDeps, 'apiKey' | 'baseUrl'>> & { fetchImpl: typeof fetch },
): Promise<Map<string, number>> {
  const params = new URLSearchParams();
  occSymbols.forEach((symbol) => params.append('option_symbol[]', symbol));
  params.set('limit', '500');

  const url = `${deps.baseUrl}/api/stock/${encodeURIComponent(ticker)}/option-contracts?${params.toString()}`;
  const response = await deps.fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${deps.apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    // Treat a ticker-level failure (unknown ticker, UW hiccup) as "no marks";
    // the caller folds the affected ids into `misses` rather than erroring out.
    return new Map();
  }

  const payload = await response.json();
  const marks = new Map<string, number>();
  extractContracts(payload).forEach((contract) => {
    if (typeof contract.option_symbol !== 'string') {
      return;
    }
    const mark = markFromContract(contract);
    if (mark !== null) {
      marks.set(contract.option_symbol.toUpperCase(), mark);
    }
  });
  return marks;
}

// Resolve current marks for the requested contract identifiers. Identifiers
// that cannot be parsed, belong to an unknown ticker, or have no priceable
// quote are returned in `misses` rather than throwing.
export async function fetchPrices(
  ids: readonly string[],
  deps: FetchPricesDeps,
): Promise<PriceResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const baseUrl = (deps.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

  const prices: Record<string, PriceQuote> = {};
  const misses: string[] = [];

  // De-duplicate while preserving the caller's identifiers for the response.
  const resolved: { id: string; ticker: string; occSymbol: string }[] = [];
  const byTicker = new Map<string, Set<string>>();
  const seen = new Set<string>();

  ids.forEach((rawId) => {
    const id = rawId.trim();
    if (id === '' || seen.has(id)) {
      return;
    }
    seen.add(id);

    const parsed = parseContractId(id);
    if (!parsed) {
      misses.push(id);
      return;
    }
    resolved.push({ id, ...parsed });
    const set = byTicker.get(parsed.ticker) ?? new Set<string>();
    set.add(parsed.occSymbol);
    byTicker.set(parsed.ticker, set);
  });

  if (resolved.length === 0) {
    return { prices, misses };
  }

  const marksByTicker = new Map<string, Map<string, number>>();
  await Promise.all(
    [...byTicker.entries()].map(async ([ticker, symbols]) => {
      const marks = await fetchTickerMarks(ticker, [...symbols], {
        apiKey: deps.apiKey,
        baseUrl,
        fetchImpl,
      });
      marksByTicker.set(ticker, marks);
    }),
  );

  const asOf = now().toISOString();
  resolved.forEach(({ id, ticker, occSymbol }) => {
    const mark = marksByTicker.get(ticker)?.get(occSymbol);
    if (mark === undefined) {
      misses.push(id);
    } else {
      prices[id] = { price: mark, asOf };
    }
  });

  return { prices, misses };
}
