import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

export const PRIVACY_MODE_STORAGE_KEY = 'privacyMode';

const readStoredPrivacyMode = (): boolean => {
  try {
    return window.localStorage.getItem(PRIVACY_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const persistPrivacyMode = (on: boolean): void => {
  try {
    window.localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, String(on));
  } catch {
    // localStorage unavailable (private mode, disabled, etc.) — the toggle
    // still applies for the current session via context state.
  }
};

export interface PrivacyModeValue {
  privacyMode: boolean;
  setPrivacyMode: (next: boolean) => void;
}

const PrivacyModeContext = createContext<PrivacyModeValue>({
  privacyMode: false,
  setPrivacyMode: () => {},
});

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyModeState] = useState<boolean>(readStoredPrivacyMode);

  const setPrivacyMode = useCallback((next: boolean): void => {
    persistPrivacyMode(next);
    setPrivacyModeState(next);
  }, []);

  const value = useMemo(
    () => ({ privacyMode, setPrivacyMode }),
    [privacyMode, setPrivacyMode],
  );

  return (
    <PrivacyModeContext.Provider value={value}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export const usePrivacyMode = (): PrivacyModeValue => useContext(PrivacyModeContext);
