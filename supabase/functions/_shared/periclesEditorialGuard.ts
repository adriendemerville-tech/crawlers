/**
 * parmenionEditorialGuard.ts — Garde éditoriale partagée Parménion
 *
 * Fix 10.7 — Liste d'alias auteur "Parménion" résolue depuis la DB
 * (`parmenion_targets.author_aliases`, JSONB array) avec fallback statique
 * si la colonne est vide / l'appel échoue. Le fallback est CRITIQUE :
 * on ne veut jamais désactiver la garde par accident si la DB est incomplète.
 */

const STATIC_FALLBACK_ALIASES = ['parménion', 'parmenion', 'crawlers autopilot'] as const;
const EDITORIAL_AGE_LIMIT_MONTHS = 6;

// Cache léger (5 min) par domaine pour éviter un RPC à chaque check
const aliasCache = new Map<string, { aliases: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface EditorialGuardResult {
  allowed: boolean;
  reason?: string;
}

interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

/**
 * Charge les alias auteurs pour un domaine (DB → fallback statique).
 * Idempotent et caché 5 min.
 */
export async function loadAuthorAliases(
  supabase: SupabaseLike | undefined,
  domain: string,
): Promise<string[]> {
  const key = domain.toLowerCase();
  const cached = aliasCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.aliases;

  let aliases: string[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('get_parmenion_author_aliases', { p_domain: domain });
      if (!error && Array.isArray(data)) {
        aliases = (data as unknown[])
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
          .map(v => v.toLowerCase().trim());
      }
    } catch (e) {
      console.warn(`[editorial-guard] RPC get_parmenion_author_aliases failed for "${domain}": ${(e as Error).message}`);
    }
  }

  // FALLBACK CRITIQUE : si DB vide / RPC down → liste statique
  if (aliases.length === 0) {
    console.log(`[editorial-guard] ${domain}: fallback static aliases (DB vide ou indisponible)`);
    aliases = [...STATIC_FALLBACK_ALIASES];
  }

  aliasCache.set(key, { aliases, expiresAt: Date.now() + CACHE_TTL_MS });
  return aliases;
}

/**
 * Vérifie qu'un contenu CMS peut être modifié par Parménion.
 *  - Bloque si auteur ∈ aliases (DB ou statique)
 *  - Bloque si publié_at > 6 mois
 */
export async function checkEditorialGuard(
  content: Record<string, unknown>,
  domain: string,
  supabase?: SupabaseLike,
): Promise<EditorialGuardResult> {
  const author = ((content.author_name || content.author || '') as string).toLowerCase().trim();
  if (author) {
    const aliases = await loadAuthorAliases(supabase, domain);
    if (aliases.some(p => author.includes(p))) {
      return {
        allowed: false,
        reason: `Parménion ne peut pas modifier un contenu dont il est l'auteur (author: "${author}", matched alias DB/statique)`,
      };
    }
  }

  const dateStr = (content.published_at || content.created_at || '') as string;
  if (dateStr) {
    const publishedDate = new Date(dateStr);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - EDITORIAL_AGE_LIMIT_MONTHS);
    if (publishedDate < sixMonthsAgo) {
      return {
        allowed: false,
        reason: `Contenu trop ancien (${dateStr}) — limite de ${EDITORIAL_AGE_LIMIT_MONTHS} mois dépassée`,
      };
    }
  }

  return { allowed: true };
}
