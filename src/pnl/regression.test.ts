import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { parseCsv } from '../parsing/parseCsv.ts';
import { computeClosedContracts, computeSummary } from './index.ts';
import type { ClosedContract } from './types';

const FIXTURE_PATH = resolve(__dirname, '__fixtures__/canonical-april-2026.csv');

function loadFixture(): File {
  const buf = readFileSync(FIXTURE_PATH);
  return new File([buf], 'canonical-april-2026.csv', { type: 'text/csv' });
}

describe('canonical Robinhood fixture regression (bubbles-zvr.6)', () => {
  test('AC1 — parseCsv reads the fixture without throwing', async () => {
    const { trades } = await parseCsv(loadFixture());
    expect(Array.isArray(trades)).toBe(true);
    expect(trades.length).toBeGreaterThan(0);
  });

  test('AC2 — engine produces well-formed result with finite P/L and best/worst shape', async () => {
    const { trades, warnings } = await parseCsv(loadFixture());
    const contracts = computeClosedContracts(trades);
    const summary = computeSummary(contracts, warnings);

    expect(contracts.length).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(summary.totalPl)).toBe(true);

    const sortedByPl = [...contracts].sort((a, b) => b.pl - a.pl);
    const best: ClosedContract | undefined = sortedByPl[0];
    const worst: ClosedContract | undefined = sortedByPl[sortedByPl.length - 1];

    if (contracts.length > 0) {
      expect(best).toBeDefined();
      expect(worst).toBeDefined();
      expect(Number.isFinite(best!.pl)).toBe(true);
      expect(Number.isFinite(worst!.pl)).toBe(true);
      expect(best!.pl).toBeGreaterThanOrEqual(worst!.pl);
    } else {
      expect(best).toBeUndefined();
      expect(worst).toBeUndefined();
    }
  });

  test('AC3 — per-side accounting is internally consistent', async () => {
    const { trades, warnings } = await parseCsv(loadFixture());
    const contracts = computeClosedContracts(trades);
    const summary = computeSummary(contracts, warnings);

    const sumOfContractPls = contracts.reduce((acc, c) => acc + c.pl, 0);
    expect(Math.abs(sumOfContractPls - summary.totalPl)).toBeLessThanOrEqual(0.01);

    expect(summary.winRate).toBeGreaterThanOrEqual(0);
    expect(summary.winRate).toBeLessThanOrEqual(100);

    if (summary.winnersCount > 0) {
      expect(summary.avgWin).toBeGreaterThanOrEqual(0);
    }
    if (summary.losersCount > 0) {
      expect(summary.avgLoss).toBeLessThanOrEqual(0);
    }
  });
});
