export type TaskStatus =
  | 'pending'
  | 'acknowledged'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface PendingTask {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  target_domain: string;
  created_at: string;
}

export interface PublishedResult {
  url: string;
  cms_post_id?: string;
  notes?: string;
}

export interface FailedResult {
  error_message: string;
  error_category?: string;
}

export interface ClientOptions {
  /** Clé pull — préfixe `prm_live_`. */
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface WorkerOptions {
  /** Intervalle de polling en ms (défaut 30 000). */
  pollIntervalMs?: number;
  /** Max tâches récupérées par cycle (défaut 5). */
  batchSize?: number;
  /** Signal d'arrêt propre. */
  signal?: AbortSignal;
}

export class ParmenionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ParmenionError';
  }
}
