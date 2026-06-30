import {
  fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, expect, test, vi,
} from 'vitest';
import App from './App.tsx';

const HEADER = 'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount';

// One fully-closed contract (realized) + one still-open contract (BTO with no
// matching STC → an open position the unrealized pipeline surfaces).
const MIXED_CSV = [
  HEADER,
  '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 4/26/2026 Call $500.00,BTO,1,$5.00,($100.00)',
  '04/26/2026,04/26/2026,04/27/2026,SPY,SPY 4/26/2026 Call $500.00,STC,1,$8.00,$200.00',
  '04/24/2026,04/24/2026,04/25/2026,SPY,SPY 6/20/2026 Put $480.00,BTO,1,$3.00,($60.00)',
].join('\n');

const getHiddenInput = (): HTMLInputElement => {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('hidden file input not found');
  }
  return input;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('bubbles-1xy: open positions render as unrealized bubbles with a toggle that hides them', async () => {
  // /api/prices resolves with no marks → open position is a neutral bubble.
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ prices: {}, misses: ['SPY 6/20/2026 Put $480.00'] }),
  });
  vi.stubGlobal('fetch', fetchMock);

  const { container } = render(<App />);
  const file = new File([MIXED_CSV], 'trades.csv', { type: 'text/csv' });
  fireEvent.change(getHiddenInput(), { target: { files: [file] } });

  // Realized chart renders immediately.
  await screen.findByRole('region', { name: /total realized p\/l/i });

  // Unrealized bubble fills in once /api/prices resolves.
  await waitFor(() => {
    expect(
      container.querySelectorAll('circle[data-bubble-id^="open|"]'),
    ).toHaveLength(1);
  });

  // The proxy was queried for the open position's contract id.
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/prices?'),
  );

  // Toggle is present (default on) and hides the unrealized bubble when clicked.
  const toggle = await screen.findByRole('button', { name: /hide unrealized bubbles/i });
  fireEvent.click(toggle);

  expect(
    container.querySelectorAll('circle[data-bubble-id^="open|"]'),
  ).toHaveLength(0);
  // Realized bubble is unaffected.
  expect(
    container.querySelectorAll('circle[data-bubble-id^="contract|"]'),
  ).toHaveLength(1);

  // Clicking again re-shows it.
  fireEvent.click(screen.getByRole('button', { name: /show unrealized bubbles/i }));
  expect(
    container.querySelectorAll('circle[data-bubble-id^="open|"]'),
  ).toHaveLength(1);
});
