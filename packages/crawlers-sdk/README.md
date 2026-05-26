# @crawlers/sdk

Official TypeScript SDK for the [Crawlers API](https://crawlers.fr/developers) — SEO, GEO and AI-visibility audits.

```bash
npm install @crawlers/sdk
```

## Quickstart

```ts
import { CrawlersClient } from '@crawlers/sdk';

const crawlers = new CrawlersClient({ apiKey: process.env.CRAWLERS_API_KEY! });

const job = await crawlers.jobs.run({
  feature: 'geo_score',
  url: 'https://example.com',
});

console.log(job.result);
```

## Features

- Typed signatures for the 18 Crawlers features (`geo_score`, `eeat`, `audit_expert`, `serp_scan`, `llm_visibility`, …).
- Automatic polling helper: `jobs.run()` creates the job and waits for completion.
- Typed errors: `InsufficientBalanceError`, `RateLimitError`, `AuthenticationError`, `JobTimeoutError`.
- Wallet helper: `wallet.balance()` returns your current credit + estimated jobs remaining.
- Zero runtime dependency. Works in Node 18+, Bun, Deno, edge runtimes.

## Pricing

Every successful job costs **0.10 € / job**, debited from your wallet. Top up at
[/developers/profile?tab=facturation](https://crawlers.fr/developers/profile?tab=facturation).

## Errors

```ts
import {
  InsufficientBalanceError,
  RateLimitError,
  AuthenticationError,
} from '@crawlers/sdk';

try {
  await crawlers.jobs.create({ feature: 'audit_expert', url: 'https://example.com' });
} catch (err) {
  if (err instanceof InsufficientBalanceError) {
    console.error('Top up at', err.topupUrl);
  } else if (err instanceof RateLimitError) {
    console.error('Retry in', err.retryAfterSec, 's');
  } else if (err instanceof AuthenticationError) {
    console.error('Check your API key.');
  } else {
    throw err;
  }
}
```

## License

MIT
