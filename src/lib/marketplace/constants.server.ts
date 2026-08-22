/**
 * constants.server.ts (L1a.8)
 *
 * Lecture unique et mise en cache de `marketplace_pricing_constants` (§2.15).
 * Aucune autre fonction de la place d'échange ne code un seuil en dur :
 * tout paramètre de pricing, de risque, de plafond ou de Studio se lit ici.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server';

export interface MarketplaceConstants {
  version: number;
  values: Record<string, unknown>;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { loaded_at: number; data: MarketplaceConstants } | null = null;

/** Charge la version active des constantes (cache mémoire 5 min par isolate). */
export async function loadConstants(force = false): Promise<MarketplaceConstants> {
  if (!force && cache && Date.now() - cache.loaded_at < CACHE_TTL_MS) return cache.data;

  const { data, error } = await supabaseAdmin
    .from('marketplace_pricing_constants')
    .select('version, key, value')
    .eq('active', true)
    .order('version', { ascending: false });

  if (error) throw new Error(`Constantes place d'échange illisibles : ${error.message}`);
  if (!data || data.length === 0) throw new Error("Aucune version active de constantes place d'échange");

  const version = Math.max(...data.map((r) => r.version));
  const values: Record<string, unknown> = {};
  for (const row of data) {
    if (row.version === version) values[row.key] = row.value;
  }

  cache = { loaded_at: Date.now(), data: { version, values } };
  return cache.data;
}

/** Vide le cache (recalibrage admin). */
export function invalidateConstantsCache(): void {
  cache = null;
}

export function num(c: MarketplaceConstants, key: string): number {
  const raw = c.values[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Constante numérique manquante : ${key}`);
  }
  return value;
}

export function str(c: MarketplaceConstants, key: string): string {
  const value = c.values[key];
  if (typeof value !== 'string' || !value) throw new Error(`Constante texte manquante : ${key}`);
  return value;
}

export function obj<T extends Record<string, unknown>>(c: MarketplaceConstants, key: string): T {
  const value = c.values[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Constante objet manquante : ${key}`);
  }
  return value as T;
}
