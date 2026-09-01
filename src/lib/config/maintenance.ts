import { supabase } from '@/integrations/supabase/client';

/**
 * Etat de maintenance du site.
 *
 * Lu depuis `public.site_maintenance` (lecture publique) : la page de
 * maintenance doit s'afficher aussi pour les visiteurs anonymes, or
 * `system_config` n'est lisible que connecté. Une seule requête, mise en
 * cache mémoire, pour ne pas alourdir le chemin critique.
 */
export interface MaintenanceState {
  active: boolean;
  /** 'all' = tout le site, 'paths' = uniquement les chemins listés. */
  scope: 'all' | 'paths';
  /** Chemins ou répertoires (ex. "/blog" couvre "/blog/mon-article"). */
  paths: string[];
  message: string | null;
}

export const MAINTENANCE_ROUTE = '/maintenance';

export const DEFAULT_MAINTENANCE: MaintenanceState = {
  active: false,
  scope: 'all',
  paths: [],
  message: null,
};

let cache: MaintenanceState | null = null;
let inflight: Promise<MaintenanceState> | null = null;

export async function getMaintenanceState(): Promise<MaintenanceState> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await supabase
        .from('site_maintenance')
        .select('active,scope,paths,message')
        .abortSignal(AbortSignal.timeout(4000))
        .maybeSingle();

      cache = data
        ? {
            active: Boolean(data.active),
            scope: data.scope === 'paths' ? 'paths' : 'all',
            paths: Array.isArray(data.paths) ? (data.paths as string[]) : [],
            message: (data.message as string | null) ?? null,
          }
        : DEFAULT_MAINTENANCE;
      return cache;
    } catch {
      // fail-safe : jamais de faux positif de maintenance
      cache = DEFAULT_MAINTENANCE;
      return cache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function invalidateMaintenanceCache() {
  cache = null;
}

function normalize(path: string): string {
  const trimmed = (path || '').trim().split('?')[0].split('#')[0];
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : '/';
}

/** Les écrans qui doivent rester joignables même en maintenance. */
const ALWAYS_ALLOWED = [MAINTENANCE_ROUTE, '/auth', '/admin', '/app/admin'];

export function isMaintenancePath(pathname: string, state: MaintenanceState): boolean {
  if (!state.active) return false;

  const current = normalize(pathname);
  if (ALWAYS_ALLOWED.some((p) => current === p || current.startsWith(`${p}/`))) return false;

  if (state.scope === 'all') return true;

  return state.paths.some((raw) => {
    const rule = normalize(raw);
    if (!rule) return false;
    if (rule === '/') return current === '/';
    return current === rule || current.startsWith(`${rule}/`);
  });
}

/** Parse la zone de saisie admin (un chemin par ligne ou séparés par virgule). */
export function parseMaintenancePaths(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((v) => normalize(v))
        .filter(Boolean)
    )
  );
}
