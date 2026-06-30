import { describe, expect, test } from 'vitest';
import {
  computeClosedContracts, computeOpenPositions, priceOpenPositions,
} from './computePnl.ts';
import type { RawTrade } from './types';

const TOLERANCE_DIGITS = 9;

const trade = (overrides: Partial<RawTrade> = {}): RawTrade => ({
  activityDate: new Date('2026-04-15T00:00:00Z'),
  instrument: 'INTC',
  description: 'INTC 4/24/2026 Call $25.00',
  transCode: 'BTO',
  quantity: 1,
  amount: -100,
  ...overrides,
});

describe('computeClosedContracts (PRD §6.2)', () => {
  test('AC1 — full close: bto_qty=10, stc_qty=10, bto_amt=-1000, stc_amt=1500', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'BTO', quantity: 10, amount: -1000, activityDate: new Date('2026-04-10T00:00:00Z'),
      }),
      trade({
        transCode: 'STC', quantity: 10, amount: 1500, activityDate: new Date('2026-04-25T00:00:00Z'),
      }),
    ];

    const result = computeClosedContracts(trades);

    expect(result).toHaveLength(1);
    const [c] = result;
    if (!c) throw new Error('missing contract');
    expect(c.instrument).toBe('INTC');
    expect(c.description).toBe('INTC 4/24/2026 Call $25.00');
    expect(c.pl).toBeCloseTo(500, TOLERANCE_DIGITS);
    expect(c.costBasis).toBeCloseTo(1000, TOLERANCE_DIGITS);
    expect(c.pctReturn).toBeCloseTo(50, TOLERANCE_DIGITS);
    expect(c.closedQty).toBe(10);
    expect(c.proceeds).toBeCloseTo(1500, TOLERANCE_DIGITS);
    expect(c.grossVolume).toBeCloseTo(2500, TOLERANCE_DIGITS);
    expect(c.openDate.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(c.closeDate.toISOString()).toBe('2026-04-25T00:00:00.000Z');
    expect(c.tradeCount).toBe(2);
  });

  test('AC2 — partial close: bto_qty=10, stc_qty=5 → closed_qty=5; cost_used proportional', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'BTO', quantity: 10, amount: -1000, activityDate: new Date('2026-04-10T00:00:00Z'),
      }),
      trade({
        transCode: 'STC', quantity: 5, amount: 750, activityDate: new Date('2026-04-25T00:00:00Z'),
      }),
    ];

    const result = computeClosedContracts(trades);

    expect(result).toHaveLength(1);
    const [c] = result;
    if (!c) throw new Error('missing contract');
    expect(c.closedQty).toBe(5);
    // cost_used = -1000 * (5/10) = -500 → costBasis = 500 (proportional)
    expect(c.costBasis).toBeCloseTo(500, TOLERANCE_DIGITS);
    // proceeds_used = 750 * (5/5) = 750 (full proceeds at 5 closed)
    expect(c.proceeds).toBeCloseTo(750, TOLERANCE_DIGITS);
    // pl = -500 + 750 = 250
    expect(c.pl).toBeCloseTo(250, TOLERANCE_DIGITS);
    // pctReturn = (250/500)*100 = 50
    expect(c.pctReturn).toBeCloseTo(50, TOLERANCE_DIGITS);
  });

  test('AC3 — open-only (stc_qty=0) is skipped', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'BTO', quantity: 10, amount: -1000, activityDate: new Date('2026-04-10T00:00:00Z'),
      }),
    ];

    const result = computeClosedContracts(trades);
    expect(result).toHaveLength(0);
  });

  test('AC3 — sold-only (bto_qty=0) is skipped', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'STC', quantity: 5, amount: 750, activityDate: new Date('2026-04-25T00:00:00Z'),
      }),
    ];

    const result = computeClosedContracts(trades);
    expect(result).toHaveLength(0);
  });

  test('AC4 — BTC/STO/OEXP/CDIV trans codes are ignored from the algorithm', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'BTO', quantity: 10, amount: -1000, activityDate: new Date('2026-04-10T00:00:00Z'),
      }),
      trade({
        transCode: 'STC', quantity: 10, amount: 1500, activityDate: new Date('2026-04-25T00:00:00Z'),
      }),
      // Noise rows that should NOT change the math:
      trade({
        transCode: 'BTC', quantity: 5, amount: -250, activityDate: new Date('2026-04-12T00:00:00Z'),
      }),
      trade({
        transCode: 'STO', quantity: 5, amount: 300, activityDate: new Date('2026-04-13T00:00:00Z'),
      }),
      trade({
        transCode: 'OEXP', quantity: 1, amount: 0, activityDate: new Date('2026-04-14T00:00:00Z'),
      }),
      trade({
        transCode: 'CDIV', quantity: 0, amount: 12, activityDate: new Date('2026-04-15T00:00:00Z'),
      }),
    ];

    const result = computeClosedContracts(trades);
    expect(result).toHaveLength(1);
    const [c] = result;
    if (!c) throw new Error('missing contract');
    // Same numbers as AC1 — noise codes ignored.
    expect(c.pl).toBeCloseTo(500, TOLERANCE_DIGITS);
    expect(c.costBasis).toBeCloseTo(1000, TOLERANCE_DIGITS);
    expect(c.pctReturn).toBeCloseTo(50, TOLERANCE_DIGITS);
    expect(c.closedQty).toBe(10);
    // tradeCount counts only the BTO+STC fills used by the algorithm.
    expect(c.tradeCount).toBe(2);
    expect(c.grossVolume).toBeCloseTo(2500, TOLERANCE_DIGITS);
  });

  test('groups by composite (instrument, description) key', () => {
    const trades: RawTrade[] = [
      trade({
        instrument: 'INTC', description: 'INTC 4/24/2026 Call $25.00', transCode: 'BTO', quantity: 10, amount: -1000, activityDate: new Date('2026-04-10T00:00:00Z'),
      }),
      trade({
        instrument: 'INTC', description: 'INTC 4/24/2026 Call $25.00', transCode: 'STC', quantity: 10, amount: 1500, activityDate: new Date('2026-04-25T00:00:00Z'),
      }),
      trade({
        instrument: 'INTC', description: 'INTC 5/01/2026 Call $30.00', transCode: 'BTO', quantity: 4, amount: -400, activityDate: new Date('2026-04-11T00:00:00Z'),
      }),
      trade({
        instrument: 'INTC', description: 'INTC 5/01/2026 Call $30.00', transCode: 'STC', quantity: 4, amount: 200, activityDate: new Date('2026-04-26T00:00:00Z'),
      }),
    ];

    const result = computeClosedContracts(trades);
    expect(result).toHaveLength(2);
    const c25 = result.find((c) => c.description.includes('$25.00'));
    const c30 = result.find((c) => c.description.includes('$30.00'));
    if (!c25 || !c30) throw new Error('missing contract');
    expect(c25.pl).toBeCloseTo(500, TOLERANCE_DIGITS);
    expect(c30.pl).toBeCloseTo(-200, TOLERANCE_DIGITS);
  });

  test('open_date is earliest BTO; close_date is latest STC', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'BTO', quantity: 5, amount: -500, activityDate: new Date('2026-04-12T00:00:00Z'),
      }),
      trade({
        transCode: 'BTO', quantity: 5, amount: -500, activityDate: new Date('2026-04-08T00:00:00Z'),
      }),
      trade({
        transCode: 'STC', quantity: 5, amount: 750, activityDate: new Date('2026-04-22T00:00:00Z'),
      }),
      trade({
        transCode: 'STC', quantity: 5, amount: 750, activityDate: new Date('2026-04-28T00:00:00Z'),
      }),
    ];
    const result = computeClosedContracts(trades);
    expect(result).toHaveLength(1);
    const [c] = result;
    if (!c) throw new Error('missing contract');
    expect(c.openDate.toISOString()).toBe('2026-04-08T00:00:00.000Z');
    expect(c.closeDate.toISOString()).toBe('2026-04-28T00:00:00.000Z');
  });

  test('empty input returns empty array', () => {
    expect(computeClosedContracts([])).toEqual([]);
  });
});

