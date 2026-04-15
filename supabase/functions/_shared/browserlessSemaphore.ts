/**
 * Browserless Concurrency Semaphore
 * 
 * Limits simultaneous Browserless sessions to avoid 429 errors.
 * Plan: Cloud 10 concurrent sessions → cap at 7 to leave headroom.
 */

const MAX_CONCURRENT = 7;
const WAIT_TIMEOUT_MS = 30_000; // max wait before giving up
const POLL_INTERVAL_MS = 500;

let activeCount = 0;

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
  console.log(`[Semaphore] 🔒 ${label}: acquired slot (${activeCount}/${MAX_CONCURRENT})`);

  try {
    return await fn();
  } finally {
    activeCount--;
    console.log(`[Semaphore] 🔓 ${label}: released slot (${activeCount}/${MAX_CONCURRENT})`);
  }
}

export function getActiveSessions(): number {
  return activeCount;
}
