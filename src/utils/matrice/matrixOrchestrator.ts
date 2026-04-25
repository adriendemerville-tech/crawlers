/**
 * Matrix Orchestrator — Executes the audit plan with:
 * - Parallel technical calls
 * - Staggered LLM calls (avoid 429)
 * - Non-redundancy logic (matchType)
 * - Fallback to expert-audit
 * - Progress tracking
 */

import { supabase } from '@/integrations/supabase/client';
import type { AuditPlan, AuditRoute } from './resolveAuditRoutes';
import { hydratePrompt } from './promptSanitizer';

export interface MatrixResult {
  criterionId: string;
  criterionTitle: string;
  matchType: string;
  parsedScore: number | null;
  parsedResponse: string | null;
  crawlersScore: number | null;
  crawlersData: any;
  sourceFunction: string;
  confidence: number;
}

export type CallEventStatus = 'pending' | 'running' | 'done' | 'error';

export interface CallEvent {
  id: string;                  // unique per (fn, criterionId, provider?)
  fn: string;                  // edge function name
  criterionId?: string;        // optional, for LLM custom prompt calls
  criterionTitle?: string;
  provider?: string;           // for benchmark calls
  promptIndex?: number;        // index of prompt in multi-prompt audit
  promptTotal?: number;
  label: string;               // human-readable
  detail?: string;             // e.g. "gemini · prompt 2/5"
  status: CallEventStatus;
  errorMessage?: string;
}

export interface OrchestratorCallbacks {
  onProgress: (completed: number, total: number, currentCriterion: string) => void;
  onResult: (result: MatrixResult) => void;
  onError: (criterionId: string, error: string) => void;
  /**
   * Fired for every backend call lifecycle change.
   * Listeners should upsert by `event.id`.
   */
  onCallEvent?: (event: CallEvent) => void;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callFunction(fn: string, url: string, params?: Record<string, any>): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, {
      body: { url, ...params },
    });
    if (error) throw error;
    return data;
  } catch (e) {
    console.error(`[orchestrator] ${fn} failed:`, e);
    return null;
  }
}

async function callWithFallback(fn: string, url: string, params?: Record<string, any>): Promise<any> {
  const result = await callFunction(fn, url, params);
  if (result) return result;

  // Fallback to expert-audit for technical functions
  if (['check-meta-tags', 'check-structured-data', 'check-robots-indexation', 'check-images'].includes(fn)) {
    console.log(`[orchestrator] Fallback to expert-audit for ${fn}`);
    return callFunction('expert-audit', url);
  }
  return null;
}

function extractScore(data: any, fn: string): number | null {
  if (!data) return null;
  // Each function returns different score formats — try function-specific first,
  // then fall back to a broad sweep of common shapes so new edge function
  // payloads don't silently produce null.
  const direct = (() => {
    switch (fn) {
      case 'check-pagespeed':
        return data.scores?.performance ?? data.score ?? null;
      case 'check-geo':
        return data.geoScore ?? data.score ?? null;
      case 'check-llm':
        return data.visibilityScore ?? data.score ?? null;
      case 'check-crawlers':
        return data.accessibilityScore ?? data.score ?? null;
      case 'expert-audit':
        return data.score ?? data.totalScore ?? data.globalScore ?? null;
      default:
        return data.score ?? null;
    }
  })();
  if (typeof direct === 'number') return direct;

  // Generic fallbacks for new/unhandled response shapes
  const candidates = [
    data.score, data.totalScore, data.globalScore, data.overallScore,
    data.result?.score, data.result?.totalScore,
    data.summary?.score, data.metrics?.score,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && !Number.isNaN(c)) return c;
  }
  // Last resort: 0–100 percentage-like field
  if (typeof data.percentage === 'number') return data.percentage;
  return null;
}

