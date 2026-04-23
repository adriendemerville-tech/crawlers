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

export interface OrchestratorCallbacks {
  onProgress: (completed: number, total: number, currentCriterion: string) => void;
  onResult: (result: MatrixResult) => void;
  onError: (criterionId: string, error: string) => void;
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
  // Each function returns different score formats
  switch (fn) {
    case 'check-pagespeed':
      return data.scores?.performance ?? data.score ?? null;
    case 'check-geo':
      return data.geoScore ?? data.score ?? null;
    case 'check-llm':
      return data.visibilityScore ?? data.score ?? null;
    case 'check-crawlers':
      return data.accessibilityScore ?? data.score ?? null;
    case 'check-meta-tags':
      return data.score ?? null;
    case 'check-structured-data':
      return data.score ?? null;
    case 'check-robots-indexation':
      return data.score ?? null;
    case 'check-images':
      return data.score ?? null;
    case 'check-backlinks':
      return data.score ?? null;
    case 'check-content-quality':
      return data.score ?? null;
    case 'check-eeat':
      return data.score ?? null;
    case 'expert-audit':
      return data.score ?? data.totalScore ?? null;
    default:
      return data.score ?? null;
  }
}

export async function executeAuditPlan(
  plan: AuditPlan,
  url: string,
  callbacks: OrchestratorCallbacks,
): Promise<MatrixResult[]> {
  const results: MatrixResult[] = [];
  const total = plan.routes.length;
  let completed = 0;

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

  // Execute technical functions in parallel
  const technicalPromises = technicalFns.map(async (fn) => {
    const data = await callWithFallback(fn, url);
    fnResultCache.set(fn, data);
  });
  await Promise.allSettled(technicalPromises);

  // Execute LLM functions staggered
  for (const fn of llmFns) {
    const routes = fnGroups.get(fn) || [];
    // Check if any route has a custom prompt requiring a separate call
    const hasCustomPrompt = routes.some(r => r.customPrompt);

    // Standard Crawlers call (1 call per function)
    const standardData = await callWithFallback(fn, url);
    fnResultCache.set(fn, standardData);

    // If custom prompts exist, make additional targeted calls
    // Each (prompt, provider) tuple = one separate call so:
    //  - audit multi-prompts → N appels (1 par prompt)
    //  - benchmark → N×P appels (1 par prompt × provider ciblé)
    if (hasCustomPrompt) {
      for (const route of routes) {
        if (!route.customPrompt || fn !== 'check-llm') continue;
        const hydratedPrompt = hydratePrompt(route.customPrompt, url);

        // Determine providers to query for this prompt
        const providers: (string | undefined)[] =
          route.mode === 'benchmark' && route.targetProviders && route.targetProviders.length > 0
            ? route.targetProviders
            : [route.targetProvider]; // single provider OR undefined → check-llm queries all

        if (route.mode === 'benchmark') {
          // Benchmark: one call per (prompt × provider), aggregate
          const perProviderResults: Record<string, any> = {};
          for (const prov of providers) {
            const customData = await callFunction('check-llm', url, {
              customPrompt: hydratedPrompt,
              targetProvider: prov,
            });
            if (prov) perProviderResults[prov] = customData;
            await delay(300);
          }
          fnResultCache.set(`${fn}:custom:${route.criterionId}`, {
            mode: 'benchmark',
            providers: perProviderResults,
          });
        } else {
          // Standard: 1 call (with optional single provider filter)
          const customData = await callFunction('check-llm', url, {
            customPrompt: hydratedPrompt,
            targetProvider: route.targetProvider,
          });
          fnResultCache.set(`${fn}:custom:${route.criterionId}`, customData);
          await delay(300);
        }
      }
    }

    await delay(250); // Stagger between LLM functions
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
      // Custom prompt result
      const customKey = `${route.fn}:custom:${route.criterionId}`;
      const customData = fnResultCache.get(customKey);
      parsedScore = extractScore(customData, route.fn);
      parsedResponse = customData ? JSON.stringify(customData) : null;
    } else {
      // custom_only — only LLM with user prompt, no Crawlers equivalent
      parsedScore = crawlersScore;
      crawlersScore; // no separate crawlers score
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
