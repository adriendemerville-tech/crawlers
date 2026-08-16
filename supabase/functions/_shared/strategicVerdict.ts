/**
 * strategicVerdict.ts — Conclusion stratégique déterministe de la synthèse
 * exécutive (0 token LLM).
 *
 * Objectif : produire, sur TOUS les audits, un paragraphe en gras du type
 * « Après analyse, il ressort que <domaine> poursuit une stratégie de volume
 * SEO … En SEO, il doit … En GEO, il doit … Gain de trafic possible : +X à
 * +Y % sur 12 mois. »
 *
 * Le paragraphe n'est jamais un texte figé : chaque proposition est un
 * *levier* activé par un signal réellement mesuré (perf mobile, cannibalisation,
 * pages fines, données structurées, gaps de contenu, positions secondaires).
 * Un site sans le signal correspondant ne reçoit pas la recommandation.
 */

export interface VerdictSignals {
  /** Pages réellement explorées / URLs connues du site. */
  pagesAnalyzed?: number | null;
  pagesKnown?: number | null;
  /** Score PageSpeed performance — TOUJOURS mesuré en profil mobile. */
  psiPerformanceMobile?: number | null;
  /** Score SEO technique et GEO ramenés sur 100. */
  techScore?: number | null;
  geoScore?: number | null;
  /** Intégrité de contenu (near-duplicate / thin content). */
  cannibalizationGroups?: number | null;
  nearDuplicateGroups?: number | null;
  thinPages?: number | null;
  /** Cocon sémantique. */
  clusterCount?: number | null;
  orphanPages?: number | null;
  /** Données structurées détectées sur la page pivot. */
  hasSchema?: boolean | null;
  schemaTypesCount?: number | null;
  /** Positionnement mots-clés. */
  rankedKeywords?: number | null;
  quickWinKeywords?: number | null;
  contentGapKeywords?: number | null;
  /** Doublon d'hôte (www vs apex) sans redirection 301. */
  hostDuplication?: boolean | null;
  /** Blocages critiques restants dans le plan consolidé. */
  criticalCount?: number | null;
}

export interface StrategicVerdict {
  /** Phrase de posture (diagnostic de la stratégie actuelle). */
  posture: string;
  /** Leviers SEO retenus. */
  seoLevers: string[];
  /** Leviers GEO retenus. */
  geoLevers: string[];
  /** Fourchette de gain de trafic organique à 12 mois, en points de %. */
  gain: { low: number; high: number } | null;
  /** Paragraphe HTML prêt à insérer (gras). */
  html: string;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
};

function round5(x: number): number {
  return Math.max(5, Math.round(x / 5) * 5);
}

/**
 * Fourchette de gain : somme de leviers bornés, chacun adossé à un signal
 * mesuré. Volontairement conservatrice — bornée à +60 % haut de fourchette.
 */
function estimateGain(s: VerdictSignals): { low: number; high: number } | null {
  let low = 0;
  let high = 0;
  let evidence = 0;

  const psi = n(s.psiPerformanceMobile);
  if (psi > 0) {
    evidence++;
    if (psi < 50) { low += 6; high += 14; }
    else if (psi < 80) { low += 3; high += 7; }
    else { low += 0; high += 2; }
  }

  const cannib = n(s.cannibalizationGroups) + Math.round(n(s.nearDuplicateGroups) / 2);
  if (cannib > 0) {
    evidence++;
    if (cannib >= 5) { low += 5; high += 12; }
    else { low += 3; high += 8; }
  }

  const gaps = n(s.contentGapKeywords);
  if (gaps > 0) {
    evidence++;
    if (gaps >= 10) { low += 8; high += 18; }
    else if (gaps >= 3) { low += 4; high += 10; }
    else { low += 2; high += 5; }
  }

  const qw = n(s.quickWinKeywords);
  if (qw > 0) {
    evidence++;
    if (qw >= 10) { low += 6; high += 14; }
    else { low += 3; high += 8; }
  }

  const geo = n(s.geoScore);
  if (geo > 0) {
    evidence++;
    if (geo < 50) { low += 3; high += 8; }
    else if (geo < 70) { low += 2; high += 5; }
  }

  const thin = n(s.thinPages);
  if (thin >= 10) { evidence++; low += 2; high += 6; }
  else if (thin > 0) { evidence++; low += 1; high += 3; }

  if (s.hostDuplication) { evidence++; low += 2; high += 5; }

  // Sans au moins deux signaux mesurés, on n'avance pas de fourchette.
  if (evidence < 2 || high <= 0) return null;

  return { low: round5(low), high: Math.min(60, Math.max(round5(high), round5(low) + 5)) };
}

