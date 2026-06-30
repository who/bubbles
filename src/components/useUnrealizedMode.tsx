import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

export const UNREALIZED_MODE_STORAGE_KEY = 'unrealizedBubbles';

// Unrealized bubbles are shown by default so the live open-position data is
// visible without the user having to discover the toggle. Only an explicit
// stored 'false' hides them.
const readStoredUnrealizedMode = (): boolean => {
  try {
    return window.localStorage.getItem(UNREALIZED_MODE_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

const persistUnrealizedMode = (on: boolean): void => {
  try {
    window.localStorage.setItem(UNREALIZED_MODE_STORAGE_KEY, String(on));
  } catch {
    // localStorage unavailable (private mode, disabled, etc.) — the toggle
    // still applies for the current session via context state.
  }
};

export interface UnrealizedModeValue {
  unrealizedMode: boolean;
  setUnrealizedMode: (next: boolean) => void;
}

const UnrealizedModeContext = createContext<UnrealizedModeValue>({
  unrealizedMode: true,
  setUnrealizedMode: () => {},
});

export function UnrealizedModeProvider({ children }: { children: ReactNode }) {
  const [unrealizedMode, setUnrealizedModeState] = useState<boolean>(
    readStoredUnrealizedMode,
  );

  const setUnrealizedMode = useCallback((next: boolean): void => {
    persistUnrealizedMode(next);
    setUnrealizedModeState(next);
  }, []);

  const value = useMemo(
    () => ({ unrealizedMode, setUnrealizedMode }),
    [unrealizedMode, setUnrealizedMode],
  );

  return (
    <UnrealizedModeContext.Provider value={value}>
      {children}
    </UnrealizedModeContext.Provider>
  );
}

export const useUnrealizedMode = (): UnrealizedModeValue => useContext(UnrealizedModeContext);
