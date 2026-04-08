import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DemoModeContextType {
  isDemoMode: boolean;
  loading: boolean;
}

const DemoModeContext = createContext<DemoModeContextType>({ isDemoMode: false, loading: true });

export function useDemoMode() {
  return useContext(DemoModeContext);
}

/**
 * Wrapper for supabase.functions.invoke with auto-retry in demo mode.
 * Use this instead of raw supabase.functions.invoke() across the app.
 */
export async function demoSafeInvoke(
  functionName: string,
  options?: { body?: unknown; headers?: Record<string, string> },
  maxRetries = 2
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await supabase.functions.invoke(functionName, options as any);
      if (result.error) throw result.error;
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const originalConsoleError = useRef<typeof console.error | null>(null);

  const fetchDemoMode = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'demo_mode')
        .maybeSingle();
      
      const active = data?.value === true || (data?.value as any)?.active === true;
      setIsDemoMode(active);
    } catch {
      setIsDemoMode(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDemoMode();

    // Only subscribe to realtime on non-public pages (avoid WebSocket errors on blog/landing)
    const isPublicPage = ['/blog', '/lexique', '/tarifs', '/guide-audit-seo', '/landing'].some(
      p => window.location.pathname.startsWith(p)
    ) || window.location.pathname === '/';
    
    if (isPublicPage) return;

    // Listen for realtime changes
    const channel = supabase
      .channel('demo-mode-watch')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_config',
        filter: 'key=eq.demo_mode',
      }, (payload: any) => {
        const val = payload.new?.value;
        const active = val === true || val?.active === true;
        setIsDemoMode(active);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchDemoMode]);

  // Suppress all toast errors and console.error when demo mode is active
  useEffect(() => {
    if (isDemoMode) {
      // Override console.error to silence it
      if (!originalConsoleError.current) {
        originalConsoleError.current = console.error;
      }
      console.error = (...args: any[]) => {
        // Still log to a debug namespace for backend monitoring
        originalConsoleError.current?.('[DEMO-SUPPRESSED]', ...args);
      };

      // Monkey-patch toast.error to no-op
      const originalToastError = toast.error;
      toast.error = (() => {}) as any;

      return () => {
        if (originalConsoleError.current) {
          console.error = originalConsoleError.current;
          originalConsoleError.current = null;
        }
        toast.error = originalToastError;
      };
    }
  }, [isDemoMode]);

  // Global unhandled promise rejection suppression in demo mode
  useEffect(() => {
    if (!isDemoMode) return;

    const handler = (e: PromiseRejectionEvent) => {
      e.preventDefault();
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [isDemoMode]);

  // Global window.onerror suppression in demo mode
  useEffect(() => {
    if (!isDemoMode) return;

    const prev = window.onerror;
    window.onerror = () => true; // swallow all
    return () => { window.onerror = prev; };
  }, [isDemoMode]);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, loading }}>
      {children}
    </DemoModeContext.Provider>
  );
}
