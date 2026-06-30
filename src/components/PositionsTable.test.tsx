import { render, screen, within } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import PositionsTable from './PositionsTable.tsx';
import { PrivacyModeProvider } from './usePrivacyMode.tsx';
import {
  UnrealizedModeProvider,
  UNREALIZED_MODE_STORAGE_KEY,
} from './useUnrealizedMode.tsx';
import type { ClosedContract, UnrealizedPosition } from '../pnl/index.ts';

const CLOSED_WIN: ClosedContract = {
  instrument: 'AMD',
  description: 'AMD 5/15/2026 Call $185.00',
  pl: 374.2,
  pctReturn: 21.7,
  closedQty: 5,
  costBasis: 1725.2,
  proceeds: 2099.4,
  grossVolume: 3824.6,
  closeDate: new Date('2026-05-05T00:00:00Z'),
  openDate: new Date('2026-05-05T00:00:00Z'),
  tradeCount: 2,
};

const CLOSED_LOSS: ClosedContract = {
  instrument: 'MSFT',
  description: 'MSFT 5/15/2026 Put $410.00',
  pl: -200,
  pctReturn: -22.2,
  closedQty: 2,
  costBasis: 900,
  proceeds: 700,
  grossVolume: 1600,
  closeDate: new Date('2026-05-06T00:00:00Z'),
  openDate: new Date('2026-05-04T00:00:00Z'),
  tradeCount: 2,
};

const OPEN_PRICED: UnrealizedPosition = {
  instrument: 'TSLA',
  description: 'TSLA 5/16/2026 Call $260.00',
  openQty: 3,
  costBasis: 1725.12,
  openDate: new Date('2026-05-04T00:00:00Z'),
  tradeCount: 1,
  currentPrice: 7.0,
  currentValue: 2100,
  unrealizedPl: 374.88,
  pctReturn: 21.7,
};

const OPEN_UNPRICED: UnrealizedPosition = {
  instrument: 'SPY',
  description: 'SPY 6/20/2026 Put $480.00',
  openQty: 1,
  costBasis: 60,
  openDate: new Date('2026-04-24T00:00:00Z'),
  tradeCount: 1,
  currentPrice: null,
  currentValue: null,
  unrealizedPl: null,
  pctReturn: null,
};

const renderTable = (
  contracts: ClosedContract[],
  unrealized: UnrealizedPosition[] = [],
) => render(
  <PrivacyModeProvider>
    <UnrealizedModeProvider>
      <PositionsTable contracts={contracts} unrealized={unrealized} />
    </UnrealizedModeProvider>
  </PrivacyModeProvider>,
);

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? (store.get(k) ?? null) : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
};

beforeEach(() => {
  vi.stubGlobal('localStorage', createStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PositionsTable', () => {
  test('renders the four required columns', () => {
    renderTable([CLOSED_WIN]);
    expect(screen.getByText('Option (OCC)')).toBeInTheDocument();
    expect(screen.getByText('Entry price')).toBeInTheDocument();
    expect(screen.getByText('Exit price')).toBeInTheDocument();
    expect(screen.getByText('P&L')).toBeInTheDocument();
  });

  test('closed rows show OCC, entry, exit, and signed P/L', () => {
    renderTable([CLOSED_WIN]);
    const row = screen.getByText('AMD260515C00185000').closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement).getAllByRole('cell');
    // entry = costBasis/qty/100 = 1725.2/5/100 = 3.45
    expect(cells[1]).toHaveTextContent('$3.45');
    // exit = proceeds/qty/100 = 2099.4/5/100 = 4.20
    expect(cells[2]).toHaveTextContent('$4.20');
    expect(cells[3]).toHaveTextContent('+$374.20');
  });

  test('gain uses gain class, loss uses loss class', () => {
    renderTable([CLOSED_WIN, CLOSED_LOSS]);
    const win = within(screen.getByText('AMD260515C00185000').closest('tr') as HTMLElement)
      .getAllByRole('cell')[3] as HTMLElement;
    const loss = within(screen.getByText('MSFT260515P00410000').closest('tr') as HTMLElement)
      .getAllByRole('cell')[3] as HTMLElement;
    expect(win.className).toContain('positions-table__pl--gain');
    expect(loss.className).toContain('positions-table__pl--loss');
  });

  test('unrealized rows: blank exit, gray P/L, default-on toggle includes them', () => {
    renderTable([CLOSED_WIN], [OPEN_PRICED]);
    const row = screen.getByText('TSLA260516C00260000').closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('—'); // exit blank
    expect(cells[3]).toHaveTextContent('+$374.88');
    expect((cells[3] as HTMLElement).className).toContain('positions-table__pl--unrealized');
    expect(row).toHaveAttribute('data-realized', 'false');
  });

  test('un-priced unrealized P/L renders as a dash', () => {
    renderTable([CLOSED_WIN], [OPEN_UNPRICED]);
    const cells = within(
      screen.getByText('SPY260620P00480000').closest('tr') as HTMLElement,
    ).getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('—');
  });

  test('unrealized OFF removes open-position rows (mirrors the chart)', () => {
    window.localStorage.setItem(UNREALIZED_MODE_STORAGE_KEY, 'false');
    renderTable([CLOSED_WIN], [OPEN_PRICED]);
    expect(screen.getByText('AMD260515C00185000')).toBeInTheDocument();
    expect(screen.queryByText('TSLA260516C00260000')).not.toBeInTheDocument();
  });

  test('privacy mode masks dollar amounts but keeps the OCC symbol', () => {
    window.localStorage.setItem('privacyMode', 'true');
    renderTable([CLOSED_WIN]);
    const cells = within(
      screen.getByText('AMD260515C00185000').closest('tr') as HTMLElement,
    ).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('•••');
    expect(cells[3]).toHaveTextContent('•••');
    expect(cells[3]).not.toHaveTextContent('$');
  });

  test('shows an empty state when there are no rows', () => {
    renderTable([]);
    expect(screen.getByText('No positions to display.')).toBeInTheDocument();
  });
});
