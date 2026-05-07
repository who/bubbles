import { describe, expect, test } from 'vitest';
import { ParseError } from './normalizers.ts';
import { parseCsv } from './parseCsv.ts';

const HEADER = 'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount';
const SAMPLE_ROW = '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)';

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

describe('parseCsv malformed-row aggregation (PRD §6.1 edge case 3)', () => {
  test('AC1 — 1 malformed row yields warnings === ["1 row skipped: malformed"]', async () => {
    const csv = [
      HEADER,
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,not-a-number',
      '04/30/2026,04/30/2026,05/01/2026,QQQ,QQQ 5/3/2026 Put $400.00,STC,2,$1.50,$294.00',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(2);
    expect(warnings).toEqual(['1 row skipped: malformed']);
  });

  test('AC2 — 3 malformed rows aggregate to "3 rows skipped: malformed"', async () => {
    const csv = [
      HEADER,
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,not-a-number',
      '04/24/2026,04/24/2026,04/25/2026,QQQ,QQQ 5/3/2026 Put $400.00,BTO,oops,$3.00,($606.00)',
      'not-a-date,04/30/2026,05/01/2026,QQQ,QQQ 5/3/2026 Put $400.00,STC,2,$1.50,$294.00',
      '05/03/2026,05/03/2026,05/04/2026,AAPL,AAPL 5/10/2026 Call $200.00,OEXP,1,$0.00,$0.00',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(2);
    expect(warnings).toEqual(['3 rows skipped: malformed']);
  });

  test('AC3 — empty trailing rows are silently dropped (NOT counted)', async () => {
    const csv = [
      HEADER,
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$795.00',
      '',
      '',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(2);
    expect(warnings).toEqual([]);
  });

  test('AC3 — empty trailing rows alongside malformed rows: only malformed counted', async () => {
    const csv = [
      HEADER,
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,not-a-number',
      '',
      '',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(1);
    expect(warnings).toEqual(['1 row skipped: malformed']);
  });

  test('zero malformed rows produces empty warnings array', async () => {
    const { warnings } = await parseCsv(makeFile(FIXTURE_5_ROWS));
    expect(warnings).toEqual([]);
  });
});

describe('parseCsv header normalization & validation (PRD §6.1, §9)', () => {
  test('AC1 — lowercase headers map to canonical fields', async () => {
    const csv = [
      'activity date,process date,settle date,instrument,description,trans code,quantity,price,amount',
      SAMPLE_ROW,
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(1);
    expect(trades[0]?.transCode).toBe('BTO');
  });

  test('AC1 — mixed-case headers map to canonical fields', async () => {
    const csv = [
      'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
      SAMPLE_ROW,
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(1);
  });

  test('AC1 — uppercase headers map to canonical fields', async () => {
    const csv = [
      'ACTIVITY DATE,PROCESS DATE,SETTLE DATE,INSTRUMENT,DESCRIPTION,TRANS CODE,QUANTITY,PRICE,AMOUNT',
      SAMPLE_ROW,
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(1);
    expect(trades[0]?.instrument).toBe('SPY');
  });

  test('AC1 — headers with surrounding whitespace map to canonical fields', async () => {
    const csv = [
      ' Activity Date , Process Date ,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
      SAMPLE_ROW,
    ].join('\n');
    const { trades } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(1);
    expect(trades[0]?.activityDate.toISOString()).toBe('2026-04-24T00:00:00.000Z');
  });

  test('AC2 — missing Trans Code throws PRD §9 message verbatim', async () => {
    const csv = [
      'Activity Date,Process Date,Settle Date,Instrument,Description,Quantity,Price,Amount',
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,1,$5.00,($505.00)',
    ].join('\n');
    await expect(parseCsv(makeFile(csv))).rejects.toThrow(ParseError);
    await expect(parseCsv(makeFile(csv))).rejects.toThrow(
      "Couldn't find required column: Trans Code. Is this a Robinhood activity export?",
    );
  });

  test.each([
    {
      missing: 'Activity Date',
      headerLine: 'Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
      row: '04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
    },
    {
      missing: 'Instrument',
      headerLine: 'Activity Date,Process Date,Settle Date,Description,Trans Code,Quantity,Price,Amount',
      row: '04/24/2026,04/24/2026,04/25/2026,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
    },
    {
      missing: 'Description',
      headerLine: 'Activity Date,Process Date,Settle Date,Instrument,Trans Code,Quantity,Price,Amount',
      row: '04/24/2026,04/24/2026,04/25/2026,SPY,BTO,1,$5.00,($505.00)',
    },
    {
      missing: 'Quantity',
      headerLine: 'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Price,Amount',
      row: '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,$5.00,($505.00)',
    },
    {
      missing: 'Amount',
      headerLine: 'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price',
      row: '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00',
    },
  ])('AC2 — missing $missing throws with that column name in the message', async ({ missing, headerLine, row }) => {
    const csv = [headerLine, row].join('\n');
    await expect(parseCsv(makeFile(csv))).rejects.toThrow(
      `Couldn't find required column: ${missing}. Is this a Robinhood activity export?`,
    );
  });

  test('AC3 — missing optional Process Date does NOT throw', async () => {
    const csv = [
      'Activity Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
      '04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(1);
  });

  test('AC3 — missing optional Settle Date does NOT throw', async () => {
    const csv = [
      'Activity Date,Process Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
      '04/24/2026,04/24/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(1);
  });

  test('AC3 — missing optional Price does NOT throw', async () => {
    const csv = [
      'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Amount',
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,($505.00)',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(1);
  });

  test('AC3 — all three optional columns missing simultaneously does NOT throw', async () => {
    const csv = [
      'Activity Date,Instrument,Description,Trans Code,Quantity,Amount',
      '04/24/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,($505.00)',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(1);
    expect(trades[0]?.amount).toBe(-505);
  });
});
