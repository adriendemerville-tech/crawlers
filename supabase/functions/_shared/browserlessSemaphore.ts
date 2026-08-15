/**
 * Browserless Concurrency Semaphore
 * 
 * Limits simultaneous Browserless sessions to avoid 429 errors.
 * Plan: Cloud 10 concurrent sessions → cap at 7 to leave headroom.
 */

// Local guard remains as a fallback. The database lease enforces the actual
// seven-session ceiling across all worker isolates.
const MAX_CONCURRENT = 7;
const WAIT_TIMEOUT_MS = 30_000; // max wait before giving up
const POLL_INTERVAL_MS = 500;

let activeCount = 0;

async function callSlotRpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const baseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceKey) return null;
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`slot RPC ${name} returned ${response.status}`);
  return await response.json() as T;
}

async function acquireGlobalSlot(label: string): Promise<string | null> {
  const leaseId = crypto.randomUUID();
  const startedAt = Date.now();
  while (Date.now() - startedAt <= WAIT_TIMEOUT_MS) {
    const slot = await callSlotRpc<number>('acquire_browserless_slot', {
      p_lease_id: leaseId,
      p_label: label,
      p_lease_seconds: 60,
    });
    if (typeof slot === 'number') return leaseId;
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}

/**
 * Wraps an async function that uses a Browserless session.
 * Waits for a slot if at capacity; returns null if wait times out.
 */
export async function withBrowserlessSlot<T>(
  fn: () => Promise<T>,
  label = 'unknown',
): Promise<T | null> {
  const start = Date.now();

  // Wait for an available slot
  while (activeCount >= MAX_CONCURRENT) {
    if (Date.now() - start > WAIT_TIMEOUT_MS) {
      console.warn(`[Semaphore] ⏱️ ${label}: timeout waiting for Browserless slot (${activeCount}/${MAX_CONCURRENT} active)`);
      return null;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  activeCount++;
  let leaseId: string | null = null;

  try {
    leaseId = await acquireGlobalSlot(label);
    if (!leaseId) {
      console.warn(`[Semaphore] ${label}: timeout waiting for a global Browserless slot`);
      return null;
    }
    return await fn();
  } catch (error) {
    console.warn(`[Semaphore] ${label}: global slot unavailable`, error);
    return null;
  } finally {
    if (leaseId) await callSlotRpc<boolean>('release_browserless_slot', { p_lease_id: leaseId }).catch(() => null);
    activeCount--;
  }
}

export function getActiveSessions(): number {
  return activeCount;
}
