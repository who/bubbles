import { describe, expect, test } from 'vitest';
import { computeClosedTickers } from './computeTickers.ts';
import type { ClosedContract } from './types';

const TOLERANCE_DIGITS = 9;

const contract = (overrides: Partial<ClosedContract> = {}): ClosedContract => ({
  instrument: 'INTC',
  description: 'INTC 4/24/2026 Call $25.00',
  pl: 0,
  pctReturn: 0,
  closedQty: 0,
  costBasis: 0,
  proceeds: 0,
  grossVolume: 0,
  closeDate: new Date('2026-04-25T00:00:00Z'),
  openDate: new Date('2026-04-10T00:00:00Z'),
  tradeCount: 2,
  ...overrides,
});

describe('computeClosedTickers (PRD §6.2 ticker aggregation)', () => {
  test('AC1 — INTC contracts pl=100 and pl=-50 → ticker.pl===50 and contracts===2', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 100, costBasis: 200 }),
      contract({ pl: -50, costBasis: 100 }),
    ];

    const tickers = computeClosedTickers(contracts);

    expect(tickers).toHaveLength(1);
    const [t] = tickers;
    if (!t) throw new Error('missing ticker');
    expect(t.instrument).toBe('INTC');
    expect(t.pl).toBeCloseTo(50, TOLERANCE_DIGITS);
    expect(t.contracts).toBe(2);
  });

  test('AC2 — pctReturn === sum(pl) / sum(costBasis) * 100', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 100, costBasis: 200 }),
      contract({ pl: -50, costBasis: 100 }),
    ];

    const tickers = computeClosedTickers(contracts);
    const [t] = tickers;
    if (!t) throw new Error('missing ticker');
    // sum(pl) / sum(costBasis) * 100 = 50 / 300 * 100 = 16.6666...
    expect(t.pctReturn).toBeCloseTo((50 / 300) * 100, TOLERANCE_DIGITS);
    expect(t.costBasis).toBeCloseTo(300, TOLERANCE_DIGITS);
  });

  test('AC3 — closeDate is most-recent; openDate is earliest', () => {
    const contracts: ClosedContract[] = [
      contract({
        pl: 10,
        costBasis: 50,
        openDate: new Date('2026-04-12T00:00:00Z'),
        closeDate: new Date('2026-04-22T00:00:00Z'),
      }),
      contract({
        pl: 20,
        costBasis: 80,
        openDate: new Date('2026-04-05T00:00:00Z'),
        closeDate: new Date('2026-04-30T00:00:00Z'),
      }),
      contract({
        pl: -5,
        costBasis: 40,
        openDate: new Date('2026-04-15T00:00:00Z'),
        closeDate: new Date('2026-04-20T00:00:00Z'),
      }),
    ];

    const tickers = computeClosedTickers(contracts);
    const [t] = tickers;
    if (!t) throw new Error('missing ticker');
    expect(t.openDate.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    expect(t.closeDate.toISOString()).toBe('2026-04-30T00:00:00.000Z');
  });

  test('fixture: 3 INTC + 1 LITE → 2 tickers with correct sums and dates', () => {
    const contracts: ClosedContract[] = [
      contract({
        instrument: 'INTC',
        description: 'INTC 4/24/2026 Call $25.00',
        pl: 500,
        costBasis: 1000,
        closedQty: 10,
        grossVolume: 2500,
        openDate: new Date('2026-04-10T00:00:00Z'),
        closeDate: new Date('2026-04-25T00:00:00Z'),
      }),
      contract({
        instrument: 'INTC',
        description: 'INTC 5/01/2026 Call $30.00',
        pl: -200,
        costBasis: 400,
        closedQty: 4,
        grossVolume: 600,
        openDate: new Date('2026-04-11T00:00:00Z'),
        closeDate: new Date('2026-04-26T00:00:00Z'),
      }),
      contract({
        instrument: 'INTC',
        description: 'INTC 5/15/2026 Put $20.00',
        pl: 75,
        costBasis: 300,
        closedQty: 3,
        grossVolume: 675,
        openDate: new Date('2026-04-08T00:00:00Z'),
        closeDate: new Date('2026-05-01T00:00:00Z'),
      }),
      contract({
        instrument: 'LITE',
        description: 'LITE 5/22/2026 Call $50.00',
        pl: 120,
        costBasis: 240,
        closedQty: 2,
        grossVolume: 600,
        openDate: new Date('2026-04-15T00:00:00Z'),
        closeDate: new Date('2026-05-05T00:00:00Z'),
      }),
    ];

    const tickers = computeClosedTickers(contracts);
    expect(tickers).toHaveLength(2);

    const intc = tickers.find((t) => t.instrument === 'INTC');
    const lite = tickers.find((t) => t.instrument === 'LITE');
    if (!intc || !lite) throw new Error('expected INTC and LITE tickers');

    expect(intc.contracts).toBe(3);
    expect(intc.pl).toBeCloseTo(375, TOLERANCE_DIGITS);
    expect(intc.costBasis).toBeCloseTo(1700, TOLERANCE_DIGITS);
    expect(intc.closedQty).toBe(17);
    expect(intc.grossVolume).toBeCloseTo(3775, TOLERANCE_DIGITS);
    expect(intc.pctReturn).toBeCloseTo((375 / 1700) * 100, TOLERANCE_DIGITS);
    expect(intc.openDate.toISOString()).toBe('2026-04-08T00:00:00.000Z');
    expect(intc.closeDate.toISOString()).toBe('2026-05-01T00:00:00.000Z');

    expect(lite.contracts).toBe(1);
    expect(lite.pl).toBeCloseTo(120, TOLERANCE_DIGITS);
    expect(lite.costBasis).toBeCloseTo(240, TOLERANCE_DIGITS);
    expect(lite.pctReturn).toBeCloseTo(50, TOLERANCE_DIGITS);
    expect(lite.openDate.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    expect(lite.closeDate.toISOString()).toBe('2026-05-05T00:00:00.000Z');
  });

  test('empty input returns empty array', () => {
    expect(computeClosedTickers([])).toEqual([]);
  });

  test('zero costBasis → pctReturn === 0 (guard against div-by-zero)', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 0, costBasis: 0 }),
    ];
    const [t] = computeClosedTickers(contracts);
    if (!t) throw new Error('missing ticker');
    expect(t.pctReturn).toBe(0);
  });

  test('single-contract ticker — one contract aggregates to a 1-contract ticker echoing its values', () => {
    const only = contract({
      instrument: 'NVDA',
      description: 'NVDA 6/19/2026 Call $120.00',
      pl: 250,
      costBasis: 500,
      closedQty: 5,
      grossVolume: 1250,
      openDate: new Date('2026-05-01T00:00:00Z'),
      closeDate: new Date('2026-05-20T00:00:00Z'),
    });

    const tickers = computeClosedTickers([only]);

    expect(tickers).toHaveLength(1);
    const [t] = tickers;
    if (!t) throw new Error('missing ticker');
    expect(t.instrument).toBe('NVDA');
    expect(t.contracts).toBe(1);
    expect(t.pl).toBeCloseTo(250, TOLERANCE_DIGITS);
    expect(t.costBasis).toBeCloseTo(500, TOLERANCE_DIGITS);
    expect(t.closedQty).toBe(5);
    expect(t.grossVolume).toBeCloseTo(1250, TOLERANCE_DIGITS);
    expect(t.pctReturn).toBeCloseTo(50, TOLERANCE_DIGITS);
    expect(t.openDate.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(t.closeDate.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  });
});
