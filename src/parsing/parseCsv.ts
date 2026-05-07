import Papa from 'papaparse';
import type { RawTrade } from '../pnl/types';
import { ParseError, parseAmount, parseDate, parseQty } from './normalizers.ts';

export type ParseCsvResult = {
  trades: RawTrade[];
  warnings: string[];
};

export type ParseProgress = {
  rowsProcessed: number;
  bytesProcessed: number;
  totalBytes: number;
};

export type ParseCsvOptions = {
  onProgress?: (progress: ParseProgress) => void;
};

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const NON_CSV_MESSAGE = 'Only .csv files are supported.';
const EMPTY_FILE_MESSAGE = 'This file is empty.';
const FILE_TOO_LARGE_MESSAGE = 'File is unusually large for an activity export. Max 50MB.';

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

export function parseCsv(file: File, options?: ParseCsvOptions): Promise<ParseCsvResult> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      reject(new ParseError(NON_CSV_MESSAGE, file.name));
      return;
    }
    if (file.size === 0) {
      reject(new ParseError(EMPTY_FILE_MESSAGE, file.name));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      reject(new ParseError(FILE_TOO_LARGE_MESSAGE, file.name));
      return;
    }

    const trades: RawTrade[] = [];
    const warnings: string[] = [];
    let aborted = false;
    let headersValidated = false;
    let malformedCount = 0;

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
        } catch {
          malformedCount += 1;
        }
        if (options?.onProgress) {
          options.onProgress({
            rowsProcessed: trades.length + malformedCount,
            bytesProcessed: results.meta.cursor ?? 0,
            totalBytes: file.size,
          });
        }
      },
      complete: () => {
        if (aborted) return;
        if (malformedCount > 0) {
          const noun = malformedCount === 1 ? 'row' : 'rows';
          warnings.push(`${malformedCount} ${noun} skipped: malformed`);
        }
        resolve({ trades, warnings });
      },
      error: (err) => {
        if (!aborted) reject(err);
      },
    });
  });
}
