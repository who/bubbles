import { useState } from 'react';
import { FileDropzone } from './components/index.ts';
import './App.css';

function App() {
  const [acceptedFile, setAcceptedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    setAcceptedFile(file);
  };

  const handleError = (message: string) => {
    setAcceptedFile(null);
    setError(message);
  };

  return (
    <main className="app">
      <h1>PnL Bubbles</h1>
      {error ? (
        <p className="app__error" role="alert">
          {error}
        </p>
      ) : null}
      <FileDropzone onFile={handleFile} onError={handleError} />
      {acceptedFile ? (
        <p className="app__accepted">Loaded: {acceptedFile.name}</p>
      ) : null}
    </main>
  );
}

export default App;
