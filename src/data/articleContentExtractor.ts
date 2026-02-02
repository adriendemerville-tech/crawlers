// Extraction du contenu textuel des articles statiques pour l'édition
// Ce fichier convertit le contenu JSX en HTML/Markdown éditable

export interface ExtractedArticleContent {
  html: string;
  markdown: string;
}

// Contenu extrait manuellement des articles statiques en HTML pur
// Ce contenu peut être édité directement depuis l'admin
export const extractedArticleContents: Record<string, { fr: string; en: string; es: string }> = {
  'guide-visibilite-technique-ia': {
    fr: `<p class="lead">En 2026, avoir un site rapide ne suffit plus. Si votre infrastructure technique n'est pas lisible par les bots d'IA, vous n'existez tout simplement pas dans les réponses générées par ChatGPT, Perplexity ou Google SGE. Ce guide exhaustif couvre les 3 piliers de l'infrastructure GEO indispensable pour toute entreprise qui souhaite rester visible dans l'ère des moteurs de réponse.</p>

<h2>1. Le Robots.txt : N'utilisez plus les règles de 2020</h2>

<p>La plupart des sites web bloquent encore les crawlers IA par habitude ou par méconnaissance. Or, bloquer GPTBot aujourd'hui, c'est littéralement refuser d'apparaître dans la réponse par défaut de millions d'utilisateurs qui posent des questions à ChatGPT chaque jour. Il faut impérativement passer d'une logique de protection défensive à une logique de curation stratégique de votre contenu.</p>

<p>Les directives Disallow sont héritées d'une époque révolue où le seul risque était le scraping malveillant de vos données. Aujourd'hui, ne pas être lu par les bots IA signifie ne pas exister dans leurs réponses. C'est comme refuser que Google indexe votre site en 2010 : un suicide commercial. Revoyez vos règles avec une vision stratégique qui distingue clairement les bots de navigation (à autoriser) des bots d'entraînement (à contrôler).</p>

<h3>Principaux User-Agents IA à configurer</h3>
<ul>
  <li><strong>GPTBot (OpenAI)</strong> : Entraînement des modèles</li>
  <li><strong>ChatGPT-User</strong> : Navigation temps réel - ESSENTIEL</li>
  <li><strong>Google-Extended</strong> : Gemini / Bard - ESSENTIEL</li>
  <li><strong>ClaudeBot</strong> : Anthropic Claude</li>
  <li><strong>CCBot (Common Crawl)</strong> : Base pour LLM tiers</li>
</ul>

<h2>2. JSON-LD : Nourrir la bête avec de la donnée structurée</h2>

<p>Le Schema Markup n'est plus une option réservée aux grandes entreprises tech. C'est devenu le seul moyen fiable de garantir que Perplexity ou Google SGE comprennent précisément ce que vous vendez, qui vous êtes, et pourquoi vous êtes une source fiable. Sans JSON-LD, vous laissez l'IA deviner le sens de votre contenu. Et l'IA devine souvent mal, générant des informations incorrectes ou vous ignorant complètement.</p>

<p>Intégrez des balises JSON-LD pour chaque type de contenu que vous publiez : Article pour vos contenus éditoriaux, Product pour vos fiches produits, LocalBusiness pour votre présence locale, FAQPage pour vos questions fréquentes, Organization pour votre identité d'entreprise. Les LLM extraient ces données structurées en priorité absolue pour construire leurs réponses, car elles représentent une information vérifiée et sans ambiguïté.</p>

<p>Le format JSON-LD est particulièrement apprécié car il se place dans une balise script séparée, sans polluer votre HTML visible. Il est lisible par les machines tout en restant invisible pour vos visiteurs humains. C'est la méthode recommandée par Google depuis 2020, et elle est aujourd'hui adoptée par tous les moteurs génératifs comme standard de facto.</p>

<h2>3. Sitemaps : L'indexation instantanée</h2>

<p>Un sitemap XML bien structuré accélère considérablement la découverte de vos nouvelles pages par les bots IA. Contrairement aux idées reçues, les moteurs génératifs ne crawlent pas votre site en continu : ils effectuent des passes périodiques et utilisent votre sitemap comme point d'entrée principal. Incluez systématiquement les dates de dernière modification (lastmod) et les priorités relatives pour guider les crawlers vers votre contenu le plus stratégique en premier.</p>

<p>Pensez également à créer des sitemaps spécialisés : un sitemap pour vos articles de blog, un autre pour vos pages produits, un troisième pour vos pages institutionnelles. Cette segmentation permet aux bots de comprendre l'architecture de votre site et de prioriser le contenu pertinent. Un site e-commerce avec 10 000 produits doit impérativement avoir un sitemap produits distinct du sitemap éditorial.</p>

<p>La mise à jour automatique de votre sitemap est cruciale. Chaque nouvelle page publiée doit y apparaître dans les minutes qui suivent. Utilisez des plugins ou des scripts automatisés pour maintenir cette fraîcheur. Les bots IA favorisent les sites qui démontrent une activité régulière et une maintenance technique soignée.</p>

<blockquote>"En 2026, plus de 60% des réponses générées par l'IA proviennent de sources avec des données structurées complètes. Le JSON-LD n'est plus optionnel, c'est le ticket d'entrée minimum pour exister dans l'écosystème des moteurs génératifs."</blockquote>`,

    en: `<p class="lead">In 2026, having a fast site is no longer enough. If your technical infrastructure is not readable by AI bots, you simply don't exist in the generated responses from ChatGPT, Perplexity or Google SGE. This comprehensive guide covers the 3 pillars of essential GEO infrastructure for any business that wants to stay visible in the age of answer engines.</p>

<h2>1. Robots.txt: Stop Using 2020 Rules</h2>

<p>Most websites still block AI crawlers out of habit or ignorance. But blocking GPTBot today literally means refusing to appear in the default response of millions of users who ask questions to ChatGPT every day. You must shift from a defensive protection logic to a strategic content curation logic.</p>

<p>Disallow directives are inherited from an era when malicious data scraping was the only risk. Today, not being read by AI bots means not existing in their responses. It's like refusing Google to index your site in 2010: commercial suicide. Review your rules with a strategic vision that clearly distinguishes browsing bots (to allow) from training bots (to control).</p>

<h2>2. JSON-LD: Feed the Beast with Structured Data</h2>

<p>Schema Markup is no longer an option reserved for large tech companies. It has become the only reliable way to ensure that Perplexity or Google SGE precisely understand what you sell, who you are, and why you are a reliable source.</p>

<h2>3. Sitemaps: Instant Indexing</h2>

<p>A well-structured XML sitemap significantly accelerates the discovery of your new pages by AI bots. Contrary to popular belief, generative engines don't crawl your site continuously: they make periodic passes and use your sitemap as the main entry point.</p>

<blockquote>"In 2026, over 60% of AI-generated responses come from sources with complete structured data. JSON-LD is no longer optional, it's the minimum entry ticket to exist in the generative engine ecosystem."</blockquote>`,

    es: `<p class="lead">En 2026, tener un sitio rápido ya no es suficiente. Si su infraestructura técnica no es legible por los bots de IA, simplemente no existe en las respuestas generadas por ChatGPT, Perplexity o Google SGE.</p>

<h2>1. Robots.txt: Deja de usar las reglas de 2020</h2>

<p>La mayoría de los sitios web todavía bloquean los crawlers de IA por hábito o ignorancia. Pero bloquear GPTBot hoy significa literalmente rechazar aparecer en la respuesta predeterminada de millones de usuarios.</p>

<h2>2. JSON-LD: Alimenta a la bestia con datos estructurados</h2>

<p>El Schema Markup ya no es una opción reservada para grandes empresas tecnológicas. Se ha convertido en la única forma fiable de garantizar que Perplexity o Google SGE entiendan precisamente lo que vendes.</p>

<h2>3. Sitemaps: Indexación instantánea</h2>

<p>Un sitemap XML bien estructurado acelera significativamente el descubrimiento de tus nuevas páginas por los bots de IA.</p>`
  },

  'comprendre-geo-vs-seo': {
    fr: `<p class="lead">Le SEO consistait à être trouvé. Le GEO consiste à être cité. Découvrez le changement de paradigme le plus violent de l'histoire du web et comment en tirer profit sans budget publicitaire.</p>

<h2>La différence fondamentale : Classer vs Générer</h2>

<p>Le SEO traditionnel optimise pour apparaître dans une liste de liens. Le GEO optimise pour être intégré directement dans une réponse générée. C'est la différence entre être sur une étagère de bibliothèque et être cité dans un livre. Le premier vous rend accessible, le second vous rend incontournable.</p>

<p>Quand un utilisateur pose une question à ChatGPT ou Perplexity, il n'obtient pas 10 liens bleus : il obtient une réponse synthétique. Si vous n'êtes pas dans cette réponse, vous n'existez pas pour cet utilisateur. Point final.</p>

<h2>Pourquoi l'autorité sémantique remplace le volume de recherche</h2>

<p>En SEO, on ciblait des mots-clés avec du volume. En GEO, on construit une autorité thématique reconnue par les LLM. Les backlinks comptent moins que la cohérence de votre discours et la profondeur de votre expertise démontrée.</p>

<p>Les LLM évaluent votre crédibilité en analysant la consistance de vos affirmations à travers tout votre corpus. Un site qui dit une chose sur une page et son contraire sur une autre sera considéré comme peu fiable. La cohérence éditoriale devient un facteur de ranking majeur.</p>

<h2>Comparaison SEO vs GEO</h2>

<table>
  <tr><th>Facteur</th><th>SEO</th><th>GEO</th></tr>
  <tr><td>Objectif principal</td><td>Être cliqué (trafic)</td><td>Être cité (influence)</td></tr>
  <tr><td>KPI principal</td><td>Position SERP, CTR</td><td>Fréquence de citation</td></tr>
  <tr><td>Données structurées</td><td>Recommandé</td><td>Obligatoire (JSON-LD)</td></tr>
  <tr><td>Autorité auteur (E-E-A-T)</td><td>Important</td><td>Critique pour la citation</td></tr>
  <tr><td>Backlinks</td><td>Facteur majeur</td><td>Trust signal secondaire</td></tr>
</table>

<h2>Comment adapter votre stratégie dès aujourd'hui</h2>

<p>Commencez par auditer votre présence dans les réponses IA. Posez des questions liées à votre expertise sur ChatGPT, Perplexity, et Google SGE. Êtes-vous cité ? Si non, identifiez qui l'est et analysez pourquoi.</p>

<p>Ensuite, restructurez votre contenu pour répondre aux questions, pas pour cibler des mots-clés. Les LLM cherchent des réponses claires, pas des pages optimisées artificiellement. Privilégiez la profondeur sur la quantité.</p>

<blockquote>"Le SEO vous rendait visible dans une liste. Le GEO vous rend indispensable dans une conversation."</blockquote>`,

    en: `<p class="lead">SEO was about being found. GEO is about being cited. Discover the most violent paradigm shift in web history and how to profit from it without an advertising budget.</p>

<h2>The Fundamental Difference: Ranking vs Generating</h2>

<p>Traditional SEO optimizes to appear in a list of links. GEO optimizes to be integrated directly into a generated response. It's the difference between being on a library shelf and being cited in a book.</p>

<h2>Why Semantic Authority Replaces Search Volume</h2>

<p>In SEO, we targeted keywords with volume. In GEO, we build thematic authority recognized by LLMs. Backlinks count less than the consistency of your discourse and the depth of your demonstrated expertise.</p>

<h2>How to Adapt Your Strategy Today</h2>

<p>Start by auditing your presence in AI responses. Ask questions related to your expertise on ChatGPT, Perplexity, and Google SGE. Are you cited? If not, identify who is and analyze why.</p>

<blockquote>"SEO made you visible in a list. GEO makes you indispensable in a conversation."</blockquote>`,

    es: `<p class="lead">El SEO consistía en ser encontrado. El GEO consiste en ser citado. Descubre el cambio de paradigma más violento de la historia web.</p>

<h2>La diferencia fundamental: Clasificar vs Generar</h2>

<p>El SEO tradicional optimiza para aparecer en una lista de enlaces. El GEO optimiza para ser integrado directamente en una respuesta generada.</p>

<h2>Por qué la autoridad semántica reemplaza el volumen de búsqueda</h2>

<p>En SEO, nos enfocábamos en palabras clave con volumen. En GEO, construimos autoridad temática reconocida por los LLM.</p>`
  },

  'optimiser-contenu-reponses-ia': {
    fr: `<p class="lead">Créer du contenu en 2026 exige une approche radicalement différente. Les moteurs génératifs ne cherchent plus des pages, ils cherchent des réponses. Voici comment adapter votre production éditoriale.</p>

<h2>La structure de contenu idéale pour les LLM</h2>

<p>Les LLM favorisent les contenus qui répondent directement aux questions. Commencez chaque section par la réponse, puis développez. Cette structure "pyramide inversée" correspond exactement à la façon dont les IA extraient l'information.</p>

<p>Utilisez des listes à puces pour les étapes et les caractéristiques. Les LLM les parsent facilement et les intègrent souvent verbatim dans leurs réponses. Une liste bien structurée a plus de chances d'être citée qu'un paragraphe dense.</p>

<h2>L'importance des définitions claires</h2>

<p>Chaque terme technique devrait avoir une définition explicite la première fois qu'il apparaît. Les LLM utilisent ces définitions pour calibrer leur compréhension de votre contenu et décider de votre niveau d'expertise.</p>

<h2>Optimiser pour les questions fréquentes</h2>

<p>Créez des sections FAQ avec des questions formulées naturellement. Les utilisateurs posent des questions aux IA en langage naturel - votre contenu doit correspondre à ces formulations pour être sélectionné comme source.</p>

<blockquote>"Un contenu optimisé GEO répond à la question avant de l'expliquer. C'est l'inverse du suspense narratif : donnez la conclusion d'abord."</blockquote>`,

    en: `<p class="lead">Creating content in 2026 requires a radically different approach. Generative engines no longer look for pages, they look for answers.</p>

<h2>The Ideal Content Structure for LLMs</h2>

<p>LLMs favor content that directly answers questions. Start each section with the answer, then elaborate. This "inverted pyramid" structure matches exactly how AIs extract information.</p>

<h2>The Importance of Clear Definitions</h2>

<p>Every technical term should have an explicit definition the first time it appears. LLMs use these definitions to calibrate their understanding of your content.</p>`,

    es: `<p class="lead">Crear contenido en 2026 requiere un enfoque radicalmente diferente. Los motores generativos ya no buscan páginas, buscan respuestas.</p>

<h2>La estructura de contenido ideal para LLM</h2>

<p>Los LLM favorecen el contenido que responde directamente a las preguntas. Comience cada sección con la respuesta, luego desarrolle.</p>`
  },

  'hallucinations-ia-guide': {
    fr: `<p class="lead">Les hallucinations IA représentent un risque majeur pour votre réputation. Quand ChatGPT invente des informations sur votre entreprise, les utilisateurs les prennent pour argent comptant. Voici comment les détecter et les corriger.</p>

<h2>Qu'est-ce qu'une hallucination IA ?</h2>

<p>Une hallucination se produit quand un LLM génère des informations factuellement incorrectes avec une apparence de certitude. Contrairement à une erreur humaine, l'IA ne signale pas son incertitude - elle affirme avec la même confiance que l'information soit vraie ou inventée.</p>

<h2>Les types d'hallucinations les plus dangereux</h2>

<ul>
  <li><strong>Hallucinations d'attribution</strong> : L'IA vous attribue des propos ou des actions que vous n'avez jamais tenus</li>
  <li><strong>Hallucinations factuelles</strong> : Prix, dates, caractéristiques produit incorrects</li>
  <li><strong>Hallucinations de relation</strong> : Partenariats ou affiliations inventés</li>
</ul>

<h2>Comment diagnostiquer les hallucinations sur votre marque</h2>

<p>Posez régulièrement des questions sur votre entreprise aux principaux LLM. Variez les formulations et notez les réponses. Comparez avec vos informations officielles. Toute divergence est potentiellement une hallucination propagée à chaque interaction utilisateur.</p>

<h2>Stratégies de correction</h2>

<p>Publiez des pages FAQ structurées avec les informations correctes en JSON-LD. Les LLM privilégient les sources avec données structurées pour éviter les erreurs. Plus votre information est explicite et structurée, moins elle sera "devinée" incorrectement.</p>

<blockquote>"Une hallucination non corrigée est une désinformation active. Chaque jour sans action, des milliers d'utilisateurs reçoivent de fausses informations sur votre marque."</blockquote>`,

    en: `<p class="lead">AI hallucinations represent a major risk for your reputation. When ChatGPT invents information about your company, users take it as truth.</p>

<h2>What is an AI Hallucination?</h2>

<p>A hallucination occurs when an LLM generates factually incorrect information with an appearance of certainty. Unlike human error, the AI doesn't signal its uncertainty.</p>

<h2>The Most Dangerous Types of Hallucinations</h2>

<ul>
  <li><strong>Attribution hallucinations</strong>: The AI attributes statements or actions to you that you never made</li>
  <li><strong>Factual hallucinations</strong>: Incorrect prices, dates, product features</li>
  <li><strong>Relationship hallucinations</strong>: Invented partnerships or affiliations</li>
</ul>`,

    es: `<p class="lead">Las alucinaciones de IA representan un riesgo importante para tu reputación. Cuando ChatGPT inventa información sobre tu empresa, los usuarios la toman como verdad.</p>

<h2>¿Qué es una alucinación de IA?</h2>

<p>Una alucinación ocurre cuando un LLM genera información factualmente incorrecta con apariencia de certeza.</p>`
  },

  'audit-seo-technique-2026': {
    fr: `<p class="lead">Un audit SEO technique en 2026 doit intégrer les exigences des moteurs génératifs. Les critères traditionnels restent valides, mais de nouveaux facteurs sont désormais critiques.</p>

<h2>Les fondamentaux toujours d'actualité</h2>

<p>Vitesse de chargement, Core Web Vitals, structure de liens internes, maillage sémantique - ces bases restent essentielles. Un site lent ou mal structuré sera ignoré par les bots IA comme par Google.</p>

<h2>Les nouveaux critères GEO à auditer</h2>

<ul>
  <li><strong>Accessibilité aux bots IA</strong> : Vérifiez que GPTBot, ClaudeBot et Google-Extended ne sont pas bloqués</li>
  <li><strong>Complétude du JSON-LD</strong> : Article, Organization, Product, FAQ - tous les schémas pertinents sont-ils présents ?</li>
  <li><strong>Cohérence des informations</strong> : Les mêmes données (adresse, téléphone, prix) sont-elles identiques partout ?</li>
  <li><strong>Fraîcheur des contenus</strong> : Dates de mise à jour visibles et cohérentes avec lastmod du sitemap</li>
</ul>

<h2>Outils d'audit recommandés</h2>

<p>Utilisez notre outil Crawlers.fr pour un audit automatisé de votre visibilité IA. Il vérifie l'accessibilité aux bots, la qualité du JSON-LD, et teste votre présence dans les réponses des principaux LLM.</p>

<blockquote>"Un audit SEO sans dimension GEO en 2026, c'est comme auditer un site mobile sans tester sur smartphone."</blockquote>`,

    en: `<p class="lead">A technical SEO audit in 2026 must integrate the requirements of generative engines. Traditional criteria remain valid, but new factors are now critical.</p>

<h2>Fundamentals Still Relevant</h2>

<p>Loading speed, Core Web Vitals, internal link structure, semantic linking - these basics remain essential.</p>

<h2>New GEO Criteria to Audit</h2>

<ul>
  <li><strong>AI bot accessibility</strong>: Check that GPTBot, ClaudeBot and Google-Extended are not blocked</li>
  <li><strong>JSON-LD completeness</strong>: Are all relevant schemas present?</li>
  <li><strong>Information consistency</strong>: Is the same data identical everywhere?</li>
</ul>`,

    es: `<p class="lead">Una auditoría SEO técnica en 2026 debe integrar los requisitos de los motores generativos.</p>

<h2>Fundamentos aún relevantes</h2>

<p>Velocidad de carga, Core Web Vitals, estructura de enlaces internos - estas bases siguen siendo esenciales.</p>`
  },

  'google-sge-impact-trafic': {
    fr: `<p class="lead">Google SGE (Search Generative Experience) transforme radicalement les pages de résultats. Les premiers clics organiques sont désormais précédés d'une réponse IA qui capture l'attention. Impact sur votre trafic : potentiellement dévastateur ou opportunité majeure.</p>

<h2>Comment fonctionne Google SGE</h2>

<p>SGE génère une réponse synthétique en haut de page avant d'afficher les résultats traditionnels. Cette réponse cite parfois des sources - être cité ici devient le nouveau Graal du SEO. Ne pas être cité signifie perdre le premier contact avec l'utilisateur.</p>

<h2>L'impact mesuré sur le CTR</h2>

<p>Les études montrent une baisse de 20 à 40% du CTR sur les positions organiques traditionnelles quand SGE est affiché. Les utilisateurs obtiennent leur réponse sans cliquer. Seules les sources citées dans la réponse SGE maintiennent ou augmentent leur trafic.</p>

<h2>Stratégies d'adaptation</h2>

<p>Optimisez pour être la source citée, pas le lien cliqué. Cela signifie : données structurées impeccables, contenu qui répond directement aux questions, autorité thématique démontrée, fraîcheur des informations.</p>

<blockquote>"Dans l'ère SGE, le trafic ne vient plus de votre position mais de votre citation. Le ranking cède la place au sourcing."</blockquote>`,

    en: `<p class="lead">Google SGE (Search Generative Experience) is radically transforming result pages. The first organic clicks are now preceded by an AI response that captures attention.</p>

<h2>How Google SGE Works</h2>

<p>SGE generates a synthetic response at the top of the page before displaying traditional results. This response sometimes cites sources - being cited here becomes the new SEO Holy Grail.</p>

<h2>Measured Impact on CTR</h2>

<p>Studies show a 20-40% drop in CTR on traditional organic positions when SGE is displayed. Users get their answer without clicking.</p>`,

    es: `<p class="lead">Google SGE (Search Generative Experience) está transformando radicalmente las páginas de resultados.</p>

<h2>Cómo funciona Google SGE</h2>

<p>SGE genera una respuesta sintética en la parte superior de la página antes de mostrar los resultados tradicionales.</p>`
  }
};

// Fonction pour obtenir le contenu extrait d'un article
export function getExtractedContent(slug: string, language: 'fr' | 'en' | 'es' = 'fr'): string | null {
  const content = extractedArticleContents[slug];
  if (!content) return null;
  return content[language] || content.fr;
}

// Liste des slugs disponibles
export function getAvailableExtractedSlugs(): string[] {
  return Object.keys(extractedArticleContents);
}
