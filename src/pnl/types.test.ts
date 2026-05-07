import { expectTypeOf, test } from 'vitest';
import type {
  RawTrade, ClosedContract, ClosedTicker, Summary,
} from './types';

test('RawTrade sample literal compiles', () => {
  const sample: RawTrade = {
    activityDate: new Date('2026-04-15'),
    instrument: 'INTC',
    description: 'INTC 04/19/2026 Call $25.00',
    transCode: 'BTO',
    quantity: 10,
    amount: -1000,
  };
  expectTypeOf(sample).toEqualTypeOf<RawTrade>();
});

test('RawTrade transCode accepts known and arbitrary string literals', () => {
  const known: RawTrade['transCode'] = 'STC';
  const fallback: RawTrade['transCode'] = 'WHATEVER';
  expectTypeOf(known).toBeString();
  expectTypeOf(fallback).toBeString();
});

test('ClosedContract sample literal compiles', () => {
  const sample: ClosedContract = {
    instrument: 'INTC',
    description: 'INTC 04/19/2026 Call $25.00',
    pl: 500,
    pctReturn: 50,
    closedQty: 10,
    costBasis: 1000,
    proceeds: 1500,
    grossVolume: 2500,
    closeDate: new Date('2026-04-25'),
    openDate: new Date('2026-04-10'),
    tradeCount: 2,
  };
  expectTypeOf(sample).toEqualTypeOf<ClosedContract>();
});

test('ClosedTicker sample literal compiles', () => {
  const sample: ClosedTicker = {
    instrument: 'INTC',
    pl: 500,
    pctReturn: 50,
    closedQty: 10,
    costBasis: 1000,
    grossVolume: 2500,
    contracts: 2,
    closeDate: new Date('2026-04-25'),
    openDate: new Date('2026-04-10'),
  };
  expectTypeOf(sample).toEqualTypeOf<ClosedTicker>();
});

test('Summary sample literal compiles with glRatio number and null', () => {
  const withRatio: Summary = {
    totalPl: 200,
    totalGain: 300,
    totalLoss: 100,
    glRatio: 3,
    winnersCount: 4,
    losersCount: 2,
    totalClosed: 6,
    winRate: 66.67,
    avgWin: 75,
    avgLoss: -50,
    avgPctWin: 25,
    avgPctLoss: -10,
    uniqueTickers: 2,
    parseWarnings: ['3 rows skipped: malformed'],
  };
  const noLosses: Summary = { ...withRatio, glRatio: null };
  expectTypeOf(withRatio).toEqualTypeOf<Summary>();
  expectTypeOf(noLosses).toEqualTypeOf<Summary>();
});
