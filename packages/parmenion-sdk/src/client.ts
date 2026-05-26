import {
  ParmenionError,
  type ClientOptions,
  type FailedResult,
  type PendingTask,
  type PublishedResult,
  type WorkerOptions,
} from './types.js';

const DEFAULT_BASE_URL =
  'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/parmenion-api';
const SDK_VERSION = '0.1.0';

export class ParmenionClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {
    if (!options.apiKey || !options.apiKey.startsWith('prm_live_')) {
      throw new ParmenionError(
        'Invalid apiKey: expected a key starting with "prm_live_".',
        'invalid_api_key'
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `@parmenion/sdk/${SDK_VERSION}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ParmenionError(`Request timed out after ${this.timeoutMs}ms.`, 'timeout');
      }
      throw new ParmenionError(`Network error: ${(err as Error).message}`, 'network');
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const payload = text ? JSON.parse(text) : null;
    if (res.ok) return payload as T;

    throw new ParmenionError(
      payload?.error ?? payload?.message ?? res.statusText,
      `http_${res.status}`
    );
  }

  /** Récupère les tâches en attente (sans ack). */
  pending(limit = 5): Promise<PendingTask[]> {
    return this.request<PendingTask[]>('GET', `/v1/tasks/pending?limit=${limit}`);
  }

  /** Verrouille une tâche pour ce worker. */
  ack(taskId: string): Promise<{ ok: true }> {
    return this.request('POST', `/v1/tasks/${encodeURIComponent(taskId)}/ack`);
  }

  /** Reporte un succès de publication. */
  published(taskId: string, result: PublishedResult): Promise<{ ok: true }> {
    return this.request('POST', `/v1/tasks/${encodeURIComponent(taskId)}/published`, result);
  }

  /** Reporte un échec. */
  failed(taskId: string, result: FailedResult): Promise<{ ok: true }> {
    return this.request('POST', `/v1/tasks/${encodeURIComponent(taskId)}/failed`, result);
  }

  /**
   * Worker prêt à l'emploi : poll → ack → handler → published/failed, en boucle.
   * Arrêt propre via `opts.signal`.
   */
  async runWorker(
    handler: (task: PendingTask) => Promise<PublishedResult>,
    opts: WorkerOptions = {}
  ): Promise<void> {
    const interval = opts.pollIntervalMs ?? 30_000;
    const batch = opts.batchSize ?? 5;
    const signal = opts.signal;

    while (!signal?.aborted) {
      let tasks: PendingTask[] = [];
      try {
        tasks = await this.pending(batch);
      } catch (e) {
        console.error('[parmenion] poll failed:', e);
      }

      for (const task of tasks) {
        if (signal?.aborted) return;
        try {
          await this.ack(task.id);
          const result = await handler(task);
          await this.published(task.id, result);
        } catch (e) {
          await this.failed(task.id, {
            error_message: (e as Error).message,
          }).catch(() => undefined);
        }
      }

      if (signal?.aborted) return;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, interval);
        signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
      });
    }
  }
}
