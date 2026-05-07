import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App.tsx';
import type { ParseCsvOptions, ParseCsvResult, ParseProgress } from './parsing/parseCsv.ts';

type ParseCsvFn = (file: File, options?: ParseCsvOptions) => Promise<ParseCsvResult>;

let pendingResolve: ((result: ParseCsvResult) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;
let capturedOnProgress: ((p: ParseProgress) => void) | null = null;

const parseCsvMock: ParseCsvFn = (_file, options) => {
  capturedOnProgress = options?.onProgress ?? null;
  return new Promise<ParseCsvResult>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
  });
};

vi.mock('./parsing/index.ts', () => ({
  parseCsv: (...args: Parameters<ParseCsvFn>) => parseCsvMock(...args),
  ParseError: class ParseError extends Error {},
}));

const HEADER = 'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount';
const VALID_CSV = [
  HEADER,
  '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($100.00)',
].join('\n');

const getHiddenInput = (): HTMLInputElement => {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('hidden file input not found');
  }
  return input;
};

const dropFile = (name = 'trades.csv'): void => {
  const file = new File([VALID_CSV], name, { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });
};

describe('Processing state UI (PRD §5.1, §7.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pendingResolve = null;
    pendingReject = null;
    capturedOnProgress = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('AC1 — once a file is dropped, dropzone collapses', () => {
    const { container } = render(<App />);
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    dropFile();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  test("AC1 — 'Parsing 1,029 rows…' with Intl comma formatter renders during parsing", () => {
    render(<App />);
    dropFile();
    act(() => {
      capturedOnProgress?.({ rowsProcessed: 1029, bytesProcessed: 100_000, totalBytes: 200_000 });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Parsing 1,029 rows…');
  });

  test("AC1 — singular noun used when exactly 1 row processed", () => {
    render(<App />);
    dropFile();
    act(() => {
      capturedOnProgress?.({ rowsProcessed: 1, bytesProcessed: 50, totalBytes: 200 });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Parsing 1 row…');
  });

  test('AC2 — progress bar is NOT visible before 2s elapsed', () => {
    render(<App />);
    dropFile();
    act(() => {
      capturedOnProgress?.({ rowsProcessed: 100, bytesProcessed: 10_000, totalBytes: 100_000 });
      vi.advanceTimersByTime(1999);
    });
    expect(document.querySelector('progress')).toBeNull();
  });

  test('AC2 — after 2s of parsing, a determinate progress bar is visible', () => {
    render(<App />);
    dropFile();
    act(() => {
      capturedOnProgress?.({ rowsProcessed: 500, bytesProcessed: 50_000, totalBytes: 100_000 });
      vi.advanceTimersByTime(2000);
    });
    const progressBar = document.querySelector('progress');
    expect(progressBar).not.toBeNull();
    expect(progressBar?.getAttribute('max')).toBe('100');
    expect(Number(progressBar?.getAttribute('value'))).toBe(50);
  });

  test('AC2 — progress bar value tracks bytesProcessed/totalBytes ratio', () => {
    render(<App />);
    dropFile();
    act(() => {
      vi.advanceTimersByTime(2000);
      capturedOnProgress?.({ rowsProcessed: 800, bytesProcessed: 80_000, totalBytes: 100_000 });
    });
    const progressBar = document.querySelector('progress');
    expect(Number(progressBar?.getAttribute('value'))).toBeCloseTo(80, 5);
  });

  test('AC3 — on parse completion, processing state hides', async () => {
    render(<App />);
    dropFile();
    act(() => {
      capturedOnProgress?.({ rowsProcessed: 1, bytesProcessed: 100, totalBytes: 100 });
    });
    expect(screen.queryByText(/Parsing/)).not.toBeNull();

    await act(async () => {
      pendingResolve?.({
        trades: [],
        warnings: [],
      });
      await Promise.resolve();
    });

    expect(screen.queryByText(/Parsing/)).toBeNull();
  });

  test('AC3 — on parse rejection, processing state hides and dropzone returns', async () => {
    const { container } = render(<App />);
    dropFile();
    expect(container.querySelector('input[type="file"]')).toBeNull();

    await act(async () => {
      pendingReject?.(new Error('boom'));
      await Promise.resolve();
    });

    expect(screen.queryByText(/Parsing/)).toBeNull();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });
});
