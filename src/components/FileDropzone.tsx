import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import './FileDropzone.css';

export interface FileDropzoneProps {
  onFile: (file: File) => void;
  onError: (message: string) => void;
  onUseSample?: () => void;
}

export const FILE_REJECT_MESSAGE = 'Only .csv files are supported.';

const isCsv = (file: File): boolean => /\.csv$/i.test(file.name);

function FileDropzone({ onFile, onError, onUseSample }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (isCsv(file)) {
        onFile(file);
      } else {
        onError(FILE_REJECT_MESSAGE);
      }
    },
    [onFile, onError],
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    },
    [openPicker],
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (inputRef.current) inputRef.current.value = '';
    },
    [handleFile],
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const className = `file-dropzone${isDragOver ? ' file-dropzone--drag-over' : ''}`;

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      aria-label="Upload CSV file"
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="file-dropzone__primary">
        Drag your Robinhood activity CSV here, or click to browse.
      </p>
      <p className="file-dropzone__secondary">
        Your data never leaves this browser.
      </p>
      {onUseSample ? (
        <button
          type="button"
          className="file-dropzone__sample-link"
          onClick={(e) => {
            e.stopPropagation();
            onUseSample();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
        >
          Use sample data
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="file-dropzone__input"
        aria-hidden="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onChange={handleInputChange}
      />
    </div>
  );
}

FileDropzone.defaultProps = {
  onUseSample: undefined,
};

export default FileDropzone;
