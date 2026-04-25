/**
 * useFelixV2Flag — bascule Félix legacy ↔ unifié.
 *
 * Sprint 8 : v2 active par défaut. Le legacy reste accessible via
 * `?felix_v2=0` ou `localStorage.felix_unified='0'` le temps de la dépréciation.
 *
 * Sources, par ordre de priorité :
 *  1. URL `?felix_v2=1|0` (force, persistée)
 *  2. localStorage.felix_unified ('1' actif, '0' désactivé)
 *  3. par défaut : true (v2)
 */
import { useEffect, useState } from 'react';

const KEY = 'felix_unified';
const EVENT = 'felix-v2-flag-changed';

function readFlag(): boolean {
  if (typeof window === 'undefined') return true;
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
  const stored = localStorage.getItem(KEY);
  if (stored === '0') return false;
  return true; // défaut v2
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
