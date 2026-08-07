/**
 * auditDisclaimer — section « Portée et limites » ajoutée à la fin de TOUS les rapports PDF.
 *
 * Objectif : dire avec prudence ce qui est fiable dans la méthodologie de l'audit,
 * ce qui dépend de la page / du site audité, de la maturité du nom de domaine,
 * de sa crawlabilité (et de ce qui la bloque ou la freine), ainsi que de la maturité
 * du marché et du basculement d'usage moteur de recherche → moteurs de réponse IA.
 *
 * Un seul module, deux rendus :
 *  - `renderDisclaimerHTML(ctx)` pour les PDF construits depuis du HTML (html2canvas)
 *  - `addDisclaimerPage(doc, ctx)` pour les PDF construits directement en jsPDF
 */

export type AuditKind =
  | 'crawlers'
  | 'geo'
  | 'llm'
  | 'pagespeed'
  | 'site_crawl'
  | 'expert'
  | 'cro'
  | 'marina'
  | 'parmenion'
  | 'generic';

export type DisclaimerContext = {
  auditType: AuditKind;
  /** URL ou domaine audité, affiché tel quel */
  target?: string;
  domain?: string;
  language?: string;
  /** Périmètre réellement observé */
  scope?: {
    singlePage?: boolean;
    pagesAnalyzed?: number;
    /** Nombre de pages connues/déclarées (sitemap, crawl précédent) */
    pagesKnown?: number;
    analyzedAt?: string | Date;
  };
  /** Signaux de maturité du nom de domaine, quand ils sont disponibles */
  domainMaturity?: {
    ageMonths?: number;
    authorityScore?: number;
    indexedPages?: number;
    backlinks?: number;
  };
  /** Signaux de crawlabilité observés pendant l'audit */
  crawlability?: {
    /** Freins explicites détectés : "robots.txt restrictif", "403 Cloudflare", ... */
    blockers?: string[];
    robotsRestrictive?: boolean;
    aiBotsBlocked?: number;
    jsRendered?: boolean;
    httpErrors?: number;
    avgResponseMs?: number;
    sitemapFound?: boolean;
  };
};

type Locale = 'fr' | 'en' | 'es';

function pickLocale(language?: string): Locale {
  const l = (language || 'fr').slice(0, 2).toLowerCase();
  return l === 'en' ? 'en' : l === 'es' ? 'es' : 'fr';
}

