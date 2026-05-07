import { describe, expect, test } from 'vitest';
import {
  ParseError, parseAmount, parseDate, parseQty,
} from './normalizers.ts';

describe('parseAmount (PRD §6.1.1 currency formatting)', () => {
  test('AC1a — parens denote negative: ($1,234.56) → -1234.56', () => {
    expect(parseAmount('($1,234.56)')).toBe(-1234.56);
  });

  test('AC1b — plain dollar amount: $50.00 → 50.00', () => {
    expect(parseAmount('$50.00')).toBe(50.0);
  });

  test('AC1c — empty string throws ParseError', () => {
    expect(() => parseAmount('')).toThrow(ParseError);
  });

  test('whitespace-only string throws ParseError', () => {
    expect(() => parseAmount('   ')).toThrow(ParseError);
  });

  test('positive without dollar sign', () => {
    expect(parseAmount('1234.56')).toBe(1234.56);
  });

  test('explicit minus sign without parens', () => {
    expect(parseAmount('-$1,234.56')).toBe(-1234.56);
  });

  test('thousands separators stripped', () => {
    expect(parseAmount('$1,000,000.00')).toBe(1000000);
  });

  test('integer dollar amount', () => {
    expect(parseAmount('$5')).toBe(5);
  });

  test('parens around whitespace-padded value', () => {
    expect(parseAmount('( $42.00 )')).toBe(-42);
  });

  test('zero', () => {
    expect(parseAmount('$0.00')).toBe(0);
  });

  test('non-numeric body throws ParseError', () => {
    expect(() => parseAmount('not-a-number')).toThrow(ParseError);
  });

  test('lone minus throws ParseError', () => {
    expect(() => parseAmount('-')).toThrow(ParseError);
  });

  test('lone plus throws ParseError', () => {
    expect(() => parseAmount('+')).toThrow(ParseError);
  });

  test('lone parens throws ParseError', () => {
    expect(() => parseAmount('()')).toThrow(ParseError);
  });

  test('non-string input throws ParseError', () => {
    // @ts-expect-error — runtime guard against non-string callers.
    expect(() => parseAmount(undefined)).toThrow(ParseError);
  });

  test('ParseError preserves original input', () => {
    try {
      parseAmount('garbage');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).input).toBe('garbage');
      expect((e as ParseError).name).toBe('ParseError');
      return;
    }
    throw new Error('expected throw');
  });
});

describe('parseQty (PRD §6.1.2 quantity formatting)', () => {
  test('AC2a — trailing S and commas stripped: 1,000S → 1000', () => {
    expect(parseQty('1,000S')).toBe(1000);
  });

  test('AC2b — bare integer: 5 → 5', () => {
    expect(parseQty('5')).toBe(5);
  });

  test('lowercase trailing s also stripped', () => {
    expect(parseQty('100s')).toBe(100);
  });

  test('whitespace trimmed', () => {
    expect(parseQty('  42  ')).toBe(42);
  });

  test('decimal quantity preserved', () => {
    expect(parseQty('2.5')).toBe(2.5);
  });

  test('comma without S', () => {
    expect(parseQty('1,234')).toBe(1234);
  });

  test('empty string throws ParseError', () => {
    expect(() => parseQty('')).toThrow(ParseError);
  });

  test('whitespace-only throws ParseError', () => {
    expect(() => parseQty('   ')).toThrow(ParseError);
  });

  test('garbage throws ParseError', () => {
    expect(() => parseQty('abc')).toThrow(ParseError);
  });

  test('lone S throws ParseError', () => {
    expect(() => parseQty('S')).toThrow(ParseError);
  });

  test('non-string input throws ParseError', () => {
    // @ts-expect-error — runtime guard against non-string callers.
    expect(() => parseQty(null)).toThrow(ParseError);
  });

  test('negative quantity preserved (defensive — Robinhood may emit)', () => {
    expect(parseQty('-3')).toBe(-3);
  });
});

describe('parseDate (PRD §6.1.6 date parsing)', () => {
  test('AC3a — 04/24/2026 → 2026-04-24 UTC midnight', () => {
    const d = parseDate('04/24/2026');
    expect(d.toISOString()).toBe('2026-04-24T00:00:00.000Z');
  });

  test('AC3b — not-a-date throws ParseError', () => {
    expect(() => parseDate('not-a-date')).toThrow(ParseError);
  });

  test('single-digit month and day accepted: 4/2/2026', () => {
    const d = parseDate('4/2/2026');
    expect(d.toISOString()).toBe('2026-04-02T00:00:00.000Z');
  });

  test('leading and trailing whitespace tolerated', () => {
    const d = parseDate('  04/24/2026  ');
    expect(d.toISOString()).toBe('2026-04-24T00:00:00.000Z');
  });

  test('month 0 rejected', () => {
    expect(() => parseDate('00/15/2026')).toThrow(ParseError);
  });

  test('month 13 rejected', () => {
    expect(() => parseDate('13/01/2026')).toThrow(ParseError);
  });

  test('day 0 rejected', () => {
    expect(() => parseDate('04/00/2026')).toThrow(ParseError);
  });

  test('day 32 rejected', () => {
    expect(() => parseDate('04/32/2026')).toThrow(ParseError);
  });

  test('Feb 30 rejected (calendar overflow)', () => {
    expect(() => parseDate('02/30/2026')).toThrow(ParseError);
  });

  test('Apr 31 rejected (calendar overflow)', () => {
    expect(() => parseDate('04/31/2026')).toThrow(ParseError);
  });

  test('two-digit year rejected', () => {
    expect(() => parseDate('04/24/26')).toThrow(ParseError);
  });

  test('ISO format rejected (wrong shape)', () => {
    expect(() => parseDate('2026-04-24')).toThrow(ParseError);
  });

  test('non-string input throws ParseError', () => {
    // @ts-expect-error — runtime guard against non-string callers.
    expect(() => parseDate(20260424)).toThrow(ParseError);
  });

  test('first day of year', () => {
    const d = parseDate('1/1/2026');
    expect(d.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  test('last day of year', () => {
    const d = parseDate('12/31/2026');
    expect(d.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  test('leap day in leap year', () => {
    const d = parseDate('02/29/2024');
    expect(d.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  test('Feb 29 in non-leap year rejected', () => {
    expect(() => parseDate('02/29/2026')).toThrow(ParseError);
  });
});
