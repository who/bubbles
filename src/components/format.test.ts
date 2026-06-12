import { describe, expect, test } from 'vitest';
import {
  DASH,
  MASKED_AMOUNT,
  formatCompactCurrency,
  formatPercent,
  formatRatio,
  formatRewardRisk,
  formatSignedCurrency,
  formatSignedPercent,
} from './format.ts';

describe('formatRatio', () => {
  test('formats finite numbers to 2 decimals', () => {
    expect(formatRatio(4)).toBe('4.00');
    expect(formatRatio(1.234)).toBe('1.23');
    expect(formatRatio(0)).toBe('0.00');
  });

  test('returns dash for null and non-finite', () => {
    expect(formatRatio(null)).toBe(DASH);
    expect(formatRatio(Number.NaN)).toBe(DASH);
    expect(formatRatio(Number.POSITIVE_INFINITY)).toBe(DASH);
  });
});

describe('formatSignedCurrency', () => {
  test('positive values get a + prefix', () => {
    expect(formatSignedCurrency(1234.56)).toBe('+$1,234.56');
    expect(formatSignedCurrency(50)).toBe('+$50.00');
  });

  test('negative values keep the - sign from Intl', () => {
    expect(formatSignedCurrency(-1234.56)).toBe('-$1,234.56');
  });

  test('zero is unsigned', () => {
    expect(formatSignedCurrency(0)).toBe('$0.00');
  });

  test('NaN returns dash', () => {
    expect(formatSignedCurrency(Number.NaN)).toBe(DASH);
  });

  test('bubbles-1c2: masked returns the privacy mask regardless of value', () => {
    expect(formatSignedCurrency(1234.56, true)).toBe(MASKED_AMOUNT);
    expect(formatSignedCurrency(-1234.56, true)).toBe(MASKED_AMOUNT);
    expect(formatSignedCurrency(0, true)).toBe(MASKED_AMOUNT);
    expect(formatSignedCurrency(Number.NaN, true)).toBe(MASKED_AMOUNT);
  });
});

describe('formatCompactCurrency', () => {
  test('compact thousands and millions', () => {
    expect(formatCompactCurrency(4800)).toBe('$4.8K');
    expect(formatCompactCurrency(15000)).toBe('$15K');
    expect(formatCompactCurrency(1200000)).toBe('$1.2M');
  });

  test('negative compact', () => {
    expect(formatCompactCurrency(-2400)).toBe('-$2.4K');
  });

  test('NaN returns dash', () => {
    expect(formatCompactCurrency(Number.NaN)).toBe(DASH);
  });

  test('bubbles-1c2: masked returns the privacy mask regardless of value', () => {
    expect(formatCompactCurrency(4800, true)).toBe(MASKED_AMOUNT);
    expect(formatCompactCurrency(-2400, true)).toBe(MASKED_AMOUNT);
    expect(formatCompactCurrency(Number.NaN, true)).toBe(MASKED_AMOUNT);
  });
});

describe('formatPercent', () => {
  test('rounds to N.N% by default', () => {
    expect(formatPercent(66.66667)).toBe('66.7%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  test('honors decimals override', () => {
    expect(formatPercent(66.66667, 2)).toBe('66.67%');
  });

  test('NaN returns dash', () => {
    expect(formatPercent(Number.NaN)).toBe(DASH);
  });
});

describe('formatSignedPercent', () => {
  test('positive gets + prefix', () => {
    expect(formatSignedPercent(5.5)).toBe('+5.5%');
  });

  test('negative keeps - sign', () => {
    expect(formatSignedPercent(-3.2)).toBe('-3.2%');
  });

  test('zero is unsigned', () => {
    expect(formatSignedPercent(0)).toBe('0.0%');
  });

  test('NaN returns dash', () => {
    expect(formatSignedPercent(Number.NaN)).toBe(DASH);
  });
});

describe('formatRewardRisk', () => {
  test('takes magnitude of avgWin/avgLoss to 2 decimals with × suffix', () => {
    expect(formatRewardRisk(1600, -800)).toBe('2.00×');
    expect(formatRewardRisk(50, -25)).toBe('2.00×');
    expect(formatRewardRisk(100, -300)).toBe('0.33×');
  });

  test('zero or non-finite avgLoss returns dash', () => {
    expect(formatRewardRisk(100, 0)).toBe(DASH);
    expect(formatRewardRisk(100, Number.NaN)).toBe(DASH);
  });

  test('non-finite avgWin returns dash', () => {
    expect(formatRewardRisk(Number.NaN, -100)).toBe(DASH);
  });
});