const UI = {
  fr: {
    title: 'Portée et limites de cet audit',
    intro:
      "Cette section précise ce qui est mesuré, ce qui est estimé et ce qui dépend du contexte. Elle doit être lue avant toute décision d'arbitrage budgétaire.",
    methodology: '1. Ce qui est fiable dans la méthodologie',
    measured: 'Mesuré directement',
    estimated: 'Estimé ou pondéré',
    scope: '2. Ce qui dépend de la page et du site audités',
    domain: '3. Maturité du nom de domaine',
    crawl: '4. Crawlabilité observée',
    market: '5. Maturité du marché et changement d\'usage',
    marketBody:
      "La part de trafic captée par les moteurs de réponse IA (ChatGPT, Perplexity, Google AI Overviews, Copilot) progresse vite mais reste instable d'un secteur à l'autre : sur un marché mature et très concurrentiel, les gains SEO classiques sont lents et l'écart se joue sur la citabilité par les IA ; sur un marché émergent, une page correctement structurée peut être citée en quelques semaines sans autorité forte. Les scores GEO de ce rapport évaluent l'aptitude à être cité, pas un volume de trafic garanti : aucun acteur, y compris les éditeurs de ces moteurs, ne publie de correspondance stable entre optimisation et citations. Enfin, les critères d'ingestion des IA évoluent plus vite que les critères de classement de Google — une mesure a une durée de validité courte et doit être rejouée périodiquement.",
    noSignal: 'Signal non disponible dans ce rapport : ne pas conclure sur ce point.',
    footerNote:
      "Les recommandations sont hiérarchisées par impact attendu, pas par certitude de résultat. Aucun résultat de positionnement n'est garanti.",
  },
  en: {
    title: 'Scope and limitations of this audit',
    intro:
      'This section states what is measured, what is estimated and what depends on context. Read it before making budget decisions.',
    methodology: '1. What is reliable in the methodology',
    measured: 'Directly measured',
    estimated: 'Estimated or weighted',
    scope: '2. What depends on the audited page and site',
    domain: '3. Domain name maturity',
    crawl: '4. Observed crawlability',
    market: '5. Market maturity and shifting usage',
    marketBody:
      'Traffic captured by AI answer engines (ChatGPT, Perplexity, Google AI Overviews, Copilot) is growing fast but remains uneven across sectors: in a mature, competitive market, classic SEO gains are slow and the difference is made by AI citability; in an emerging market, a well-structured page can be cited within weeks without strong authority. The GEO scores in this report assess the ability to be cited, not guaranteed traffic: no vendor, including the engines themselves, publishes a stable mapping between optimisation and citations. AI ingestion criteria also change faster than Google ranking criteria — any measurement has a short shelf life and should be re-run periodically.',
    noSignal: 'Signal not available in this report: do not draw conclusions on this point.',
    footerNote:
      'Recommendations are ranked by expected impact, not by certainty of outcome. No ranking result is guaranteed.',
  },
  es: {
    title: 'Alcance y límites de esta auditoría',
    intro:
      'Esta sección indica qué se mide, qué se estima y qué depende del contexto. Léala antes de tomar decisiones presupuestarias.',
    methodology: '1. Qué es fiable en la metodología',
    measured: 'Medido directamente',
    estimated: 'Estimado o ponderado',
    scope: '2. Qué depende de la página y del sitio auditados',
    domain: '3. Madurez del nombre de dominio',
    crawl: '4. Rastreabilidad observada',
    market: '5. Madurez del mercado y cambio de uso',
    marketBody:
      'El tráfico captado por los motores de respuesta IA (ChatGPT, Perplexity, Google AI Overviews, Copilot) crece rápido pero es desigual según el sector: en un mercado maduro y competitivo, las ganancias SEO clásicas son lentas y la diferencia la marca la citabilidad por las IA; en un mercado emergente, una página bien estructurada puede ser citada en pocas semanas sin gran autoridad. Las puntuaciones GEO de este informe evalúan la aptitud para ser citado, no un volumen de tráfico garantizado. Los criterios de ingesta de las IA cambian más rápido que los de posicionamiento de Google: toda medición tiene una validez corta y debe repetirse periódicamente.',
    noSignal: 'Señal no disponible en este informe: no concluya sobre este punto.',
    footerNote:
      'Las recomendaciones se priorizan por impacto esperado, no por certeza de resultado. No se garantiza ningún resultado de posicionamiento.',
  },
} as const;

