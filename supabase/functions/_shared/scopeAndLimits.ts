/**
 * scopeAndLimits — section « Portée et limites » générée côté backend.
 *
 * Contrat : cette section est TOUJOURS présente dans un rapport Marina, y compris
 * quand aucun signal n'a pu être collecté. Elle est construite dès le départ à
 * partir du nom de domaine audité, puis enrichie par les signaux réellement
 * observés (périmètre crawlé, autorité/backlinks, freins de crawlabilité).
 *
 * Elle porte `data-pdf-section="disclaimer"` afin que l'export PDF
 * (src/utils/sectionBasedPdfExport.ts) n'en rajoute pas une seconde.
 */

export interface ScopeLimitsInput {
  domain: string;
  url?: string;
  lang?: string;
  /** Périmètre réellement observé */
  pagesAnalyzed?: number | null;
  pagesKnown?: number | null;
  singlePage?: boolean;
  analyzedAt?: string | Date | null;
  /** Signaux de maturité du domaine (DataForSEO / audit stratégique) */
  authority?: {
    authority_score?: number | null;
    referring_domains?: number | null;
    backlinks_total?: number | null;
    first_seen?: string | null;
    data_source?: string | null;
  } | null;
  /** Freins de crawlabilité observés pendant l'audit */
  blockers?: string[];
}

type Locale = 'fr' | 'en' | 'es';

function pickLocale(lang?: string): Locale {
  const l = (lang || 'fr').slice(0, 2).toLowerCase();
  return l === 'en' ? 'en' : l === 'es' ? 'es' : 'fr';
}

