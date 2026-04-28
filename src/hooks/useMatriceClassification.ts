/**
 * useMatriceClassification — Calls the matrice-classify edge function to obtain
 * per-criterion family + reformulation + confidence. This is the "comprehension"
 * pass surfaced before the user runs the actual audit.
 */

import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MatriceFamily =
  | 'technical'
  | 'content'
  | 'eeat'
  | 'geo'
  | 'performance'
  | 'links'
  | 'security'
  | 'other';

export interface ClassifiedCriterion {
  id: string;
  family: MatriceFamily;
  reformulation: string;
  confidence: number;
}

export interface ClassifyInput {
  id: string;
  title: string;
  category?: string;
}

interface State {
  loading: boolean;
  error: string | null;
  results: Record<string, ClassifiedCriterion> | null;
  /** 0..1 — driven locally for the progress bar (no SSE on this call). */
  progress: number;
}

const INITIAL: State = { loading: false, error: null, results: null, progress: 0 };

export function useMatriceClassification() {
  const [state, setState] = useState<State>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    cancelledRef.current = false;
    setState(INITIAL);
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ loading: false, error: 'Analyse interrompue', results: null, progress: 0 });
  }, []);

  const classify = useCallback(async (criteria: ClassifyInput[]) => {
    if (criteria.length === 0) return null;

    cancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ loading: true, error: null, results: null, progress: 0.05 });

    const ticker = window.setInterval(() => {
      setState((s) => (s.loading ? { ...s, progress: Math.min(0.9, s.progress + 0.05) } : s));
    }, 350);

    try {
      const { data, error } = await supabase.functions.invoke('matrice-classify', {
        body: { criteria },
        // @ts-expect-error supabase-js forwards the signal to fetch
        signal: controller.signal,
      });

      window.clearInterval(ticker);

      if (cancelledRef.current) return null;

      if (error) throw new Error(error.message || 'Classification failed');
      if (data?.error) throw new Error(data.error);

      const list: ClassifiedCriterion[] = Array.isArray(data?.results) ? data.results : [];
      const map: Record<string, ClassifiedCriterion> = {};
      for (const r of list) map[r.id] = r;

      setState({ loading: false, error: null, results: map, progress: 1 });
      abortRef.current = null;
      return map;
    } catch (e) {
      window.clearInterval(ticker);
      if (cancelledRef.current) return null;
      const message = e instanceof Error ? e.message : 'Erreur inconnue';
      setState({ loading: false, error: message, results: null, progress: 0 });
      abortRef.current = null;
      return null;
    }
  }, []);

  return { ...state, classify, reset, stop };
}
