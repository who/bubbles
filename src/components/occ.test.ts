import { describe, expect, test } from 'vitest';
import { toOccSymbol } from './occ.ts';

describe('toOccSymbol', () => {
  test('builds a standard OCC symbol from a call fill', () => {
    expect(toOccSymbol('AMD', 'AMD 5/15/2026 Call $185.00')).toBe('AMD260515C00185000');
  });

  test('builds a standard OCC symbol from a put fill', () => {
    expect(toOccSymbol('MSFT', 'MSFT 5/15/2026 Put $410.00')).toBe('MSFT260515P00410000');
  });

  test('zero-pads single-digit month and day', () => {
    expect(toOccSymbol('SPY', 'SPY 5/9/2026 Call $580.00')).toBe('SPY260509C00580000');
  });

  test('handles fractional strikes', () => {
    expect(toOccSymbol('F', 'F 1/16/2026 Call $12.50')).toBe('F260116C00012500');
  });

  test('strips commas from large strikes', () => {
    expect(toOccSymbol('SPX', 'SPX 12/19/2025 Call $5,000.00')).toBe('SPX251219C05000000');
  });

  test('uses the instrument as the root ticker', () => {
    // Description ticker is ignored in favor of the canonical instrument field.
    expect(toOccSymbol('brk.b', 'BRK.B 6/20/2025 Put $400.00')).toBe('BRK.B250620P00400000');
  });

  test('falls back to the trimmed description when it does not parse', () => {
    expect(toOccSymbol('CASH', '  Interest payment  ')).toBe('Interest payment');
  });
});
