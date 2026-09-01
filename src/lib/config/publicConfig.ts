import { supabase } from '@/integrations/supabase/client';

/**
 * Lecture mutualisée des clés publiques de `system_config`.
 *
 * Avant : trois requêtes REST distinctes au premier rendu de la home
 * (`demo_mode`, `freemium_open_mode`, `hide_home_leadmagnet`). Chacune payait
 * son propre aller-retour réseau, ce qui retardait l'hydratation sur mobile.
 * Ici, une seule requête `in(...)` sert les trois consommateurs, avec cache
 * mémoire et déduplication des appels concurrents.
 */
export const PUBLIC_CONFIG_KEYS = [
  'demo_mode',
  'freemium_open_mode',
  'hide_home_leadmagnet',
] as const;

export type PublicConfigKey = (typeof PUBLIC_CONFIG_KEYS)[number];

type ConfigMap = Partial<Record<PublicConfigKey, unknown>>;

let cache: ConfigMap | null = null;
let inflight: Promise<ConfigMap> | null = null;

export async function getPublicConfig(): Promise<ConfigMap> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('key,value')
        .in('key', PUBLIC_CONFIG_KEYS as unknown as string[])
        .abortSignal(AbortSignal.timeout(4000));

      const map: ConfigMap = {};
      for (const row of data ?? []) {
        map[row.key as PublicConfigKey] = (row as { value: unknown }).value;
      }
      cache = map;
      return map;
    } catch {
      // fail-safe : configuration absente = valeurs par défaut fermées
      cache = {};
      return cache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Invalide le cache (utilisé par l'écoute temps réel du mode démo). */
export function invalidatePublicConfig() {
  cache = null;
}

/** Vrai si la valeur vaut `true` ou `{ [flag]: true }`. */
export function isFlagEnabled(value: unknown, flag?: string): boolean {
  if (value === true) return true;
  if (value && typeof value === 'object' && flag) {
    return (value as Record<string, unknown>)[flag] === true;
  }
  return false;
}