/** Ce qui est mesuré / estimé, par type d'audit. */
const METHODOLOGY: Record<AuditKind, Record<Locale, { measured: string[]; estimated: string[] }>> = {
  crawlers: {
    fr: {
      measured: [
        'Contenu réel du fichier robots.txt au moment du scan et directives par user-agent.',
        'Code HTTP renvoyé par le serveur à notre requête.',
      ],
      estimated: [
        "La correspondance user-agent → société est déclarative : un bot peut se présenter sous un autre nom, et l'absence de blocage ne prouve pas que le bot passe réellement.",
        "Un robots.txt permissif n'implique ni crawl effectif, ni indexation, ni citation par le modèle.",
      ],
    },
    en: {
      measured: ['Actual robots.txt content at scan time and per-user-agent directives.', 'HTTP status returned to our request.'],
      estimated: [
        'User-agent to company mapping is declarative: a bot may spoof another name, and the absence of a block does not prove the bot actually crawls.',
        'A permissive robots.txt implies neither crawling, indexing nor citation by the model.',
      ],
    },
    es: {
      measured: ['Contenido real del robots.txt en el momento del escaneo.', 'Código HTTP devuelto por el servidor.'],
      estimated: [
        'La correspondencia user-agent → empresa es declarativa: un bot puede suplantar otro nombre.',
        'Un robots.txt permisivo no implica rastreo, indexación ni cita por el modelo.',
      ],
    },
  },
  geo: {
    fr: {
      measured: [
        'Présence et structure des signaux observables dans le HTML servi : titres, données structurées, passages citables, fraîcheur déclarée, auteur.',
      ],
      estimated: [
        "La pondération des facteurs GEO est propriétaire : elle reflète l'état de l'art public sur l'ingestion des LLM, pas un algorithme documenté par les éditeurs.",
        'Un score élevé augmente la probabilité de citation ; il ne la garantit pas et ne prédit pas un volume de trafic.',
      ],
    },
    en: {
      measured: ['Presence and structure of observable signals in the served HTML: headings, structured data, citable passages, freshness, author.'],
      estimated: [
        'GEO factor weighting is proprietary: it reflects public state of the art on LLM ingestion, not a documented vendor algorithm.',
        'A high score raises the probability of citation; it does not guarantee it, nor predict traffic.',
      ],
    },
    es: {
      measured: ['Presencia y estructura de señales observables en el HTML servido.'],
      estimated: [
        'La ponderación de los factores GEO es propietaria y refleja el estado del arte público.',
        'Una puntuación alta aumenta la probabilidad de cita; no la garantiza.',
      ],
    },
  },
  llm: {
    fr: {
      measured: ['Réponses effectivement renvoyées par les modèles interrogés, à la date et avec les formulations indiquées.'],
      estimated: [
        'Les LLM sont non déterministes : la même question peut donner une réponse différente selon la session, la région, la version du modèle et la personnalisation utilisateur.',
        "Un test négatif ne prouve pas l'absence de citation ; un test positif ne prouve pas une citation systématique.",
      ],
    },
    en: {
      measured: ['Answers actually returned by the queried models, at the stated date and with the stated prompts.'],
      estimated: [
        'LLMs are non-deterministic: the same prompt may yield different answers depending on session, region, model version and personalisation.',
        'A negative test does not prove absence of citation; a positive test does not prove systematic citation.',
      ],
    },
    es: {
      measured: ['Respuestas devueltas realmente por los modelos consultados en la fecha indicada.'],
      estimated: [
        'Los LLM no son deterministas: la misma pregunta puede dar respuestas distintas.',
        'Una prueba negativa no demuestra ausencia de cita.',
      ],
    },
  },
  pagespeed: {
    fr: {
      measured: ['Métriques de laboratoire renvoyées par Lighthouse pour une exécution unique, sur un profil réseau et matériel simulé.'],
      estimated: [
        'Les données de laboratoire ne sont pas les données terrain (CrUX) : elles varient d\'une exécution à l\'autre et peuvent diverger de l\'expérience réelle de vos visiteurs.',
        "L'impact SEO d'un gain de performance est indirect et dépend du secteur et de la concurrence.",
      ],
    },
    en: {
      measured: ['Lab metrics returned by Lighthouse for a single run on a simulated network and device profile.'],
      estimated: [
        'Lab data is not field data (CrUX): it varies run to run and may diverge from real user experience.',
        'The SEO impact of a performance gain is indirect and sector-dependent.',
      ],
    },
    es: {
      measured: ['Métricas de laboratorio de Lighthouse para una única ejecución simulada.'],
      estimated: [
        'Los datos de laboratorio no son datos de campo (CrUX) y varían entre ejecuciones.',
        'El impacto SEO de una mejora de rendimiento es indirecto.',
      ],
    },
  },
  site_crawl: {
    fr: {
      measured: [
        'HTML réellement servi aux pages effectivement parcourues : codes HTTP, balises, maillage interne, duplication et volumétrie de contenu.',
      ],
      estimated: [
        'Les scores SEO par page et les seuils de contenu insuffisant reposent sur des idéaux sectoriels internes, ajustés statistiquement : ils comparent vos pages entre elles avant de les comparer au marché.',
        'La détection de quasi-doublons repose sur une similarité lexicale (SimHash) : elle signale un risque de cannibalisation, elle ne le démontre pas sans vérification SERP.',
      ],
    },
    en: {
      measured: ['HTML actually served on crawled pages: HTTP codes, tags, internal linking, duplication and content volume.'],
      estimated: [
        'Per-page SEO scores and thin-content thresholds rely on internal sector baselines: they compare your pages to each other before comparing them to the market.',
        'Near-duplicate detection relies on lexical similarity (SimHash): it flags cannibalisation risk, it does not prove it without SERP verification.',
      ],
    },
    es: {
      measured: ['HTML realmente servido en las páginas rastreadas.'],
      estimated: [
        'Las puntuaciones por página se basan en referencias sectoriales internas.',
        'La detección de casi-duplicados se basa en similitud léxica: señala un riesgo, no lo demuestra.',
      ],
    },
  },
  expert: {
    fr: {
      measured: ['Signaux techniques relevés sur les pages parcourues : en-têtes, balises, données structurées, accessibilité des ressources, sécurité.'],
      estimated: [
        "Les analyses stratégiques et les priorisations sont produites par un modèle de langage à partir des signaux mesurés : elles sont argumentées, mais restent une lecture d'expert, pas une mesure.",
        "Les estimations de potentiel (trafic, positions) proviennent de bases tierces : elles ont une marge d'erreur importante sur les requêtes à faible volume.",
      ],
    },
    en: {
      measured: ['Technical signals collected on crawled pages: headers, tags, structured data, resource accessibility, security.'],
      estimated: [
        'Strategic analysis and prioritisation are produced by a language model from measured signals: reasoned, but an expert reading rather than a measurement.',
        'Potential estimates (traffic, positions) come from third-party databases with significant error margins on low-volume queries.',
      ],
    },
    es: {
      measured: ['Señales técnicas recogidas en las páginas rastreadas.'],
      estimated: [
        'Los análisis estratégicos los produce un modelo de lenguaje: son razonados, no medidos.',
        'Las estimaciones de potencial provienen de bases de terceros con margen de error.',
      ],
    },
  },
  cro: {
    fr: {
      measured: ['Éléments d\'interface réellement présents sur la page au moment de la capture, et métriques comportementales transmises par vos outils analytiques.'],
      estimated: [
        "Les gains de conversion annoncés sont des ordres de grandeur issus de références sectorielles : ils ne remplacent pas un test A/B sur votre audience.",
        "Sans volume suffisant, un écart observé n'est pas statistiquement significatif.",
      ],
    },
    en: {
      measured: ['Interface elements actually present on the page at capture time, and behavioural metrics from your analytics.'],
      estimated: [
        'Stated conversion gains are sector-level orders of magnitude: they do not replace an A/B test on your own audience.',
        'Without sufficient volume, an observed difference is not statistically significant.',
      ],
    },
    es: {
      measured: ['Elementos de interfaz presentes en la página en el momento de la captura.'],
      estimated: [
        'Las mejoras de conversión indicadas son órdenes de magnitud sectoriales.',
        'Sin volumen suficiente, una diferencia observada no es significativa.',
      ],
    },
  },
  marina: {
    fr: {
      measured: ['Signaux publics accessibles sans accès à vos outils : HTML servi, robots.txt, sitemap, données structurées, rendu réel de la page.'],
      estimated: [
        "Cet audit est réalisé sans accès à votre Search Console ni à votre analytique : les volumes, positions et conversions évoqués sont des estimations externes.",
        'Le périmètre est volontairement restreint à un échantillon de pages : il illustre des tendances, il ne remplace pas un audit complet.',
      ],
    },
    en: {
      measured: ['Public signals available without access to your tools: served HTML, robots.txt, sitemap, structured data, real rendering.'],
      estimated: [
        'This audit runs without access to your Search Console or analytics: volumes, positions and conversions are external estimates.',
        'Scope is deliberately limited to a sample of pages: it illustrates trends, it does not replace a full audit.',
      ],
    },
    es: {
      measured: ['Señales públicas accesibles sin acceso a sus herramientas.'],
      estimated: [
        'Esta auditoría se realiza sin acceso a su Search Console ni a su analítica.',
        'El alcance se limita a una muestra de páginas.',
      ],
    },
  },
  parmenion: {
    fr: {
      measured: ['Actions réellement exécutées et horodatées par le moteur d\'automatisation, avec leur statut de retour CMS.'],
      estimated: [
        "L'effet SEO d'une publication ne se mesure pas à la date de publication : comptez plusieurs semaines de recul avant toute lecture de performance.",
        "La corrélation entre une action listée ici et une variation de trafic n'est pas établie par ce rapport.",
      ],
    },
    en: {
      measured: ['Actions actually executed and timestamped by the automation engine, with CMS return status.'],
      estimated: [
        'The SEO effect of a publication is not measurable on its publication date: allow several weeks before reading performance.',
        'Correlation between a listed action and a traffic change is not established by this report.',
      ],
    },
    es: {
      measured: ['Acciones ejecutadas y fechadas por el motor de automatización.'],
      estimated: [
        'El efecto SEO de una publicación no se mide en su fecha de publicación.',
        'Este informe no establece correlación con las variaciones de tráfico.',
      ],
    },
  },
  generic: {
    fr: {
      measured: ['Signaux relevés directement sur les URL analysées à la date indiquée en tête de rapport.'],
      estimated: [
        'Les scores composites et les priorisations reposent sur des pondérations propriétaires, révisées régulièrement : deux audits espacés dans le temps ne sont comparables que sur la même version de méthodologie.',
      ],
    },
    en: {
      measured: ['Signals collected directly on the analysed URLs at the date shown at the top of the report.'],
      estimated: [
        'Composite scores and prioritisation rely on proprietary weightings, revised regularly: two audits are only comparable under the same methodology version.',
      ],
    },
    es: {
      measured: ['Señales recogidas directamente en las URL analizadas.'],
      estimated: ['Las puntuaciones compuestas se basan en ponderaciones propietarias revisadas periódicamente.'],
    },
  },
};

