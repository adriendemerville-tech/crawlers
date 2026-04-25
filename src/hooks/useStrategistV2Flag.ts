/**
 * useStrategistV2Flag — bascule Stratège legacy ↔ unifié.
 * Sprint 8 : v2 active par défaut. Override : `?strategist_v2=0`.
 */
import { useEffect, useState } from 'react';

const KEY = 'strategist_unified';
const EVENT = 'strategist-v2-flag-changed';

function readFlag(): boolean {
  if (typeof window === 'undefined') return true;
  const params = new URLSearchParams(window.location.search);
  const urlVal = params.get('strategist_v2');
  if (urlVal === '1') {
    localStorage.setItem(KEY, '1');
    return true;
  }
  if (urlVal === '0') {
    localStorage.setItem(KEY, '0');
    return false;
  }
  const stored = localStorage.getItem(KEY);
  if (stored === '0') return false;
  return true;
}

export function useStrategistV2Flag(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readFlag());

  useEffect(() => {
    const handler = () => setEnabled(readFlag());
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const set = (next: boolean) => {
    localStorage.setItem(KEY, next ? '1' : '0');
    setEnabled(next);
    window.dispatchEvent(new Event(EVENT));
  };

  return [enabled, set];
}
