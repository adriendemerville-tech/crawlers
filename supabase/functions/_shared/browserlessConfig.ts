/**
 * Centralized Browserless.io configuration.
 * All edge functions MUST use this constant instead of hardcoding URLs.
 * 
 * Current plan: Cloud (1000 units/month, concurrency 10)
 * URL: production-sfo.browserless.io (v2 cloud)
 */
export const BROWSERLESS_BASE_URL = 'https://production-sfo.browserless.io';

export function getBrowserlessContentUrl(token: string): string {
  return `${BROWSERLESS_BASE_URL}/content?token=${token}`;
}

export function getBrowserlessFunctionUrl(token: string): string {
  return `${BROWSERLESS_BASE_URL}/function?token=${token}`;
}

export function getBrowserlessKey(): string | null {
  return Deno.env.get('RENDERING_API_KEY') || Deno.env.get('BROWSERLESS_API_KEY') || null;
}
