import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ThemeToggle from './ThemeToggle.tsx';
import { THEME_STORAGE_KEY } from './useTheme.ts';

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

describe('ThemeToggle (bubbles-api dark mode)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.stubGlobal('localStorage', createStorage());
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
  });

  test('initial render defaults to light when no preference is set', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark theme');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('clicking the toggle flips theme, persists to localStorage, and updates the html data-theme', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');

    fireEvent.click(btn);

    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('aria-label', 'Switch to light theme');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    fireEvent.click(btn);

    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  test('reads stored preference from localStorage on mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('honors a data-theme attribute already set on <html> (pre-paint script case)', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  test('ignores garbage values in localStorage and falls back to light', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