function scopeBody(ctx: DisclaimerContext, l: Locale): string {
  const s = ctx.scope || {};
  const parts: string[] = [];
  const target = ctx.target || ctx.domain;

  if (l === 'fr') {
    if (s.singlePage) {
      parts.push(
        `L'analyse porte sur une seule URL${target ? ` (${target})` : ''} : elle ne préjuge ni de la qualité des autres gabarits du site, ni de la santé globale du domaine.`,
      );
    } else if (s.pagesAnalyzed) {
      const cover =
        s.pagesKnown && s.pagesKnown > 0
          ? ` sur ${s.pagesKnown} connue(s), soit ${Math.round((s.pagesAnalyzed / s.pagesKnown) * 100)} % du périmètre`
          : '';
      parts.push(
        `${s.pagesAnalyzed} page(s) analysée(s)${cover}. Les conclusions valent pour cet échantillon : les gabarits non parcourus peuvent présenter d'autres défauts.`,
      );
    } else {
      parts.push("Le périmètre exact des pages parcourues conditionne la portée des conclusions : hors de cet échantillon, rien n'est démontré.");
    }
    parts.push(
      "Un audit est une photographie instantanée : une mise en production, un changement de thème, de CDN ou de règles de cache postérieurs à la mesure peuvent invalider tout ou partie des constats.",
    );
    if (s.analyzedAt) {
      parts.push(`Date de mesure : ${new Date(s.analyzedAt).toLocaleString('fr-FR')}.`);
    }
    return parts.join(' ');
  }

  if (l === 'es') {
    if (s.singlePage) parts.push(`El análisis cubre una sola URL${target ? ` (${target})` : ''} y no prejuzga los demás gabaritos del sitio.`);
    else if (s.pagesAnalyzed) parts.push(`${s.pagesAnalyzed} página(s) analizada(s). Las conclusiones valen para esta muestra.`);
    else parts.push('El alcance de las páginas rastreadas condiciona el alcance de las conclusiones.');
    parts.push('Una auditoría es una fotografía instantánea: cualquier cambio posterior puede invalidar los hallazgos.');
    if (s.analyzedAt) parts.push(`Fecha de medición: ${new Date(s.analyzedAt).toLocaleString('es-ES')}.`);
    return parts.join(' ');
  }

  if (s.singlePage) {
    parts.push(`The analysis covers a single URL${target ? ` (${target})` : ''}: it says nothing about other templates or overall domain health.`);
  } else if (s.pagesAnalyzed) {
    const cover =
      s.pagesKnown && s.pagesKnown > 0 ? ` out of ${s.pagesKnown} known (${Math.round((s.pagesAnalyzed / s.pagesKnown) * 100)}% of scope)` : '';
    parts.push(`${s.pagesAnalyzed} page(s) analysed${cover}. Conclusions hold for this sample; uncrawled templates may have other defects.`);
  } else {
    parts.push('The exact set of crawled pages bounds the conclusions: outside that sample, nothing is demonstrated.');
  }
  parts.push('An audit is a snapshot: a deployment, theme, CDN or cache change after measurement can invalidate part of the findings.');
  if (s.analyzedAt) parts.push(`Measured at: ${new Date(s.analyzedAt).toLocaleString('en-GB')}.`);
  return parts.join(' ');
}