describe('computeClosedContracts — worthless expiration (bubbles-10p)', () => {
  test('long closed by OEXP (no STC) yields proceeds $0, pl = -costBasis, -100%', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'BTO', quantity: 2, amount: -200, activityDate: new Date('2026-04-22T00:00:00Z'),
      }),
      trade({
        transCode: 'OEXP', quantity: 2, amount: 0, activityDate: new Date('2026-04-29T00:00:00Z'),
      }),
    ];

    const result = computeClosedContracts(trades);
    expect(result).toHaveLength(1);
    const [c] = result;
    if (!c) throw new Error('missing contract');
    expect(c.proceeds).toBe(0);
    expect(c.pl).toBeCloseTo(-200, TOLERANCE_DIGITS);
    expect(c.costBasis).toBeCloseTo(200, TOLERANCE_DIGITS);
    expect(c.pctReturn).toBeCloseTo(-100, TOLERANCE_DIGITS);
    expect(c.closedQty).toBe(2);
    expect(c.openDate.toISOString()).toBe('2026-04-22T00:00:00.000Z');
    // Close date is the expiration date.
    expect(c.closeDate.toISOString()).toBe('2026-04-29T00:00:00.000Z');
    expect(c.grossVolume).toBeCloseTo(200, TOLERANCE_DIGITS);
  });

  test('OEXP without any BTO in the bucket produces no contract', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'OEXP', quantity: 1, amount: 0, activityDate: new Date('2026-04-29T00:00:00Z'),
      }),
    ];
    expect(computeClosedContracts(trades)).toHaveLength(0);
  });
});

