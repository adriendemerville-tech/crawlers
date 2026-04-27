/**
 * ConsoleViewModeContext — toggles the Console UI between simplified and advanced views.
 *
 * Default: 'advanced' (preserves current behavior).
 * Persisted in localStorage so it survives reloads.
 *
 * Usage:
 *   const { advanced, setAdvanced, toggle } = useConsoleViewMode();
 *
 *   <AdvancedOnly>
 *     <TechnicalBlock />
 *   </AdvancedOnly>
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

interface ConsoleViewModeContextValue {
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'console.viewMode.advanced';

const ConsoleViewModeContext = createContext<ConsoleViewModeContextValue>({
  advanced: true,
  setAdvanced: () => {},
  toggle: () => {},
});

export function ConsoleViewModeProvider({ children }: { children: ReactNode }) {
  const [advanced, setAdvancedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return true; // default ON
      return raw === '1' || raw === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, advanced ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [advanced]);

  const setAdvanced = useCallback((v: boolean) => setAdvancedState(v), []);
  const toggle = useCallback(() => setAdvancedState((v) => !v), []);

  const value = useMemo(() => ({ advanced, setAdvanced, toggle }), [advanced, setAdvanced, toggle]);

  return (
    <ConsoleViewModeContext.Provider value={value}>
      {children}
    </ConsoleViewModeContext.Provider>
  );
}

export function useConsoleViewMode() {
  return useContext(ConsoleViewModeContext);
}

/**
 * Renders children only when Console is in advanced view.
 * Use to hide technical/debug blocks in simplified view.
 */
export function AdvancedOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { advanced } = useConsoleViewMode();
  return <>{advanced ? children : fallback}</>;
}

/**
 * Inverse of AdvancedOnly — renders only when in simplified view.
 */
export function SimplifiedOnly({ children }: { children: ReactNode }) {
  const { advanced } = useConsoleViewMode();
  return <>{advanced ? null : children}</>;
}
