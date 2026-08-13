/**
 * Page Archetypes — segmentation d'un crawl en « types de pages » (agence, produit,
 * avis, service, blog, conversion, institutionnel…), notation par type, conclusion
 * intermédiaire par type puis synthèse business globale.
 *
 * 100 % déterministe : aucun appel LLM, aucun token consommé.
 * Consommé par Marina (section « Audit par type de page ») et réutilisable par
 * Parménion / Stratège cocoon via le même objet ArchetypeAnalysis.
 */

export interface ArchetypePageInput {
  url: string;
  path?: string | null;
  title?: string | null;
  meta_description?: string | null;
  h1?: string | null;
  word_count?: number | null;
  internal_links?: number | null;
  seo_score?: number | null;
  thin_score?: number | null;
  near_duplicate_group?: string | null;
  is_indexable?: boolean | null;
  has_schema_org?: boolean | null;
  has_canonical?: boolean | null;
  images_without_alt?: number | null;
  http_status?: number | null;
  crawl_depth?: number | null;
  page_intent?: string | null;
  page_type_override?: string | null;
}

export type ArchetypeRole = 'core_business' | 'auxiliary_pillar' | 'support' | 'functional';

export interface ArchetypeGroup {
  key: string;
  label: string;
  role: ArchetypeRole;
  purpose: string;
  pages: number;
  sample: string[];
  avgSeoScore: number | null;
  avgWordCount: number;
  avgInternalLinks: number;
  thinPages: number;
  duplicateGroups: number;
  missingMeta: number;
  missingTitleOrH1: number;
  noSchema: number;
  notIndexable: number;
  strengths: string[];
  failures: string[];
  optimizations: string[];
  verdict: 'strong' | 'ok' | 'weak';
}

export type MixAction = 'balanced' | 'expand' | 'prune' | 'differentiate' | 'create';

export interface ArchetypeMixEntry {
  key: string;
  label: string;
  role: ArchetypeRole;
  crawledPages: number;
  crawlShare: number;          // 0-1
  sitemapPages: number | null; // null si sitemap indisponible
  sitemapShare: number | null; // 0-1
  targetMin: number;           // 0-1
  targetMax: number;           // 0-1
  action: MixAction;
  rationale: string;
}

export interface ArchetypeMix {
  basis: 'crawl' | 'crawl+sitemap';
  crawlPages: number;
  sitemapPages: number | null;
  coverage: number | null;     // pages crawlées / pages sitemap
  entries: ArchetypeMixEntry[];
  missing: Array<{ key: string; label: string; role: ArchetypeRole; rationale: string }>;
  verdict: 'balanced' | 'unbalanced';
  synthesis: string;
}

export interface ArchetypeAnalysis {
  totalPages: number;
  groups: ArchetypeGroup[];
  coreGroups: ArchetypeGroup[];
  mainProblem: string | null;
  globalVerdict: 'strong' | 'ok' | 'weak';
  synthesis: string;
  mix: ArchetypeMix | null;
}


interface ArchetypeDef {
  key: string;
  label: string;
  role: ArchetypeRole;
  purpose: string;
  pattern: RegExp;
}

