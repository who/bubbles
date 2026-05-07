import { useCallback, useEffect, useState } from 'react';
import { FileDropzone, StatsStrip, ViewToggle } from './components/index.ts';
import type { ViewMode } from './components/index.ts';
import { BubbleChart } from './components/chart/index.ts';
import { parseCsv } from './parsing/index.ts';
import {
  computeClosedContracts,
  computeClosedTickers,
  computeSummary,
} from './pnl/index.ts';
import type { ClosedContract, ClosedTicker, Summary } from './pnl/index.ts';
import './App.css';

type Status = 'empty' | 'parsing' | 'results' | 'error';

const METHODOLOGY_TEXT = 'Realized P/L is computed from matched BTO/STC pairs per contract using proportional cost allocation. Open positions and BTC/STO/OEXP/CDIV transactions are excluded.';

const PROGRESS_BAR_DELAY_MS = 2000;

const ROW_COUNT_FORMATTER = new Intl.NumberFormat('en-US');

function App() {
  const [status, setStatus] = useState<Status>('empty');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [contracts, setContracts] = useState<ClosedContract[]>([]);
  const [tickers, setTickers] = useState<ClosedTicker[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('contract');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowsParsed, setRowsParsed] = useState(0);
  const [bytesProcessed, setBytesProcessed] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [showProgressBar, setShowProgressBar] = useState(false);

  useEffect(() => {
    if (status !== 'parsing') {
      setShowProgressBar(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setShowProgressBar(true);
    }, PROGRESS_BAR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  const handleFile = useCallback(async (file: File) => {
    setStatus('parsing');
    setError(null);
    setSummary(null);
    setContracts([]);
    setTickers([]);
    setViewMode('contract');
    setWarnings([]);
    setFileName(file.name);
    setRowsParsed(0);
    setBytesProcessed(0);
    setTotalBytes(file.size);

    try {
      const { trades, warnings: parseWarnings } = await parseCsv(file, {
        onProgress: ({ rowsProcessed, bytesProcessed: bp, totalBytes: tb }) => {
          setRowsParsed(rowsProcessed);
          setBytesProcessed(bp);
          setTotalBytes(tb);
        },
      });
      const closedContracts = computeClosedContracts(trades);
      const closedTickers = computeClosedTickers(closedContracts);
      const computed = computeSummary(closedContracts, parseWarnings);
      setContracts(closedContracts);
      setTickers(closedTickers);
      setSummary(computed);
      setWarnings(parseWarnings);
      setStatus('results');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to parse CSV.';
      setError(message);
      setSummary(null);
      setContracts([]);
      setTickers([]);
      setWarnings([]);
      setStatus('error');
    }
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    setSummary(null);
    setWarnings([]);
    setStatus('error');
  }, []);

  const handleUseSample = useCallback(async () => {
    try {
      const response = await fetch('/sample.csv');
      if (!response.ok) {
        throw new Error('Could not load sample data.');
      }
      const blob = await response.blob();
      const file = new File([blob], 'sample.csv', { type: 'text/csv' });
      handleFile(file);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load sample data.';
      handleError(message);
    }
  }, [handleFile, handleError]);

  const handleReset = useCallback(() => {
    setStatus('empty');
    setSummary(null);
    setContracts([]);
    setTickers([]);
    setViewMode('contract');
    setWarnings([]);
    setError(null);
    setFileName(null);
    setRowsParsed(0);
    setBytesProcessed(0);
    setTotalBytes(0);
  }, []);

  const showResults = status === 'results' && summary;
  const showDropzone = status === 'empty' || status === 'error';
  const progressPercent = totalBytes > 0
    ? Math.min(100, Math.max(0, (bytesProcessed / totalBytes) * 100))
    : 0;

  return (
    <main className="app">
      <h1>PnL Bubbles</h1>
      {error ? (
        <p className="app__error" role="alert">
          {error}
        </p>
      ) : null}
      {showDropzone ? (
        <FileDropzone
          onFile={handleFile}
          onError={handleError}
          onUseSample={handleUseSample}
        />
      ) : null}
      {status === 'parsing' && fileName ? (
        <div className="app__processing" role="status" aria-live="polite">
          <p className="app__status">
            Parsing
            {' '}
            {ROW_COUNT_FORMATTER.format(rowsParsed)}
            {' '}
            {rowsParsed === 1 ? 'row' : 'rows'}
            …
          </p>
          {showProgressBar ? (
            <progress
              className="app__progress"
              value={progressPercent}
              max={100}
              aria-label="Parse progress"
            />
          ) : null}
        </div>
      ) : null}
      {showResults ? (
        <>
          <StatsStrip summary={summary} />
          <section className="app__chart-card" aria-labelledby="app__chart-title">
            <header className="app__chart-header">
              <h2 id="app__chart-title" className="app__chart-title">
                Realized Gain/Loss Details
              </h2>
              <p className="app__chart-subtitle">
                Chart based on
                {' '}
                {summary.totalClosed}
                {' '}
                {summary.totalClosed === 1 ? 'record' : 'records'}
                .
              </p>
            </header>
            <ViewToggle
              value={viewMode}
              onChange={setViewMode}
              counts={{ contract: contracts.length, ticker: tickers.length }}
            />
            <div className="app__chart-slot">
              {viewMode === 'contract' ? (
                <BubbleChart data={contracts} groupingMode="contract" />
              ) : (
                <BubbleChart data={tickers} groupingMode="ticker" />
              )}
            </div>
          </section>
          {warnings.length > 0 ? (
            <ul className="app__warnings" role="status">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <p className="app__methodology">{METHODOLOGY_TEXT}</p>
          <button
            type="button"
            className="app__upload-another"
            onClick={handleReset}
          >
            Upload another
          </button>
        </>
      ) : null}
    </main>
  );
}

export default App;
