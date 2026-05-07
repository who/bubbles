import { describe, expect, test } from 'vitest';
import {
  buildRScale,
  buildXScale,
  buildYScale,
  type ChartDatum,
} from './scales.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

const datum = (overrides: Partial<ChartDatum> = {}): ChartDatum => ({
  closeDate: new Date(2026, 3, 15),
  pctReturn: 0,
  pl: 0,
  ...overrides,
});

describe('buildXScale (PRD §7.2 X axis)', () => {
  test('domain expands data extent by ±2 days', () => {
    const data = [
      datum({ closeDate: new Date(2026, 3, 2) }),
      datum({ closeDate: new Date(2026, 3, 15) }),
      datum({ closeDate: new Date(2026, 3, 30) }),
    ];
    const scale = buildXScale(data, 800);
    const [lo, hi] = scale.domain() as [Date, Date];
    expect(lo.getTime()).toBe(new Date(2026, 2, 31).getTime());
    expect(hi.getTime()).toBe(new Date(2026, 4, 2).getTime());
  });

  test('range is [0, width]', () => {
    const scale = buildXScale([datum()], 1000);
    expect(scale.range()).toEqual([0, 1000]);
  });

  test('single point still produces a 4-day-wide domain', () => {
    const scale = buildXScale(
      [datum({ closeDate: new Date(2026, 3, 15) })],
      800,
    );
    const [lo, hi] = scale.domain() as [Date, Date];
    expect(hi.getTime() - lo.getTime()).toBe(4 * DAY_MS);
  });

  test('empty data returns a usable scale', () => {
    const scale = buildXScale([], 800);
    const [lo, hi] = scale.domain() as [Date, Date];
    expect(hi.getTime() - lo.getTime()).toBe(4 * DAY_MS);
    expect(scale.range()).toEqual([0, 800]);
  });
});

describe('buildYScale (PRD §7.2 Y axis)', () => {
  test('AC fixture: range [-78.9, 950.5] → domain [-250, 1000]', () => {
    const data = [
      datum({ pctReturn: -78.9 }),
      datum({ pctReturn: 200 }),
      datum({ pctReturn: 950.5 }),
    ];
    const scale = buildYScale(data, 540);
    expect(scale.domain()).toEqual([-250, 1000]);
  });

  test('range is inverted [height, 0] for SVG y-axis', () => {
    const scale = buildYScale([datum({ pctReturn: 50 })], 540);
    expect(scale.range()).toEqual([540, 0]);
  });

  test('exact multiples of 250 stay put', () => {
    const data = [datum({ pctReturn: -250 }), datum({ pctReturn: 500 })];
    const scale = buildYScale(data, 540);
    expect(scale.domain()).toEqual([-250, 500]);
  });

  test('all-positive data: domain min = 0', () => {
    const data = [datum({ pctReturn: 50 }), datum({ pctReturn: 200 })];
    const scale = buildYScale(data, 540);
    expect(scale.domain()).toEqual([0, 250]);
  });

  test('all-negative data: domain max = 0', () => {
    const data = [datum({ pctReturn: -100 }), datum({ pctReturn: -10 })];
    const scale = buildYScale(data, 540);
    expect(scale.domain()).toEqual([-250, 0]);
  });

  test('zero-range data expands to ±250 to avoid degenerate scale', () => {
    const scale = buildYScale([datum({ pctReturn: 0 })], 540);
    expect(scale.domain()).toEqual([-250, 250]);
  });

  test('empty data falls back to [-250, 250]', () => {
    const scale = buildYScale([], 540);
    expect(scale.domain()).toEqual([-250, 250]);
  });
});

describe('buildRScale (PRD §7.2 bubble radius)', () => {
  test('domain is [0, max(|pl|)] over both gains and losses', () => {
    const data = [
      datum({ pl: 100 }),
      datum({ pl: -1500 }),
      datum({ pl: 800 }),
    ];
    const scale = buildRScale(data);
    expect(scale.domain()).toEqual([0, 1500]);
  });

  test('range is [4, 42]', () => {
    const scale = buildRScale([datum({ pl: 100 })]);
    expect(scale.range()).toEqual([4, 42]);
  });

  test('uses scaleSqrt so area is proportional to |pl|', () => {
    const data = [datum({ pl: 100 })];
    const scale = buildRScale(data);
    // sqrt(0.25) * (42-4) + 4 = 0.5*38 + 4 = 23
    expect(scale(25)).toBeCloseTo(23, 5);
    expect(scale(100)).toBeCloseTo(42, 5);
    expect(scale(0)).toBeCloseTo(4, 5);
  });

  test('empty data does not throw and returns [4,42] range', () => {
    const scale = buildRScale([]);
    expect(scale.range()).toEqual([4, 42]);
  });
});
