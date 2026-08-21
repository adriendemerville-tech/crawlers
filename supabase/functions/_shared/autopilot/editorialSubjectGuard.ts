/**
 * Editorial Subject Guard — sépare la STRATÉGIE SEO du SUJET éditorial.
 *
 * Problème corrigé : Parménion recevait des tâches stratégiques du type
 * « Optimiser le placement du mot-clé dans la balise title » et utilisait
 * ce libellé comme SUJET d'article. Résultat : des articles absurdes
 * (« Guide ultime SEO local pour artisans : dominez Google avec la balise title »)
 * sur un logiciel de devis comme dictadevi.io, répétés cycle après cycle
 * → cannibalisation.
 *
 * Règle : un libellé de tactique SEO n'est JAMAIS un sujet éditorial,
 * SAUF si le site vend précisément du SEO (crawlers.fr). Dans les autres cas,
 * on retombe sur le vrai sujet métier (mot-clé cible, page manquante),
 * et à défaut on bloque la génération.
 */

/** Libellés de tactiques / techniques SEO (le MOYEN, pas le SUJET). */
const SEO_TACTIC_PATTERNS: RegExp[] = [
  /balise\s+(title|meta|h1|h2|alt|canonical)/i,
  /\bmeta[\s-]?(title|description|robots)\b/i,
  /placement\s+du\s+mot[\s-]?cl[eé]/i,
  /mot[\s-]?cl[eé]\s+(en\s+)?(t[eê]te|d[eé]but|premier)/i,
  /front[\s-]?loading/i,
  /maillage\s+interne|liens?\s+internes?|netlinking|backlinks?|ancres?\s+de\s+lien/i,
  /canonical|hreflang|robots\.txt|sitemap|no\s?index|redirection\s+30\d/i,
  /donn[eé]es\s+structur[eé]es|schema\.?org|json[\s-]?ld|rich\s+snippets?/i,
  /core\s+web\s+vitals|lcp|cls|inp|budget\s+de?\s+crawl|crawl\s+budget/i,
  /indexation|d[eé]sindexation|couverture\s+gsc|search\s+console/i,
  /optimiser\s+(le\s+)?(title|titre\s+seo|slug|url)/i,
  /densit[eé]\s+de\s+mots?[\s-]?cl[eé]s|cocon\s+s[eé]mantique|silo\s+seo/i,
  /audit\s+(seo|technique)|score\s+seo|position\s+serp|serp/i,
];

/** Le site parle-t-il lui-même de SEO/GEO ? (alors la tactique EST un sujet légitime) */
export function siteSellsSeo(domain: string, keywords: string[] = []): boolean {
  const d = (domain || '').toLowerCase();
  if (d.includes('crawlers.')) return true;
  const hay = keywords.join(' ').toLowerCase();
  return /\bseo\b|r[eé]f[eé]rencement|generative\s+engine|(\bgeo\b.*(ia|llm))/.test(hay);
}

/** Le texte est-il un libellé de tactique SEO plutôt qu'un sujet métier ? */
export function isSeoTacticText(text: string): boolean {
  const t = (text || '').trim();
  if (t.length < 3) return false;
  return SEO_TACTIC_PATTERNS.some((re) => re.test(t));
}

export interface ResolveSubjectInput {
  domain: string;
  /** priority_content / missing_pages[0] issu du plan stratégique */
  missingPage?: { title?: string; rationale?: string; target_keywords?: string[] } | null;
  /** strategist_task du plan PRESCRIBE V3 */
  task?: { title?: string; metadata?: Record<string, unknown> } | null;
  /** Mots-clés métier du site (keyword universe) */
  siteKeywords?: string[];
}

export type ResolvedSubject =
  | { ok: true; subject: string; keywords: string[]; source: 'missing_page' | 'business_keyword'; note?: string }
  | { ok: false; reason: string; tacticLabel: string };

function cleanKeywords(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter((k) => k.length > 2 && !isSeoTacticText(k));
}

/**
 * Résout le sujet éditorial réel à partir d'une tâche stratégique.
 * Retourne `ok: false` quand la tâche n'exprime qu'une tactique SEO sans
 * sujet métier exploitable : l'appelant DOIT alors renoncer à publier.
 */
export function resolveEditorialSubject(input: ResolveSubjectInput): ResolvedSubject {
  const { domain, missingPage, task } = input;
  const meta = (task?.metadata || {}) as Record<string, unknown>;
  const taskKeywords = cleanKeywords(
    (meta['target_keywords'] as unknown) ?? (missingPage?.target_keywords as unknown),
  );
  const siteKeywords = cleanKeywords(input.siteKeywords);
  const seoIsTheProduct = siteSellsSeo(domain, [...siteKeywords, ...taskKeywords]);

  const candidates: Array<{ text: string; source: 'missing_page' | 'business_keyword' }> = [];
  if (missingPage?.title) candidates.push({ text: String(missingPage.title), source: 'missing_page' });
  if (task?.title) candidates.push({ text: String(task.title), source: 'missing_page' });

  for (const c of candidates) {
    if (c.text.trim().length < 5) continue;
    if (!seoIsTheProduct && isSeoTacticText(c.text)) continue;
    return {
      ok: true,
      subject: c.text.trim(),
      keywords: (taskKeywords.length ? taskKeywords : siteKeywords).slice(0, 5),
      source: c.source,
    };
  }

  // Le libellé est une tactique : on retombe sur le vrai sujet métier.
  const tacticLabel = (missingPage?.title || task?.title || '').trim();
  const businessKeyword = taskKeywords[0] || siteKeywords[0];
  if (businessKeyword) {
    return {
      ok: true,
      subject: businessKeyword,
      keywords: (taskKeywords.length ? taskKeywords : siteKeywords).slice(0, 5),
      source: 'business_keyword',
      note: `Tactique SEO "${tacticLabel}" requalifiée : elle décrit le MOYEN, pas le sujet. Sujet métier retenu : "${businessKeyword}".`,
    };
  }

  return {
    ok: false,
    reason: 'Tâche purement tactique (technique SEO) sans sujet métier exploitable : publication annulée pour éviter un article hors-sujet.',
    tacticLabel,
  };
}

/**
 * Brief éditorial : la tactique SEO est passée en CONSIGNE d'exécution,
 * jamais en thème d'article.
 */
export function buildEditorialBrief(resolved: Extract<ResolvedSubject, { ok: true }>, opts: {
  rationale?: string | null;
  tacticDirective?: string | null;
  domain?: string;
} = {}): string {
  const lines: string[] = [`Sujet éditorial : ${resolved.subject}`];
  if (resolved.keywords.length) lines.push(`Mots-clés cibles : ${resolved.keywords.join(', ')}`);
  if (opts.rationale) lines.push(String(opts.rationale));
  if (opts.tacticDirective) {
    lines.push(
      `Consigne d'optimisation (à appliquer, PAS à traiter comme sujet) : ${opts.tacticDirective}.`,
    );
  }
  lines.push(
    "Interdiction absolue : ne pas écrire d'article sur les techniques SEO (balise title, maillage, données structurées, indexation) ; ces techniques sont des moyens appliqués silencieusement au contenu, pas le thème traité.",
  );
  return lines.join('\n');
}
