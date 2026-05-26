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
  Job,
  JobCreateInput,
  WaitOptions,
  WalletBalance,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.crawlers.fr';
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

  // ----- HTTP plumbing --------------------------------------------------

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
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON response */
    }

    if (res.ok) return payload as T;

    const message: string = payload?.error?.message ?? payload?.error ?? res.statusText;

    switch (res.status) {
      case 401:
      case 403:
        throw new AuthenticationError(message);
      case 402:
        throw new InsufficientBalanceError(
          message,
          payload?.topup_url ?? undefined
        );
      case 429: {
        const retryAfter = Number(res.headers.get('retry-after')) || undefined;
        throw new RateLimitError(message, retryAfter);
      }
      case 400:
      case 422:
        throw new ValidationError(message, payload?.details);
      default:
        if (res.status >= 500) throw new ApiError(message, res.status);
        throw new CrawlersError(message, 'unknown_error');
    }
  }

  // ----- Jobs -----------------------------------------------------------

  jobs = {
    /** Create a new job. Charges 0.10 € on success (202). */
    create: <T = unknown>(input: JobCreateInput): Promise<Job<T>> =>
      this.request<Job<T>>('POST', '/v1/jobs', input),

    /** Get a job by id. */
    get: <T = unknown>(id: string): Promise<Job<T>> =>
      this.request<Job<T>>('GET', `/v1/jobs/${encodeURIComponent(id)}`),

    /** Convenience helper: create + poll until terminal state. */
    run: async <T = unknown>(
      input: JobCreateInput,
      wait?: WaitOptions
    ): Promise<Job<T>> => {
      const created = await this.jobs.create<T>(input);
      return this.jobs.wait<T>(created.id, wait);
    },

    /** Poll a job until it completes, fails, or the timeout fires. */
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
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
          return job;
        }
        if (Date.now() > deadline) {
          throw new JobTimeoutError(id, opts.timeoutMs ?? 5 * 60_000);
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    },
  };

  // ----- Wallet ---------------------------------------------------------

  wallet = {
    /** Current wallet balance + estimated jobs remaining. */
    balance: (): Promise<WalletBalance> =>
      this.request<WalletBalance>('GET', '/v1/wallet/balance'),
  };
}
