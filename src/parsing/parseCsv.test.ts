import { describe, expect, test } from 'vitest';
import { parseCsv } from './parseCsv.ts';

const HEADER = 'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount';

const FIXTURE_5_ROWS = [
  HEADER,
  '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
  '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$795.00',
  '04/24/2026,04/24/2026,04/25/2026,QQQ,QQQ 5/3/2026 Put $400.00,BTO,2,$3.00,($606.00)',
  '04/30/2026,04/30/2026,05/01/2026,QQQ,QQQ 5/3/2026 Put $400.00,STC,2,$1.50,$294.00',
  '05/03/2026,05/03/2026,05/04/2026,AAPL,AAPL 5/10/2026 Call $200.00,OEXP,1,$0.00,$0.00',
].join('\n');

function makeFile(contents: string, name = 'test.csv'): File {
  return new File([contents], name, { type: 'text/csv' });
}

describe('parseCsv (PRD §6.1)', () => {
  test('AC1 — returns Promise<{trades, warnings}>', async () => {
    const result = await parseCsv(makeFile(FIXTURE_5_ROWS));
    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.trades)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('AC2 — 5-row fixture yields 5 trades with typed fields', async () => {
    const { trades, warnings } = await parseCsv(makeFile(FIXTURE_5_ROWS));
    expect(trades).toHaveLength(5);
    expect(warnings).toEqual([]);

    trades.forEach((t) => {
      expect(t.activityDate).toBeInstanceOf(Date);
      expect(typeof t.instrument).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(typeof t.transCode).toBe('string');
      expect(typeof t.quantity).toBe('number');
      expect(typeof t.amount).toBe('number');
    });
  });

  test('AC2 — varied trans codes round-trip into RawTrade', async () => {
    const { trades } = await parseCsv(makeFile(FIXTURE_5_ROWS));
    const codes = trades.map((t) => t.transCode);
    expect(codes).toEqual(['BTO', 'STC', 'BTO', 'STC', 'OEXP']);
  });

  test('signed amounts: parens become negative, plain values positive', async () => {
    const { trades } = await parseCsv(makeFile(FIXTURE_5_ROWS));
    expect(trades[0]?.amount).toBe(-505);
    expect(trades[1]?.amount).toBe(795);
    expect(trades[2]?.amount).toBe(-606);
    expect(trades[3]?.amount).toBe(294);
    expect(trades[4]?.amount).toBe(0);
  });

  test('quantity is a number (not a string)', async () => {
    const { trades } = await parseCsv(makeFile(FIXTURE_5_ROWS));
    expect(trades[2]?.quantity).toBe(2);
  });

  test('activityDate parses to UTC midnight', async () => {
    const { trades } = await parseCsv(makeFile(FIXTURE_5_ROWS));
    expect(trades[0]?.activityDate.toISOString()).toBe('2026-04-24T00:00:00.000Z');
    expect(trades[4]?.activityDate.toISOString()).toBe('2026-05-03T00:00:00.000Z');
  });

  test('skipEmptyLines: blank lines between rows do not produce trades', async () => {
    const csv = [
      HEADER,
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
      '',
      '',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$795.00',
    ].join('\n');
    const { trades } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(2);
  });

  test('row-level normalization error becomes a warning (does not abort)', async () => {
    const csv = [
      HEADER,
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,not-a-number',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$795.00',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(trades[0]?.transCode).toBe('STC');
  });
});
