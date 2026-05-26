import { describe, expect, it, vi } from 'vitest';
import {
  CrawlersClient,
  AuthenticationError,
  InsufficientBalanceError,
  ValidationError,
} from '../src/index.js';

const mockFetch = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    })
  ) as unknown as typeof fetch;

describe('CrawlersClient', () => {
  it('rejects keys that do not start with crw_live_', () => {
    expect(() => new CrawlersClient({ apiKey: 'bad' })).toThrow(ValidationError);
  });

  it('creates a job and returns the payload', async () => {
    const fetchImpl = mockFetch(202, {
      id: 'job_1',
      feature: 'geo_score',
      status: 'queued',
      created_at: '',
      updated_at: '',
      completed_at: null,
      cost_cents: 10,
      input: { feature: 'geo_score', url: 'https://x.com' },
      result: null,
      error: null,
    });
    const client = new CrawlersClient({ apiKey: 'crw_live_test', fetch: fetchImpl });
    const job = await client.jobs.create({ feature: 'geo_score', url: 'https://x.com' });
    expect(job.id).toBe('job_1');
  });

  it('throws AuthenticationError on 401', async () => {
    const client = new CrawlersClient({
      apiKey: 'crw_live_test',
      fetch: mockFetch(401, { error: { message: 'bad key' } }),
    });
    await expect(client.wallet.balance()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws InsufficientBalanceError on 402', async () => {
    const client = new CrawlersClient({
      apiKey: 'crw_live_test',
      fetch: mockFetch(402, {
        error: { message: 'low' },
        topup_url: 'https://x/topup',
      }),
    });
    await expect(
      client.jobs.create({ feature: 'geo_score', url: 'https://x.com' })
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});
