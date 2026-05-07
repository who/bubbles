import { fireEvent, render, screen } from '@testing-library/react';
import App from './App.tsx';

const HEADER = 'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount';

const VALID_CSV = [
  HEADER,
  '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($100.00)',
  '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$200.00',
].join('\n');

const MISSING_AMOUNT_CSV = [
  'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price',
  '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00',
].join('\n');

const getHiddenInput = (): HTMLInputElement => {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('hidden file input not found');
  }
  return input;
};

test('renders the PnL Bubbles heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /PnL Bubbles/i })).toBeInTheDocument();
});

test('uploading a valid CSV renders StatsStrip with computed summary', async () => {
  render(<App />);
  const file = new File([VALID_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  const plTile = await screen.findByRole('region', { name: /total realized p\/l/i });
  expect(plTile).toBeInTheDocument();
  expect(plTile.textContent ?? '').toMatch(/\+\$100\.00/);

  expect(
    await screen.findByRole('region', { name: /win rate/i }),
  ).toHaveTextContent('100.0%');
});

test('uploading a non-CSV surfaces the dropzone error message', () => {
  render(<App />);
  const png = new File(['binary'], 'photo.png', { type: 'image/png' });
  fireEvent.change(getHiddenInput(), { target: { files: [png] } });

  expect(screen.getByRole('alert')).toHaveTextContent('Only .csv files are supported.');
  expect(screen.queryByRole('region', { name: /total realized p\/l/i })).not.toBeInTheDocument();
});

test('uploading a CSV missing a required column shows the §9 error verbatim', async () => {
  render(<App />);
  const file = new File([MISSING_AMOUNT_CSV], 'bad.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  const banner = await screen.findByRole('alert');
  expect(banner).toHaveTextContent(
    "Couldn't find required column: Amount. Is this a Robinhood activity export?",
  );
});
