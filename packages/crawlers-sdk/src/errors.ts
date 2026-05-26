/** Base class for all SDK errors. */
export class CrawlersError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CrawlersError';
  }
}

/** 401 / 403 — invalid or revoked API key. */
export class AuthenticationError extends CrawlersError {
  constructor(message = 'Invalid or revoked API key.') {
    super(message, 'authentication_error');
    this.name = 'AuthenticationError';
  }
}

/** 402 — wallet balance below 0.10 €. Top up at /developers/profile?tab=facturation. */
export class InsufficientBalanceError extends CrawlersError {
  constructor(
    message = 'Wallet balance is too low to run this job.',
    public readonly topupUrl = 'https://crawlers.fr/developers/profile?tab=facturation'
  ) {
    super(message, 'insufficient_balance');
    this.name = 'InsufficientBalanceError';
  }
}

/** 429 — rate limit hit (100 req/min per key). */
export class RateLimitError extends CrawlersError {
  constructor(message = 'Rate limit exceeded.', public readonly retryAfterSec?: number) {
    super(message, 'rate_limit');
    this.name = 'RateLimitError';
  }
}

/** 4xx other — bad request, unknown feature, etc. */
export class ValidationError extends CrawlersError {
  constructor(message: string, public readonly details?: unknown) {
    super(message, 'validation_error');
    this.name = 'ValidationError';
  }
}

/** 5xx or network failure. */
export class ApiError extends CrawlersError {
  constructor(message: string, public readonly status?: number) {
    super(message, 'api_error');
    this.name = 'ApiError';
  }
}

/** Job did not reach a terminal state before the timeout. */
export class JobTimeoutError extends CrawlersError {
  constructor(public readonly jobId: string, timeoutMs: number) {
    super(`Job ${jobId} did not complete within ${timeoutMs}ms.`, 'job_timeout');
    this.name = 'JobTimeoutError';
  }
}