/** Ordre = priorité de matching (le premier qui matche gagne). */
const DEFS: ArchetypeDef[] = [
  {
    key: 'agency',
    label: 'Pages agence / point de vente',
    role: 'core_business',
    purpose: "capter la demande locale (« métier + ville ») et convertir en prise de contact",
    pattern: /\/(agence|agences|magasin|magasins|boutique-?locale|point-de-vente|showroom|centre|centres|succursale|nos-agences)\b/i,
  },
  {
    key: 'product',
    label: 'Pages produit',
    role: 'core_business',
    purpose: 'répondre à une intention d\'achat précise et déclencher la commande ou la demande de devis',
    pattern: /\/(produit|produits|product|products|catalogue|modele|modeles|reference|references)\b/i,
  },
  {
    key: 'service',
    label: 'Pages service / prestation',
    role: 'core_business',
    purpose: "positionner l'offre sur les requêtes métier commerciales et amener au devis",
    pattern: /\/(service|services|prestation|prestations|travaux|realisation|realisations|solution|solutions|metier|metiers|specialite|specialites)\b/i,
  },
  {
    key: 'conversion',
    label: 'Pages de conversion (devis, contact commercial)',
    role: 'core_business',
    purpose: 'transformer un visiteur qualifié en lead',
    pattern: /\/(devis|estimation|simulateur|demande|rendez-vous|rdv|reservation|contact-commercial|tarif|tarifs|prix|pricing)\b/i,
  },
  {
    key: 'reviews',
    label: 'Pages avis / témoignages',
    role: 'auxiliary_pillar',
    purpose: 'apporter la preuve sociale et les signaux E-E-A-T qui rassurent avant la conversion',
    pattern: /\/(avis|temoignage|temoignages|review|reviews|notation|satisfaction|clients?-satisfaits?)\b/i,
  },
  {
    key: 'editorial',
    label: 'Pages éditoriales (blog, guides, actualités)',
    role: 'auxiliary_pillar',
    purpose: 'capter la demande informationnelle, alimenter le maillage interne et nourrir les moteurs de réponse IA',
    pattern: /\/(blog|article|articles|actualite|actualites|news|guide|guides|conseil|conseils|dossier|dossiers|tutoriel|faq|lexique|glossaire)\b/i,
  },
  {
    key: 'listing',
    label: 'Pages de listing / catégories',
    role: 'support',
    purpose: 'distribuer le maillage interne vers les pages business et structurer les thématiques',
    pattern: /\/(categorie|categories|category|rubrique|rubriques|tag|tags|liste|recherche|search|page\/\d+)\b/i,
  },
  {
    key: 'institutional',
    label: 'Pages institutionnelles',
    role: 'functional',
    purpose: "porter la confiance de marque et les mentions obligatoires",
    pattern: /\/(a-propos|qui-sommes-nous|equipe|notre-histoire|entreprise|about|recrutement|carriere|carrieres|partenaires?)\b/i,
  },
  {
    key: 'legal',
    label: 'Pages légales et utilitaires',
    role: 'functional',
    purpose: 'conformité et navigation ; aucun objectif d\'acquisition',
    pattern: /\/(mentions|mentions-legales|cgv|cgu|confidentialite|privacy|cookies|plan-du-site|sitemap|contact)\b/i,
  },
];

function isHome(path: string): boolean {
  return path === '/' || path === '' || /^\/(index(\.html?)?)?$/i.test(path);
}

function pagePath(p: ArchetypePageInput): string {
  if (p.path) return p.path;
  try { return new URL(p.url).pathname; } catch { return '/'; }
}

