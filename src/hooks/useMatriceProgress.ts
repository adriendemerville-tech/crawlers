/**
 * useMatriceProgress — React hook bridging the orchestrator's onCallEvent stream
 * to a stable list of MatriceProgressItem suitable for <MatriceProgressTracker />.
 *
 * Usage:
 *   const { items, completed, total, currentLabel, onCallEvent, reset } = useMatriceProgress();
 *   await executeAuditPlan(plan, url, { onProgress, onResult, onError, onCallEvent });
 *   <MatriceProgressTracker {...{ items, completed, total, currentLabel }} />
 */

import { useCallback, useRef, useState } from 'react';
import type { CallEvent } from '@/utils/matrice/matrixOrchestrator';
import type { MatriceProgressItem } from '@/components/Matrice/MatriceProgressTracker';

interface ProgressState {
  items: MatriceProgressItem[];
  completed: number;
  total: number;
  currentLabel?: string;
}

const INITIAL: ProgressState = { items: [], completed: 0, total: 0, currentLabel: undefined };

function statusToItemStatus(s: CallEvent['status']): MatriceProgressItem['status'] {
  return s; // identical union
}

export function useMatriceProgress() {
  const [state, setState] = useState<ProgressState>(INITIAL);

  // Map from event.id → index in items array. Kept in a ref to avoid re-renders.
  const indexRef = useRef<Map<string, number>>(new Map());

  const onCallEvent = useCallback((event: CallEvent) => {
    setState((prev) => {
      const items = prev.items.slice();
      const existingIdx = indexRef.current.get(event.id);

      const item: MatriceProgressItem = {
        id: event.id,
        label: event.label,
        status: statusToItemStatus(event.status),
        detail: event.detail,
      };

      if (existingIdx === undefined) {
        indexRef.current.set(event.id, items.length);
        items.push(item);
      } else {
        items[existingIdx] = item;
      }

      // Recompute aggregates
      const total = items.length;
      const completed = items.filter(i => i.status === 'done' || i.status === 'error').length;
      const running = items.find(i => i.status === 'running');
      const currentLabel = running
        ? running.detail ? `${running.label} — ${running.detail}` : running.label
        : prev.currentLabel;

      return { items, completed, total, currentLabel };
    });
  }, []);

  const reset = useCallback(() => {
    indexRef.current.clear();
    setState(INITIAL);
  }, []);

  return {
    items: state.items,
    completed: state.completed,
    total: state.total,
    currentLabel: state.currentLabel,
    onCallEvent,
    reset,
  };
}
