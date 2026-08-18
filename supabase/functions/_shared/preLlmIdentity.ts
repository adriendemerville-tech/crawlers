/**
 * _shared/preLlmIdentity.ts
 *
 * Résolution de la carte d'identité AVANT toute interrogation des LLM, y compris
 * pour un domaine anonyme (lead magnets de la home : check-llm, check-llm-depth).
 *
 * Pourquoi : sans site suivi, `getSiteContext` / `ensureSiteContext` renvoient
 * null et les prompts se rabattent sur le NOM DE DOMAINE. C'est la source des
 * identités fausses (un domaine contenant « dicta » décrit comme un service de
 * transcription), et une identité fausse invalide toute la mesure de visibilité :
 * on interroge les modèles sur un marché qui n'est pas celui du site.
 *
 * Ce module réutilise `resolveIdentityCard` (inférence ancrée sur des pages
 * réellement lues, jamais sur le nom de domaine) et met le résultat en cache
 * partagé 30 jours dans `domain_data_cache` : un seul appel de modèle par
 * domaine et par mois, quel que soit le nombre de leads sur ce domaine.
 *
 * `fingerprint` sert de clé de cohérence : il entre dans la clé de cache des
 * résultats LLM. Si l'identité est corrigée, les runs mesurés sur l'ancienne
 * identité ne sont plus servis.
 */

import { resolveIdentityCard, emptyIdentityCard, type IdentityCard } from './identityResolver.ts';

const CACHE_DAYS = 30;
const CACHE_TYPE = 'pre_llm_identity';

export interface PreLlmIdentity {
  /** Champs consommés par les générateurs de prompts (naturalPrompts, buildPromptSequence). */
  market_sector?: string;
  products_services?: string;
  target_audience?: string;
  commercial_area?: string;
  entity_type?: string;
  business_model?: string;
  brand_name?: string;
  site_name?: string;
  /** Traçabilité affichable : d'où vient l'identité utilisée pour interroger les modèles. */
  identity: {
    source: IdentityCard['source'];
    confidence: number;
    pagesUsed: string[];
    notes: string[];
    /** Phrase prête à afficher sous le résultat du lead magnet. */
    disclosure: string;
  };
  /** Empreinte courte de l'identité, à intégrer aux clés de cache des runs LLM. */
  fingerprint: string;
}

function shortHash(input: string): string {
  // FNV-1a 32 bits — suffisant pour une clé de cohérence de cache, non cryptographique.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function cardToIdentity(card: IdentityCard): PreLlmIdentity {
  const resolved = card.source !== 'unresolved'
    && Boolean(card.marketSector || card.productsServices);

  const disclosure = resolved
    ? `Activité du site déterminée avant l'interrogation des modèles, à partir de ${card.pagesUsed.length || 1} page(s) réellement lue(s)${card.reused ? ' (carte déjà résolue, réutilisée)' : ''} : ${card.marketSector || card.productsServices}. Les questions posées aux modèles portent sur ce marché.`
    : "L'activité du site n'a pas pu être déterminée à partir de son contenu avant l'interrogation des modèles. Les questions posées restent génériques : la mesure indique une visibilité de marque, pas une visibilité sur un marché précis. Le nom de domaine n'est jamais utilisé pour deviner l'activité.";

  const fingerprint = shortHash([
    card.marketSector || '',
    card.productsServices || '',
    card.targetAudience || '',
    card.commercialArea || '',
    card.entityType || '',
    card.commercialModel || '',
  ].join('|').toLowerCase());

  return {
    ...(card.marketSector ? { market_sector: card.marketSector } : {}),
    ...(card.productsServices ? { products_services: card.productsServices } : {}),
    ...(card.targetAudience ? { target_audience: card.targetAudience } : {}),
    ...(card.commercialArea ? { commercial_area: card.commercialArea } : {}),
    ...(card.entityType ? { entity_type: card.entityType } : {}),
    ...(card.commercialModel && card.commercialModel !== 'unknown'
      ? { business_model: card.commercialModel }
      : {}),
    identity: {
      source: card.source,
      confidence: card.confidence,
      pagesUsed: card.pagesUsed,
      notes: card.notes,
      disclosure,
    },
    fingerprint,
  };
}

/**
 * Renvoie l'identité à utiliser pour construire les prompts. Ne lève jamais :
 * en cas d'échec, renvoie une identité `unresolved` dont la `disclosure` dit
 * explicitement que les questions sont génériques.
 */
export async function resolvePreLlmIdentity(
  sb: any,
  opts: { domain: string; url?: string; userId?: string | null; forceRefresh?: boolean },
): Promise<PreLlmIdentity> {
  const domain = String(opts.domain || '').replace(/^www\./, '').toLowerCase();
  const url = opts.url || `https://${domain}`;

  // 1) Cache partagé par domaine — évite un appel de modèle par lead.
  if (!opts.forceRefresh) {
    try {
      const { data } = await sb
        .from('domain_data_cache')
        .select('result_data')
        .eq('domain', domain)
        .eq('data_type', CACHE_TYPE)
        .is('week_start_date', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      const cached = data?.result_data as PreLlmIdentity | undefined;
      if (cached?.fingerprint && cached.identity) return cached;
    } catch { /* cache indisponible : on infère */ }
  }

  // 2) Inférence ancrée sur les pages (jamais sur le nom de domaine).
  let card: IdentityCard;
  try {
    card = await resolveIdentityCard(sb, {
      domain,
      url,
      userId: opts.userId || '',
      forceRefresh: opts.forceRefresh,
    });
  } catch (e) {
    card = emptyIdentityCard(domain, null, [String((e as Error)?.message || e)]);
  }

  const identity = cardToIdentity(card);

  // 3) Mise en cache seulement si l'identité est exploitable : ne jamais figer
  //    30 jours un échec de résolution (le site peut être temporairement injoignable).
  if (identity.identity.source !== 'unresolved') {
    try {
      await sb.from('domain_data_cache').upsert({
        domain,
        data_type: CACHE_TYPE,
        week_start_date: null,
        result_data: identity,
        expires_at: new Date(Date.now() + CACHE_DAYS * 86_400_000).toISOString(),
      }, { onConflict: 'domain,data_type,week_start_date' });
    } catch { /* non bloquant */ }
  }

  return identity;
}
