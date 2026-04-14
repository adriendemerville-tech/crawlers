/**
 * Client-side brute-force protection for login forms.
 * Progressive lockout: 30s after 5 fails, 60s after 8, 300s after 12.
 * Persisted in localStorage to survive page refresh.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'login_rate_limit';
const THRESHOLDS = [
  { attempts: 5, lockoutSeconds: 30 },
  { attempts: 8, lockoutSeconds: 60 },
  { attempts: 12, lockoutSeconds: 300 },
];

interface RateLimitState {
  failCount: number;
  lockedUntil: number | null; // epoch ms
}

function loadState(): RateLimitState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore storage errors
  }
  return { failCount: 0, lockedUntil: null };
}

function saveState(state: RateLimitState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useLoginRateLimiter() {
  const [state, setState] = useState<RateLimitState>(loadState);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute remaining seconds from lockedUntil
  const updateRemaining = useCallback(() => {
    if (!state.lockedUntil) {
      setRemainingSeconds(0);
      return;
    }
    const diff = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    if (diff <= 0) {
      // Lock expired — keep failCount but clear lock
      const newState = { ...state, lockedUntil: null };
      setState(newState);
      saveState(newState);
      setRemainingSeconds(0);
    } else {
      setRemainingSeconds(diff);
    }
  }, [state]);

  useEffect(() => {
    updateRemaining();
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      timerRef.current = setInterval(updateRemaining, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [state.lockedUntil, updateRemaining]);

  const isLocked = remainingSeconds > 0;

  const recordFailure = useCallback(() => {
    const current = loadState(); // re-read to avoid stale
    const newCount = current.failCount + 1;
    let lockoutSeconds = 0;
    for (const t of THRESHOLDS) {
      if (newCount >= t.attempts) lockoutSeconds = t.lockoutSeconds;
    }
    const newState: RateLimitState = {
      failCount: newCount,
      lockedUntil: lockoutSeconds > 0 ? Date.now() + lockoutSeconds * 1000 : null,
    };
    saveState(newState);
    setState(newState);
  }, []);

  const recordSuccess = useCallback(() => {
    const cleared: RateLimitState = { failCount: 0, lockedUntil: null };
    saveState(cleared);
    setState(cleared);
  }, []);

  return { isLocked, remainingSeconds, failCount: state.failCount, recordFailure, recordSuccess };
}
