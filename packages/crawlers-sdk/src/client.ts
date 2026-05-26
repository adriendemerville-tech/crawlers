import {
  AuthenticationError,
  ApiError,
  CrawlersError,
  InsufficientBalanceError,
  JobTimeoutError,
  RateLimitError,
  ValidationError,
} from './errors.js';
import type {
  ClientOptions,
  FeatureDescriptor,
  Job,
  JobCreated,
  JobCreateInput,
  WaitOptions,
  WalletBalance,
} from './types.js';

const DEFAULT_BASE_URL =
  'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/crawlers-api';
const DEFAULT_TIMEOUT = 30_000;
const SDK_VERSION = '0.1.0';

export class CrawlersClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {
    if (!options.apiKey || !options.apiKey.startsWith('crw_live_')) {
      throw new ValidationError(
        'Invalid apiKey: expected a key starting with "crw_live_".'
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
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
          'User-Agent': `@crawlers/sdk/${SDK_VERSION}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ApiError(`Request timed out after ${this.timeoutMs}ms.`);
      }
      throw new ApiError(`Network error: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* */ }

    if (res.ok) return payload as T;

    const message: string =
      payload?.error?.message ?? payload?.message ?? payload?.error ?? res.statusText;

    switch (res.status) {
      case 401:
      case 403:
        throw new AuthenticationError(message);
      case 402:
        throw new InsufficientBalanceError(message);
      case 429: {
        const retryAfter = Number(res.headers.get('retry-after')) || undefined;
        throw new RateLimitError(message, retryAfter);
      }
      case 400:
      case 404:
      case 409:
      case 422:
        throw new ValidationError(message, payload);
      default:
        if (res.status >= 500) throw new ApiError(message, res.status);
        throw new CrawlersError(message, 'unknown_error');
    }
  }

  features = {
    /** Liste publique du catalogue (no auth required côté backend, on auth quand même). */
    list: async (): Promise<FeatureDescriptor[]> => {
      const r = await this.request<{ object: 'list'; data: FeatureDescriptor[] }>(
        'GET',
        '/v1/features'
      );
      return r.data;
    },
  };

  jobs = {
    create: async (input: JobCreateInput): Promise<JobCreated> =>
      this.request<JobCreated>('POST', '/v1/jobs', input),

    get: <T = unknown>(id: string): Promise<Job<T>> =>
      this.request<Job<T>>('GET', `/v1/jobs/${encodeURIComponent(id)}`),

    list: async (limit = 20): Promise<Job[]> => {
      const r = await this.request<{ object: 'list'; data: Job[] }>(
        'GET',
        `/v1/jobs?limit=${limit}`
      );
      return r.data;
    },

    cancel: (id: string): Promise<{ id: string; status: 'cancelled' }> =>
      this.request('POST', `/v1/jobs/${encodeURIComponent(id)}/cancel`),

    /** Create + poll jusqu'à l'état terminal. */
    run: async <T = unknown>(
      input: JobCreateInput,
      wait?: WaitOptions
    ): Promise<Job<T>> => {
      const created = await this.jobs.create(input);
      return this.jobs.wait<T>(created.id, wait);
    },

    wait: async <T = unknown>(
      id: string,
      opts: WaitOptions = {}
    ): Promise<Job<T>> => {
      const interval = opts.intervalMs ?? 2000;
      const deadline = Date.now() + (opts.timeoutMs ?? 5 * 60_000);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const job = await this.jobs.get<T>(id);
        opts.onProgress?.(job);
        if (
          job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'cancelled'
        ) {
          return job;
        }
        if (Date.now() > deadline) {
          throw new JobTimeoutError(id, opts.timeoutMs ?? 5 * 60_000);
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    },
  };

  wallet = {
    balance: (): Promise<WalletBalance> =>
      this.request<WalletBalance>('GET', '/v1/wallet/balance'),
  };
}
