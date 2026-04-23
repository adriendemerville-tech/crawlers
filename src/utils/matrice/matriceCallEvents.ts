/**
 * matriceCallEvents — Synthesises CallEvent streams for the live tracker
 * when audits are executed via dedicated edge functions instead of the
 * client-side orchestrator.
 *
 * Each selected prompt produces ONE event (technical mode) or ONE event per
 * targeted LLM (benchmark mode). The caller drives transitions:
 *   prepare() → emits all 'pending'
 *   start(id) → 'running'
 *   done(id)  → 'done'
 *   fail(id, msg) → 'error'
 */

import type { CallEvent } from './matrixOrchestrator';

export interface SyntheticCallSeed {
  id: string;
  label: string;
  detail?: string;
  fn: string;
  criterionId?: string;
  criterionTitle?: string;
  provider?: string;
  promptIndex?: number;
  promptTotal?: number;
}

export function makePending(seed: SyntheticCallSeed): CallEvent {
  return { ...seed, status: 'pending' };
}
export function makeRunning(seed: SyntheticCallSeed): CallEvent {
  return { ...seed, status: 'running' };
}
export function makeDone(seed: SyntheticCallSeed): CallEvent {
  return { ...seed, status: 'done' };
}
export function makeError(seed: SyntheticCallSeed, message: string): CallEvent {
  return { ...seed, status: 'error', errorMessage: message };
}

interface PromptSeedInput {
  id: string;
  prompt: string;
  axe?: string;
  llm_name?: string;
  engines?: string[]; // for benchmark: one event per engine
}

export function seedsForStandardAudit(items: PromptSeedInput[], fnName: string): SyntheticCallSeed[] {
  const total = items.length;
  return items.map((it, idx) => ({
    id: `std:${fnName}:${it.id}`,
    label: it.prompt.length > 80 ? it.prompt.slice(0, 77) + '…' : it.prompt,
    detail: `${it.axe || 'Général'} · ${idx + 1}/${total}`,
    fn: fnName,
    criterionId: it.id,
    criterionTitle: it.prompt,
    provider: it.llm_name,
    promptIndex: idx + 1,
    promptTotal: total,
  }));
}

export function seedsForBenchmark(items: PromptSeedInput[], engines: string[], fnName: string): SyntheticCallSeed[] {
  const total = items.length;
  const seeds: SyntheticCallSeed[] = [];
  items.forEach((it, idx) => {
    engines.forEach((engine) => {
      seeds.push({
        id: `bench:${fnName}:${it.id}:${engine}`,
        label: it.prompt.length > 80 ? it.prompt.slice(0, 77) + '…' : it.prompt,
        detail: `${engine} · prompt ${idx + 1}/${total}`,
        fn: fnName,
        criterionId: it.id,
        criterionTitle: it.prompt,
        provider: engine,
        promptIndex: idx + 1,
        promptTotal: total,
      });
    });
  });
  return seeds;
}
