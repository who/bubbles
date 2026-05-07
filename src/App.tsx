import { useCallback, useState } from 'react';
import { FileDropzone, StatsStrip } from './components/index.ts';
import { parseCsv } from './parsing/index.ts';
import { computeClosedContracts, computeSummary } from './pnl/index.ts';
import type { Summary } from './pnl/index.ts';
import './App.css';

type Status = 'empty' | 'parsing' | 'results' | 'error';

const METHODOLOGY_TEXT = 'Realized P/L is computed from matched BTO/STC pairs per contract using proportional cost allocation. Open positions and BTC/STO/OEXP/CDIV transactions are excluded.';

function App() {
  const [status, setStatus] = useState<Status>('empty');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setStatus('parsing');
    setError(null);
    setSummary(null);
    setWarnings([]);
    setFileName(file.name);

    try {
      const { trades, warnings: parseWarnings } = await parseCsv(file);
      const contracts = computeClosedContracts(trades);
      const computed = computeSummary(contracts, parseWarnings);
      setSummary(computed);
      setWarnings(parseWarnings);
      setStatus('results');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to parse CSV.';
      setError(message);
      setSummary(null);
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

  const handleReset = useCallback(() => {
    setStatus('empty');
    setSummary(null);
    setWarnings([]);
    setError(null);
    setFileName(null);
  }, []);

  const showResults = status === 'results' && summary;
  const showDropzone = status !== 'results';

  return (
    <main className="app">
      <h1>PnL Bubbles</h1>
      {error ? (
        <p className="app__error" role="alert">
          {error}
        </p>
      ) : null}
      {showDropzone ? (
        <FileDropzone onFile={handleFile} onError={handleError} />
      ) : null}
      {status === 'parsing' && fileName ? (
        <p className="app__status" role="status">
          Parsing
          {' '}
          {fileName}
          …
        </p>
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
            <div className="app__chart-slot" aria-hidden="true" />
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
