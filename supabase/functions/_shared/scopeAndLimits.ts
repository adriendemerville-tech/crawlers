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
  const domainBody = domainObserved + t(
    "Un domaine récent ou faiblement lié subit une inertie structurelle : même parfaitement optimisées, ses pages mettent plus longtemps à être explorées, indexées puis citées, et un score technique élevé ne compense pas un déficit d'autorité. À l'inverse, un domaine ancien porte parfois un passif — anciennes URL, contenus obsolètes, liens de mauvaise qualité — qui pèse davantage que les défauts techniques listés ici. Comptez 3 à 6 mois avant de juger l'effet d'une refonte sémantique, quelques semaines pour une correction technique sur un domaine installé. Aucun de ces délais n'est garanti.",
    'A young or weakly linked domain suffers structural inertia: even perfectly optimised, its pages take longer to be crawled, indexed and cited, and a high technical score does not offset an authority deficit. Conversely, an old domain may carry liabilities — legacy URLs, outdated content, poor links — weighing more than the technical defects listed here. Allow 3 to 6 months before judging a semantic overhaul, a few weeks for a technical fix on an established domain. None of these timeframes is guaranteed.',
    'Un dominio reciente o poco enlazado sufre una inercia estructural; un dominio antiguo puede arrastrar un pasivo. Ningún plazo está garantizado.',
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
    <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:16px 0 0 0;font-style:italic;">${ui.note}</p>
  </div>`;
}
