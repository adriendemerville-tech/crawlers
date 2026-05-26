import { describe, expect, it, vi } from 'vitest';
import {
  CrawlersClient,
  AuthenticationError,
  InsufficientBalanceError,
  ValidationError,
} from '../src/index.js';

const mockFetch = (status: number, body: unknown) =>
  vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  ) as unknown as typeof fetch;

describe('CrawlersClient', () => {
  it('rejects keys that do not start with crw_live_', () => {
    expect(() => new CrawlersClient({ apiKey: 'bad' })).toThrow(ValidationError);
  });

  it('creates a job and returns the payload', async () => {
    const client = new CrawlersClient({
      apiKey: 'crw_live_test',
      fetch: mockFetch(202, {
        id: 'job_1',
        feature: 'geo_score',
        status: 'queued',
        created_at: '',
        cost_cents: 10,
        poll_url: '/v1/jobs/job_1',
      }),
    });
    const job = await client.jobs.create({
      feature: 'geo_score',
      input: { url: 'https://x.com' },
    });
    expect(job.id).toBe('job_1');
    expect(job.cost_cents).toBe(10);
  });

  it('throws AuthenticationError on 401', async () => {
    const client = new CrawlersClient({
      apiKey: 'crw_live_test',
      fetch: mockFetch(401, { error: 'invalid_api_key' }),
    });
    await expect(client.wallet.balance()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws InsufficientBalanceError on 402', async () => {
    const client = new CrawlersClient({
      apiKey: 'crw_live_test',
      fetch: mockFetch(402, { error: 'insufficient_balance', message: 'low' }),
    });
    await expect(
      client.jobs.create({ feature: 'geo_score', input: { url: 'https://x.com' } })
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});
