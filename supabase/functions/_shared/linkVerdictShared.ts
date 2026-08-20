/**
 * linkVerdict.ts — Juge unique des liens (interne ET sortant).
 *
 * Problème résolu : jusqu'ici, chaque surface (audit-expert-seo, crawl,
 * Marina/deadUrls, file Liens admin) redéfinissait sa propre tolérance HTTP et
 * son propre vocabulaire. La même URL pouvait donc être « lien cassé » ici,
 * « broken_outbound_link » là, et absente de la file admin. Trois verdicts
 * contradictoires, aucun ne primant.
 *
 * Une seule échelle, quatre verdicts :
 *  - `hard_broken` : 404 / 410 / 451 → absence confirmée. Provenance : Mesuré.
 *  - `soft_broken` : 5xx / 429 / timeout → besoin d'un 2ᵉ constat consécutif
 *    avant d'accuser le site. Provenance : Déduit.
 *  - `blocked`     : 401 / 403 / 405 / 406 / 999 → protection serveur ou WAF,
 *    jamais un défaut du site audité. Provenance : Mesuré (non concluant).
 *  - `ok`          : tout le reste (2xx, 3xx suivis).
 *
 * 100 % déterministe, zéro appel LLM.
 */

export type LinkVerdict = 'hard_broken' | 'soft_broken' | 'blocked' | 'ok';

export type LinkProvenance = 'mesure' | 'deduit';

/** Domaines connus pour renvoyer des erreurs aux robots sans être cassés. */
export const FALSE_POSITIVE_DOMAINS = [
  'linkedin.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'amazon.fr',
  'amazon.com',
  'doctolib.fr',
  'pagesjaunes.fr',
  'google.com',
  'g.page',
  'maps.app.goo.gl',
];

export function isFalsePositiveDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return FALSE_POSITIVE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export interface ClassifyInput {
  /** URL cible du lien. */
  url: string;
  /** Statut HTTP observé, `null` en cas d'échec réseau / timeout. */
  status: number | null;
  /** Nombre de constats négatifs consécutifs déjà enregistrés pour ce lien. */
  consecutiveFailures?: number;
}

export interface LinkClassification {
  verdict: LinkVerdict;
  /** Libellé utilisateur unifié — même mot pour la même valeur, partout. */
  label: string;
  /** Provenance au sens de la taxonomie des rapports (Mesuré / Déduit). */
  provenance: LinkProvenance;
  /** Vrai quand le constat doit être remonté à l'utilisateur. */
  reportable: boolean;
  /** Explication courte, réutilisable telle quelle dans un rapport. */
  explanation: string;
}

export const VERDICT_LABELS: Record<LinkVerdict, string> = {
  hard_broken: 'lien cassé',
  soft_broken: 'lien instable (à confirmer)',
  blocked: 'non vérifiable (protection serveur)',
  ok: 'lien valide',
};

/** Un `soft_broken` n'est remonté qu'à partir de ce nombre de constats. */
export const SOFT_BROKEN_CONFIRMATIONS = 2;

export function classifyLink(input: ClassifyInput): LinkClassification {
  const { url, status } = input;
  const consecutive = input.consecutiveFailures ?? 1;

  const make = (
    verdict: LinkVerdict,
    provenance: LinkProvenance,
    reportable: boolean,
    explanation: string,
  ): LinkClassification => ({
    verdict,
    label: VERDICT_LABELS[verdict],
    provenance,
    reportable,
    explanation,
  });

  // Échec réseau / timeout : jamais concluant au premier passage.
  if (status === null || status === 0) {
    return make(
      'soft_broken',
      'deduit',
      consecutive >= SOFT_BROKEN_CONFIRMATIONS,
      consecutive >= SOFT_BROKEN_CONFIRMATIONS
        ? `Injoignable sur ${consecutive} contrôles consécutifs (délai dépassé ou erreur réseau).`
        : 'Injoignable une seule fois : en attente d\'un second contrôle avant conclusion.',
    );
  }

  if (status === 401 || status === 403 || status === 405 || status === 406 || status === 999) {
    return make(
      'blocked',
      'mesure',
      false,
      `HTTP ${status} : la cible refuse les robots (WAF, authentification ou filtrage). Ce n'est pas un défaut du site audité.`,
    );
  }

  if (status === 404 || status === 410 || status === 451) {
    return make(
      'hard_broken',
      'mesure',
      true,
      `HTTP ${status} : la ressource n'existe plus. À rediriger en 301 vers l'équivalent vivant, ou à retirer du contenu source.`,
    );
  }

  if (status === 429 || status >= 500) {
    return make(
      'soft_broken',
      'deduit',
      consecutive >= SOFT_BROKEN_CONFIRMATIONS,
      consecutive >= SOFT_BROKEN_CONFIRMATIONS
        ? `HTTP ${status} sur ${consecutive} contrôles consécutifs : indisponibilité durable côté cible.`
        : `HTTP ${status} au premier contrôle : indisponibilité possiblement temporaire, second contrôle requis.`,
    );
  }

  if (status >= 400) {
    // 4xx résiduels (400, 409, 422…) : anomalie réelle mais pas une absence.
    return make(
      'soft_broken',
      'deduit',
      consecutive >= SOFT_BROKEN_CONFIRMATIONS,
      `HTTP ${status} : réponse anormale de la cible, à confirmer sur un second contrôle.`,
    );
  }

  return make('ok', 'mesure', false, `HTTP ${status} : lien valide.`);
}

/** Vue agrégée d'un lot de liens, avec le vocabulaire unifié. */
export interface LinkVerdictSummary {
  hard_broken: number;
  soft_broken: number;
  blocked: number;
  ok: number;
  /** Constats à afficher = hard_broken + soft_broken confirmés. */
  reportable: number;
}

export function summarizeVerdicts(items: LinkClassification[]): LinkVerdictSummary {
  const s: LinkVerdictSummary = { hard_broken: 0, soft_broken: 0, blocked: 0, ok: 0, reportable: 0 };
  for (const it of items) {
    s[it.verdict] += 1;
    if (it.reportable) s.reportable += 1;
  }
  return s;
}

/**
 * Phrase de synthèse normalisée, utilisable dans Marina, /audit-expert et la
 * file admin sans reformulation locale (c'est ce qui supprime l'impression de
 * rapports qui se contredisent).
 */
export function describeLinkHealth(s: LinkVerdictSummary): string {
  const parts: string[] = [];
  if (s.hard_broken > 0) parts.push(`${s.hard_broken} ${VERDICT_LABELS.hard_broken}${s.hard_broken > 1 ? 's' : ''}`);
  if (s.soft_broken > 0) parts.push(`${s.soft_broken} lien${s.soft_broken > 1 ? 's' : ''} instable${s.soft_broken > 1 ? 's' : ''}`);
  if (s.blocked > 0) parts.push(`${s.blocked} non vérifiable${s.blocked > 1 ? 's' : ''}`);
  if (!parts.length) return 'Aucun lien cassé détecté.';
  return parts.join(', ') + '.';
}