export async function executeAuditPlan(
  plan: AuditPlan,
  url: string,
  callbacks: OrchestratorCallbacks,
): Promise<MatrixResult[]> {
  const results: MatrixResult[] = [];
  const total = plan.routes.length;
  let completed = 0;

  const emit = (e: CallEvent) => callbacks.onCallEvent?.(e);

  // Wraps a backend call with pending → running → done|error events.
  const tracked = async <T,>(
    eventBase: Omit<CallEvent, 'status'>,
    exec: () => Promise<T>,
  ): Promise<T> => {
    emit({ ...eventBase, status: 'pending' });
    emit({ ...eventBase, status: 'running' });
    try {
      const out = await exec();
      const ok = out !== null && out !== undefined;
      emit({ ...eventBase, status: ok ? 'done' : 'error', errorMessage: ok ? undefined : 'Empty response' });
      return out;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Call failed';
      emit({ ...eventBase, status: 'error', errorMessage: msg });
      throw err;
    }
  };

  // Group routes by function for deduplication
  const fnGroups = new Map<string, AuditRoute[]>();
  for (const route of plan.routes) {
    const key = route.fn;
    if (!fnGroups.has(key)) fnGroups.set(key, []);
    fnGroups.get(key)!.push(route);
  }

  // Separate technical (parallel) and LLM (staggered) calls
  const technicalFns: string[] = [];
  const llmFns: string[] = [];
  for (const [fn, routes] of fnGroups) {
    const isLLM = ['check-llm', 'check-eeat', 'check-content-quality'].includes(fn);
    if (isLLM) llmFns.push(fn);
    else technicalFns.push(fn);
  }

  // Cache function results to avoid redundant calls
  const fnResultCache = new Map<string, any>();

  // Pre-emit all planned events as 'pending' so the UI shows the full upcoming plan upfront
  for (const fn of technicalFns) {
    emit({ id: `tech:${fn}`, fn, label: fn, detail: 'technique', status: 'pending' });
  }
  for (const fn of llmFns) {
    emit({ id: `llm-std:${fn}`, fn, label: `${fn} (référence)`, detail: 'crawlers', status: 'pending' });
    const routes = fnGroups.get(fn) || [];
    for (const route of routes) {
      if (!route.customPrompt || fn !== 'check-llm') continue;
      if (route.mode === 'benchmark' && route.targetProviders?.length) {
        route.targetProviders.forEach((prov) => {
          emit({
            id: `llm-bench:${route.criterionId}:${prov}`,
            fn, criterionId: route.criterionId, criterionTitle: route.criterionTitle,
            provider: prov, label: route.criterionTitle, detail: prov, status: 'pending',
          });
        });
      } else {
        emit({
          id: `llm-custom:${route.criterionId}`,
          fn, criterionId: route.criterionId, criterionTitle: route.criterionTitle,
          provider: route.targetProvider, label: route.criterionTitle,
          detail: route.targetProvider || 'tous LLMs', status: 'pending',
        });
      }
    }
  }

  // Execute technical functions in parallel
  const technicalPromises = technicalFns.map(async (fn) => {
    try {
      const data = await tracked(
        { id: `tech:${fn}`, fn, label: fn, detail: 'technique' },
        () => callWithFallback(fn, url),
      );
      fnResultCache.set(fn, data);
    } catch {
      fnResultCache.set(fn, null);
    }
  });
  await Promise.allSettled(technicalPromises);

  // Execute LLM functions staggered
  for (const fn of llmFns) {
    const routes = fnGroups.get(fn) || [];
    const hasCustomPrompt = routes.some(r => r.customPrompt);

    // Standard Crawlers call (1 call per function)
    try {
      const standardData = await tracked(
        { id: `llm-std:${fn}`, fn, label: `${fn} (référence)`, detail: 'crawlers' },
        () => callWithFallback(fn, url),
      );
      fnResultCache.set(fn, standardData);
    } catch {
      fnResultCache.set(fn, null);
    }

    // If custom prompts exist, make additional targeted calls
    // Each (prompt, provider) tuple = one separate call so:
    //  - audit multi-prompts → N appels (1 par prompt)
    //  - benchmark → N×P appels (1 par prompt × provider ciblé)
    if (hasCustomPrompt) {
      const customRoutes = routes.filter(r => r.customPrompt && fn === 'check-llm');
      const promptTotal = customRoutes.length;

      for (let pi = 0; pi < customRoutes.length; pi++) {
        const route = customRoutes[pi];
        const hydratedPrompt = hydratePrompt(route.customPrompt!, url);
        const promptIndex = pi + 1;
        // Suffix cache key with index to guarantee uniqueness even if
        // criterionId is duplicated across rows of the source matrix.
        const cacheKey = `${fn}:custom:${route.criterionId}:${pi}`;

        if (route.mode === 'benchmark' && route.targetProviders?.length) {
          // Run all providers in parallel — each LLM call is independent and
          // the rate-limit budget is per-provider, so sequential delay was
          // adding minutes for no throughput gain.
          const providerEntries = await Promise.all(
            route.targetProviders.map(async (prov) => {
              try {
                const customData = await tracked(
                  {
                    id: `llm-bench:${route.criterionId}:${prov}`,
                    fn, criterionId: route.criterionId, criterionTitle: route.criterionTitle,
                    provider: prov, promptIndex, promptTotal,
                    label: route.criterionTitle,
                    detail: `${prov} · prompt ${promptIndex}/${promptTotal}`,
                  },
                  () => callFunction('check-llm', url, { customPrompt: hydratedPrompt, targetProvider: prov }),
                );
                return [prov, customData] as const;
              } catch {
                return [prov, null] as const;
              }
            }),
          );
          const perProviderResults: Record<string, any> = Object.fromEntries(providerEntries);
          fnResultCache.set(cacheKey, {
            mode: 'benchmark',
            providers: perProviderResults,
          });
        } else {
          try {
            const customData = await tracked(
              {
                id: `llm-custom:${route.criterionId}`,
                fn, criterionId: route.criterionId, criterionTitle: route.criterionTitle,
                provider: route.targetProvider, promptIndex, promptTotal,
                label: route.criterionTitle,
                detail: `${route.targetProvider || 'tous LLMs'} · prompt ${promptIndex}/${promptTotal}`,
              },
              () => callFunction('check-llm', url, {
                customPrompt: hydratedPrompt,
                targetProvider: route.targetProvider,
              }),
            );
            fnResultCache.set(cacheKey, customData);
          } catch {
            fnResultCache.set(cacheKey, null);
          }
          await delay(300);
        }
      }
    }

    await delay(250); // Stagger between LLM functions
  }

  // Pre-compute the per-route custom-cache index so we read the same key
  // we wrote during execution (guards against duplicate criterionId rows).
  const customIndexByRoute = new Map<AuditRoute, number>();
  for (const [fn, routes] of fnGroups) {
    if (fn !== 'check-llm') continue;
    const customRoutes = routes.filter(r => r.customPrompt);
    customRoutes.forEach((r, i) => customIndexByRoute.set(r, i));
  }

  // Map results to criteria
  for (const route of plan.routes) {
    const fnData = fnResultCache.get(route.fn);
    const crawlersScore = extractScore(fnData, route.fn);

    let parsedScore: number | null = null;
    let parsedResponse: string | null = null;

    if (route.matchType === 'exact') {
      // Same data for both scores
      parsedScore = crawlersScore;
      parsedResponse = null;
    } else if (route.matchType === 'partial') {
      // Custom prompt result — may be benchmark (multi-provider) or single
      const pi = customIndexByRoute.get(route) ?? 0;
      const customKey = `${route.fn}:custom:${route.criterionId}:${pi}`;
      const customData = fnResultCache.get(customKey);

      if (customData?.mode === 'benchmark' && customData.providers) {
        // Aggregate per-provider scores into a mean for parsedScore;
        // keep full breakdown in parsedResponse for the UI.
        const perProvider = customData.providers as Record<string, any>;
        const scores = Object.values(perProvider)
          .map((d) => extractScore(d, route.fn))
          .filter((s): s is number => typeof s === 'number');
        parsedScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        parsedResponse = JSON.stringify({ benchmark: true, perProvider });
      } else {
        parsedScore = extractScore(customData, route.fn);
        parsedResponse = customData ? JSON.stringify(customData) : null;
      }
    } else {
      // custom_only — only LLM with user prompt, no Crawlers equivalent
      parsedScore = crawlersScore;
    }

    const result: MatrixResult = {
      criterionId: route.criterionId,
      criterionTitle: route.criterionTitle,
      matchType: route.matchType,
      parsedScore,
      parsedResponse,
      crawlersScore: route.matchType === 'custom_only' ? null : crawlersScore,
      crawlersData: fnData,
      sourceFunction: route.fn,
      confidence: route.confidence,
    };

    results.push(result);
    completed++;
    callbacks.onProgress(completed, total, route.criterionTitle);
    callbacks.onResult(result);
  }

  return results;
}
