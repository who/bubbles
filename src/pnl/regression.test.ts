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

function makeFile(contents: string): File {
  return new File([contents], 'worthless.csv', { type: 'text/csv' });
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

describe('worthless option expiration end-to-end (bubbles-10p)', () => {
  test('BTO followed by an OEXP row (empty Amount, differing description) becomes a -100% loss bubble', async () => {
    const HEADER = 'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount';
    const csv = [
      HEADER,
      // Bought 2 contracts for $200.
      '04/22/2026,04/22/2026,04/23/2026,TSLA,TSLA 4/29/2026 Call $420.00,BTO,2,$1.00,($200.00)',
      // Expired worthless — OEXP row carries an empty Amount and the
      // "Option Expiration for ..." description that must bucket with the BTO.
      '04/29/2026,04/29/2026,04/30/2026,TSLA,Option Expiration for TSLA Call $420.00,OEXP,2,,',
    ].join('\n');

    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(2);

    const contracts = computeClosedContracts(trades);
    expect(contracts).toHaveLength(1);
    const [c] = contracts;
    if (!c) throw new Error('missing contract');
    expect(c.instrument).toBe('TSLA');
    expect(c.description).toBe('TSLA 4/29/2026 Call $420.00');
    expect(c.proceeds).toBe(0);
    expect(c.pl).toBeCloseTo(-200, 9);
    expect(c.pctReturn).toBeCloseTo(-100, 9);

    const summary = computeSummary(contracts, warnings);
    expect(summary.totalPl).toBeCloseTo(-200, 9);
    expect(summary.losersCount).toBe(1);
  });
});
