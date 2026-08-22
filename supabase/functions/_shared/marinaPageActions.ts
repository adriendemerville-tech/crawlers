/**
 * marinaPageActions.ts — Actions PROPRES À UNE URL, dérivées de faits mesurés.
 *
 * Contexte : la fiche de chaque URL d'un lot multipages affichait, à défaut
 * d'actions ciblées, les 3 premières actions du plan consolidé du domaine.
 * Résultat : 14 fiches sur 15 portaient les mêmes actions, dont des
 * recommandations de domaine, et le plan consolidé important des actions
 * d'autres URLs (pollution du Workbench).
 *
 * Ce module ne produit une action que si un fait a été MESURÉ sur l'URL lue,
 * et il attache toujours la preuve chiffrée (valeur mesurée → cible).
 * 100 % déterministe : 0 token LLM.
 */

export interface PageActionFacts {
  /** Title de la page (texte brut). */
  title?: string | null;
  /** Meta description. */
  metaDescription?: string | null;
  /** Nombre de H1 détectés. */
  h1Count?: number | null;
  /** Nombre de mots utiles mesurés. */
  words?: number | null;
  /** LCP mobile mesuré, en ms. */
  lcpMs?: number | null;
  /** Poids JS transféré, en Ko. */
  jsWeightKb?: number | null;
  /** Images sans attribut alt. */
  imagesWithoutAlt?: number | null;
  /** Nombre total d'images. */
  imagesTotal?: number | null;
  /** Types de données structurées détectés sur cette URL. */
  schemaTypes?: string[] | null;
  /** Passages citables (blocs de réponse directe) détectés. */
  citablePassages?: number | null;
  /** Ratio texte/HTML mesuré en %, ou null si non mesurable. */
  codeTextRatio?: number | null;
  /** Liens internes entrants mesurés sur le graphe. */
  linksIn?: number | null;
  /** Liens internes sortants mesurés. */
  linksOut?: number | null;
  /** URL(s) en concurrence interne avec celle-ci. */
  cannibalWith?: string[] | null;
  /** Contenu jugé fin par le module d'intégrité. */
  isThin?: boolean;
  /** Page orpheline dans le maillage. */
  isOrphan?: boolean;
}

export interface DerivedPageAction {
  /** Une phrase, jamais tronquée. */
  title: string;
  /** Preuve chiffrée : valeur mesurée → cible. */
  evidence: string;
  severity: 'critical' | 'important' | 'suggestion';
  /** Empreinte de déduplication inter-fiches. */
  fingerprint: string;
}

const n = (v: unknown): number | null => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/**
 * Dérive les actions d'une URL à partir de ses seuls faits mesurés.
 * Une action absente signifie « fait non mesuré » ou « conforme » — jamais
 * un remplissage par une recommandation de domaine.
 */
