import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';

const readStoredTheme = (): Theme | null => {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(v) ? v : null;
  } catch {
    return null;
  }
};

const readSystemTheme = (): Theme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const readInitialTheme = (): Theme => {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (isTheme(attr)) return attr;
  }
  return readStoredTheme() ?? readSystemTheme();
};

const applyTheme = (theme: Theme): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
};

const persistTheme = (theme: Theme): void => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (private mode, disabled, etc.) — selection
    // still applies for the current session via the data-theme attribute.
  }
};

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: Theme): void => {
    persistTheme(next);
    setThemeState(next);
  };

  return [theme, setTheme];
}
