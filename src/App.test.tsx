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

test('results state renders chart card with title, methodology footnote, and Upload another button', async () => {
  render(<App />);
  const file = new File([VALID_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  await screen.findByRole('region', { name: /total realized p\/l/i });

  const chartCard = screen.getByRole('region', { name: /realized gain\/loss details/i });
  expect(chartCard).toBeInTheDocument();
  expect(chartCard).toHaveTextContent('Chart based on 1 record.');

  expect(
    screen.getByText(/Realized P\/L is computed from matched BTO\/STC pairs/i),
  ).toBeInTheDocument();

  expect(
    screen.getByRole('button', { name: /upload another/i }),
  ).toBeInTheDocument();
});

test('results state hides the dropzone and DOM order is stats → chart → methodology → upload-another', async () => {
  const { container } = render(<App />);
  const file = new File([VALID_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  await screen.findByRole('region', { name: /total realized p\/l/i });

  expect(container.querySelector('input[type="file"]')).toBeNull();

  const main = container.querySelector('main') as HTMLElement;
  const stats = main.querySelector('.stats-strip') as HTMLElement;
  const chart = main.querySelector('.app__chart-card') as HTMLElement;
  const methodology = main.querySelector('.app__methodology') as HTMLElement;
  const button = main.querySelector('.app__upload-another') as HTMLElement;

  expect(stats).not.toBeNull();
  expect(chart).not.toBeNull();
  expect(methodology).not.toBeNull();
  expect(button).not.toBeNull();

  const positions = [stats, chart, methodology, button].map((el) => {
    const idx = Array.prototype.indexOf.call(main.children, el);
    return idx === -1 ? Number.POSITIVE_INFINITY : idx;
  });
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(positions.every((p) => p < Number.POSITIVE_INFINITY)).toBe(true);
});

test('clicking Upload another returns to empty state and clears parsed data', async () => {
  render(<App />);
  const file = new File([VALID_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  await screen.findByRole('region', { name: /total realized p\/l/i });

  fireEvent.click(screen.getByRole('button', { name: /upload another/i }));

  expect(screen.queryByRole('region', { name: /total realized p\/l/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /realized gain\/loss details/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /upload another/i })).not.toBeInTheDocument();

  expect(screen.getByRole('button', { name: /upload csv file/i })).toBeInTheDocument();
});
