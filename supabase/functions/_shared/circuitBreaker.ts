/**
 * Circuit Breaker — prevents cascade failures when external APIs go down.
 * 
 * States: CLOSED (normal) → OPEN (blocking) → HALF_OPEN (testing)
 * Opens after `threshold` consecutive failures, stays open for `resetMs`.
 */

interface CircuitState {
  failures: number;
  state: 'closed' | 'open' | 'half_open';
  lastFailure: number;
  lastSuccess: number;
}

const circuits = new Map<string, CircuitState>();

const DEFAULT_THRESHOLD = 3;
const DEFAULT_RESET_MS = 5 * 60 * 1000; // 5 minutes

function getCircuit(name: string): CircuitState {
  if (!circuits.has(name)) {
    circuits.set(name, { failures: 0, state: 'closed', lastFailure: 0, lastSuccess: 0 });
  }
  return circuits.get(name)!;
}

/**
 * Check if a circuit is available for requests.
 * Returns true if the request should proceed, false if blocked.
 */
export function isCircuitOpen(name: string, resetMs = DEFAULT_RESET_MS): boolean {
  const circuit = getCircuit(name);

  if (circuit.state === 'closed') return false; // not open → proceed

  if (circuit.state === 'open') {
    // Check if reset period has elapsed → transition to half_open
    if (Date.now() - circuit.lastFailure > resetMs) {
      circuit.state = 'half_open';
      console.log(`[CircuitBreaker] ${name}: OPEN → HALF_OPEN (testing)`);
      return false; // allow one test request
    }
    return true; // still open → block
  }

  // half_open → allow the test request
  return false;
}

/**
 * Record a successful API call — resets the circuit.
 */
export function recordSuccess(name: string): void {
  const circuit = getCircuit(name);
  circuit.failures = 0;
  circuit.state = 'closed';
  circuit.lastSuccess = Date.now();
}

/**
 * Record a failed API call — may trip the circuit.
 */
export function recordFailure(name: string, threshold = DEFAULT_THRESHOLD): void {
  const circuit = getCircuit(name);
  circuit.failures++;
  circuit.lastFailure = Date.now();

  if (circuit.failures >= threshold) {
    circuit.state = 'open';
    console.warn(`[CircuitBreaker] ${name}: CLOSED → OPEN after ${circuit.failures} failures (blocking for 5 min)`);
  }
}

/**
 * Wraps an async function with circuit breaker protection.
 * Returns null if the circuit is open (instead of throwing).
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { threshold?: number; resetMs?: number }
): Promise<T | null> {
  const { threshold = DEFAULT_THRESHOLD, resetMs = DEFAULT_RESET_MS } = options || {};

  if (isCircuitOpen(name, resetMs)) {
    console.log(`[CircuitBreaker] ${name}: BLOCKED (circuit open)`);
    return null;
  }

  try {
    const result = await fn();
    recordSuccess(name);
    return result;
  } catch (err) {
    recordFailure(name, threshold);
    console.error(`[CircuitBreaker] ${name}: failure #${getCircuit(name).failures}:`, err);
    return null;
  }
}

/**
 * Get circuit status for monitoring/logging.
 */
export function getCircuitStatus(name: string): { state: string; failures: number; lastFailure: number } {
  const circuit = getCircuit(name);
  return { state: circuit.state, failures: circuit.failures, lastFailure: circuit.lastFailure };
}
