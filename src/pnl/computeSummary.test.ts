import { describe, expect, test } from 'vitest';
import { computeSummary } from './computeSummary.ts';
import type { ClosedContract } from './types';

const TOLERANCE_DIGITS = 9;

const contract = (overrides: Partial<ClosedContract> = {}): ClosedContract => ({
  instrument: 'INTC',
  description: 'INTC 4/24/2026 Call $25.00',
  pl: 100,
  pctReturn: 25,
  closedQty: 1,
  costBasis: 400,
  proceeds: 500,
  grossVolume: 900,
  closeDate: new Date('2026-04-25T00:00:00Z'),
  openDate: new Date('2026-04-10T00:00:00Z'),
  tradeCount: 2,
  ...overrides,
});

describe('computeSummary (PRD §6.3)', () => {
  test('AC fixture — 4 winners (sum +200) and 2 losers (sum -50)', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 50, pctReturn: 25 }),
      contract({ pl: 50, pctReturn: 25 }),
      contract({ pl: 50, pctReturn: 25 }),
      contract({ pl: 50, pctReturn: 25 }),
      contract({ pl: -25, pctReturn: -10 }),
      contract({ pl: -25, pctReturn: -10 }),
    ];

    const s = computeSummary(contracts);

    expect(s.totalPl).toBeCloseTo(150, TOLERANCE_DIGITS);
    expect(s.totalGain).toBeCloseTo(200, TOLERANCE_DIGITS);
    expect(s.totalLoss).toBeCloseTo(50, TOLERANCE_DIGITS);
    expect(s.glRatio).toBeCloseTo(4, TOLERANCE_DIGITS);
    expect(s.winnersCount).toBe(4);
    expect(s.losersCount).toBe(2);
    expect(s.totalClosed).toBe(6);
    expect(s.winRate).toBeCloseTo((4 / 6) * 100, TOLERANCE_DIGITS);
    expect(s.avgWin).toBeCloseTo(50, TOLERANCE_DIGITS);
    expect(s.avgLoss).toBeCloseTo(-25, TOLERANCE_DIGITS);
    expect(s.avgPctWin).toBeCloseTo(25, TOLERANCE_DIGITS);
    expect(s.avgPctLoss).toBeCloseTo(-10, TOLERANCE_DIGITS);
  });

  test('AC1 — glRatio formula: totalGain / totalLoss when losses > 0', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 300 }),
      contract({ pl: -100 }),
    ];
    const s = computeSummary(contracts);
    expect(s.glRatio).toBeCloseTo(3, TOLERANCE_DIGITS);
  });

  test('AC1 — glRatio is null when totalLoss === 0 (winners only)', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 100 }),
      contract({ pl: 200 }),
    ];
    const s = computeSummary(contracts);
    expect(s.glRatio).toBeNull();
    expect(s.totalLoss).toBe(0);
    expect(s.losersCount).toBe(0);
  });

  test('AC2 — winRate is winnersCount / totalClosed * 100', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 10 }),
      contract({ pl: 10 }),
      contract({ pl: 10 }),
      contract({ pl: -5 }),
    ];
    const s = computeSummary(contracts);
    expect(s.winRate).toBeCloseTo(75, TOLERANCE_DIGITS);
  });

  test('AC3 — avgWin computed only over winners; avgLoss only over losers (signed negative)', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 80 }),
      contract({ pl: 120 }),
      contract({ pl: -40 }),
      contract({ pl: -60 }),
    ];
    const s = computeSummary(contracts);
    expect(s.avgWin).toBeCloseTo(100, TOLERANCE_DIGITS);
    expect(s.avgLoss).toBeCloseTo(-50, TOLERANCE_DIGITS);
  });

  test('AC4 — avgPctWin/avgPctLoss are simple means of pctReturn over respective groups', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 10, pctReturn: 20 }),
      contract({ pl: 10, pctReturn: 40 }),
      contract({ pl: -5, pctReturn: -8 }),
      contract({ pl: -5, pctReturn: -12 }),
    ];
    const s = computeSummary(contracts);
    expect(s.avgPctWin).toBeCloseTo(30, TOLERANCE_DIGITS);
    expect(s.avgPctLoss).toBeCloseTo(-10, TOLERANCE_DIGITS);
  });

  test('AC5 — parseWarnings echoes the input warnings array', () => {
    const warnings = ['3 rows skipped: malformed', 'Unknown transCode: FOOBAR'];
    const s = computeSummary([], warnings);
    expect(s.parseWarnings).toEqual(warnings);
  });

  test('parseWarnings defaults to empty array when omitted', () => {
    const s = computeSummary([]);
    expect(s.parseWarnings).toEqual([]);
  });

  test('parseWarnings is a defensive copy (not the caller reference)', () => {
    const warnings = ['original'];
    const s = computeSummary([], warnings);
    expect(s.parseWarnings).not.toBe(warnings);
  });

  test('zero-pl ties counted as losers per PRD silent default', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: 100, pctReturn: 50 }),
      contract({ pl: 0, pctReturn: 0 }),
    ];
    const s = computeSummary(contracts);
    expect(s.winnersCount).toBe(1);
    expect(s.losersCount).toBe(1);
    expect(s.totalLoss).toBe(0);
    // glRatio is null because totalLoss magnitude is zero, even though there's a "loser"
    expect(s.glRatio).toBeNull();
    // avgLoss includes the zero-pl tie (sum=0 / count=1 = 0)
    expect(s.avgLoss).toBe(0);
  });

  test('uniqueTickers counts distinct instruments', () => {
    const contracts: ClosedContract[] = [
      contract({ instrument: 'INTC', pl: 10 }),
      contract({ instrument: 'INTC', pl: 20 }),
      contract({ instrument: 'LITE', pl: 30 }),
      contract({ instrument: 'AAPL', pl: -5 }),
    ];
    const s = computeSummary(contracts);
    expect(s.uniqueTickers).toBe(3);
  });

  test('empty input returns zeroed summary with glRatio null', () => {
    const s = computeSummary([]);
    expect(s.totalPl).toBe(0);
    expect(s.totalGain).toBe(0);
    expect(s.totalLoss).toBe(0);
    expect(s.glRatio).toBeNull();
    expect(s.winnersCount).toBe(0);
    expect(s.losersCount).toBe(0);
    expect(s.totalClosed).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.avgWin).toBe(0);
    expect(s.avgLoss).toBe(0);
    expect(s.avgPctWin).toBe(0);
    expect(s.avgPctLoss).toBe(0);
    expect(s.uniqueTickers).toBe(0);
  });

  test('losers-only input: totalGain=0, glRatio=0 (since losses>0)', () => {
    const contracts: ClosedContract[] = [
      contract({ pl: -100 }),
      contract({ pl: -50 }),
    ];
    const s = computeSummary(contracts);
    expect(s.totalGain).toBe(0);
    expect(s.totalLoss).toBeCloseTo(150, TOLERANCE_DIGITS);
    expect(s.glRatio).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.avgWin).toBe(0);
  });
});