function domainBody(ctx: DisclaimerContext, l: Locale): string {
  const d = ctx.domainMaturity || {};
  const facts: string[] = [];
  if (typeof d.ageMonths === 'number') {
    const years = Math.floor(d.ageMonths / 12);
    facts.push(
      l === 'fr'
        ? `ancienneté estimée ${years >= 1 ? `${years} an(s)` : `${d.ageMonths} mois`}`
        : l === 'es'
          ? `antigüedad estimada ${years >= 1 ? `${years} año(s)` : `${d.ageMonths} meses`}`
          : `estimated age ${years >= 1 ? `${years} year(s)` : `${d.ageMonths} months`}`,
    );
  }
  if (typeof d.authorityScore === 'number')
    facts.push(l === 'fr' ? `autorité ${d.authorityScore}/100` : l === 'es' ? `autoridad ${d.authorityScore}/100` : `authority ${d.authorityScore}/100`);
  if (typeof d.indexedPages === 'number')
    facts.push(l === 'fr' ? `${d.indexedPages} page(s) indexée(s)` : l === 'es' ? `${d.indexedPages} página(s) indexada(s)` : `${d.indexedPages} indexed page(s)`);
  if (typeof d.backlinks === 'number')
    facts.push(l === 'fr' ? `${d.backlinks} lien(s) entrant(s)` : l === 'es' ? `${d.backlinks} enlace(s) entrante(s)` : `${d.backlinks} backlink(s)`);

  const observed = facts.length
    ? (l === 'fr' ? `Signaux relevés : ${facts.join(', ')}. ` : l === 'es' ? `Señales observadas: ${facts.join(', ')}. ` : `Observed signals: ${facts.join(', ')}. `)
    : (l === 'fr'
        ? "Aucun signal d'ancienneté ou d'autorité n'a été collecté dans ce rapport : la lecture ci-dessous reste théorique. "
        : l === 'es'
          ? 'No se recogieron señales de antigüedad o autoridad en este informe. '
          : 'No age or authority signal was collected in this report. ');

  if (l === 'fr') {
    return `${observed}Un domaine récent (moins de douze mois) ou faiblement lié subit une inertie structurelle : même parfaitement optimisées, ses pages mettent plus longtemps à être explorées, indexées puis citées, et un score technique élevé ne compense pas un déficit d'autorité. À l'inverse, un domaine ancien porte parfois un passif — anciennes URL, contenus obsolètes, liens de mauvaise qualité — qui pèse davantage que les défauts techniques listés dans ce rapport. Les priorités proposées supposent une progression sur plusieurs mois, jamais un effet immédiat.`;
  }
  if (l === 'es') {
    return `${observed}Un dominio reciente o poco enlazado sufre una inercia estructural: sus páginas tardan más en ser rastreadas, indexadas y citadas, y una buena puntuación técnica no compensa la falta de autoridad. Un dominio antiguo puede arrastrar un pasivo que pese más que los defectos técnicos aquí listados.`;
  }
  return `${observed}A recent domain (under twelve months) or a weakly linked one carries structural inertia: even when perfectly optimised, its pages take longer to be crawled, indexed and cited, and a high technical score does not offset an authority gap. Conversely, an older domain may carry legacy debt — stale URLs, obsolete content, poor links — that weighs more than the technical defects listed here. Priorities assume progress over months, never an immediate effect.`;
}

