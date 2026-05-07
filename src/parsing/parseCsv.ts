import Papa from 'papaparse';
import type { RawTrade } from '../pnl/types';
import { parseAmount, parseDate, parseQty } from './normalizers.ts';

export type ParseCsvResult = {
  trades: RawTrade[];
  warnings: string[];
};

const COLUMN_ACTIVITY_DATE = 'Activity Date';
const COLUMN_INSTRUMENT = 'Instrument';
const COLUMN_DESCRIPTION = 'Description';
const COLUMN_TRANS_CODE = 'Trans Code';
const COLUMN_QUANTITY = 'Quantity';
const COLUMN_AMOUNT = 'Amount';

function rowToTrade(row: Record<string, string>): RawTrade {
  return {
    activityDate: parseDate(row[COLUMN_ACTIVITY_DATE] ?? ''),
    instrument: (row[COLUMN_INSTRUMENT] ?? '').trim(),
    description: (row[COLUMN_DESCRIPTION] ?? '').trim(),
    transCode: (row[COLUMN_TRANS_CODE] ?? '').trim(),
    quantity: parseQty(row[COLUMN_QUANTITY] ?? ''),
    amount: parseAmount(row[COLUMN_AMOUNT] ?? ''),
  };
}

export function parseCsv(file: File): Promise<ParseCsvResult> {
  return new Promise((resolve, reject) => {
    const trades: RawTrade[] = [];
    const warnings: string[] = [];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      step: (results) => {
        try {
          trades.push(rowToTrade(results.data));
        } catch (err) {
          warnings.push(err instanceof Error ? err.message : String(err));
        }
      },
      complete: () => {
        resolve({ trades, warnings });
      },
      error: (err) => {
        reject(err);
      },
    });
  });
}
