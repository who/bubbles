import { fireEvent, render, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import UnrealizedToggle from './UnrealizedToggle.tsx';
import {
  UNREALIZED_MODE_STORAGE_KEY,
  UnrealizedModeProvider,
} from './useUnrealizedMode.tsx';

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

describe('UnrealizedToggle (bubbles-1xy)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('defaults to ON (unrealized shown) when no preference is set', () => {
    render(
      <UnrealizedModeProvider>
        <UnrealizedToggle />
      </UnrealizedModeProvider>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('aria-label', 'Hide unrealized bubbles');
  });

  test('clicking toggles the mode and persists to localStorage', () => {
    render(
      <UnrealizedModeProvider>
        <UnrealizedToggle />
      </UnrealizedModeProvider>,
    );
    const btn = screen.getByRole('button');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('aria-label', 'Show unrealized bubbles');
    expect(window.localStorage.getItem(UNREALIZED_MODE_STORAGE_KEY)).toBe('false');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem(UNREALIZED_MODE_STORAGE_KEY)).toBe('true');
  });

  test('reads stored "false" preference from localStorage on mount', () => {
    window.localStorage.setItem(UNREALIZED_MODE_STORAGE_KEY, 'false');
    render(
      <UnrealizedModeProvider>
        <UnrealizedToggle />
      </UnrealizedModeProvider>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
