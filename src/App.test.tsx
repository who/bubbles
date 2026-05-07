import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
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
    screen.getByText(/P\/L computed via matched closes:/i),
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

test('bubbles-702.3: empty state shows dropzone copy, privacy note, and sample link', () => {
  render(<App />);
  expect(
    screen.getByText('Drag your Robinhood activity CSV here, or click to browse.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Your data never leaves this browser.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /use sample data/i }),
  ).toBeInTheDocument();
});

test('bubbles-702.3: clicking Use sample data fetches /sample.csv and renders results', async () => {
  const sampleCsv = VALID_CSV;
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob([sampleCsv], { type: 'text/csv' }),
  });
  vi.stubGlobal('fetch', fetchMock);

  try {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /use sample data/i }));

    expect(fetchMock).toHaveBeenCalledWith('/sample.csv');

    const plTile = await screen.findByRole('region', { name: /total realized p\/l/i });
    expect(plTile.textContent ?? '').toMatch(/\+\$100\.00/);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('bubbles-702.3: failed sample fetch surfaces an error banner', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, blob: async () => new Blob() });
  vi.stubGlobal('fetch', fetchMock);

  try {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /use sample data/i }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(/Could not load sample data\./);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('bubbles-xad.5: ViewToggle flips BubbleChart between contract and ticker datasets', async () => {
  // Two contracts on the same instrument → 2 contract bubbles, 1 ticker bubble.
  const TWO_CONTRACT_CSV = [
    HEADER,
    '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($100.00)',
    '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$200.00',
    '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Put $480.00,BTO,1,$3.00,($60.00)',
    '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Put $480.00,STC,1,$1.00,$20.00',
  ].join('\n');

  const { container } = render(<App />);
  const file = new File([TWO_CONTRACT_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  await screen.findByRole('region', { name: /total realized p\/l/i });

  // Default view is "contract" → 2 bubbles
  let chart = container.querySelector('.bubble-chart') as HTMLElement;
  expect(chart).not.toBeNull();
  expect(chart.dataset.groupingMode).toBe('contract');
  expect(chart.querySelectorAll('circle')).toHaveLength(2);

  // ViewToggle counts reflect both datasets
  const tickerBtn = screen.getByRole('radio', { name: /By Ticker · 1/i });
  const contractBtn = screen.getByRole('radio', { name: /By Contract · 2/i });
  expect(contractBtn.getAttribute('aria-checked')).toBe('true');
  expect(tickerBtn.getAttribute('aria-checked')).toBe('false');

  // Flip to ticker → 1 bubble, mode flag flipped
  fireEvent.click(tickerBtn);
  chart = container.querySelector('.bubble-chart') as HTMLElement;
  expect(chart.dataset.groupingMode).toBe('ticker');
  expect(chart.querySelectorAll('circle')).toHaveLength(1);
  expect(chart.querySelectorAll('circle[data-bubble-id^="ticker|"]')).toHaveLength(1);

  // Hover the ticker bubble → tooltip shows ticker fields (instrument + N contracts)
  const tickerCircle = chart.querySelector('circle') as Element;
  fireEvent.mouseEnter(tickerCircle);
  const tip = container.querySelector('.hover-tooltip') as HTMLElement;
  expect(tip).not.toBeNull();
  expect(tip).toHaveTextContent('SPY');
  expect(tip).toHaveTextContent('2 contracts');

  // Flip back to contract → 2 bubbles again, contract ids
  fireEvent.click(screen.getByRole('radio', { name: /By Contract · 2/i }));
  chart = container.querySelector('.bubble-chart') as HTMLElement;
  expect(chart.dataset.groupingMode).toBe('contract');
  expect(chart.querySelectorAll('circle[data-bubble-id^="contract|"]')).toHaveLength(2);
});

test('bubbles-cxs.6: 1 malformed row renders chip "1 row was skipped." with expandable details', async () => {
  // VALID_CSV plus one row with an invalid date → parseCsv produces ["1 row skipped: malformed"]
  const ONE_MALFORMED_CSV = [
    HEADER,
    '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($100.00)',
    '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$200.00',
    '99/99/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$1.00,$1.00',
  ].join('\n');

  const { container } = render(<App />);
  const file = new File([ONE_MALFORMED_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  await screen.findByRole('region', { name: /total realized p\/l/i });

  const details = container.querySelector('details.app__warnings') as HTMLDetailsElement;
  expect(details).not.toBeNull();
  const summary = details.querySelector('summary') as HTMLElement;
  expect(summary.textContent).toBe('1 row was skipped.');

  // Underlying warning text is in the DOM (children of details render even when collapsed)
  expect(details.textContent).toContain('1 row skipped: malformed');

  // Clicking opens the details element
  expect(details.open).toBe(false);
  fireEvent.click(summary);
  expect(details.open).toBe(true);
});

test('bubbles-cxs.6: pluralized chip "N rows were skipped." for >1 malformed', async () => {
  const THREE_MALFORMED_CSV = [
    HEADER,
    '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($100.00)',
    '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$200.00',
    '99/99/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$1.00,$1.00',
    '88/88/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$1.00,$1.00',
    '77/77/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$1.00,$1.00',
  ].join('\n');

  const { container } = render(<App />);
  const file = new File([THREE_MALFORMED_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  await screen.findByRole('region', { name: /total realized p\/l/i });

  const summary = container.querySelector('details.app__warnings summary') as HTMLElement;
  expect(summary).not.toBeNull();
  expect(summary.textContent).toBe('3 rows were skipped.');
});

test('bubbles-cxs.6: no chip rendered when there are no warnings', async () => {
  const { container } = render(<App />);
  const file = new File([VALID_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  await screen.findByRole('region', { name: /total realized p\/l/i });
  expect(container.querySelector('details.app__warnings')).toBeNull();
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