function crawlBody(ctx: DisclaimerContext, l: Locale): string {
  const c = ctx.crawlability || {};
  const blockers: string[] = [...(c.blockers || [])];
  if (c.robotsRestrictive)
    blockers.push(l === 'fr' ? 'robots.txt restrictif sur tout ou partie du site' : l === 'es' ? 'robots.txt restrictivo' : 'restrictive robots.txt');
  if (typeof c.aiBotsBlocked === 'number' && c.aiBotsBlocked > 0)
    blockers.push(
      l === 'fr' ? `${c.aiBotsBlocked} bot(s) IA bloqué(s)` : l === 'es' ? `${c.aiBotsBlocked} bot(s) IA bloqueado(s)` : `${c.aiBotsBlocked} AI bot(s) blocked`,
    );
  if (c.jsRendered)
    blockers.push(
      l === 'fr'
        ? 'contenu dépendant du JavaScript (les moteurs de réponse IA exécutent rarement le JS)'
        : l === 'es'
          ? 'contenido dependiente de JavaScript'
          : 'JavaScript-dependent content (AI answer engines rarely execute JS)',
    );
  if (typeof c.httpErrors === 'number' && c.httpErrors > 0)
    blockers.push(l === 'fr' ? `${c.httpErrors} réponse(s) HTTP en erreur` : l === 'es' ? `${c.httpErrors} respuesta(s) HTTP en error` : `${c.httpErrors} HTTP error response(s)`);
  if (typeof c.avgResponseMs === 'number' && c.avgResponseMs > 1500)
    blockers.push(
      l === 'fr'
        ? `temps de réponse moyen élevé (${Math.round(c.avgResponseMs)} ms), qui réduit le budget de crawl`
        : l === 'es'
          ? `tiempo de respuesta elevado (${Math.round(c.avgResponseMs)} ms)`
          : `high average response time (${Math.round(c.avgResponseMs)} ms), reducing crawl budget`,
    );
  if (c.sitemapFound === false)
    blockers.push(l === 'fr' ? 'aucun sitemap XML exploitable' : l === 'es' ? 'sin sitemap XML utilizable' : 'no usable XML sitemap');

  if (l === 'fr') {
    const head = blockers.length
      ? `Freins identifiés pendant la collecte : ${blockers.join(' ; ')}. Chacun réduit la quantité de pages réellement vues par les robots et fragilise donc la représentativité des constats.`
      : "Aucun frein bloquant n'a été rencontré pendant la collecte : les pages ciblées ont répondu normalement. Cela ne garantit pas que les robots des moteurs bénéficient du même traitement, certaines protections (pare-feu applicatif, limitation de débit, filtrage géographique) ne se déclenchant qu'à un volume supérieur.";
    return `${head} Rappel de prudence : une page inaccessible à notre collecteur peut être parfaitement accessible à Googlebot, et l'inverse est vrai. En cas de doute, faire confirmer par un test d'inspection d'URL dans la Search Console avant tout arbitrage.`;
  }
  if (l === 'es') {
    const head = blockers.length
      ? `Frenos identificados durante la recogida: ${blockers.join(' ; ')}.`
      : 'No se encontraron frenos bloqueantes durante la recogida.';
    return `${head} Una página inaccesible para nuestro rastreador puede ser accesible para Googlebot, y viceversa. Confirme con la inspección de URL en Search Console.`;
  }
  const head = blockers.length
    ? `Blockers found during collection: ${blockers.join('; ')}. Each one reduces how many pages bots actually see and weakens the representativeness of the findings.`
    : 'No blocking obstacle was encountered during collection: targeted pages responded normally. This does not guarantee search engine bots get the same treatment, as some protections (WAF, rate limiting, geo-filtering) only trigger at higher volume.';
  return `${head} Caution: a page inaccessible to our collector may be perfectly accessible to Googlebot, and vice versa. When in doubt, confirm with URL inspection in Search Console before deciding.`;
}