describe('computeOpenPositions (bubbles-4jt)', () => {
  test('fully-open BTO surfaces openQty, costBasis, openDate', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'BTO', quantity: 10, amount: -1000, activityDate: new Date('2026-04-10T00:00:00Z'),
      }),
    ];

    const result = computeOpenPositions(trades);
    expect(result).toHaveLength(1);
    const [p] = result;
    if (!p) throw new Error('missing position');
    expect(p.instrument).toBe('INTC');
    expect(p.description).toBe('INTC 4/24/2026 Call $25.00');
    expect(p.openQty).toBe(10);
    expect(p.costBasis).toBeCloseTo(1000, TOLERANCE_DIGITS);
    expect(p.openDate.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(p.tradeCount).toBe(1);

    // The same trades produce no realized contract.
    expect(computeClosedContracts(trades)).toHaveLength(0);
  });

  test('partial close leaves the remaining quantity open with proportional cost basis', () => {
    const trades: RawTrade[] = [
      trade({
        transCode: 'BTO', quantity: 10, amount: -1000, activityDate: new Date('2026-04-10T00:00:00Z'),
      }),
      trade({
        transCode: 'STC', quantity: 4, amount: 600, activityDate: new Date('2026-04-25T00:00:00Z'),
      }),
    ];

    const [p] = computeOpenPositions(trades);
    if (!p) throw new Error('missing position');
    expect(p.openQty).toBe(6);
    // costBasis = 1000 * (6/10) = 600 (the un-closed slice)
    expect(p.costBasis).toBeCloseTo(600, TOLERANCE_DIGITS);

    // The closed slice still appears as a realized ClosedContract (unchanged).
    const closed = computeClosedContracts(trades);
    expect(closed).toHaveLength(1);
    expect(closed[0]?.closedQty).toBe(4);
  });

  test('fully closed (STC) and expired (OEXP) buckets are not open', () => {
    const closedTrades: RawTrade[] = [
      trade({ transCode: 'BTO', quantity: 5, amount: -500 }),
      trade({ transCode: 'STC', quantity: 5, amount: 700 }),
    ];
    expect(computeOpenPositions(closedTrades)).toHaveLength(0);

    const expiredTrades: RawTrade[] = [
      trade({ transCode: 'BTO', quantity: 5, amount: -500 }),
      trade({ transCode: 'OEXP', quantity: 5, amount: 0 }),
    ];
    expect(computeOpenPositions(expiredTrades)).toHaveLength(0);
  });

  test('empty input yields no positions', () => {
    expect(computeOpenPositions([])).toEqual([]);
  });
});

describe('priceOpenPositions (bubbles-4jt)', () => {
  test('computes unrealizedPl and pctReturn from a current mark', () => {
    const positions = computeOpenPositions([
      trade({
        transCode: 'BTO', quantity: 10, amount: -1000, activityDate: new Date('2026-04-10T00:00:00Z'),
      }),
    ]);

    // mark $1.50/share → 10 contracts * 100 * 1.50 = $1500 current value.
    const [priced] = priceOpenPositions(positions, { 'INTC 4/24/2026 Call $25.00': 1.5 });
    if (!priced) throw new Error('missing priced position');
    expect(priced.currentPrice).toBe(1.5);
    expect(priced.currentValue).toBeCloseTo(1500, TOLERANCE_DIGITS);
    expect(priced.unrealizedPl).toBeCloseTo(500, TOLERANCE_DIGITS);
    expect(priced.pctReturn).toBeCloseTo(50, TOLERANCE_DIGITS);
  });

  test('an unpriceable position is kept with null/neutral P/L, not dropped', () => {
    const positions = computeOpenPositions([
      trade({ transCode: 'BTO', quantity: 1, amount: -100 }),
    ]);

    // No entry in the price map (UW miss / fictional ticker).
    const [priced] = priceOpenPositions(positions, {});
    if (!priced) throw new Error('missing priced position');
    expect(priced.openQty).toBe(1);
    expect(priced.costBasis).toBeCloseTo(100, TOLERANCE_DIGITS);
    expect(priced.currentPrice).toBeNull();
    expect(priced.currentValue).toBeNull();
    expect(priced.unrealizedPl).toBeNull();
    expect(priced.pctReturn).toBeNull();
  });

  test('a null price entry is treated as a miss', () => {
    const positions = computeOpenPositions([
      trade({ transCode: 'BTO', quantity: 1, amount: -100 }),
    ]);
    const [priced] = priceOpenPositions(positions, { 'INTC 4/24/2026 Call $25.00': null });
    expect(priced?.unrealizedPl).toBeNull();
  });
});