function classify(p: ArchetypePageInput): ArchetypeDef {
  const path = pagePath(p);
  if (isHome(path)) {
    return { key: 'home', label: "Page d'accueil", role: 'core_business', purpose: "porter le positionnement global et distribuer l'autorité vers les pages business", pattern: /^$/ };
  }
  const override = (p.page_type_override || '').toLowerCase();
  if (override) {
    const hit = DEFS.find((d) => d.key === override);
    if (hit) return hit;
  }
  for (const def of DEFS) if (def.pattern.test(path)) return def;

  // Repli par intention détectée au crawl
  const intent = (p.page_intent || '').toLowerCase();
  if (intent === 'buy') return DEFS.find((d) => d.key === 'product')!;
  if (intent === 'do') return DEFS.find((d) => d.key === 'conversion')!;
  if (intent === 'know') return DEFS.find((d) => d.key === 'editorial')!;
  if (intent === 'navigate') return DEFS.find((d) => d.key === 'institutional')!;

  return { key: 'other', label: 'Autres pages', role: 'support', purpose: "rôle non déterminé par l'URL ni par l'intention détectée", pattern: /^$/ };
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function buildGroup(def: ArchetypeDef, pages: ArchetypePageInput[]): ArchetypeGroup {
  const seoScores = pages.map((p) => Number(p.seo_score)).filter((n) => Number.isFinite(n) && n > 0);
  const avgSeoScore = seoScores.length ? Math.round(avg(seoScores)) : null;
  const avgWordCount = Math.round(avg(pages.map((p) => Number(p.word_count || 0))));
  const avgInternalLinks = Math.round(avg(pages.map((p) => Number(p.internal_links || 0))));
  const thinPages = pages.filter((p) => Number(p.thin_score || 0) >= 60 || Number(p.word_count || 0) < 250).length;
  const duplicateGroups = new Set(pages.map((p) => p.near_duplicate_group).filter(Boolean) as string[]).size;
  const missingMeta = pages.filter((p) => !p.meta_description || String(p.meta_description).trim().length < 50).length;
  const missingTitleOrH1 = pages.filter((p) => !p.title || !p.h1).length;
  const noSchema = pages.filter((p) => p.has_schema_org === false).length;
  const notIndexable = pages.filter((p) => p.is_indexable === false || Number(p.http_status || 200) >= 400).length;
  const n = pages.length;
  const pct = (x: number) => (n ? x / n : 0);

  const strengths: string[] = [];
  const failures: string[] = [];
  const optimizations: string[] = [];

  if (avgSeoScore !== null && avgSeoScore >= 70) strengths.push(`socle technique correct (score SEO moyen ${avgSeoScore}/100)`);
  if (avgWordCount >= 600) strengths.push(`contenu suffisamment développé (${avgWordCount} mots en moyenne)`);
  if (pct(missingMeta) < 0.2) strengths.push('métadonnées renseignées sur la quasi-totalité des pages');
  if (pct(noSchema) < 0.3 && n > 1) strengths.push('balisage structuré présent sur la majorité des pages');
  if (avgInternalLinks >= 15) strengths.push(`maillage interne actif (${avgInternalLinks} liens internes par page)`);

  if (pct(thinPages) >= 0.3) failures.push(`${thinPages} page(s) sur ${n} au contenu trop léger pour se différencier`);
  if (duplicateGroups > 0 && n > 1) failures.push(`${duplicateGroups} groupe(s) de pages quasi identiques : elles se neutralisent entre elles`);
  if (pct(missingMeta) >= 0.3) failures.push(`${missingMeta} page(s) sans meta description exploitable`);
  if (pct(missingTitleOrH1) >= 0.2) failures.push(`${missingTitleOrH1} page(s) sans title ou sans H1 unique`);
  if (pct(noSchema) >= 0.5) failures.push('absence de données structurées, donc peu de reprise possible par les moteurs de réponse IA');
  if (notIndexable > 0) failures.push(`${notIndexable} page(s) non indexables ou en erreur`);
  if (avgWordCount > 0 && avgWordCount < 350) failures.push(`volume rédactionnel faible (${avgWordCount} mots en moyenne)`);
  if (avgInternalLinks > 0 && avgInternalLinks < 5) failures.push('pages trop isolées dans le maillage interne');

  if (pct(thinPages) >= 0.3) optimizations.push('enrichir chaque page avec des éléments réellement propres à son contexte (chiffres, cas, contraintes locales, questions fréquentes)');
  if (duplicateGroups > 0) optimizations.push('différencier les gabarits dupliqués ou fusionner les pages redondantes avec une canonique claire');
  if (pct(noSchema) >= 0.5) optimizations.push(`ajouter le balisage structuré adapté au type (${def.key === 'product' ? 'Product/Offer' : def.key === 'reviews' ? 'Review/AggregateRating' : def.key === 'agency' ? 'LocalBusiness' : def.key === 'editorial' ? 'Article/FAQPage' : 'WebPage/Organization'})`);
  if (pct(missingMeta) >= 0.3) optimizations.push('rédiger des meta descriptions différenciées, orientées bénéfice et intention de recherche');
  if (avgInternalLinks < 10) optimizations.push('renforcer les liens contextuels entrants depuis les pages éditoriales et de listing');
  if (def.role === 'core_business') optimizations.push('exposer un bloc de réponse citable (question/réponse factuelle) pour être reprise par les moteurs IA');

  let verdict: ArchetypeGroup['verdict'] = 'ok';
  if (failures.length === 0 && (avgSeoScore === null || avgSeoScore >= 65)) verdict = 'strong';
  if (failures.length >= 3 || notIndexable > 0 || (avgSeoScore !== null && avgSeoScore < 45)) verdict = 'weak';

  return {
    key: def.key,
    label: def.label,
    role: def.role,
    purpose: def.purpose,
    pages: n,
    sample: pages.slice(0, 3).map((p) => p.url),
    avgSeoScore,
    avgWordCount,
    avgInternalLinks,
    thinPages,
    duplicateGroups,
    missingMeta,
    missingTitleOrH1,
    noSchema,
    notIndexable,
    strengths: strengths.slice(0, 4),
    failures: failures.slice(0, 4),
    optimizations: optimizations.slice(0, 4),
    verdict,
  };
}

/**
 * Fourchettes de référence de la part de chaque type dans un site d'acquisition
 * (part du nombre de pages). Déterministe, volontairement large : on ne signale
 * qu'un déséquilibre net, jamais un écart de quelques points.
 */
const MIX_TARGETS: Record<string, [number, number]> = {
  home: [0, 0.05],
  agency: [0.05, 0.35],
  product: [0.05, 0.45],
  service: [0.05, 0.30],
  conversion: [0.01, 0.08],
  reviews: [0.01, 0.10],
  editorial: [0.15, 0.50],
  listing: [0.02, 0.20],
  institutional: [0.01, 0.08],
  legal: [0, 0.05],
  other: [0, 0.15],
};

function mixTarget(key: string, role: ArchetypeRole): [number, number] {
  if (MIX_TARGETS[key]) return MIX_TARGETS[key];
  return role === 'core_business' ? [0.05, 0.40] : role === 'auxiliary_pillar' ? [0.10, 0.45] : [0, 0.15];
}

function pct1(x: number): string {
  return `${Math.round(x * 1000) / 10} %`;
}

function buildMix(groups: ArchetypeGroup[], crawlPages: number, sitemapUrls?: string[] | null): ArchetypeMix | null {
  if (!crawlPages) return null;

  // Répartition du sitemap par type (même classifieur, sur la seule URL)
  let sitemapCounts: Map<string, number> | null = null;
  let sitemapTotal: number | null = null;
  const cleanSitemap = (sitemapUrls || []).filter((u) => typeof u === 'string' && u.startsWith('http'));
  if (cleanSitemap.length >= 5) {
    sitemapCounts = new Map();
    for (const url of cleanSitemap) {
      const key = classify({ url }).key;
      sitemapCounts.set(key, (sitemapCounts.get(key) || 0) + 1);
    }
    sitemapTotal = cleanSitemap.length;
  }

  const reference = sitemapCounts && sitemapTotal ? { counts: sitemapCounts, total: sitemapTotal } : null;

  const entries: ArchetypeMixEntry[] = groups.map((g) => {
    const crawlShare = g.pages / crawlPages;
    const sitemapPages = reference ? (reference.counts.get(g.key) || 0) : null;
    const sitemapShare = reference && sitemapPages !== null ? sitemapPages / reference.total : null;
    const share = sitemapShare ?? crawlShare;
    const [targetMin, targetMax] = mixTarget(g.key, g.role);

    const thinRatio = g.pages ? g.thinPages / g.pages : 0;
    const unhealthy = g.verdict === 'weak' || thinRatio >= 0.4 || g.duplicateGroups > 0;

    let action: MixAction = 'balanced';
    let rationale = `part de ${pct1(share)} du site, cohérente avec la fourchette de référence (${pct1(targetMin)}–${pct1(targetMax)}).`;

    if (share > targetMax && unhealthy) {
      action = 'prune';
      rationale = `${pct1(share)} du site pour ce seul gabarit, dont ${g.thinPages} page(s) trop légère(s)${g.duplicateGroups ? ` et ${g.duplicateGroups} groupe(s) quasi identique(s)` : ''} : élaguer ou fusionner les pages les plus faibles avant d'en créer d'autres.`;
    } else if (share > targetMax) {
      action = 'differentiate';
      rationale = `${pct1(share)} du site, au-dessus de la fourchette de référence (max ${pct1(targetMax)}) : le volume est là, l'enjeu est de différencier ces pages plutôt que d'en ajouter.`;
    } else if (share < targetMin) {
      action = 'expand';
      rationale = `seulement ${pct1(share)} du site (${g.pages} page(s)) contre ${pct1(targetMin)} attendu au minimum : ce gabarit est sous-représenté au regard de son rôle.`;
    }

    return {
      key: g.key, label: g.label, role: g.role,
      crawledPages: g.pages, crawlShare,
      sitemapPages, sitemapShare,
      targetMin, targetMax, action, rationale,
    };
  });

  const present = new Set(groups.map((g) => g.key));
  const MISSING_WATCH = ['conversion', 'reviews', 'editorial', 'service'];
  const missing = DEFS.filter((d) => MISSING_WATCH.includes(d.key) && !present.has(d.key)).map((d) => ({
    key: d.key, label: d.label, role: d.role,
    rationale: `aucune page de ce type n'a été détectée : créer ce gabarit pour ${d.purpose}.`,
  }));

  const coverage = reference ? Math.min(1, crawlPages / reference.total) : null;
  const flagged = entries.filter((e) => e.action !== 'balanced');
  const verdict: ArchetypeMix['verdict'] = flagged.length || missing.length ? 'unbalanced' : 'balanced';

  const toPrune = entries.filter((e) => e.action === 'prune');
  const toExpand = entries.filter((e) => e.action === 'expand');
  const toDiff = entries.filter((e) => e.action === 'differentiate');

  const parts: string[] = [];
  parts.push(reference
    ? `Répartition établie sur ${reference.total} URL(s) du sitemap, recoupée avec ${crawlPages} page(s) réellement crawlée(s)${coverage !== null ? ` (couverture ${pct1(coverage)})` : ''}.`
    : `Répartition établie sur les ${crawlPages} page(s) crawlée(s) — sitemap non exploitable, les parts sont donc indicatives du périmètre crawlé et non du site entier.`);
  if (verdict === 'balanced') {
    parts.push("Le ratio entre gabarits est équilibré : aucun type n'est nettement sur- ou sous-représenté, l'effort doit porter sur la qualité des pages existantes plutôt que sur leur nombre.");
  } else {
    if (toPrune.length) parts.push(`À élaguer en priorité : ${toPrune.map((e) => e.label.toLowerCase()).join(', ')} — le volume produit de la dilution, pas de la couverture.`);
    if (toDiff.length) parts.push(`À différencier sans en créer davantage : ${toDiff.map((e) => e.label.toLowerCase()).join(', ')}.`);
    if (toExpand.length) parts.push(`À développer : ${toExpand.map((e) => e.label.toLowerCase()).join(', ')}.`);
    if (missing.length) parts.push(`Gabarit(s) à créer, aujourd'hui absent(s) : ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`);
  }
  parts.push("Ces arbitrages de volume rejoignent ceux du module Cocoon (élagage, cannibalisation, création de piliers) : les traiter au même endroit évite de créer des pages qui viendraient concurrencer les existantes.");

  return {
    basis: reference ? 'crawl+sitemap' : 'crawl',
    crawlPages,
    sitemapPages: reference?.total ?? null,
    coverage,
    entries,
    missing,
    verdict,
    synthesis: parts.join(' '),
  };
}

export function analyzePageArchetypes(pages: ArchetypePageInput[], sitemapUrls?: string[] | null): ArchetypeAnalysis | null {

  const usable = (pages || []).filter((p) => p && p.url);
  if (usable.length < 3) return null;

  const buckets = new Map<string, { def: ArchetypeDef; pages: ArchetypePageInput[] }>();
  for (const p of usable) {
    const def = classify(p);
    const entry = buckets.get(def.key) || { def, pages: [] };
    entry.pages.push(p);
    buckets.set(def.key, entry);
  }

  const groups = Array.from(buckets.values())
    .map(({ def, pages: gp }) => buildGroup(def, gp))
    .sort((a, b) => {
      const roleWeight: Record<ArchetypeRole, number> = { core_business: 0, auxiliary_pillar: 1, support: 2, functional: 3 };
      if (roleWeight[a.role] !== roleWeight[b.role]) return roleWeight[a.role] - roleWeight[b.role];
      return b.pages - a.pages;
    });

  const coreGroups = groups.filter((g) => g.role === 'core_business' && g.pages > 0);
  const auxGroups = groups.filter((g) => g.role === 'auxiliary_pillar');

  // Problème principal = le blocage le plus fréquent sur les types business
  const problemCandidates: Array<{ weight: number; text: string }> = [];
  for (const g of coreGroups.length ? coreGroups : groups) {
    if (g.notIndexable > 0) problemCandidates.push({ weight: 100 + g.pages, text: `des pages « ${g.label.toLowerCase()} » ne sont pas indexables, elles ne peuvent produire aucun résultat` });
    if (g.duplicateGroups > 0) problemCandidates.push({ weight: 80 + g.duplicateGroups, text: `les pages « ${g.label.toLowerCase()} » sont bâties sur un gabarit trop uniforme et se cannibalisent` });
    if (g.pages && g.thinPages / g.pages >= 0.3) problemCandidates.push({ weight: 70 + g.thinPages, text: `les pages « ${g.label.toLowerCase()} » manquent de contenu propre et restent interchangeables aux yeux des moteurs` });
    if (g.avgInternalLinks < 5) problemCandidates.push({ weight: 40, text: `les pages « ${g.label.toLowerCase()} » sont insuffisamment maillées et reçoivent peu d'autorité interne` });
  }
  problemCandidates.sort((a, b) => b.weight - a.weight);
  const mainProblem = problemCandidates[0]?.text || null;

  const coreWeak = coreGroups.filter((g) => g.verdict === 'weak').length;
  const globalVerdict: ArchetypeAnalysis['globalVerdict'] =
    coreGroups.length === 0 ? 'ok' : coreWeak >= Math.max(1, Math.ceil(coreGroups.length / 2)) ? 'weak' : coreWeak > 0 ? 'ok' : 'strong';

  const coreLabels = coreGroups.slice(0, 2).map((g) => g.label.toLowerCase()).join(' et ');
  const auxLabels = auxGroups.slice(0, 2).map((g) => g.label.toLowerCase()).join(' et ');
  const auxPlaying = auxGroups.length ? auxGroups.every((g) => g.verdict !== 'weak') : null;

  const synthesis = [
    coreGroups.length
      ? `À périmètre constant, les pages les plus importantes pour le business sont celles de type ${coreLabels}. ` +
        (globalVerdict === 'strong'
          ? "Elles remplissent leur rôle : socle technique tenu, contenu propre à chaque page, maillage suffisant — le site n'est pas freiné par ses pages business."
          : globalVerdict === 'ok'
            ? "Elles tiennent partiellement leur rôle : le socle technique est là, mais leur différenciation éditoriale reste insuffisante, ce qui plafonne la performance globale du site."
            : "Elles échouent à tenir leur rôle : contenu trop uniforme, signaux structurés absents ou indexation défaillante — le site est freiné par ses pages les plus stratégiques.")
      : "Aucun type de page clairement commercial n'a été identifié sur le périmètre crawlé : le site s'adresse aujourd'hui davantage à une audience informationnelle qu'à une intention d'achat.",
    auxLabels
      ? auxPlaying
        ? `Les pages ${auxLabels}, qui servent de piliers auxiliaires, jouent leur rôle de preuve et d'apport de trafic amont.`
        : `Les pages ${auxLabels}, qui devraient servir de piliers auxiliaires, ne jouent pas ce rôle : trop légères ou mal maillées, elles n'alimentent ni la preuve ni les pages business.`
      : "Aucun pilier auxiliaire (avis, contenus éditoriaux) n'a été détecté : les pages business avancent sans preuve sociale ni apport de trafic amont.",
    mainProblem ? `Le problème principal est simple : ${mainProblem}.` : null,
  ].filter(Boolean).join(' ');

  const mix = buildMix(groups, usable.length, sitemapUrls);
  const fullSynthesis = mix ? `${synthesis} ${mix.synthesis}` : synthesis;

  return { totalPages: usable.length, groups, coreGroups, mainProblem, globalVerdict, synthesis: fullSynthesis, mix };

}

const ROLE_LABELS: Record<ArchetypeRole, string> = {
  core_business: 'Type business prioritaire',
  auxiliary_pillar: 'Pilier auxiliaire',
  support: 'Rôle de distribution',
  functional: 'Rôle fonctionnel',
};

const VERDICT_LABELS: Record<ArchetypeGroup['verdict'], { text: string; color: string }> = {
  strong: { text: 'remplit son rôle', color: '#22c55e' },
  ok: { text: 'partiellement à la hauteur', color: '#d4af37' },
  weak: { text: 'ne remplit pas son rôle', color: '#ef4444' },
};

function list(items: string[], color: string, title: string): string {
  if (!items.length) return '';
  return `<div style="margin:8px 0 0 0;">
    <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${color};margin-bottom:4px;">${title}</div>
    <ul style="padding-left:18px;margin:0;font-size:12.5px;line-height:1.65;color:#374151;">${items.map((i) => `<li>${i}</li>`).join('')}</ul>
  </div>`;
}

/** Rendu HTML de la section « Audit par type de page » (déterministe). */
export function renderPageArchetypesHTML(analysis: ArchetypeAnalysis, domain: string): string {
  const cards = analysis.groups.map((g) => {
    const v = VERDICT_LABELS[g.verdict];
    return `<div data-marina-block="archetype-${g.key}" style="border:1px solid #e5e7eb;border-left:4px solid ${v.color};border-radius:8px;padding:14px 16px;margin:0 0 12px 0;background:#ffffff;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap;">
        <div>
          <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">${ROLE_LABELS[g.role]}</div>
          <div style="font-size:15px;font-weight:700;color:#111827;">${g.label}</div>
        </div>
        <div style="font-size:12px;color:${v.color};font-weight:600;">${v.text}</div>
      </div>
      <p style="font-size:12.5px;color:#4b5563;line-height:1.7;margin:6px 0 0 0;">
        Ce que ces pages visent : ${g.purpose}. Périmètre mesuré : ${g.pages} page(s)${g.avgSeoScore !== null ? `, score SEO moyen ${g.avgSeoScore}/100` : ''}, ${g.avgWordCount} mots et ${g.avgInternalLinks} liens internes en moyenne.
      </p>
      ${list(g.strengths, '#16a34a', 'Ce qui fonctionne')}
      ${list(g.failures, '#b91c1c', 'Ce qui échoue')}
      ${list(g.optimizations, '#6d28d9', 'Comment les optimiser')}
      ${g.sample.length ? `<div style="font-size:11px;color:#9ca3af;margin-top:8px;word-break:break-all;">Exemples : ${g.sample.join(' · ')}</div>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="section" data-marina-scope="site" data-marina-block="archetypes" data-pdf-section style="border-left:6px solid #6d28d9;">
    <h2 style="font-size:19px;margin:0 0 10px 0;">Audit par type de page</h2>
    <p style="font-size:12.5px;line-height:1.7;color:#4b5563;background:#faf9f5;border-left:3px solid #d4af37;padding:10px 14px;border-radius:6px;margin:0 0 16px 0;">
      Ce que mesure cette section : un site ne se juge pas page par page mais gabarit par gabarit. Les ${analysis.totalPages} pages retenues sur ${domain} sont regroupées par type (agence, produit, service, avis, éditorial…), chaque type est confronté à l'objectif qu'il est censé servir, puis une conclusion intermédiaire précise s'il le remplit. Le verdict global du site en découle.
    </p>
    ${cards}
    <div style="border:2px solid #6d28d9;border-left:6px solid #d4af37;border-radius:10px;padding:16px 18px;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Conclusion par types de pages</div>
      <p style="font-size:13.5px;line-height:1.8;color:#111827;margin:0;">${analysis.synthesis}</p>
    </div>
  </div>`;
}
