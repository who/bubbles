import Papa from 'papaparse';
import type { RawTrade } from '../pnl/types';
import { ParseError, parseAmount, parseDate, parseQty } from './normalizers.ts';

export type ParseCsvResult = {
  trades: RawTrade[];
  warnings: string[];
};

const REQUIRED_COLUMNS: ReadonlyArray<{ canonical: string; normalized: string }> = [
  { canonical: 'Activity Date', normalized: 'activity date' },
  { canonical: 'Instrument', normalized: 'instrument' },
  { canonical: 'Description', normalized: 'description' },
  { canonical: 'Trans Code', normalized: 'trans code' },
  { canonical: 'Quantity', normalized: 'quantity' },
  { canonical: 'Amount', normalized: 'amount' },
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function rowToTrade(row: Record<string, string>): RawTrade {
  return {
    activityDate: parseDate(row['activity date'] ?? ''),
    instrument: (row.instrument ?? '').trim(),
    description: (row.description ?? '').trim(),
    transCode: (row['trans code'] ?? '').trim(),
    quantity: parseQty(row.quantity ?? ''),
    amount: parseAmount(row.amount ?? ''),
  };
}

export function parseCsv(file: File): Promise<ParseCsvResult> {
  return new Promise((resolve, reject) => {
    const trades: RawTrade[] = [];
    const warnings: string[] = [];
    let aborted = false;
    let headersValidated = false;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: normalizeHeader,
      step: (results, parser) => {
        if (aborted) return;
        if (!headersValidated) {
          headersValidated = true;
          const fields = new Set(results.meta.fields ?? []);
          const missing = REQUIRED_COLUMNS.find((c) => !fields.has(c.normalized));
          if (missing) {
            aborted = true;
            parser.abort();
            reject(new ParseError(
              `Couldn't find required column: ${missing.canonical}. Is this a Robinhood activity export?`,
              missing.canonical,
            ));
            return;
          }
        }
        try {
          trades.push(rowToTrade(results.data));
        } catch (err) {
          warnings.push(err instanceof Error ? err.message : String(err));
        }
      },
      complete: () => {
        if (!aborted) {
          resolve({ trades, warnings });
        }
      },
      error: (err) => {
        if (!aborted) reject(err);
      },
    });
  });
}