export function buildStrategicVerdict(
  domain: string,
  signals: VerdictSignals,
  lang = 'fr',
): StrategicVerdict {
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const t = (fr: string, en: string, es: string) => (isEn ? en : isEs ? es : fr);

  const known = n(signals.pagesKnown) || n(signals.pagesAnalyzed);
  const cannib = n(signals.cannibalizationGroups);
  const dupes = n(signals.nearDuplicateGroups);
  const thin = n(signals.thinPages);
  const psi = n(signals.psiPerformanceMobile);
  const geo = n(signals.geoScore);
  const gaps = n(signals.contentGapKeywords);
  const qw = n(signals.quickWinKeywords);
  const ranked = n(signals.rankedKeywords);
  const clusters = n(signals.clusterCount);

  // ── Posture : quelle stratégie le site poursuit-il, de fait ?
  const volumeStrategy = known >= 200 && (cannib > 0 || dupes > 0 || thin >= 5);
  const wideThin = known >= 200 && cannib === 0 && dupes === 0;
  const narrow = known > 0 && known < 40;

  const posture = volumeStrategy
    ? t(
        `${domain} poursuit actuellement une stratégie de volume SEO sur la SERP — ${known} URLs connues, ${cannib || dupes} groupe${(cannib || dupes) > 1 ? 's' : ''} de pages très proches — au risque de cannibaliser ses propres pages.`,
        `${domain} is currently pursuing an SEO volume strategy — ${known} known URLs, ${cannib || dupes} near-identical page group(s) — at the risk of cannibalising its own pages.`,
        `${domain} sigue actualmente una estrategia de volumen SEO (${known} URL conocidas) con riesgo de canibalizar sus propias páginas.`,
      )
    : wideThin
    ? t(
        `${domain} couvre un périmètre large (${known} URLs connues) sans redondance majeure détectée : la structure tient, l'enjeu porte sur la profondeur et la qualité de couverture.`,
        `${domain} covers a wide perimeter (${known} known URLs) with no major redundancy detected: structure holds, the stake is depth and coverage quality.`,
        `${domain} cubre un perímetro amplio (${known} URL) sin redundancia mayor: el reto es la profundidad de cobertura.`,
      )
    : narrow
    ? t(
        `${domain} exploite un périmètre restreint (${known} URLs connues) : la visibilité repose sur trop peu de pages pour capter la diversité des requêtes de son marché.`,
        `${domain} operates a narrow perimeter (${known} known URLs): visibility relies on too few pages to capture its market's query diversity.`,
        `${domain} opera un perímetro reducido (${known} URL): la visibilidad depende de muy pocas páginas.`,
      )
    : t(
        `${domain} présente une couverture intermédiaire : ni volume excessif, ni périmètre insuffisant — les gains viennent d'abord de l'optimisation des pages existantes.`,
        `${domain} shows intermediate coverage: neither excessive volume nor insufficient perimeter — gains come first from optimising existing pages.`,
        `${domain} presenta una cobertura intermedia: las ganancias vienen de optimizar las páginas existentes.`,
      );

  // ── Leviers SEO (uniquement si le signal existe)
  const seo: string[] = [];
  if (psi > 0 && psi < 80) {
    seo.push(t(
      `optimiser le chargement des pages sur mobile (performance PageSpeed mesurée en profil mobile : ${psi}/100)`,
      `optimise page loading on mobile (PageSpeed performance measured on a mobile profile: ${psi}/100)`,
      `optimizar la carga en móvil (PageSpeed móvil: ${psi}/100)`,
    ));
  }
  if (clusters > 0 || gaps > 0) {
    seo.push(t(
      `affiner la couverture sémantique et clarifier les clusters`,
      `refine semantic coverage and clarify topic clusters`,
      `afinar la cobertura semántica y clarificar los clústeres`,
    ));
  }
  if (cannib > 0 || dupes > 0) {
    seo.push(t(
      `éviter la cannibalisation en désignant une page pivot par intention de recherche`,
      `avoid cannibalisation by designating one pivot page per search intent`,
      `evitar la canibalización designando una página pivote por intención`,
    ));
  }
  if (thin > 0) {
    seo.push(t(
      `traiter les ${thin} page${thin > 1 ? 's' : ''} à contenu faible (enrichir, fusionner ou dépublier)`,
      `handle the ${thin} thin page(s) (enrich, merge or unpublish)`,
      `tratar las ${thin} página(s) de contenido pobre`,
    ));
  }
  if (qw > 0 || ranked > 0) {
    seo.push(t(
      `améliorer les positions sur les mots-clés secondaires${qw > 0 ? ` (${qw} gain${qw > 1 ? 's' : ''} rapide${qw > 1 ? 's' : ''} identifié${qw > 1 ? 's' : ''} en positions 4 à 20)` : ''}`,
      `improve rankings on secondary keywords${qw > 0 ? ` (${qw} quick win(s) in positions 4-20)` : ''}`,
      `mejorar posiciones en palabras clave secundarias${qw > 0 ? ` (${qw} ganancias rápidas)` : ''}`,
    ));
  }
  if (signals.hostDuplication) {
    seo.push(t(
      `rationaliser l'hôte servi avec une redirection 301 définitive (www ou apex, pas les deux)`,
      `consolidate the served host with a permanent 301 redirect (www or apex, not both)`,
      `consolidar el host servido con una redirección 301 (www o apex)`,
    ));
  }

  // ── Leviers GEO
  const geoLevers: string[] = [];
  if (geo === 0 || geo < 70) {
    geoLevers.push(t(
      `réorganiser le contenu des pages pour améliorer la citabilité (réponse directe en tête de section, données factuelles, tableaux comparatifs)`,
      `restructure page content to improve citability (direct answer up front, factual data, comparison tables)`,
      `reorganizar el contenido para mejorar la citabilidad`,
    ));
  }
  if (!signals.hasSchema || n(signals.schemaTypesCount) < 2) {
    geoLevers.push(t(
      `déployer systématiquement des données structurées JSON-LD pour faciliter le travail des bots IA`,
      `systematically deploy JSON-LD structured data to help AI bots`,
      `desplegar datos estructurados JSON-LD de forma sistemática`,
    ));
  }
  if (gaps > 0 || clusters > 0) {
    geoLevers.push(t(
      `créer des guides et articles tournés vers l'intention informationnelle${gaps > 0 ? `, en partant des ${gaps} requêtes non couvertes identifiées` : ''}`,
      `create guides and articles targeting informational intent${gaps > 0 ? `, starting from the ${gaps} uncovered queries identified` : ''}`,
      `crear guías y artículos de intención informacional`,
    ));
  }

  const gain = estimateGain(signals);

  const list = (items: string[]) => {
    if (items.length <= 1) return items[0] || '';
    return items.slice(0, -1).join(', ') + t(', enfin ', ', and finally ', ' y, por último, ') + items[items.length - 1];
  };

  const sentences: string[] = [
    t(`Après analyse, il ressort de notre audit que ${posture}`, `After analysis, our audit finds that ${posture}`, `Tras el análisis, nuestra auditoría concluye que ${posture}`),
  ];
  if (seo.length) {
    sentences.push(t(
      `En SEO, ${domain} doit désormais réfléchir à une stratégie de rationalisation de sa présence en ligne : ${list(seo)}.`,
      `On SEO, ${domain} should now rationalise its online presence: ${list(seo)}.`,
      `En SEO, ${domain} debe racionalizar su presencia en línea: ${list(seo)}.`,
    ));
  }
  if (geoLevers.length) {
    sentences.push(t(
      `En GEO, ${domain} doit ${list(geoLevers)}.`,
      `On GEO, ${domain} should ${list(geoLevers)}.`,
      `En GEO, ${domain} debe ${list(geoLevers)}.`,
    ));
  }
  if (n(signals.criticalCount) > 0) {
    sentences.push(t(
      `Ces chantiers ne produiront leur effet qu'après traitement des ${n(signals.criticalCount)} blocage${n(signals.criticalCount) > 1 ? 's' : ''} critique${n(signals.criticalCount) > 1 ? 's' : ''} listé${n(signals.criticalCount) > 1 ? 's' : ''} dans le plan d'action.`,
      `These workstreams will only pay off once the ${n(signals.criticalCount)} critical blocker(s) in the action plan are fixed.`,
      `Estos trabajos solo darán resultado tras resolver los ${n(signals.criticalCount)} bloqueos críticos del plan.`,
    ));
  }

  const gainHtml = gain
    ? `<p style="font-size:13.5px;line-height:1.7;color:#374151;margin:10px 0 0 0;">
        <strong>${t('Gain de trafic organique possible', 'Possible organic traffic gain', 'Ganancia de tráfico orgánico posible')} : +${gain.low} % ${t('à', 'to', 'a')} +${gain.high} % ${t('sur 12 mois', 'over 12 months', 'en 12 meses')}</strong>
        <span style="color:#6b7280;"> — ${t(
          `objectif raisonnable, conditionné à la mise en œuvre complète du plan d'action ; fourchette dérivée des leviers mesurés ci-dessus, pas d'une projection de marché.`,
          `a reasonable objective, conditional on full implementation of the action plan; range derived from the measured levers above, not from a market projection.`,
          `objetivo razonable, condicionado a la ejecución completa del plan; rango derivado de las palancas medidas.`,
        )}</span>
      </p>`
    : '';

  const html = `
    <div data-marina-block="verdict" style="margin:14px 0 0 0;padding:12px 14px;border:1px solid #ede9fe;border-left:4px solid #6d28d9;border-radius:8px;background:#faf9ff;">
      <p style="font-size:13.5px;line-height:1.75;color:#111827;margin:0;"><strong>${sentences.join(' ')}</strong></p>
      ${gainHtml}
    </div>`;

  return { posture, seoLevers: seo, geoLevers, gain, html };
}
