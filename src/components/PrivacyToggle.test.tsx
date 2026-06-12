import { fireEvent, render, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import PrivacyToggle from './PrivacyToggle.tsx';
import StatsStrip from './StatsStrip.tsx';
import { MASKED_AMOUNT } from './format.ts';
import {
  PRIVACY_MODE_STORAGE_KEY,
  PrivacyModeProvider,
} from './usePrivacyMode.tsx';
import type { Summary } from '../pnl/types.ts';

interface MockStorage {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  clear: () => void;
  key: (i: number) => string | null;
  readonly length: number;
}

const createStorage = (): MockStorage => {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? (store.get(k) ?? null) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
};

const summary: Summary = {
  totalPl: 1234.56,
  totalGain: 4800,
  totalLoss: 1200,
  glRatio: 4,
  winnersCount: 3,
  losersCount: 1,
  totalClosed: 4,
  winRate: 75,
  avgWin: 1600,
  avgLoss: -1200,
  avgPctWin: 5.5,
  avgPctLoss: -3.2,
  uniqueTickers: 2,
  parseWarnings: [],
};

describe('PrivacyToggle (bubbles-1c2)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('defaults to privacy mode off when no preference is set', () => {
    render(
      <PrivacyModeProvider>
        <PrivacyToggle />
      </PrivacyModeProvider>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('aria-label', 'Hide dollar amounts');
  });

  test('clicking toggles privacy mode, persists to localStorage, and masks $ amounts', () => {
    const { container } = render(
      <PrivacyModeProvider>
        <PrivacyToggle />
        <StatsStrip summary={summary} />
      </PrivacyModeProvider>,
    );
    const btn = screen.getByRole('button');
    const strip = container.querySelector('.stats-strip');

    expect(strip?.textContent).toContain('+$1,234.56');

    fireEvent.click(btn);

    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('aria-label', 'Show dollar amounts');
    expect(window.localStorage.getItem(PRIVACY_MODE_STORAGE_KEY)).toBe('true');
    expect(strip?.textContent).not.toContain('$');
    expect(strip?.textContent).toContain(MASKED_AMOUNT);
    expect(strip?.textContent).toContain('75.0%');

    fireEvent.click(btn);

    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem(PRIVACY_MODE_STORAGE_KEY)).toBe('false');
    expect(strip?.textContent).toContain('+$1,234.56');
  });

  test('reads stored preference from localStorage on mount', () => {
    window.localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, 'true');
    render(
      <PrivacyModeProvider>
        <PrivacyToggle />
      </PrivacyModeProvider>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  test('ignores garbage values in localStorage and defaults to off', () => {
    window.localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, 'banana');
    render(
      <PrivacyModeProvider>
        <PrivacyToggle />
      </PrivacyModeProvider>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