function esc(v: string): string {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function monthsSince(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  const months = Math.floor((Date.now() - d) / (30.44 * 24 * 3600 * 1000));
  return months >= 0 ? months : null;
}

const UI: Record<Locale, Record<string, string>> = {
  fr: {
    title: 'Portée et limites de cet audit',
    h1: '1. Ce qui est mesuré directement',
    h2: '2. Ce qui est estimé',
    h3: '3. Périmètre analysé',
    h4: '4. Maturité du nom de domaine',
    h5: '5. Crawlabilité observée',
    h6: '6. Maturité du marché et bascule vers les moteurs de réponse IA',
    h7: '7. Angles morts assumés',
    note: "Les recommandations sont hiérarchisées par impact attendu, pas par certitude de résultat. Aucun positionnement, aucune citation IA et aucun volume de trafic ne sont garantis.",
  },
  en: {
    title: 'Scope and limitations of this audit',
    h1: '1. What is measured directly',
    h2: '2. What is estimated',
    h3: '3. Analysed scope',
    h4: '4. Domain name maturity',
    h5: '5. Observed crawlability',
    h6: '6. Market maturity and the shift to AI answer engines',
    h7: '7. Acknowledged blind spots',
    note: 'Recommendations are ranked by expected impact, not certainty of outcome. No ranking, AI citation or traffic volume is guaranteed.',
  },
  es: {
    title: 'Alcance y límites de esta auditoría',
    h1: '1. Qué se mide directamente',
    h2: '2. Qué se estima',
    h3: '3. Alcance analizado',
    h4: '4. Madurez del nombre de dominio',
    h5: '5. Rastreabilidad observada',
    h6: '6. Madurez del mercado y cambio hacia los motores de respuesta IA',
    h7: '7. Puntos ciegos asumidos',
    note: 'Las recomendaciones se priorizan por impacto esperado, no por certeza de resultado. No se garantiza ningún resultado.',
  },
};

export function renderScopeLimitsHTML(input: ScopeLimitsInput): string {
  const l = pickLocale(input.lang);
  const ui = UI[l];
  const t = (fr: string, en: string, es: string) => (l === 'en' ? en : l === 'es' ? es : fr);
  const domain = esc(input.domain || t('le domaine audité', 'the audited domain', 'el dominio auditado'));

  const pagesAnalyzed = input.pagesAnalyzed || null;
  const pagesKnown = input.pagesKnown || null;
  const a = input.authority || null;
  const ageMonths = monthsSince(a?.first_seen ?? null);

  const li = (s: string) => `<li style="margin:0 0 6px 0;">${s}</li>`;
  const ul = (items: string[]) =>
    `<ul style="font-size:13px;color:#374151;line-height:1.7;padding-left:18px;margin:0;">${items.map(li).join('')}</ul>`;
  const p = (s: string) => `<p style="font-size:13px;color:#374151;line-height:1.7;margin:0;">${s}</p>`;
  const h3 = (s: string) => `<h3 style="font-size:15px;margin:18px 0 8px 0;">${s}</h3>`;

  // 1. Mesuré
  const measured = ul([
    t(
      `HTML réellement servi par ${domain} au moment de l'audit : codes HTTP, balises title/meta, structure Hn, données structurées, robots.txt et sitemap.`,
      `HTML actually served by ${domain} at audit time: HTTP codes, title/meta tags, Hn structure, structured data, robots.txt and sitemap.`,
      `HTML realmente servido por ${domain}: códigos HTTP, etiquetas, estructura Hn, datos estructurados, robots.txt y sitemap.`,
    ),
    pagesAnalyzed
      ? t(
          `Maillage interne, volumétrie de contenu et proximité sémantique calculés sur un crawl réel de ${pagesAnalyzed} page(s).`,
          `Internal linking, content volume and semantic proximity computed on a real crawl of ${pagesAnalyzed} page(s).`,
          `Enlazado interno y volumen de contenido calculados sobre un rastreo real de ${pagesAnalyzed} página(s).`,
        )
      : t(
          "Signaux relevés sur la ou les URL fournies, sans extrapolation au reste du site.",
          'Signals collected on the provided URL(s), with no extrapolation to the rest of the site.',
          'Señales recogidas en las URL proporcionadas, sin extrapolación.',
        ),
  ]);

  // 2. Estimé
  const estimated = ul([
    t(
      "Cet audit est réalisé sans accès à vos outils propriétaires (Search Console, analytics, CRM) : trafic, positions et conversions cités sont des estimations externes.",
      'This audit runs without access to your proprietary tools (Search Console, analytics, CRM): traffic, positions and conversions quoted are external estimates.',
      'Esta auditoría se realiza sin acceso a sus herramientas propias: tráfico, posiciones y conversiones son estimaciones externas.',
    ),
    t(
      'La pondération des scores SEO et GEO est propriétaire et révisée régulièrement : deux audits ne sont comparables que sur la même version de méthodologie.',
      'SEO and GEO score weightings are proprietary and revised regularly: two audits are only comparable under the same methodology version.',
      'La ponderación de las puntuaciones es propietaria y se revisa periódicamente.',
    ),
    t(
      "Les tests de visibilité IA ne sont pas déterministes : une même question peut donner une réponse différente d'une exécution à l'autre, selon le modèle, la région et la session.",
      'AI visibility tests are not deterministic: the same question can yield a different answer between runs, depending on model, region and session.',
      'Las pruebas de visibilidad IA no son deterministas.',
    ),
    t(
      'La détection de quasi-doublons et de contenu pauvre repose sur une similarité lexicale : elle signale un risque de cannibalisation, elle ne le démontre pas sans vérification en SERP.',
      'Near-duplicate and thin-content detection relies on lexical similarity: it flags a cannibalisation risk, it does not prove it without SERP verification.',
      'La detección de casi-duplicados se basa en similitud léxica: señala un riesgo, no lo demuestra.',
    ),
  ]);

  // 3. Périmètre
  const coverage =
    pagesAnalyzed && pagesKnown && pagesKnown > 0
      ? ` (${Math.round((pagesAnalyzed / pagesKnown) * 100)} % ${t('du périmètre connu', 'of the known scope', 'del alcance conocido')})`
      : '';
  const scopeText = input.singlePage || !pagesAnalyzed
    ? t(
        `L'analyse porte sur un périmètre restreint de ${domain}${input.url ? ` (${esc(input.url)})` : ''} : elle ne préjuge ni de la qualité des autres gabarits, ni de la santé globale du domaine.`,
        `The analysis covers a limited scope of ${domain}${input.url ? ` (${esc(input.url)})` : ''}: it says nothing about other templates or overall domain health.`,
        `El análisis cubre un alcance limitado de ${domain}: no prejuzga los demás gabaritos ni la salud global del dominio.`,
      )
    : t(
        `${pagesAnalyzed} page(s) analysée(s)${pagesKnown ? ` sur ${pagesKnown} connue(s)` : ''}${coverage}. Les conclusions valent pour cet échantillon : les gabarits non parcourus peuvent présenter d'autres défauts.`,
        `${pagesAnalyzed} page(s) analysed${pagesKnown ? ` out of ${pagesKnown} known` : ''}${coverage}. Conclusions hold for this sample; uncrawled templates may have other defects.`,
        `${pagesAnalyzed} página(s) analizada(s)${pagesKnown ? ` de ${pagesKnown} conocidas` : ''}${coverage}. Las conclusiones valen para esta muestra.`,
      );
  const snapshot = t(
    " Un audit est une photographie instantanée : une mise en production, un changement de thème, de CDN ou de règles de cache postérieurs à la mesure peuvent invalider tout ou partie des constats.",
    ' An audit is a snapshot: a deployment, theme, CDN or cache change after measurement can invalidate part of the findings.',
    ' Una auditoría es una fotografía puntual: cualquier cambio posterior puede invalidar los hallazgos.',
  );
  const dated = input.analyzedAt
    ? ` ${t('Date de mesure', 'Measured at', 'Fecha de medición')} : ${esc(new Date(input.analyzedAt).toLocaleString(l === 'en' ? 'en-GB' : l === 'es' ? 'es-ES' : 'fr-FR'))}.`
    : '';

  // 4. Maturité du domaine
  const facts: string[] = [];
  if (typeof a?.authority_score === 'number')
    facts.push(t(`autorité ${a.authority_score}/100`, `authority ${a.authority_score}/100`, `autoridad ${a.authority_score}/100`));
  if (typeof a?.referring_domains === 'number')
    facts.push(t(`${a.referring_domains} domaine(s) référent(s)`, `${a.referring_domains} referring domain(s)`, `${a.referring_domains} dominio(s) de referencia`));
  if (typeof a?.backlinks_total === 'number')
    facts.push(t(`${a.backlinks_total} lien(s) entrant(s)`, `${a.backlinks_total} backlink(s)`, `${a.backlinks_total} enlace(s) entrante(s)`));
  if (ageMonths !== null) {
    const years = Math.floor(ageMonths / 12);
    const age = years >= 1
      ? t(`${years} an(s)`, `${years} year(s)`, `${years} año(s)`)
      : t(`${ageMonths} mois`, `${ageMonths} months`, `${ageMonths} meses`);
    facts.push(t(`ancienneté observée des liens ${age}`, `observed link history ${age}`, `historial de enlaces ${age}`));
  }
  const domainObserved = facts.length
    ? t(`Signaux relevés pour ${domain} : ${facts.join(', ')}. `, `Observed signals for ${domain}: ${facts.join(', ')}. `, `Señales observadas para ${domain}: ${facts.join(', ')}. `)
    : t(
        `Aucun signal d'autorité ou d'ancienneté n'a pu être collecté pour ${domain} dans ce rapport : la lecture ci-dessous reste théorique et ne doit pas servir de conclusion. `,
        `No authority or age signal could be collected for ${domain} in this report: the reading below is theoretical and must not be used as a conclusion. `,
        `No se pudo recoger ninguna señal de autoridad para ${domain}: la lectura siguiente es teórica. `,
      );
  const authorityCaveat = typeof a?.authority_score === 'number'
    ? t(
        " L'autorité indiquée est une estimation propriétaire Crawlers (rank de domaine et diversité des référents, plafonnée à 92, pénalisée si le profil de liens est artificiel) : ce n'est ni un score Semrush, ni Moz, ni Majestic, et les valeurs de ces outils diffèrent légitimement.",
        ' The authority figure is a proprietary Crawlers estimate (domain rank and referring-domain diversity, capped at 92, penalised for artificial link profiles): it is not a Semrush, Moz or Majestic score, and those tools legitimately report different values.',
        ' La autoridad indicada es una estimación propia de Crawlers, no un score de Semrush, Moz o Majestic.',
      )
    : '';
  // Verdict d'ancienneté daté et propre au domaine audité : on nomme le mois et
  // l'année de la première trace externe observée, puis on en tire une consigne
  // de prudence (jeune) ou de confiance renforcée (mature).
  const firstSeenLabel = a?.first_seen
    ? new Date(a.first_seen).toLocaleDateString(l === 'en' ? 'en-GB' : l === 'es' ? 'es-ES' : 'fr-FR', { month: 'long', year: 'numeric' })
    : null;
  const ageLabel = ageMonths !== null
    ? (ageMonths >= 12
        ? t(`${Math.floor(ageMonths / 12)} an(s)`, `${Math.floor(ageMonths / 12)} year(s)`, `${Math.floor(ageMonths / 12)} año(s)`)
        : t(`${ageMonths} mois`, `${ageMonths} months`, `${ageMonths} meses`))
    : null;

  let maturityVerdict: string;
  if (ageMonths === null || !firstSeenLabel) {
    maturityVerdict = t(
      `Aucune date de première trace externe n'a pu être établie pour ${domain} : l'ancienneté du nom de domaine est inconnue dans ce rapport. Les délais de prise d'effet annoncés (quelques semaines pour une correction technique, 3 à 6 mois pour une refonte sémantique) sont donc à considérer comme des ordres de grandeur non calés sur votre historique.`,
      `No first external trace date could be established for ${domain}: domain age is unknown in this report. The stated timeframes (a few weeks for a technical fix, 3 to 6 months for a semantic overhaul) are therefore rough orders of magnitude, not calibrated on your history.`,
      `No se pudo establecer la fecha de primera huella externa de ${domain}: la antigüedad es desconocida en este informe.`,
    );
  } else if (ageMonths < 18) {
    maturityVerdict = t(
      `${domain} a été vu pour la première fois par nos sources externes en ${esc(firstSeenLabel)}, soit une ancienneté observable d'environ ${ageLabel}. C'est un domaine jeune : restons prudents sur l'interprétation. Ses pages subissent une inertie structurelle — elles mettent plus longtemps à être explorées, indexées puis citées — et un score technique élevé ne compense pas encore le déficit d'autorité. Comptez plutôt 4 à 8 mois avant de juger l'effet d'une refonte sémantique, et considérez les écarts de position comme instables tant que l'historique reste court.`,
      `${domain} was first seen by our external sources in ${esc(firstSeenLabel)}, i.e. an observable age of about ${ageLabel}. This is a young domain, so read the findings cautiously. Its pages face structural inertia — slower crawling, indexing and citation — and a high technical score does not yet offset the authority gap. Allow 4 to 8 months before judging a semantic overhaul, and treat ranking swings as unstable while history remains short.`,
      `${domain} fue visto por primera vez en ${esc(firstSeenLabel)} (unos ${ageLabel}). Es un dominio joven: conviene ser prudente, sus páginas tardan más en ser rastreadas, indexadas y citadas.`,
    );
  } else if (ageMonths < 48) {
    maturityVerdict = t(
      `${domain} a été vu pour la première fois par nos sources externes en ${esc(firstSeenLabel)}, soit une ancienneté observable d'environ ${ageLabel}. Le domaine est en phase intermédiaire : l'historique est suffisant pour que les constats techniques et sémantiques soient exploitables, mais pas assez profond pour attribuer avec certitude un écart de position à l'autorité plutôt qu'au contenu. Comptez 3 à 6 mois pour juger une refonte sémantique, quelques semaines pour une correction technique.`,
      `${domain} was first seen by our external sources in ${esc(firstSeenLabel)}, i.e. an observable age of about ${ageLabel}. The domain is in an intermediate phase: history is sufficient for technical and semantic findings to be actionable, but not deep enough to confidently attribute a ranking gap to authority rather than content. Allow 3 to 6 months for a semantic overhaul, a few weeks for a technical fix.`,
      `${domain} fue visto por primera vez en ${esc(firstSeenLabel)} (unos ${ageLabel}): fase intermedia, los hallazgos son accionables pero la atribución sigue siendo parcial.`,
    );
  } else {
    maturityVerdict = t(
      `${domain} a été vu pour la première fois par nos sources externes en ${esc(firstSeenLabel)}, soit une ancienneté observable d'environ ${ageLabel}. C'est un domaine mature : nos observations sont d'autant plus fiables, car l'historique écarte l'hypothèse d'un simple manque d'ancienneté pour expliquer les faiblesses relevées. En contrepartie, un domaine installé porte souvent un passif — anciennes URL, contenus obsolètes, liens de mauvaise qualité, migrations passées — qui peut peser plus lourd que les défauts techniques listés ici. Sur ce type de domaine, une correction technique produit généralement un effet en quelques semaines.`,
      `${domain} was first seen by our external sources in ${esc(firstSeenLabel)}, i.e. an observable age of about ${ageLabel}. This is a mature domain: our observations are all the more reliable, since history rules out mere youth as the explanation for the weaknesses found. In return, an established domain often carries liabilities — legacy URLs, outdated content, poor links, past migrations — that can weigh more than the technical defects listed here. On such a domain, a technical fix usually shows effect within weeks.`,
      `${domain} fue visto por primera vez en ${esc(firstSeenLabel)} (unos ${ageLabel}). Es un dominio maduro: nuestras observaciones son más fiables, aunque puede arrastrar un pasivo histórico.`,
    );
  }
  const firstSeenCaveat = firstSeenLabel
    ? ' ' + t(
        `Cette date correspond au premier lien entrant observé par nos sources, pas à la date de création du nom de domaine ni à sa première indexation exacte : elle en constitue une borne supérieure prudente (le domaine peut être antérieur).`,
        `This date is the first backlink observed by our sources, not the domain registration or exact first indexation date: it is a conservative upper bound (the domain may be older).`,
        `Esta fecha es el primer enlace entrante observado, no la fecha de creación del dominio: es una cota superior prudente.`,
      )
    : '';
  const domainBody = domainObserved + authorityCaveat + ' ' + maturityVerdict + firstSeenCaveat + ' ' + t(
    'Aucun de ces délais n\'est garanti.',
    'None of these timeframes is guaranteed.',
    'Ningún plazo está garantizado.',
  );


  // 5. Crawlabilité
  const blockers = (input.blockers || []).filter(Boolean);
  const crawlBody = blockers.length
    ? ul(blockers.map((b) => esc(b)))
    : p(
        t(
          `Aucun frein de crawlabilité bloquant n'a été détecté sur ${domain} pendant cet audit. Cela ne garantit pas que les robots des moteurs de réponse IA accèdent réellement au contenu : un blocage peut intervenir côté CDN, pare-feu applicatif ou rendu JavaScript sans apparaître dans le HTML servi à notre crawler.`,
          `No blocking crawlability issue was detected on ${domain} during this audit. This does not guarantee that AI answer-engine crawlers actually reach the content: blocking can occur at CDN, WAF or JavaScript-rendering level without showing in the HTML served to our crawler.`,
          `No se detectó ningún freno de rastreabilidad bloqueante en ${domain}. Esto no garantiza que los rastreadores de IA accedan realmente al contenido.`,
        ),
      );

  const marketBody = p(
    t(
      "Un même score n'a pas la même valeur d'un secteur à l'autre. Sur un marché mature et très éditorialisé, les gains SEO classiques sont lents et l'écart se joue sur la citabilité par les moteurs de réponse IA (ChatGPT, Perplexity, AI Overviews, Copilot). Sur un marché émergent ou peu travaillé, une page correctement structurée peut être citée en quelques semaines sans autorité forte. Les scores GEO mesurent une aptitude à être trouvé et cité, pas un volume de trafic : aucun éditeur, y compris ceux de ces moteurs, ne publie de correspondance stable entre optimisation et citations. Les critères d'ingestion des IA évoluent plus vite que les critères de classement de Google : une mesure a une durée de validité courte et doit être rejouée périodiquement.",
      'The same score does not carry the same value across sectors. In a mature, heavily editorialised market, classic SEO gains are slow and the difference is made by citability in AI answer engines. In an emerging market, a well-structured page can be cited within weeks without strong authority. GEO scores measure the ability to be found and cited, not traffic volume. AI ingestion criteria change faster than Google ranking criteria: any measurement has a short shelf life and should be re-run periodically.',
      'La misma puntuación no vale lo mismo en cada sector. Las puntuaciones GEO miden la aptitud para ser citado, no un volumen de tráfico, y deben repetirse periódicamente.',
    ),
  );

  // 7. Angles morts — contenu unique repris de l'ancienne section
  // « Divulgation méthodologique », désormais fusionnée ici pour éviter le doublon.
  const blindSpots = ul([
    t(
      'Contenus derrière authentification, formulaire ou paywall : non explorés, donc non évalués.',
      'Content behind authentication, forms or paywall: not crawled, therefore not assessed.',
      'Contenido tras autenticación, formulario o muro de pago: no rastreado.',
    ),
    t(
      'Rendu JavaScript tardif et personnalisation par géolocalisation ou cookie : ce que voient certains utilisateurs peut différer de ce qui est analysé.',
      'Late JavaScript rendering and geo/cookie personalisation: what some users see may differ from what is analysed.',
      'Renderizado JS tardío y personalización: lo que ven algunos usuarios puede diferir.',
    ),
    t(
      'Réputation hors-site (avis, presse, réseaux, mentions de marque) : partiellement approchée, jamais exhaustive.',
      'Off-site reputation (reviews, press, social, brand mentions): partially approximated, never exhaustive.',
      'Reputación externa: parcialmente aproximada, nunca exhaustiva.',
    ),
    t(
      'Historique de pénalités, migrations passées et changements de nom de domaine : invisibles depuis un audit externe.',
      'Penalty history, past migrations and domain changes: invisible from an external audit.',
      'Historial de penalizaciones y migraciones: invisible desde una auditoría externa.',
    ),
    t(
      "Tests de visibilité IA non déterministes : une même question peut donner une réponse différente d'une exécution à l'autre.",
      'AI visibility tests are not deterministic: the same question can yield a different answer between runs.',
      'Las pruebas de visibilidad IA no son deterministas.',
    ),
  ]);

  return `
  <div class="section" data-pdf-section="disclaimer" data-marina-scope="site" data-marina-block="scope_limits" style="page-break-before:always;border-top:3px solid #5b21b6;">
    <h2 style="font-size:20px;margin:0 0 6px 0;">${ui.title}</h2>
    <p style="font-size:13px;color:#4b5563;line-height:1.7;margin:0 0 4px 0;">
      ${t(
        `Cette section précise, pour ${domain}, ce qui est mesuré, ce qui est estimé et ce qui dépend du contexte. Elle doit être lue avant tout arbitrage budgétaire.`,
        `This section states, for ${domain}, what is measured, what is estimated and what depends on context. Read it before any budget decision.`,
        `Esta sección indica, para ${domain}, qué se mide, qué se estima y qué depende del contexto.`,
      )}
    </p>
    ${h3(ui.h1)}${measured}
    ${h3(ui.h2)}${estimated}
    ${h3(ui.h3)}${p(scopeText + snapshot + dated)}
    ${h3(ui.h4)}${p(domainBody)}
    ${h3(ui.h5)}${crawlBody}
    ${h3(ui.h6)}${marketBody}
    ${h3(ui.h7)}${blindSpots}
    <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:16px 0 0 0;font-style:italic;">${ui.note}</p>
  </div>`;
}