export type DisclaimerBlock = { heading: string; body: string; bullets?: { label: string; items: string[] }[] };

export function buildDisclaimer(ctx: DisclaimerContext): { title: string; intro: string; blocks: DisclaimerBlock[]; footerNote: string } {
  const l = pickLocale(ctx.language);
  const ui = UI[l];
  const method = (METHODOLOGY[ctx.auditType] || METHODOLOGY.generic)[l];
  const generic = METHODOLOGY.generic[l];

  return {
    title: ui.title,
    intro: ui.intro,
    footerNote: ui.footerNote,
    blocks: [
      {
        heading: ui.methodology,
        body: '',
        bullets: [
          { label: ui.measured, items: method.measured },
          { label: ui.estimated, items: [...method.estimated, ...(ctx.auditType === 'generic' ? [] : generic.estimated)] },
        ],
      },
      { heading: ui.scope, body: scopeBody(ctx, l) },
      { heading: ui.domain, body: domainBody(ctx, l) },
      { heading: ui.crawl, body: crawlBody(ctx, l) },
      { heading: ui.market, body: ui.marketBody },
    ],
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Rendu HTML de la section, destiné aux PDF construits depuis du HTML. */
export function renderDisclaimerHTML(ctx: DisclaimerContext): string {
  const d = buildDisclaimer(ctx);
  const blocks = d.blocks
    .map((block) => {
      const bullets = (block.bullets || [])
        .map(
          (group) => `
        <div style="margin-top:8px;">
          <div style="font-size:12px;font-weight:600;color:#1a1a1a;">${escapeHtml(group.label)}</div>
          <ul style="margin:4px 0 0;padding-left:18px;">
            ${group.items.map((item) => `<li style="font-size:12px;line-height:1.55;color:#3f3f46;margin-bottom:3px;">${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>`,
        )
        .join('');
      const body = block.body
        ? `<p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:#3f3f46;">${escapeHtml(block.body)}</p>`
        : '';
      return `
      <div style="margin-top:14px;">
        <div style="font-size:13px;font-weight:700;color:#5b21b6;">${escapeHtml(block.heading)}</div>
        ${body}
        ${bullets}
      </div>`;
    })
    .join('');

  return `
  <div data-pdf-section="disclaimer" style="page-break-inside:avoid;background:#ffffff;border:1px solid #e4e4e7;border-top:3px solid #5b21b6;border-radius:10px;padding:20px 22px;margin-top:24px;">
    <h2 style="margin:0;font-size:17px;color:#111111;">${escapeHtml(d.title)}</h2>
    <p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:#52525b;">${escapeHtml(d.intro)}</p>
    ${blocks}
    <p style="margin:16px 0 0;padding-top:10px;border-top:1px solid #e4e4e7;font-size:11px;line-height:1.55;color:#71717a;">${escapeHtml(d.footerNote)}</p>
  </div>`;
}

/** Ajoute la section de disclaimer en dernière page d'un document jsPDF. */
export function addDisclaimerPage(doc: any, ctx: DisclaimerContext): void {
  const d = buildDisclaimer(ctx);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const usable = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 30;

  doc.addPage();
  let y = 24;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = 24;
    }
  };

  const writeParagraph = (text: string, size: number, color: [number, number, number], indent = 0) => {
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines: string[] = doc.splitTextToSize(text, usable - indent);
    const lineHeight = size * 0.42 + 1.4;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(17, 17, 17);
  doc.text(d.title, margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  writeParagraph(d.intro, 9.5, [90, 90, 95]);
  y += 3;

  for (const block of d.blocks) {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(91, 33, 182);
    doc.text(block.heading, margin, y);
    y += 5.5;
    doc.setFont('helvetica', 'normal');

    if (block.body) writeParagraph(block.body, 9.5, [63, 63, 70]);

    for (const group of block.bullets || []) {
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(26, 26, 26);
      doc.text(group.label, margin, y);
      y += 4.6;
      doc.setFont('helvetica', 'normal');
      for (const item of group.items) {
        ensureSpace(6);
        doc.setFontSize(9.5);
        doc.setTextColor(63, 63, 70);
        doc.text('-', margin + 2, y);
        writeParagraph(item, 9.5, [63, 63, 70], 6);
        y += 1;
      }
    }
    y += 3.5;
  }

  ensureSpace(10);
  y += 2;
  doc.setDrawColor(220, 220, 224);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  writeParagraph(d.footerNote, 8.5, [113, 113, 122]);
}
