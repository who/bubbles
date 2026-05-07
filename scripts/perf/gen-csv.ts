/**
 * Deterministic synthetic Robinhood-style activity CSV generator.
 *
 * Used by the perf harness (perf.test.ts) to drive parseCsv → computeClosedContracts
 * → computeSummary at 1k / 10k row scale. Output is byte-identical for the same
 * (rowCount, seed) pair — enables reproducible latency measurements.
 *
 * Layout: emits ⌊rowCount/2⌋ matched BTO/STC pairs of options on a small ticker
 * universe so every contract closes (the engine has full-pipeline work to do).
 * If rowCount is odd, the trailing row is a dangling BTO (still parses; reduces
 * to a non-closed contract that the engine drops).
 */

const TICKERS = [
  'AAPL', 'TSLA', 'AMD', 'PLTR', 'NVDA',
  'MSFT', 'SPY', 'QQQ', 'COIN', 'SOFI',
] as const;

type Rng = () => number;

// Park-Miller LCG (a=16807, m=2^31-1). Deterministic, well-known, no bitwise ops.
function makeRng(seed: number): Rng {
  const M = 2147483647;
  let state = Math.abs(Math.trunc(seed)) % M;
  if (state === 0) state = 1;
  return () => {
    state = (state * 16807) % M;
    return (state - 1) / (M - 1);
  };
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

function pickTicker(rng: Rng): string {
  return TICKERS[Math.floor(rng() * TICKERS.length)] ?? TICKERS[0];
}

function pickInt(rng: Rng, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function formatAmount(n: number): string {
  // Robinhood encodes negatives as ($X,XXX.YY); positives as $X,XXX.YY.
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);
  const wholeStr = whole.toLocaleString('en-US');
  const body = `$${wholeStr}.${pad2(cents)}`;
  return n < 0 ? `(${body})` : body;
}

function formatPrice(n: number): string {
  return `$${n.toFixed(2)}`;
}

const HEADER = '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"';

type Row = {
  date: string;
  ticker: string;
  description: string;
  transCode: 'BTO' | 'STC';
  qty: number;
  price: number;
  amount: number;
};

function csvLine(r: Row): string {
  // Description and Amount can contain commas → quote everything for safety.
  return [
    r.date, r.date, r.date, r.ticker, r.description, r.transCode,
    String(r.qty), formatPrice(r.price), formatAmount(r.amount),
  ].map((f) => `"${f}"`).join(',');
}

export function generateCsv(rowCount: number, seed = 42): string {
  if (!Number.isFinite(rowCount) || rowCount < 0 || Math.floor(rowCount) !== rowCount) {
    throw new Error(`generateCsv: rowCount must be a non-negative integer, got ${String(rowCount)}`);
  }
  const rng = makeRng(seed);
  const lines: string[] = [HEADER];
  const pairs = Math.floor(rowCount / 2);
  for (let i = 0; i < pairs; i += 1) {
    const ticker = pickTicker(rng);
    const openMonth = pickInt(rng, 1, 11);
    const openDay = pickInt(rng, 1, 28);
    const closeDay = Math.min(28, openDay + pickInt(rng, 1, 5));
    const expMonth = openMonth + pickInt(rng, 0, 1);
    const expDay = pickInt(rng, 1, 28);
    const strike = pickInt(rng, 50, 500);
    const isCall = rng() < 0.6;
    const description = `${ticker} ${expMonth}/${expDay}/2026 ${isCall ? 'Call' : 'Put'} $${strike}.00`;
    const qty = pickInt(rng, 1, 50);
    const btoPrice = Number((rng() * 4 + 0.5).toFixed(2));
    // Mostly profitable closes; introduce some losers via the +/- skew.
    const stcPrice = Number((btoPrice + (rng() - 0.4) * 1.5).toFixed(2));
    const stcPriceFinal = stcPrice <= 0.01 ? 0.05 : stcPrice;
    // Treat amount = qty * price (no x100 multiplier — synthetic, not real options math).
    const btoAmount = -(qty * btoPrice);
    const stcAmount = qty * stcPriceFinal;
    const openDate = `${openMonth}/${openDay}/2026`;
    const closeDateMonth = expMonth === openMonth ? openMonth : openMonth;
    const closeDate = `${closeDateMonth}/${closeDay}/2026`;
    lines.push(csvLine({
      date: openDate, ticker, description, transCode: 'BTO', qty, price: btoPrice, amount: btoAmount,
    }));
    lines.push(csvLine({
      date: closeDate, ticker, description, transCode: 'STC', qty, price: stcPriceFinal, amount: stcAmount,
    }));
  }
  // Odd rowCount → trailing dangling BTO (engine drops, parser still counts).
  if (rowCount % 2 === 1) {
    const ticker = pickTicker(rng);
    const description = `${ticker} 6/19/2026 Call $100.00`;
    const qty = pickInt(rng, 1, 10);
    const price = Number((rng() * 3 + 0.5).toFixed(2));
    lines.push(csvLine({
      date: '6/1/2026', ticker, description, transCode: 'BTO', qty, price, amount: -(qty * price),
    }));
  }
  return `${lines.join('\n')}\n`;
}
