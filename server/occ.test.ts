import { describe, expect, it } from 'vitest';
import {
  isOccSymbol,
  occSymbolFromDescription,
  parseContractId,
  tickerFromOccSymbol,
} from './occ.ts';

describe('isOccSymbol', () => {
  it('accepts a well-formed UW option symbol', () => {
    expect(isOccSymbol('AAPL260701C00290000')).toBe(true);
  });

  it('rejects a fill description', () => {
    expect(isOccSymbol('TSLA 4/29/2026 Call $420.00')).toBe(false);
  });

  it('rejects junk', () => {
    expect(isOccSymbol('not-a-symbol')).toBe(false);
  });
});

describe('tickerFromOccSymbol', () => {
  it('extracts the root ticker', () => {
    expect(tickerFromOccSymbol('AAPL260701C00290000')).toBe('AAPL');
  });

  it('handles a one-letter root', () => {
    expect(tickerFromOccSymbol('F260116C00012000')).toBe('F');
  });

  it('returns null for a non-symbol', () => {
    expect(tickerFromOccSymbol('garbage')).toBeNull();
  });
});

describe('occSymbolFromDescription', () => {
  it('builds the OCC symbol from a Robinhood call description', () => {
    expect(occSymbolFromDescription('TSLA 4/29/2026 Call $420.00')).toBe('TSLA260429C00420000');
  });

  it('builds the OCC symbol for a put with a fractional strike', () => {
    expect(occSymbolFromDescription('SPY 1/5/2026 Put $612.50')).toBe('SPY260105P00612500');
  });

  it('tolerates a missing dollar sign and commas in the strike', () => {
    expect(occSymbolFromDescription('BRKB 12/19/2025 Call $1,000')).toBe('BRKB251219C01000000');
  });

  it('returns null for an unparseable description', () => {
    expect(occSymbolFromDescription('Dividend for AAPL')).toBeNull();
  });

  it('returns null for an out-of-range month', () => {
    expect(occSymbolFromDescription('AAPL 13/1/2026 Call $100')).toBeNull();
  });
});

describe('parseContractId', () => {
  it('passes through an OCC symbol and derives the ticker', () => {
    expect(parseContractId('aapl260701c00290000')).toEqual({
      ticker: 'AAPL',
      occSymbol: 'AAPL260701C00290000',
    });
  });

  it('converts a description into ticker + symbol', () => {
    expect(parseContractId('TSLA 4/29/2026 Call $420.00')).toEqual({
      ticker: 'TSLA',
      occSymbol: 'TSLA260429C00420000',
    });
  });

  it('returns null for an empty or unparseable id', () => {
    expect(parseContractId('')).toBeNull();
    expect(parseContractId('Option Expiration')).toBeNull();
  });
});
