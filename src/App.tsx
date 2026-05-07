import { useCallback, useState } from 'react';
import { FileDropzone, StatsStrip } from './components/index.ts';
import { parseCsv } from './parsing/index.ts';
import { computeClosedContracts, computeSummary } from './pnl/index.ts';
import type { Summary } from './pnl/index.ts';
import './App.css';

type Status = 'empty' | 'parsing' | 'results' | 'error';

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

  return (
    <main className="app">
      <h1>PnL Bubbles</h1>
      {error ? (
        <p className="app__error" role="alert">
          {error}
        </p>
      ) : null}
      <FileDropzone onFile={handleFile} onError={handleError} />
      {status === 'parsing' && fileName ? (
        <p className="app__status" role="status">
          Parsing
          {' '}
          {fileName}
          …
        </p>
      ) : null}
      {status === 'results' && summary ? (
        <>
          <StatsStrip summary={summary} />
          {warnings.length > 0 ? (
            <ul className="app__warnings" role="status">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

export default App;
