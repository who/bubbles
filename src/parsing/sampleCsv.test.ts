import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { parseCsv } from './parseCsv.ts';
import { computeClosedContracts, computeSummary } from '../pnl/index.ts';

const SAMPLE_PATH = resolve(__dirname, '../../public/sample.csv');

function loadSampleFile(): File {
  const buf = readFileSync(SAMPLE_PATH);
  return new File([buf], 'sample.csv', { type: 'text/csv' });
}

describe('public/sample.csv (bubbles-cxs.4)', () => {
  test('parses without errors or malformed warnings', async () => {
    const { trades, warnings } = await parseCsv(loadSampleFile());
    expect(warnings).toEqual([]);
    expect(trades.length).toBe(60);
  });

  test('yields ≥30 closed contracts across ≥5 unique tickers', async () => {
    const { trades } = await parseCsv(loadSampleFile());
    const contracts = computeClosedContracts(trades);
    const summary = computeSummary(contracts, []);
    expect(contracts.length).toBeGreaterThanOrEqual(30);
    expect(summary.uniqueTickers).toBeGreaterThanOrEqual(5);
  });

  test('contains a clear winner and clear losers (chart-friendly P/L spread)', async () => {
    const { trades } = await parseCsv(loadSampleFile());
    const contracts = computeClosedContracts(trades);
    const winners = contracts.filter((c) => c.pl > 0);
    const losers = contracts.filter((c) => c.pl < 0);
    expect(winners.length).toBeGreaterThan(0);
    expect(losers.length).toBeGreaterThanOrEqual(2);
    const maxWin = Math.max(...winners.map((c) => c.pl));
    const minLoss = Math.min(...losers.map((c) => c.pl));
    expect(maxWin).toBeGreaterThanOrEqual(1000);
    expect(minLoss).toBeLessThanOrEqual(-1000);
  });
});
