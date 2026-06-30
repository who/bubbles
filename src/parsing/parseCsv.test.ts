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

describe('parseCsv file-level validation (PRD §9)', () => {
  test('AC1 — non-.csv file rejected with verbatim message', async () => {
    const file = new File(['anything'], 'report.txt', { type: 'text/plain' });
    await expect(parseCsv(file)).rejects.toThrow(ParseError);
    await expect(parseCsv(file)).rejects.toThrow('Only .csv files are supported.');
  });

  test('AC1 — extension check is case-insensitive (.CSV passes)', async () => {
    const csv = [HEADER, SAMPLE_ROW].join('\n');
    const file = new File([csv], 'EXPORT.CSV', { type: 'text/csv' });
    const { trades } = await parseCsv(file);
    expect(trades).toHaveLength(1);
  });

  test('AC2 — empty (0-byte) file rejected with verbatim message', async () => {
    const file = new File([], 'empty.csv', { type: 'text/csv' });
    await expect(parseCsv(file)).rejects.toThrow(ParseError);
    await expect(parseCsv(file)).rejects.toThrow('This file is empty.');
  });

  test('AC3 — file >50MB rejected with verbatim message', async () => {
    const oversized = new File(['x'], 'huge.csv', { type: 'text/csv' });
    Object.defineProperty(oversized, 'size', { value: 50 * 1024 * 1024 + 1 });
    await expect(parseCsv(oversized)).rejects.toThrow(ParseError);
    await expect(parseCsv(oversized)).rejects.toThrow(
      'File is unusually large for an activity export. Max 50MB.',
    );
  });

  test('AC3 — file at exactly 50MB threshold is NOT rejected by size guard', async () => {
    const csv = [HEADER, SAMPLE_ROW].join('\n');
    const file = new File([csv], 'edge.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
    const { trades } = await parseCsv(file);
    expect(trades).toHaveLength(1);
  });

  test('AC4 — a 100-byte valid CSV passes through to parsing', async () => {
    const csv = [HEADER, SAMPLE_ROW].join('\n');
    expect(csv.length).toBeGreaterThanOrEqual(100);
    const file = makeFile(csv);
    const { trades, warnings } = await parseCsv(file);
    expect(trades).toHaveLength(1);
    expect(warnings).toEqual([]);
  });
});

describe('parseCsv non-trade row filtering (bubbles-a7j)', () => {
  test('CDIV/ACH/MINT/GOLD/DTAX rows with empty Quantity are skipped silently', async () => {
    const csv = [
      HEADER,
      // Two valid trade fills sandwiching the non-trade rows
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
      // CDIV: empty Quantity, populated Amount
      '04/30/2026,04/30/2026,04/30/2026,JPM,Cash Div: R/D 2026-04-06 P/D 2026-04-30,CDIV,,,$1.02',
      // ACH deposit: empty Quantity, populated Amount
      '04/22/2026,04/22/2026,04/23/2026,,ACH Deposit,ACH,,,"$5,000.00"',
      // MINT margin rate: empty Quantity, populated Amount (parens)
      '04/23/2026,04/23/2026,04/23/2026,,Aggregated Margin Rate,MINT,,,($1.61)',
      // GOLD subscription: empty Quantity, populated Amount (parens)
      '04/23/2026,04/23/2026,04/23/2026,,Gold Subscription Fee,GOLD,,,($5.00)',
      // DTAX foreign withholding: empty Quantity, populated Amount (parens)
      '04/09/2026,04/09/2026,04/09/2026,TSM,Foreign Tax Witholding at $0.33,DTAX,,,($0.33)',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$795.00',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(2);
    expect(trades.map((t) => t.transCode)).toEqual(['BTO', 'STC']);
    expect(warnings).toEqual([]);
  });

  test('OEXP rows are parsed: empty Amount becomes $0.00, trailing-S Quantity parsed, description normalized to fill format (bubbles-10p)', async () => {
    const csv = [
      HEADER,
      '04/22/2026,04/22/2026,04/23/2026,TSLA,TSLA 4/29/2026 Call $420.00,BTO,2,$1.00,($200.00)',
      // OEXP: populated Quantity (with trailing S), empty Amount, expiration-format description
      '04/29/2026,04/29/2026,04/30/2026,TSLA,Option Expiration for TSLA Call $420.00,OEXP,2,,',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(2);
    const oexp = trades[1];
    expect(oexp?.transCode).toBe('OEXP');
    expect(oexp?.amount).toBe(0);
    expect(oexp?.quantity).toBe(2);
    // Description rewritten to the BTO fill format so it buckets together.
    expect(oexp?.description).toBe('TSLA 4/29/2026 Call $420.00');
    expect(oexp?.description).toBe(trades[0]?.description);
  });

  test('OEXP trailing-S quantity like "210S" is parsed to a number', async () => {
    const csv = [
      HEADER,
      '04/29/2026,04/29/2026,04/30/2026,TSLA,Option Expiration for TSLA Call $420.00,OEXP,210S,,',
    ].join('\n');
    const { trades } = await parseCsv(makeFile(csv));
    expect(trades).toHaveLength(1);
    expect(trades[0]?.quantity).toBe(210);
    expect(trades[0]?.amount).toBe(0);
  });

  test('quoted-comma fields in Description and Amount round-trip into RawTrade', async () => {
    // Real Robinhood rows where Description and Amount contain quoted commas
    // (e.g., '$1,190.00' inside Description, '($1,310.12)' as Amount). PapaParse
    // handles RFC 4180 escaping; this test guards against any regression in that path.
    const csv = [
      HEADER,
      '"4/30/2026","4/30/2026","5/1/2026","AAPL","AAPL 5/4/2026 Call $1,190.00","BTO","1","$1.19","($1,190.04)"',
      '"5/1/2026","5/1/2026","5/2/2026","AAPL","AAPL 5/4/2026 Call $1,190.00","STC","1","$1.50","$1,310.12"',
    ].join('\n');
    const { trades, warnings } = await parseCsv(makeFile(csv));
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(2);
    expect(trades[0]?.description).toBe('AAPL 5/4/2026 Call $1,190.00');
    expect(trades[0]?.amount).toBe(-1190.04);
    expect(trades[1]?.amount).toBe(1310.12);
  });

  test('onProgress.rowsProcessed counts non-trade rows alongside trades', async () => {
    const csv = [
      HEADER,
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
      '04/30/2026,04/30/2026,04/30/2026,JPM,Cash Div,CDIV,,,$1.02',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$795.00',
    ].join('\n');
    const calls: number[] = [];
    await parseCsv(makeFile(csv), {
      onProgress: (p) => { calls.push(p.rowsProcessed); },
    });
    expect(calls).toEqual([1, 2, 3]);
  });
});

describe('parseCsv onProgress callback', () => {
  test('fires onProgress for each parsed row with rowsProcessed + bytes + totalBytes', async () => {
    const file = makeFile(FIXTURE_5_ROWS);
    const calls: Array<{ rowsProcessed: number; bytesProcessed: number; totalBytes: number }> = [];
    const { trades } = await parseCsv(file, {
      onProgress: (p) => { calls.push({ ...p }); },
    });
    expect(trades).toHaveLength(5);
    expect(calls.length).toBe(5);
    expect(calls.map((c) => c.rowsProcessed)).toEqual([1, 2, 3, 4, 5]);
    calls.forEach((c) => {
      expect(c.totalBytes).toBe(file.size);
      expect(c.bytesProcessed).toBeGreaterThanOrEqual(0);
      expect(c.bytesProcessed).toBeLessThanOrEqual(file.size);
    });
  });

  test('onProgress counts malformed rows alongside successful trades', async () => {
    const csv = [
      HEADER,
      '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($505.00)',
      '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,not-a-number',
      '04/30/2026,04/30/2026,05/01/2026,QQQ,QQQ 5/3/2026 Put $400.00,STC,2,$1.50,$294.00',
    ].join('\n');
    const calls: number[] = [];
    await parseCsv(makeFile(csv), {
      onProgress: (p) => { calls.push(p.rowsProcessed); },
    });
    expect(calls).toEqual([1, 2, 3]);
  });
});
