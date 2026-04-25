/**
 * useFelixV2Flag — feature flag de bascule Félix legacy ↔ unifié.
 *
 * Sources, par ordre de priorité :
 *  1. URL `?felix_v2=1` (force) ou `?felix_v2=0` (désactive)
 *  2. localStorage.felix_unified (=== '1' actif, '0' désactivé)
 *  3. par défaut : false (legacy ChatWindow)
 *
 * Réagit aux events `felix-v2-flag-changed` et au storage cross-tab.
 */
import { useEffect, useState } from 'react';

const KEY = 'felix_unified';
const EVENT = 'felix-v2-flag-changed';

function readFlag(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const urlVal = params.get('felix_v2');
  if (urlVal === '1') {
    localStorage.setItem(KEY, '1');
    return true;
  }
  if (urlVal === '0') {
    localStorage.setItem(KEY, '0');
    return false;
  }
  return localStorage.getItem(KEY) === '1';
}

export function useFelixV2Flag(): [boolean, (next: boolean) => void] {
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
