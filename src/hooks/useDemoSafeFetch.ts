import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/DemoModeContext';

/**
 * Hook for demo-safe edge function calls.
 * In demo mode: auto-retries on failure, never shows errors.
 * Returns { data, loading, error, invoke }
 */
export function useDemoSafeFetch<T = any>(functionName: string) {
  const { isDemoMode } = useDemoMode();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  const invoke = useCallback(async (body?: unknown, maxRetries?: number) => {
    const retries = isDemoMode ? (maxRetries ?? 3) : (maxRetries ?? 0);
    setLoading(true);
    setError(null);

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke(functionName, {
          body: body as any,
        });

        if (fnError) throw fnError;
        setData(result as T);
        setHasData(true);
        setLoading(false);
        return result as T;
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    }

    // All retries exhausted
    const errMsg = lastError instanceof Error ? lastError.message : 'Erreur';
    if (!isDemoMode) {
      setError(errMsg);
    }
    // In demo mode: silently fail, card won't render (hasData stays false)
    setLoading(false);
    return null;
  }, [functionName, isDemoMode]);

  return { data, loading, error: isDemoMode ? null : error, invoke, hasData };
}
