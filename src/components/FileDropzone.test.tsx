import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import FileDropzone, { FILE_REJECT_MESSAGE } from './FileDropzone.tsx';

const getDropzone = () => screen.getByRole('button', { name: /upload csv file/i });
const getHiddenInput = (): HTMLInputElement => {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('hidden file input not found');
  }
  return input;
};

const dropFiles = (target: Element, files: File[]) => {
  fireEvent.drop(target, { dataTransfer: { files } });
};

describe('FileDropzone', () => {
  test('AC1: hidden input has accept=".csv" and click delegates to it', () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<FileDropzone onFile={onFile} onError={onError} />);

    const input = getHiddenInput();
    expect(input.accept).toBe('.csv');

    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(getDropzone());
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test('AC2: drag-over toggles the highlight class on enter, over, leave, and drop', () => {
    render(<FileDropzone onFile={vi.fn()} onError={vi.fn()} />);
    const dropzone = getDropzone();

    fireEvent.dragEnter(dropzone);
    expect(dropzone.className).toMatch(/file-dropzone--drag-over/);

    fireEvent.dragLeave(dropzone);
    expect(dropzone.className).not.toMatch(/file-dropzone--drag-over/);

    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toMatch(/file-dropzone--drag-over/);

    dropFiles(dropzone, [new File(['x'], 'a.csv', { type: 'text/csv' })]);
    expect(dropzone.className).not.toMatch(/file-dropzone--drag-over/);
  });

  test('AC3: dropping a .csv file calls onFile with the file', () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<FileDropzone onFile={onFile} onError={onError} />);

    const csv = new File(['col1,col2'], 'trades.csv', { type: 'text/csv' });
    dropFiles(getDropzone(), [csv]);

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(csv);
    expect(onError).not.toHaveBeenCalled();
  });

  test('AC3: file picker selection of a .csv calls onFile', () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<FileDropzone onFile={onFile} onError={onError} />);

    const csv = new File(['col1,col2'], 'trades.csv', { type: 'text/csv' });
    fireEvent.change(getHiddenInput(), { target: { files: [csv] } });

    expect(onFile).toHaveBeenCalledWith(csv);
    expect(onError).not.toHaveBeenCalled();
  });

  test('AC4: dropping a non-CSV calls onError with the §9 message', () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<FileDropzone onFile={onFile} onError={onError} />);

    const png = new File(['binary'], 'photo.png', { type: 'image/png' });
    dropFiles(getDropzone(), [png]);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(FILE_REJECT_MESSAGE);
    expect(onFile).not.toHaveBeenCalled();
  });

  test('AC4: file picker selection of a non-CSV calls onError', () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<FileDropzone onFile={onFile} onError={onError} />);

    const png = new File(['binary'], 'photo.png', { type: 'image/png' });
    fireEvent.change(getHiddenInput(), { target: { files: [png] } });

    expect(onError).toHaveBeenCalledWith(FILE_REJECT_MESSAGE);
    expect(onFile).not.toHaveBeenCalled();
  });

  test('case-insensitive .CSV extension is accepted', () => {
    const onFile = vi.fn();
    render(<FileDropzone onFile={onFile} onError={vi.fn()} />);

    const csv = new File(['x'], 'TRADES.CSV', { type: 'text/csv' });
    dropFiles(getDropzone(), [csv]);

    expect(onFile).toHaveBeenCalledWith(csv);
  });

  test('keyboard Enter on the dropzone opens the picker', () => {
    render(<FileDropzone onFile={vi.fn()} onError={vi.fn()} />);
    const input = getHiddenInput();
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.keyDown(getDropzone(), { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
