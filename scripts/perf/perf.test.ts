/**
 * Perf harness for PRD §8.3 targets:
 *   - 1k row CSV: parse + compute < 500 ms
 *   - 10k row CSV: parse + compute < 5000 ms
 *
 * The 1k/10k passes are gated behind PERF=1 so the default `npm test` scan
 * skips them; only the cheap gen-csv determinism asserts run there. To run
 * the full harness:
 *
 *   npm run perf
 *
 * which invokes `PERF=1 vitest run scripts/perf/perf.test.ts`.
 */

import { describe, expect, test } from 'vitest';
import { parseCsv } from '../../src/parsing/parseCsv.ts';
import { computeClosedContracts, computeSummary } from '../../src/pnl/index.ts';
import { generateCsv } from './gen-csv.ts';

const RUN_PERF = !!(globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.PERF;

const THRESHOLD_1K_MS = 500;
const THRESHOLD_10K_MS = 5000;

async function runPipeline(rowCount: number): Promise<{
  parseMs: number;
  computeMs: number;
  totalMs: number;
  trades: number;
  closedContracts: number;
  totalClosed: number;
}> {
  const csv = generateCsv(rowCount);
  const file = new File([csv], `perf-${rowCount}.csv`, { type: 'text/csv' });

  const t0 = performance.now();
  const { trades, warnings } = await parseCsv(file);
  const t1 = performance.now();
  const closed = computeClosedContracts(trades);
  const summary = computeSummary(closed, warnings);
  const t2 = performance.now();

  return {
    parseMs: t1 - t0,
    computeMs: t2 - t1,
    totalMs: t2 - t0,
    trades: trades.length,
    closedContracts: closed.length,
    totalClosed: summary.totalClosed,
  };
}

describe.skipIf(!RUN_PERF)('perf — parse+compute latency (PRD §8.3)', () => {
  test('1k rows: parse + compute < 500 ms', async () => {
    const result = await runPipeline(1000);
    // eslint-disable-next-line no-console
    console.log(
      `[perf 1k] parse=${result.parseMs.toFixed(1)}ms `
      + `compute=${result.computeMs.toFixed(1)}ms `
      + `total=${result.totalMs.toFixed(1)}ms `
      + `trades=${result.trades} closed=${result.closedContracts}`,
    );
    expect(result.totalMs).toBeLessThan(THRESHOLD_1K_MS);
    expect(result.trades).toBe(1000);
    expect(result.closedContracts).toBeGreaterThan(0);
  });

  test('10k rows: parse + compute < 5000 ms', async () => {
    const result = await runPipeline(10000);
    // eslint-disable-next-line no-console
    console.log(
      `[perf 10k] parse=${result.parseMs.toFixed(1)}ms `
      + `compute=${result.computeMs.toFixed(1)}ms `
      + `total=${result.totalMs.toFixed(1)}ms `
      + `trades=${result.trades} closed=${result.closedContracts}`,
    );
    expect(result.totalMs).toBeLessThan(THRESHOLD_10K_MS);
    expect(result.trades).toBe(10000);
    expect(result.closedContracts).toBeGreaterThan(0);
  });
});

// Always-on sanity check: generator is deterministic. Cheap (string ops only).
describe('gen-csv determinism', () => {
  test('same (rowCount, seed) → byte-identical output', () => {
    const a = generateCsv(100, 42);
    const b = generateCsv(100, 42);
    expect(a).toBe(b);
    expect(a.split('\n').length).toBeGreaterThan(100);
    // Different seed → different output.
    const c = generateCsv(100, 43);
    expect(c).not.toBe(a);
  });

  test('rowCount=0 emits header-only CSV', () => {
    const out = generateCsv(0);
    expect(out.trim().split('\n')).toHaveLength(1);
  });
});