export function derivePageActions(facts: PageActionFacts, lang = 'fr'): DerivedPageAction[] {
  const isEn = lang === 'en';
  const t = (fr: string, en: string) => (isEn ? en : fr);
  const out: DerivedPageAction[] = [];

  const title = String(facts.title || '').trim();
  if (title.length === 0) {
    out.push({
      title: t('Écrire un title pour cette page', 'Write a title for this page'),
      evidence: t('title absent → 45 à 60 caractères', 'title missing → 45 to 60 characters'),
      severity: 'critical',
      fingerprint: 'title-missing',
    });
  } else if (title.length > 65 || title.length < 30) {
    out.push({
      title: t('Recalibrer le title de cette page', 'Recalibrate this page title'),
      evidence: t(
        `${title.length} caractères mesurés → cible 45 à 60`,
        `${title.length} characters measured → target 45 to 60`,
      ),
      severity: 'important',
      fingerprint: 'title-length',
    });
  }

  const meta = String(facts.metaDescription || '').trim();
  if (meta.length === 0) {
    out.push({
      title: t('Rédiger la meta description de cette page', 'Write this page meta description'),
      evidence: t('meta description absente → 140 à 160 caractères', 'meta description missing → 140 to 160 characters'),
      severity: 'important',
      fingerprint: 'meta-missing',
    });
  }

  const h1 = n(facts.h1Count);
  if (h1 !== null && h1 !== 1) {
    out.push({
      title: h1 === 0
        ? t('Ajouter un H1 unique à cette page', 'Add a single H1 to this page')
        : t('Ne conserver qu’un seul H1 sur cette page', 'Keep only one H1 on this page'),
      evidence: t(`${h1} H1 mesuré(s) → cible 1`, `${h1} H1 measured → target 1`),
      severity: h1 === 0 ? 'critical' : 'important',
      fingerprint: 'h1-count',
    });
  }

  const words = n(facts.words);
  if (words !== null && words > 0 && words < 350) {
    out.push({
      title: t('Étoffer le contenu propre de cette page', 'Expand this page own content'),
      evidence: t(`${words} mots utiles mesurés → cible 700 minimum`, `${words} useful words measured → target 700 minimum`),
      severity: words < 200 ? 'critical' : 'important',
      fingerprint: 'thin-words',
    });
  }

  const lcp = n(facts.lcpMs);
  if (lcp !== null && lcp > 2500) {
    out.push({
      title: t('Accélérer le rendu du contenu principal de cette page', 'Speed up this page main content render'),
      evidence: t(`LCP mobile ${(lcp / 1000).toFixed(1)} s mesuré → cible 2,5 s`, `Mobile LCP ${(lcp / 1000).toFixed(1)} s measured → target 2.5 s`),
      severity: lcp > 4000 ? 'critical' : 'important',
      fingerprint: 'lcp',
    });
  }

  const js = n(facts.jsWeightKb);
  if (js !== null && js > 700) {
    out.push({
      title: t('Réduire le JavaScript chargé par cette page', 'Reduce JavaScript loaded by this page'),
      evidence: t(`${Math.round(js)} Ko de JS mesurés → cible 400 Ko`, `${Math.round(js)} KB of JS measured → target 400 KB`),
      severity: 'important',
      fingerprint: 'js-weight',
    });
  }

  const noAlt = n(facts.imagesWithoutAlt);
  const imgTotal = n(facts.imagesTotal);
  if (noAlt !== null && noAlt > 0) {
    out.push({
      title: t('Décrire les images de cette page en texte alternatif', 'Describe this page images with alt text'),
      evidence: t(
        `${noAlt} image(s) sans alt${imgTotal ? ` sur ${imgTotal}` : ''} → cible 0`,
        `${noAlt} image(s) without alt${imgTotal ? ` out of ${imgTotal}` : ''} → target 0`,
      ),
      severity: 'suggestion',
      fingerprint: 'img-alt',
    });
  }

  const schema = Array.isArray(facts.schemaTypes) ? facts.schemaTypes.filter(Boolean) : null;
  if (schema !== null && schema.length === 0) {
    out.push({
      title: t('Baliser cette page en données structurées', 'Add structured data to this page'),
      evidence: t('aucun type Schema.org détecté sur cette URL → cible 1 type pertinent', 'no Schema.org type detected on this URL → target 1 relevant type'),
      severity: 'important',
      fingerprint: 'schema-missing',
    });
  }

  const citable = n(facts.citablePassages);
  if (citable !== null && citable < 2) {
    out.push({
      title: t('Ajouter des passages directement citables par les moteurs génératifs', 'Add passages directly citable by generative engines'),
      evidence: t(`${citable} bloc(s) de réponse directe mesuré(s) → cible 3`, `${citable} direct-answer block(s) measured → target 3`),
      severity: 'important',
      fingerprint: 'citable-passages',
    });
  }

  const ratio = n(facts.codeTextRatio);
  if (ratio !== null && ratio > 0 && ratio < 10) {
    out.push({
      title: t('Rééquilibrer le rapport entre code et texte visible', 'Rebalance code versus visible text'),
      evidence: t(`${ratio} % de texte visible mesuré → cible 15 %`, `${ratio}% visible text measured → target 15%`),
      severity: 'important',
      fingerprint: 'code-text-ratio',
    });
  }

  if (facts.isOrphan) {
    out.push({
      title: t('Relier cette page depuis son cluster', 'Link this page from its cluster'),
      evidence: t('0 lien interne entrant mesuré → cible 3', '0 measured inbound internal link → target 3'),
      severity: 'critical',
      fingerprint: 'orphan',
    });
  } else {
    const linksIn = n(facts.linksIn);
    if (linksIn !== null && linksIn <= 2) {
      out.push({
        title: t('Renforcer le maillage entrant de cette page', 'Reinforce inbound linking to this page'),
        evidence: t(`${linksIn} lien(s) interne(s) entrant(s) mesuré(s) → cible 3`, `${linksIn} measured inbound internal link(s) → target 3`),
        severity: 'important',
        fingerprint: 'links-in',
      });
    }
  }

  const linksOut = n(facts.linksOut);
  if (linksOut !== null && linksOut <= 2) {
    out.push({
      title: t('Ouvrir des liens internes depuis cette page', 'Open internal links from this page'),
      evidence: t(`${linksOut} lien(s) sortant(s) interne(s) mesuré(s) → cible 4`, `${linksOut} measured internal outbound link(s) → target 4`),
      severity: 'suggestion',
      fingerprint: 'links-out',
    });
  }

  const cannibal = (facts.cannibalWith || []).filter(Boolean);
  if (cannibal.length) {
    out.push({
      title: t('Différencier cette page de ses concurrentes internes', 'Differentiate this page from its internal competitors'),
      evidence: t(
        `${cannibal.length} URL(s) en concurrence mesurée(s) : ${cannibal.slice(0, 2).join(', ')} → 1 seule page pivot`,
        `${cannibal.length} measured competing URL(s): ${cannibal.slice(0, 2).join(', ')} → a single pivot page`,
      ),
      severity: 'critical',
      fingerprint: 'cannibalization',
    });
  }

  const rank = { critical: 0, important: 1, suggestion: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/**
 * Empreintes vraies sur plus de la moitié des URLs du lot : elles relèvent de la
 * synthèse réseau, pas de la fiche. À appeler avec les actions de toutes les
 * URLs du lot pour retirer le bruit répété.
 */
export function dropLotWideFingerprints(
  perUrl: Array<{ url: string; actions: DerivedPageAction[] }>,
): Array<{ url: string; actions: DerivedPageAction[] }> {
  if (perUrl.length < 4) return perUrl;
  const counts = new Map<string, number>();
  for (const p of perUrl) {
    for (const fp of new Set(p.actions.map((a) => a.fingerprint))) {
      counts.set(fp, (counts.get(fp) || 0) + 1);
    }
  }
  const threshold = perUrl.length / 2;
  const lotWide = new Set([...counts.entries()].filter(([, c]) => c > threshold).map(([fp]) => fp));
  return perUrl.map((p) => ({ url: p.url, actions: p.actions.filter((a) => !lotWide.has(a.fingerprint)) }));
}
