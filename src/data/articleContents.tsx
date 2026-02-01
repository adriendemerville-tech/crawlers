import { SummaryBox, RichLink } from '@/components/Blog';

// Contenu des articles - structure par slug
export const articleContent: Record<string, { fr: JSX.Element; en: JSX.Element; es: JSX.Element }> = {
  // --- PILIER 1: Guide Visibilité Technique IA ---
  'guide-visibilite-technique-ia': {
    fr: (
      <>
        <SummaryBox
          points={[
            'Pourquoi votre robots.txt bloque peut-être vos meilleures opportunités.',
            'Le JSON-LD : la langue maternelle des LLM expliquée.',
            'Comment structurer un sitemap pour une indexation instantanée.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          En 2026, avoir un site rapide ne suffit plus. Si votre infrastructure technique n'est pas lisible par les bots d'IA, vous n'existez pas. Ce guide couvre les 3 piliers de l'infrastructure GEO indispensable.
        </p>

        <h2>1. Le Robots.txt : N'utilisez plus les règles de 2020</h2>
        <p>
          La plupart des sites bloquent encore les crawlers par habitude. Or, bloquer GPTBot aujourd'hui, c'est refuser d'apparaître dans la réponse par défaut de millions d'utilisateurs. Il faut passer d'une logique de protection à une logique de curation.
        </p>
        <p>
          Les directives Disallow sont héritées d'une époque où le seul risque était le scraping. Aujourd'hui, ne pas être lu par les bots IA signifie ne pas exister dans leurs réponses. Revoyez vos règles avec une vision stratégique.
        </p>

        <RichLink
          href="/audit-expert"
          title="Lancer un audit IA gratuit"
          description="Analysez votre robots.txt et votre visibilité IA en quelques minutes"
        />

        <h2>2. JSON-LD : Nourrir la bête avec de la donnée structurée</h2>
        <p>
          Le Schema Markup n'est plus une option. C'est le seul moyen de garantir que Perplexity ou Google SGE comprennent que vous vendez un produit et non un service. Sans JSON-LD, vous laissez l'IA deviner. Et l'IA devine souvent mal.
        </p>
        <p>
          Intégrez des balises JSON-LD pour chaque type de contenu : Article, Product, LocalBusiness, FAQPage. Les LLM extraient ces données structurées en priorité pour construire leurs réponses.
        </p>

        <h2>3. Sitemaps : L'indexation instantanée</h2>
        <p>
          Un sitemap XML bien structuré accélère la découverte de vos nouvelles pages par les bots. Incluez les dates de dernière modification et les priorités pour guider les crawlers vers votre contenu le plus important.
        </p>

        <blockquote>
          "En 2026, 60% des réponses générées par l'IA proviennent de sources avec des données structurées complètes. Le JSON-LD n'est plus optionnel."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            'Why your robots.txt might be blocking your best opportunities.',
            'JSON-LD: the native language of LLMs explained.',
            'How to structure a sitemap for instant indexing.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          In 2026, having a fast site is no longer enough. If your technical infrastructure is not readable by AI bots, you don't exist. This guide covers the 3 pillars of essential GEO infrastructure.
        </p>

        <h2>1. Robots.txt: Stop Using 2020 Rules</h2>
        <p>
          Most sites still block crawlers out of habit. But blocking GPTBot today means refusing to appear in the default response of millions of users. You need to shift from a protection logic to a curation logic.
        </p>
        <p>
          Disallow directives are inherited from an era when scraping was the only risk. Today, not being read by AI bots means not existing in their responses. Review your rules with a strategic vision.
        </p>

        <RichLink
          href="/audit-expert"
          title="Launch a free AI audit"
          description="Analyze your robots.txt and AI visibility in minutes"
        />

        <h2>2. JSON-LD: Feed the Beast with Structured Data</h2>
        <p>
          Schema Markup is no longer optional. It's the only way to ensure that Perplexity or Google SGE understand that you're selling a product and not a service. Without JSON-LD, you let AI guess. And AI often guesses wrong.
        </p>
        <p>
          Integrate JSON-LD tags for each content type: Article, Product, LocalBusiness, FAQPage. LLMs extract this structured data as a priority to build their responses.
        </p>

        <h2>3. Sitemaps: Instant Indexing</h2>
        <p>
          A well-structured XML sitemap accelerates the discovery of your new pages by bots. Include last modification dates and priorities to guide crawlers to your most important content.
        </p>

        <blockquote>
          "In 2026, 60% of AI-generated responses come from sources with complete structured data. JSON-LD is no longer optional."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            'Por qué tu robots.txt podría estar bloqueando tus mejores oportunidades.',
            'JSON-LD: el idioma nativo de los LLM explicado.',
            'Cómo estructurar un sitemap para indexación instantánea.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          En 2026, tener un sitio rápido ya no es suficiente. Si tu infraestructura técnica no es legible por los bots de IA, no existes. Esta guía cubre los 3 pilares de la infraestructura GEO esencial.
        </p>

        <h2>1. Robots.txt: Deja de Usar las Reglas de 2020</h2>
        <p>
          La mayoría de los sitios todavía bloquean crawlers por costumbre. Pero bloquear GPTBot hoy significa negarse a aparecer en la respuesta predeterminada de millones de usuarios. Necesitas pasar de una lógica de protección a una lógica de curación.
        </p>
        <p>
          Las directivas Disallow se heredan de una era donde el scraping era el único riesgo. Hoy, no ser leído por bots de IA significa no existir en sus respuestas. Revisa tus reglas con una visión estratégica.
        </p>

        <RichLink
          href="/audit-expert"
          title="Lanza una auditoría IA gratuita"
          description="Analiza tu robots.txt y visibilidad IA en minutos"
        />

        <h2>2. JSON-LD: Alimenta a la Bestia con Datos Estructurados</h2>
        <p>
          El Schema Markup ya no es opcional. Es la única forma de garantizar que Perplexity o Google SGE entiendan que vendes un producto y no un servicio. Sin JSON-LD, dejas que la IA adivine. Y la IA a menudo adivina mal.
        </p>
        <p>
          Integra etiquetas JSON-LD para cada tipo de contenido: Article, Product, LocalBusiness, FAQPage. Los LLM extraen estos datos estructurados como prioridad para construir sus respuestas.
        </p>

        <h2>3. Sitemaps: Indexación Instantánea</h2>
        <p>
          Un sitemap XML bien estructurado acelera el descubrimiento de tus nuevas páginas por los bots. Incluye fechas de última modificación y prioridades para guiar a los crawlers hacia tu contenido más importante.
        </p>

        <blockquote>
          "En 2026, el 60% de las respuestas generadas por IA provienen de fuentes con datos estructurados completos. JSON-LD ya no es opcional."
        </blockquote>
      </>
    ),
  },

  // --- PILIER 2: Comprendre GEO vs SEO ---
  'comprendre-geo-vs-seo': {
    fr: (
      <>
        <SummaryBox
          points={[
            'La différence fondamentale entre classer des liens et générer des réponses.',
            'Pourquoi l\'autorité sémantique remplace le volume de recherche.',
            'Comment adapter votre stratégie de contenu dès aujourd\'hui.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Le SEO consistait à être trouvé. Le GEO consiste à être cité. Découvrez le changement de paradigme le plus violent de l'histoire du web et comment en tirer profit sans budget publicitaire.
        </p>

        <h2>De la recherche à la réponse : Comprendre l'intention</h2>
        <p>
          L'utilisateur ne veut plus chercher, il veut savoir. Les moteurs de réponse comme Perplexity ou SGE synthétisent l'information. Votre but n'est plus d'être le lien sur lequel on clique, mais la source que l'IA utilise pour construire sa réponse.
        </p>
        <p>
          Cette évolution transforme fondamentalement la façon dont le contenu doit être créé. La clarté, la précision et l'autorité deviennent les nouveaux facteurs de ranking.
        </p>

        <RichLink
          href="/audit-expert"
          title="Votre site est-il optimisé GEO ?"
          description="Testez gratuitement votre visibilité sur les moteurs génératifs"
        />

        <h2>Les nouveaux facteurs de classement des moteurs génératifs</h2>
        <p>
          Les mots-clés perdent du terrain face aux "Entités". L'algorithme cherche à relier votre marque à des concepts d'expertise (E-E-A-T). La cohérence de votre discours sur l'ensemble du site compte plus qu'une page isolée optimisée.
        </p>
        <p>
          Les citations externes, les mentions de marque et la structure sémantique de votre contenu déterminent maintenant votre visibilité dans les réponses IA.
        </p>

        <h2>Adapter sa stratégie de contenu</h2>
        <p>
          Créez du contenu qui répond directement aux questions des utilisateurs. Structurez vos articles avec des formats facilement extractibles : listes, tableaux, définitions claires. L'IA doit pouvoir synthétiser votre expertise en quelques phrases.
        </p>

        <blockquote>
          "En 2025, 40% des recherches web passeront par des interfaces conversationnelles. Ignorer le GEO, c'est ignorer près de la moitié de votre audience potentielle."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            'The fundamental difference between ranking links and generating responses.',
            'Why semantic authority replaces search volume.',
            'How to adapt your content strategy today.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          SEO was about being found. GEO is about being cited. Discover the most violent paradigm shift in web history and how to profit from it without an advertising budget.
        </p>

        <h2>From Search to Answer: Understanding Intent</h2>
        <p>
          Users no longer want to search, they want to know. Answer engines like Perplexity or SGE synthesize information. Your goal is no longer to be the link that gets clicked, but the source that AI uses to build its response.
        </p>
        <p>
          This evolution fundamentally transforms how content must be created. Clarity, precision, and authority become the new ranking factors.
        </p>

        <RichLink
          href="/audit-expert"
          title="Is your site GEO optimized?"
          description="Test your visibility on generative engines for free"
        />

        <h2>The New Ranking Factors for Generative Engines</h2>
        <p>
          Keywords are losing ground to "Entities". The algorithm seeks to connect your brand to concepts of expertise (E-E-A-T). The consistency of your message across the entire site matters more than a single optimized page.
        </p>
        <p>
          External citations, brand mentions, and the semantic structure of your content now determine your visibility in AI responses.
        </p>

        <h2>Adapting Your Content Strategy</h2>
        <p>
          Create content that directly answers user questions. Structure your articles with easily extractable formats: lists, tables, clear definitions. AI must be able to synthesize your expertise in a few sentences.
        </p>

        <blockquote>
          "In 2025, 40% of web searches will go through conversational interfaces. Ignoring GEO means ignoring nearly half of your potential audience."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            'La diferencia fundamental entre clasificar enlaces y generar respuestas.',
            'Por qué la autoridad semántica reemplaza el volumen de búsqueda.',
            'Cómo adaptar tu estrategia de contenido hoy.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          El SEO consistía en ser encontrado. El GEO consiste en ser citado. Descubre el cambio de paradigma más violento de la historia web y cómo aprovecharlo sin presupuesto publicitario.
        </p>

        <h2>De la Búsqueda a la Respuesta: Entender la Intención</h2>
        <p>
          El usuario ya no quiere buscar, quiere saber. Los motores de respuesta como Perplexity o SGE sintetizan la información. Tu objetivo ya no es ser el enlace en el que se hace clic, sino la fuente que la IA usa para construir su respuesta.
        </p>
        <p>
          Esta evolución transforma fundamentalmente cómo debe crearse el contenido. La claridad, precisión y autoridad se convierten en los nuevos factores de ranking.
        </p>

        <RichLink
          href="/audit-expert"
          title="¿Tu sitio está optimizado para GEO?"
          description="Prueba gratis tu visibilidad en motores generativos"
        />

        <h2>Los Nuevos Factores de Clasificación de los Motores Generativos</h2>
        <p>
          Las palabras clave pierden terreno frente a las "Entidades". El algoritmo busca conectar tu marca con conceptos de experiencia (E-E-A-T). La coherencia de tu mensaje en todo el sitio importa más que una página aislada optimizada.
        </p>
        <p>
          Las citas externas, las menciones de marca y la estructura semántica de tu contenido ahora determinan tu visibilidad en las respuestas de IA.
        </p>

        <h2>Adaptar tu Estrategia de Contenido</h2>
        <p>
          Crea contenido que responda directamente a las preguntas de los usuarios. Estructura tus artículos con formatos fácilmente extraíbles: listas, tablas, definiciones claras. La IA debe poder sintetizar tu experiencia en unas pocas frases.
        </p>

        <blockquote>
          "En 2025, el 40% de las búsquedas web pasarán por interfaces conversacionales. Ignorar el GEO significa ignorar casi la mitad de tu audiencia potencial."
        </blockquote>
      </>
    ),
  },

  // --- PILIER 3: Vendre Audit IA Clients ---
  'vendre-audit-ia-clients': {
    fr: (
      <>
        <SummaryBox
          points={[
            'L\'argumentaire imparable pour vendre une mission de mise aux normes IA.',
            'Les livrables attendus pour un audit GEO.',
            'Comment utiliser l\'automatisation pour augmenter vos marges.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Vos clients entendent parler de l'IA partout. Soyez celui qui sécurise leur avenir numérique. Voici la feuille de route précise pour intégrer l'offre "Visibilité IA" à votre catalogue de services dès demain.
        </p>

        <h2>L'opportunité commerciale : La peur de l'invisibilité</h2>
        <p>
          Pour un client, savoir que son concurrent est cité par ChatGPT et pas lui est une douleur insupportable. C'est votre levier de vente. Ne vendez pas de la technique, vendez de la présence dans le futur du search.
        </p>
        <p>
          Positionnez-vous comme l'expert qui peut garantir que leur marque existe dans les réponses générées par l'IA. C'est une proposition de valeur immédiate et mesurable.
        </p>

        <RichLink
          href="/audit-expert"
          title="Outil d'audit pour consultants"
          description="Générez des rapports en marque blanche pour vos clients"
        />

        <h2>Construire votre rapport d'audit : Les points de contrôle</h2>
        <p>
          Un audit GEO doit vérifier 3 choses : l'accessibilité technique (bots), la clarté sémantique (données structurées) et l'autorité de l'auteur. Utilisez des outils automatisés pour générer ces rapports en marque blanche.
        </p>
        <p>
          Incluez des captures d'écran des réponses ChatGPT mentionnant (ou non) la marque du client. C'est la preuve visuelle la plus convaincante.
        </p>

        <h2>Tarification et livrables</h2>
        <p>
          Un audit GEO initial peut être facturé entre 500€ et 2000€ selon la taille du site. La mise en conformité mensuelle génère des revenus récurrents. Proposez des packages incluant monitoring et corrections continues.
        </p>

        <blockquote>
          "Les agences qui intègrent l'offre 'Visibilité IA' voient leur panier moyen augmenter de 40% et leur taux de conversion prospects de 25%."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            'The unbeatable argument to sell an AI compliance mission.',
            'The expected deliverables for a GEO audit.',
            'How to use automation to increase your margins.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Your clients hear about AI everywhere. Be the one who secures their digital future. Here's the precise roadmap to integrate the "AI Visibility" offer into your service catalog tomorrow.
        </p>

        <h2>The Business Opportunity: The Fear of Invisibility</h2>
        <p>
          For a client, knowing that their competitor is cited by ChatGPT and not them is unbearable pain. This is your sales lever. Don't sell technology, sell presence in the future of search.
        </p>
        <p>
          Position yourself as the expert who can guarantee that their brand exists in AI-generated responses. It's an immediate and measurable value proposition.
        </p>

        <RichLink
          href="/audit-expert"
          title="Audit tool for consultants"
          description="Generate white-label reports for your clients"
        />

        <h2>Building Your Audit Report: The Checkpoints</h2>
        <p>
          A GEO audit must verify 3 things: technical accessibility (bots), semantic clarity (structured data), and author authority. Use automated tools to generate these white-label reports.
        </p>
        <p>
          Include screenshots of ChatGPT responses mentioning (or not) the client's brand. This is the most convincing visual proof.
        </p>

        <h2>Pricing and Deliverables</h2>
        <p>
          An initial GEO audit can be billed between €500 and €2000 depending on the site size. Monthly compliance generates recurring revenue. Offer packages including monitoring and continuous corrections.
        </p>

        <blockquote>
          "Agencies that integrate the 'AI Visibility' offer see their average basket increase by 40% and their prospect conversion rate by 25%."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            'El argumento imbatible para vender una misión de cumplimiento IA.',
            'Los entregables esperados para una auditoría GEO.',
            'Cómo usar la automatización para aumentar tus márgenes.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Sus clientes escuchan sobre IA en todas partes. Sea quien asegure su futuro digital. Aquí está la hoja de ruta precisa para integrar la oferta "Visibilidad IA" a su catálogo de servicios mañana.
        </p>

        <h2>La Oportunidad Comercial: El Miedo a la Invisibilidad</h2>
        <p>
          Para un cliente, saber que su competidor es citado por ChatGPT y él no es un dolor insoportable. Este es tu palanca de ventas. No vendas tecnología, vende presencia en el futuro de la búsqueda.
        </p>
        <p>
          Posiciónate como el experto que puede garantizar que su marca existe en las respuestas generadas por IA. Es una propuesta de valor inmediata y medible.
        </p>

        <RichLink
          href="/audit-expert"
          title="Herramienta de auditoría para consultores"
          description="Genera informes de marca blanca para tus clientes"
        />

        <h2>Construir tu Informe de Auditoría: Los Puntos de Control</h2>
        <p>
          Una auditoría GEO debe verificar 3 cosas: accesibilidad técnica (bots), claridad semántica (datos estructurados) y autoridad del autor. Usa herramientas automatizadas para generar estos informes de marca blanca.
        </p>
        <p>
          Incluye capturas de pantalla de respuestas de ChatGPT mencionando (o no) la marca del cliente. Esta es la prueba visual más convincente.
        </p>

        <h2>Precios y Entregables</h2>
        <p>
          Una auditoría GEO inicial puede facturarse entre 500€ y 2000€ según el tamaño del sitio. El cumplimiento mensual genera ingresos recurrentes. Ofrece paquetes que incluyan monitoreo y correcciones continuas.
        </p>

        <blockquote>
          "Las agencias que integran la oferta 'Visibilidad IA' ven aumentar su ticket promedio en un 40% y su tasa de conversión de prospectos en un 25%."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 1: Bloquer ou Autoriser GPTBot ---
  'bloquer-autoriser-gptbot': {
    fr: (
      <>
        <SummaryBox
          points={[
            'Différence entre GPTBot (scraping) et ChatGPT-User (navigation).',
            'Les risques de bloquer l\'IA.',
            'Le code exact à copier-coller.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          C'est la question que tout le monde se pose. Bloquer OpenAI pour protéger son contenu, ou ouvrir les vannes pour gagner en visibilité ? La réponse est nuancée, mais penche vers l'ouverture.
        </p>

        <h2>Comprendre les différents User-Agents d'OpenAI</h2>
        <p>
          Attention à la confusion : "GPTBot" sert à entraîner les futurs modèles (votre contenu est ingéré). "ChatGPT-User" sert à naviguer en temps réel (votre contenu est cité avec un lien). Bloquer le second est souvent une erreur stratégique.
        </p>
        <p>
          D'autres bots existent : OAI-SearchBot pour la recherche, et les plugins. Chaque User-Agent a un rôle différent dans l'écosystème OpenAI.
        </p>

        <RichLink
          href="/audit-expert"
          title="Testez votre robots.txt"
          description="Vérifiez si votre site est accessible aux bots IA"
        />

        <h2>Tutoriel : Configurer votre fichier robots.txt</h2>
        <p>
          Pour autoriser la navigation mais refuser l'entraînement massif, vous devez configurer vos directives `Disallow` avec précision. Voici les lignes exactes à intégrer à votre fichier racine :
        </p>
        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`# Autoriser ChatGPT-User (navigation temps réel)
User-agent: ChatGPT-User
Allow: /

# Bloquer GPTBot (entraînement des modèles)
User-agent: GPTBot
Disallow: /`}
        </pre>
        <p>
          Cette configuration vous permet d'être cité dans les réponses ChatGPT tout en protégeant votre contenu de l'entraînement non consenti.
        </p>

        <blockquote>
          "83% des sites du CAC 40 autorisent maintenant ChatGPT-User tout en bloquant GPTBot. C'est le nouveau standard."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            'Difference between GPTBot (scraping) and ChatGPT-User (browsing).',
            'The risks of blocking AI.',
            'The exact code to copy-paste.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          It's the question everyone is asking. Block OpenAI to protect your content, or open the floodgates to gain visibility? The answer is nuanced, but leans towards openness.
        </p>

        <h2>Understanding OpenAI's Different User-Agents</h2>
        <p>
          Beware of confusion: "GPTBot" is used to train future models (your content is ingested). "ChatGPT-User" is used to browse in real-time (your content is cited with a link). Blocking the second is often a strategic mistake.
        </p>
        <p>
          Other bots exist: OAI-SearchBot for search, and plugins. Each User-Agent has a different role in the OpenAI ecosystem.
        </p>

        <RichLink
          href="/audit-expert"
          title="Test your robots.txt"
          description="Check if your site is accessible to AI bots"
        />

        <h2>Tutorial: Configure Your robots.txt File</h2>
        <p>
          To allow browsing but refuse massive training, you must configure your `Disallow` directives precisely. Here are the exact lines to add to your root file:
        </p>
        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`# Allow ChatGPT-User (real-time browsing)
User-agent: ChatGPT-User
Allow: /

# Block GPTBot (model training)
User-agent: GPTBot
Disallow: /`}
        </pre>
        <p>
          This configuration allows you to be cited in ChatGPT responses while protecting your content from unconsented training.
        </p>

        <blockquote>
          "83% of CAC 40 sites now allow ChatGPT-User while blocking GPTBot. It's the new standard."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            'Diferencia entre GPTBot (scraping) y ChatGPT-User (navegación).',
            'Los riesgos de bloquear la IA.',
            'El código exacto para copiar-pegar.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Es la pregunta que todos se hacen. ¿Bloquear OpenAI para proteger tu contenido, o abrir las compuertas para ganar visibilidad? La respuesta es matizada, pero se inclina hacia la apertura.
        </p>

        <h2>Entender los Diferentes User-Agents de OpenAI</h2>
        <p>
          Cuidado con la confusión: "GPTBot" sirve para entrenar futuros modelos (tu contenido es ingerido). "ChatGPT-User" sirve para navegar en tiempo real (tu contenido es citado con un enlace). Bloquear el segundo es a menudo un error estratégico.
        </p>
        <p>
          Existen otros bots: OAI-SearchBot para búsqueda, y plugins. Cada User-Agent tiene un rol diferente en el ecosistema de OpenAI.
        </p>

        <RichLink
          href="/audit-expert"
          title="Prueba tu robots.txt"
          description="Verifica si tu sitio es accesible para bots de IA"
        />

        <h2>Tutorial: Configura tu Archivo robots.txt</h2>
        <p>
          Para permitir la navegación pero rechazar el entrenamiento masivo, debes configurar tus directivas `Disallow` con precisión. Aquí están las líneas exactas para agregar a tu archivo raíz:
        </p>
        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`# Permitir ChatGPT-User (navegación en tiempo real)
User-agent: ChatGPT-User
Allow: /

# Bloquear GPTBot (entrenamiento de modelos)
User-agent: GPTBot
Disallow: /`}
        </pre>
        <p>
          Esta configuración te permite ser citado en respuestas de ChatGPT mientras proteges tu contenido del entrenamiento no consentido.
        </p>

        <blockquote>
          "El 83% de los sitios del CAC 40 ahora permiten ChatGPT-User mientras bloquean GPTBot. Es el nuevo estándar."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 2: Site Invisible ChatGPT ---
  'site-invisible-chatgpt-solutions': {
    fr: (
      <>
        <SummaryBox
          points={[
            'Le piège du JavaScript non rendu.',
            'Les problèmes de Sitemap.',
            'L\'impact du temps de chargement sur le crawl budget IA.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Vous avez du contenu de qualité, mais ChatGPT affirme ne rien savoir sur vous ? C'est probablement une barrière technique invisible qui empêche les bots de lire votre HTML. Voici comment la lever.
        </p>

        <h2>Erreur n°1 : Votre site est une forteresse JS</h2>
        <p>
          Les bots d'IA sont moins patients que Googlebot. Si votre contenu nécessite 5 secondes de JavaScript pour s'afficher (Client-Side Rendering), le bot verra une page blanche. Le rendu côté serveur (SSR) est indispensable.
        </p>
        <p>
          Vérifiez votre site en désactivant JavaScript dans votre navigateur. Si le contenu disparaît, les bots IA ne le voient pas non plus.
        </p>

        <RichLink
          href="/audit-expert"
          title="Diagnostiquez l'erreur technique"
          description="Identifiez ce qui bloque les bots IA sur votre site"
        />

        <h2>Erreur n°2 : Vos données ne sont pas structurées</h2>
        <p>
          Sans balisage Schema.org, un bot doit "deviner" où est le prix et où est le titre. Aidez-le avec du JSON-LD pour qu'il indexe vos informations clés sans erreur.
        </p>
        <p>
          Les données structurées sont le langage universel des machines. Sans elles, vous parlez une langue que les IA ne comprennent pas.
        </p>

        <h2>Erreur n°3 : Temps de chargement excessif</h2>
        <p>
          Les bots IA ont un "budget" de temps par site. Si vos pages mettent 4 secondes à charger, ils n'en crawleront qu'un quart. Optimisez vos Core Web Vitals pour maximiser votre couverture.
        </p>

        <blockquote>
          "Un site qui passe de 4s à 1.5s de temps de chargement voit son taux de crawl IA augmenter de 300%."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            'The trap of unrendered JavaScript.',
            'Sitemap problems.',
            'The impact of loading time on AI crawl budget.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          You have quality content, but ChatGPT claims to know nothing about you? It's probably an invisible technical barrier preventing bots from reading your HTML. Here's how to remove it.
        </p>

        <h2>Error #1: Your Site is a JS Fortress</h2>
        <p>
          AI bots are less patient than Googlebot. If your content requires 5 seconds of JavaScript to display (Client-Side Rendering), the bot will see a blank page. Server-Side Rendering (SSR) is essential.
        </p>
        <p>
          Check your site by disabling JavaScript in your browser. If the content disappears, AI bots don't see it either.
        </p>

        <RichLink
          href="/audit-expert"
          title="Diagnose the technical error"
          description="Identify what's blocking AI bots on your site"
        />

        <h2>Error #2: Your Data is Not Structured</h2>
        <p>
          Without Schema.org markup, a bot must "guess" where the price is and where the title is. Help it with JSON-LD so it indexes your key information without error.
        </p>
        <p>
          Structured data is the universal language of machines. Without it, you're speaking a language that AIs don't understand.
        </p>

        <h2>Error #3: Excessive Loading Time</h2>
        <p>
          AI bots have a time "budget" per site. If your pages take 4 seconds to load, they'll only crawl a quarter of them. Optimize your Core Web Vitals to maximize your coverage.
        </p>

        <blockquote>
          "A site that goes from 4s to 1.5s loading time sees its AI crawl rate increase by 300%."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            'La trampa del JavaScript no renderizado.',
            'Los problemas de Sitemap.',
            'El impacto del tiempo de carga en el presupuesto de rastreo IA.',
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          ¿Tienes contenido de calidad, pero ChatGPT afirma no saber nada de ti? Probablemente sea una barrera técnica invisible que impide a los bots leer tu HTML. Aquí está cómo eliminarla.
        </p>

        <h2>Error n°1: Tu Sitio es una Fortaleza JS</h2>
        <p>
          Los bots de IA son menos pacientes que Googlebot. Si tu contenido necesita 5 segundos de JavaScript para mostrarse (Client-Side Rendering), el bot verá una página en blanco. El renderizado del lado del servidor (SSR) es indispensable.
        </p>
        <p>
          Verifica tu sitio desactivando JavaScript en tu navegador. Si el contenido desaparece, los bots de IA tampoco lo ven.
        </p>

        <RichLink
          href="/audit-expert"
          title="Diagnostica el error técnico"
          description="Identifica qué está bloqueando los bots de IA en tu sitio"
        />

        <h2>Error n°2: Tus Datos No Están Estructurados</h2>
        <p>
          Sin marcado Schema.org, un bot debe "adivinar" dónde está el precio y dónde está el título. Ayúdalo con JSON-LD para que indexe tu información clave sin error.
        </p>
        <p>
          Los datos estructurados son el lenguaje universal de las máquinas. Sin ellos, estás hablando un idioma que las IAs no entienden.
        </p>

        <h2>Error n°3: Tiempo de Carga Excesivo</h2>
        <p>
          Los bots de IA tienen un "presupuesto" de tiempo por sitio. Si tus páginas tardan 4 segundos en cargar, solo rastrearán una cuarta parte. Optimiza tus Core Web Vitals para maximizar tu cobertura.
        </p>

        <blockquote>
          "Un sitio que pasa de 4s a 1.5s de tiempo de carga ve aumentar su tasa de rastreo IA en un 300%."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 3: Google SGE SEO Preparation ---
  'google-sge-seo-preparation': {
    fr: (
      <>
        <SummaryBox
          points={[
            "La fin des '10 liens bleus'.",
            "L'importance des 'Featured Snippets' sous stéroïdes.",
            "Comment gagner la position Zéro en 2026.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          La Search Generative Experience change les règles du jeu. Google ne vous envoie plus de trafic, il donne la réponse directement. Voici comment devenir la source de cette réponse pour garder votre visibilité.
        </p>

        <h2>SGE : Un moteur de réponse, pas de recherche</h2>
        <p>
          L'objectif de SGE est de satisfaire l'utilisateur sans clic. Si votre contenu est vague ou purement promotionnel, il sera ignoré. SGE privilégie les faits, les chiffres et les retours d'expérience concrets.
        </p>
        <p>
          Les pages qui génèrent le plus de citations sont celles qui offrent des données originales, des études de cas et des réponses directes aux questions des utilisateurs.
        </p>

        <RichLink
          href="/audit-expert"
          title="Testez votre compatibilité SGE"
          description="Analysez comment votre contenu apparaît dans les réponses générées par Google"
        />

        <h2>Adapter votre contenu pour le 'Snapshot' AI</h2>
        <p>
          Structurez vos articles avec des questions directes et des réponses concises en début de paragraphe. C'est ce format 'Question/Réponse' que SGE extrait pour construire ses résumés.
        </p>
        <p>
          Utilisez des listes à puces, des tableaux de données et des définitions claires. Ces formats sont les plus susceptibles d'être repris textuellement par l'IA.
        </p>

        <h2>L'importance des sources et citations</h2>
        <p>
          SGE cite ses sources. Plus votre contenu est cité ailleurs sur le web, plus Google le considère comme fiable. Travaillez votre netlinking avec des sources autoritaires de votre secteur.
        </p>

        <blockquote>
          "D'ici fin 2026, 80% des requêtes informationnelles sur Google afficheront une réponse générée par IA. Votre stratégie SEO doit s'adapter maintenant."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            "The end of the '10 blue links'.",
            "The importance of 'Featured Snippets' on steroids.",
            "How to win position Zero in 2026.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          The Search Generative Experience changes the rules of the game. Google no longer sends you traffic, it gives the answer directly. Here's how to become the source of that answer to maintain your visibility.
        </p>

        <h2>SGE: An Answer Engine, Not a Search Engine</h2>
        <p>
          SGE's goal is to satisfy the user without a click. If your content is vague or purely promotional, it will be ignored. SGE favors facts, figures, and concrete feedback.
        </p>
        <p>
          The pages that generate the most citations are those that offer original data, case studies, and direct answers to user questions.
        </p>

        <RichLink
          href="/audit-expert"
          title="Test your SGE compatibility"
          description="Analyze how your content appears in Google's generated responses"
        />

        <h2>Adapting Your Content for the AI 'Snapshot'</h2>
        <p>
          Structure your articles with direct questions and concise answers at the beginning of paragraphs. This 'Question/Answer' format is what SGE extracts to build its summaries.
        </p>
        <p>
          Use bullet lists, data tables, and clear definitions. These formats are most likely to be quoted verbatim by AI.
        </p>

        <h2>The Importance of Sources and Citations</h2>
        <p>
          SGE cites its sources. The more your content is cited elsewhere on the web, the more Google considers it reliable. Work on your link building with authoritative sources in your industry.
        </p>

        <blockquote>
          "By the end of 2026, 80% of informational queries on Google will display an AI-generated response. Your SEO strategy must adapt now."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            "El fin de los '10 enlaces azules'.",
            "La importancia de los 'Featured Snippets' con esteroides.",
            "Cómo ganar la posición Cero en 2026.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          La Search Generative Experience cambia las reglas del juego. Google ya no te envía tráfico, da la respuesta directamente. Aquí está cómo convertirse en la fuente de esa respuesta para mantener tu visibilidad.
        </p>

        <h2>SGE: Un Motor de Respuestas, No de Búsqueda</h2>
        <p>
          El objetivo de SGE es satisfacer al usuario sin clic. Si tu contenido es vago o puramente promocional, será ignorado. SGE privilegia los hechos, las cifras y los retornos de experiencia concretos.
        </p>
        <p>
          Las páginas que generan más citas son las que ofrecen datos originales, estudios de caso y respuestas directas a las preguntas de los usuarios.
        </p>

        <RichLink
          href="/audit-expert"
          title="Prueba tu compatibilidad SGE"
          description="Analiza cómo tu contenido aparece en las respuestas generadas por Google"
        />

        <h2>Adaptar tu Contenido para el 'Snapshot' IA</h2>
        <p>
          Estructura tus artículos con preguntas directas y respuestas concisas al inicio de los párrafos. Este formato 'Pregunta/Respuesta' es lo que SGE extrae para construir sus resúmenes.
        </p>
        <p>
          Usa listas con viñetas, tablas de datos y definiciones claras. Estos formatos son los más propensos a ser citados textualmente por la IA.
        </p>

        <h2>La Importancia de las Fuentes y Citas</h2>
        <p>
          SGE cita sus fuentes. Cuanto más tu contenido sea citado en otros sitios web, más Google lo considerará confiable. Trabaja tu netlinking con fuentes autoritarias de tu sector.
        </p>

        <blockquote>
          "Para finales de 2026, el 80% de las consultas informativas en Google mostrarán una respuesta generada por IA. Tu estrategia SEO debe adaptarse ahora."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 4: Mission Mise aux Normes IA ---
  'mission-mise-aux-normes-ia': {
    fr: (
      <>
        <SummaryBox
          points={[
            "Créer un sentiment d'urgence légitime.",
            "Le pricing d'un audit GEO.",
            "Fidéliser le client avec une veille mensuelle.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Ne vendez plus du vent ou des promesses de ranking incertaines. Vendez de la sécurité infrastructurelle. La mise aux normes IA est le service le plus facile à pitcher et à justifier en 2026.
        </p>

        <h2>Le pitch : 'Votre concurrent est cité, pas vous'</h2>
        <p>
          Montrez à votre client une capture d'écran de Perplexity citant son concurrent direct. L'impact psychologique est immédiat. Proposez ensuite un plan d'action correctif sur 30 jours.
        </p>
        <p>
          Cette approche transforme une vente complexe en urgence évidente. Le client voit le problème, comprend l'enjeu, et veut agir immédiatement.
        </p>

        <RichLink
          href="/audit-expert"
          title="Générez vos audits avant-vente"
          description="Créez des rapports impactants pour convertir vos prospects"
        />

        <h2>Le livrable : Ce que le client veut voir</h2>
        <p>
          Fournissez un rapport 'Avant/Après' sur la détection des balises techniques et la propreté du robots.txt. C'est tangible, rassurant et technique.
        </p>
        <p>
          Incluez des métriques claires : nombre de pages indexées par les bots IA, présence de données structurées, temps de crawl. Ces KPIs justifient votre valeur ajoutée.
        </p>

        <h2>La récurrence : Veille et maintenance</h2>
        <p>
          Proposez un forfait mensuel de monitoring. Les bots IA évoluent constamment, de nouveaux User-Agents apparaissent. Votre client a besoin d'une veille permanente.
        </p>

        <blockquote>
          "Les consultants qui proposent un suivi mensuel 'Visibilité IA' génèrent 3x plus de revenus récurrents que ceux qui vendent uniquement des audits ponctuels."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            "Create a legitimate sense of urgency.",
            "Pricing a GEO audit.",
            "Retain clients with monthly monitoring.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Stop selling smoke or uncertain ranking promises. Sell infrastructure security. AI compliance is the easiest service to pitch and justify in 2026.
        </p>

        <h2>The Pitch: 'Your Competitor is Cited, Not You'</h2>
        <p>
          Show your client a screenshot of Perplexity citing their direct competitor. The psychological impact is immediate. Then propose a 30-day corrective action plan.
        </p>
        <p>
          This approach transforms a complex sale into an obvious urgency. The client sees the problem, understands the stakes, and wants to act immediately.
        </p>

        <RichLink
          href="/audit-expert"
          title="Generate your pre-sale audits"
          description="Create impactful reports to convert your prospects"
        />

        <h2>The Deliverable: What the Client Wants to See</h2>
        <p>
          Provide a 'Before/After' report on technical tag detection and robots.txt cleanliness. It's tangible, reassuring, and technical.
        </p>
        <p>
          Include clear metrics: number of pages indexed by AI bots, presence of structured data, crawl time. These KPIs justify your added value.
        </p>

        <h2>Recurrence: Monitoring and Maintenance</h2>
        <p>
          Offer a monthly monitoring package. AI bots are constantly evolving, new User-Agents appear. Your client needs permanent monitoring.
        </p>

        <blockquote>
          "Consultants who offer monthly 'AI Visibility' monitoring generate 3x more recurring revenue than those who only sell one-time audits."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            "Crear un sentido de urgencia legítimo.",
            "El pricing de una auditoría GEO.",
            "Fidelizar al cliente con monitoreo mensual.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Deja de vender humo o promesas de ranking inciertas. Vende seguridad de infraestructura. El cumplimiento IA es el servicio más fácil de vender y justificar en 2026.
        </p>

        <h2>El Pitch: 'Tu Competidor es Citado, Tú No'</h2>
        <p>
          Muestra a tu cliente una captura de pantalla de Perplexity citando a su competidor directo. El impacto psicológico es inmediato. Luego propón un plan de acción correctivo de 30 días.
        </p>
        <p>
          Este enfoque transforma una venta compleja en una urgencia evidente. El cliente ve el problema, entiende lo que está en juego y quiere actuar de inmediato.
        </p>

        <RichLink
          href="/audit-expert"
          title="Genera tus auditorías pre-venta"
          description="Crea informes impactantes para convertir tus prospectos"
        />

        <h2>El Entregable: Lo que el Cliente Quiere Ver</h2>
        <p>
          Proporciona un informe 'Antes/Después' sobre la detección de etiquetas técnicas y la limpieza del robots.txt. Es tangible, tranquilizador y técnico.
        </p>
        <p>
          Incluye métricas claras: número de páginas indexadas por bots IA, presencia de datos estructurados, tiempo de rastreo. Estos KPIs justifican tu valor añadido.
        </p>

        <h2>La Recurrencia: Monitoreo y Mantenimiento</h2>
        <p>
          Ofrece un paquete de monitoreo mensual. Los bots de IA evolucionan constantemente, aparecen nuevos User-Agents. Tu cliente necesita una vigilancia permanente.
        </p>

        <blockquote>
          "Los consultores que ofrecen monitoreo mensual de 'Visibilidad IA' generan 3x más ingresos recurrentes que los que solo venden auditorías puntuales."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 5: JSON-LD Snippet Autorité ---
  'json-ld-snippet-autorite': {
    fr: (
      <>
        <SummaryBox
          points={[
            "Pourquoi Schema.org est vital pour les LLM.",
            "Le schema 'Organization' décortiqué.",
            "Exemple de code prêt à l'emploi.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Les LLM ne 'lisent' pas comme nous. Ils parsent de la donnée brute. Le JSON-LD est votre façon de leur dire exactement qui vous êtes, sans ambiguïté ni risque d'hallucination.
        </p>

        <h2>Parler la langue des robots : Schema.org</h2>
        <p>
          Le JSON-LD est un morceau de code invisible pour l'humain mais vital pour le robot. Il permet de dire 'Ceci est un Article', 'Ceci est un Prix', 'Ceci est l'Auteur'. Sans ça, vous n'êtes que du texte en vrac.
        </p>
        <p>
          Schema.org est la norme universelle comprise par Google, Bing, et tous les LLM majeurs. Implémenter ces balises est non négociable en 2026.
        </p>

        <RichLink
          href="/audit-expert"
          title="Générateur JSON-LD automatique"
          description="Créez vos balises structurées en quelques clics"
        />

        <h2>Le Code : Copiez ce snippet sur votre Home</h2>
        <p>
          Il existe un format standard pour définir une Organisation. Il inclut votre logo, vos réseaux sociaux et vos contacts. C'est la carte d'identité numérique que tout site pro doit avoir.
        </p>
        <p>
          Voici les propriétés essentielles à renseigner : name, url, logo, sameAs (liens vers vos profils sociaux), contactPoint, et address pour les entreprises locales.
        </p>

        <h2>Les autres schemas indispensables</h2>
        <p>
          Au-delà d'Organization, implémentez Article pour vos contenus éditoriaux, Product pour vos produits, FAQPage pour vos questions fréquentes. Chaque type de contenu a son schema dédié.
        </p>

        <blockquote>
          "Les sites avec un JSON-LD complet sont 4x plus susceptibles d'être cités dans les réponses IA que ceux sans données structurées."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            "Why Schema.org is vital for LLMs.",
            "The 'Organization' schema explained.",
            "Ready-to-use code example.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          LLMs don't 'read' like us. They parse raw data. JSON-LD is your way to tell them exactly who you are, without ambiguity or risk of hallucination.
        </p>

        <h2>Speaking the Language of Robots: Schema.org</h2>
        <p>
          JSON-LD is a piece of code invisible to humans but vital to robots. It allows you to say 'This is an Article', 'This is a Price', 'This is the Author'. Without it, you're just unstructured text.
        </p>
        <p>
          Schema.org is the universal standard understood by Google, Bing, and all major LLMs. Implementing these tags is non-negotiable in 2026.
        </p>

        <RichLink
          href="/audit-expert"
          title="Automatic JSON-LD generator"
          description="Create your structured tags in a few clicks"
        />

        <h2>The Code: Copy This Snippet to Your Home</h2>
        <p>
          There is a standard format for defining an Organization. It includes your logo, social networks, and contacts. It's the digital ID card that every professional site must have.
        </p>
        <p>
          Here are the essential properties to fill in: name, url, logo, sameAs (links to your social profiles), contactPoint, and address for local businesses.
        </p>

        <h2>Other Essential Schemas</h2>
        <p>
          Beyond Organization, implement Article for your editorial content, Product for your products, FAQPage for your frequently asked questions. Each type of content has its dedicated schema.
        </p>

        <blockquote>
          "Sites with complete JSON-LD are 4x more likely to be cited in AI responses than those without structured data."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            "Por qué Schema.org es vital para los LLM.",
            "El esquema 'Organization' explicado.",
            "Ejemplo de código listo para usar.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Los LLM no 'leen' como nosotros. Parsean datos brutos. JSON-LD es tu forma de decirles exactamente quién eres, sin ambigüedad ni riesgo de alucinación.
        </p>

        <h2>Hablar el Idioma de los Robots: Schema.org</h2>
        <p>
          JSON-LD es un fragmento de código invisible para los humanos pero vital para los robots. Te permite decir 'Esto es un Artículo', 'Esto es un Precio', 'Este es el Autor'. Sin eso, solo eres texto desestructurado.
        </p>
        <p>
          Schema.org es el estándar universal entendido por Google, Bing y todos los LLM principales. Implementar estas etiquetas es innegociable en 2026.
        </p>

        <RichLink
          href="/audit-expert"
          title="Generador JSON-LD automático"
          description="Crea tus etiquetas estructuradas en unos clics"
        />

        <h2>El Código: Copia Este Snippet en tu Home</h2>
        <p>
          Existe un formato estándar para definir una Organización. Incluye tu logo, redes sociales y contactos. Es la tarjeta de identidad digital que todo sitio profesional debe tener.
        </p>
        <p>
          Aquí están las propiedades esenciales a completar: name, url, logo, sameAs (enlaces a tus perfiles sociales), contactPoint, y address para negocios locales.
        </p>

        <h2>Otros Schemas Indispensables</h2>
        <p>
          Más allá de Organization, implementa Article para tu contenido editorial, Product para tus productos, FAQPage para tus preguntas frecuentes. Cada tipo de contenido tiene su schema dedicado.
        </p>

        <blockquote>
          "Los sitios con JSON-LD completo son 4x más propensos a ser citados en respuestas de IA que aquellos sin datos estructurados."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 6: Perplexity SEO Citation ---
  'perplexity-seo-citation': {
    fr: (
      <>
        <SummaryBox
          points={[
            "L'algorithme de citation de Perplexity analysé.",
            "L'importance de la fraîcheur de l'information.",
            "Structurer ses articles pour la citation.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Perplexity est devenu le moteur de recherche des décideurs tech et B2B. Être cité ici vaut 1000 visites Google non qualifiées. Voici comment optimiser vos contenus pour maximiser vos chances de citation.
        </p>

        <h2>La structure 'Fact-First' : Aller droit au but</h2>
        <p>
          Perplexity déteste le blabla. Mettez l'information clé (la réponse) dès la première phrase de vos paragraphes. Utilisez des listes à puces et des tableaux de données.
        </p>
        <p>
          Évitez les introductions longues et les formules vagues. Chaque phrase doit apporter une information factuelle que Perplexity peut extraire et citer.
        </p>

        <RichLink
          href="/audit-expert"
          title="Analysez votre visibilité Perplexity"
          description="Découvrez si votre site apparaît dans les réponses Perplexity"
        />

        <h2>Citations et Backlinks : La confiance avant tout</h2>
        <p>
          Pour citer une source, Perplexity doit lui faire confiance. Les backlinks provenant de sites académiques ou de presse spécialisée augmentent drastiquement votre 'Trust Score' aux yeux de l'IA.
        </p>
        <p>
          Travaillez votre présence sur les sites d'autorité de votre secteur. Une mention sur un média reconnu vaut plus que 100 backlinks de sites inconnus.
        </p>

        <h2>La fraîcheur : Mettez à jour régulièrement</h2>
        <p>
          Perplexity privilégie le contenu récent. Mettez à jour vos articles piliers régulièrement et datez clairement vos mises à jour. Un article de 2024 non actualisé sera ignoré.
        </p>

        <blockquote>
          "Les sources citées par Perplexity voient en moyenne 200% de trafic qualifié en plus que les sources ignorées par l'IA."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            "Perplexity's citation algorithm analyzed.",
            "The importance of information freshness.",
            "Structuring articles for citation.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Perplexity has become the search engine for tech and B2B decision-makers. Being cited here is worth 1000 unqualified Google visits. Here's how to optimize your content to maximize your citation chances.
        </p>

        <h2>The 'Fact-First' Structure: Get to the Point</h2>
        <p>
          Perplexity hates fluff. Put the key information (the answer) in the first sentence of your paragraphs. Use bullet lists and data tables.
        </p>
        <p>
          Avoid long introductions and vague formulas. Every sentence must provide factual information that Perplexity can extract and cite.
        </p>

        <RichLink
          href="/audit-expert"
          title="Analyze your Perplexity visibility"
          description="Discover if your site appears in Perplexity responses"
        />

        <h2>Citations and Backlinks: Trust First</h2>
        <p>
          To cite a source, Perplexity must trust it. Backlinks from academic or specialized press sites drastically increase your 'Trust Score' in the eyes of AI.
        </p>
        <p>
          Work on your presence on authority sites in your industry. A mention on a recognized media is worth more than 100 backlinks from unknown sites.
        </p>

        <h2>Freshness: Update Regularly</h2>
        <p>
          Perplexity favors recent content. Update your pillar articles regularly and clearly date your updates. A 2024 article that hasn't been updated will be ignored.
        </p>

        <blockquote>
          "Sources cited by Perplexity see on average 200% more qualified traffic than sources ignored by AI."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            "El algoritmo de citación de Perplexity analizado.",
            "La importancia de la frescura de la información.",
            "Estructurar artículos para la citación.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Perplexity se ha convertido en el motor de búsqueda de decisores tech y B2B. Ser citado aquí vale 1000 visitas no cualificadas de Google. Aquí está cómo optimizar tu contenido para maximizar tus chances de citación.
        </p>

        <h2>La Estructura 'Fact-First': Ir al Grano</h2>
        <p>
          Perplexity odia el relleno. Pon la información clave (la respuesta) en la primera frase de tus párrafos. Usa listas con viñetas y tablas de datos.
        </p>
        <p>
          Evita las introducciones largas y las fórmulas vagas. Cada frase debe aportar información factual que Perplexity pueda extraer y citar.
        </p>

        <RichLink
          href="/audit-expert"
          title="Analiza tu visibilidad en Perplexity"
          description="Descubre si tu sitio aparece en las respuestas de Perplexity"
        />

        <h2>Citas y Backlinks: La Confianza Primero</h2>
        <p>
          Para citar una fuente, Perplexity debe confiar en ella. Los backlinks de sitios académicos o prensa especializada aumentan drásticamente tu 'Trust Score' a ojos de la IA.
        </p>
        <p>
          Trabaja tu presencia en sitios de autoridad de tu sector. Una mención en un medio reconocido vale más que 100 backlinks de sitios desconocidos.
        </p>

        <h2>La Frescura: Actualiza Regularmente</h2>
        <p>
          Perplexity privilegia el contenido reciente. Actualiza tus artículos pilares regularmente y fecha claramente tus actualizaciones. Un artículo de 2024 no actualizado será ignorado.
        </p>

        <blockquote>
          "Las fuentes citadas por Perplexity ven en promedio 200% más de tráfico cualificado que las fuentes ignoradas por la IA."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 7: Audit SEO Gratuit vs Semrush ---
  'audit-seo-gratuit-vs-semrush': {
    fr: (
      <>
        <SummaryBox
          points={[
            "Ce que Semrush ne voit pas (le rendu LLM).",
            "Pourquoi le 'Keyword Volume' est une métrique du passé.",
            "L'avantage des outils natifs IA.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Semrush et Ahrefs sont des outils fantastiques pour le web de 2020. Mais pour l'ère des LLM, ils sont aveugles sur des points critiques de votre infrastructure. Voici le comparatif.
        </p>

        <h2>Les angles morts des crawlers traditionnels</h2>
        <p>
          Les outils classiques simulent souvent Googlebot version 'Legacy'. Ils ne vérifient pas systématiquement comment votre contenu est interprété par un modèle de langage (tokenization, contexte, vecteurs).
        </p>
        <p>
          Résultat : votre score Semrush peut être excellent alors que votre site est invisible pour ChatGPT ou Perplexity.
        </p>

        <RichLink
          href="/audit-expert"
          title="Complétez votre analyse Semrush"
          description="Ajoutez la dimension IA à votre audit SEO existant"
        />

        <h2>L'importance de l'analyse sémantique vectorielle</h2>
        <p>
          Notre audit vérifie la cohérence sémantique de vos entités, pas juste la densité de vos mots-clés. C'est cette cohérence qui permet à l'IA de vous faire confiance sur un sujet donné.
        </p>
        <p>
          Les LLM fonctionnent avec des embeddings vectoriels. Votre contenu doit être positionné dans le bon espace sémantique pour être associé aux bonnes requêtes.
        </p>

        <h2>Complémentarité, pas remplacement</h2>
        <p>
          Semrush reste utile pour l'analyse de backlinks et le suivi de positions Google. Mais complétez-le avec un audit GEO pour couvrir la visibilité sur les moteurs génératifs.
        </p>

        <blockquote>
          "En 2026, 35% du trafic web provient de moteurs génératifs. Ignorer cette dimension dans vos audits, c'est ignorer un tiers de votre audience potentielle."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            "What Semrush doesn't see (LLM rendering).",
            "Why 'Keyword Volume' is a past metric.",
            "The advantage of AI-native tools.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Semrush and Ahrefs are fantastic tools for the 2020 web. But for the LLM era, they're blind to critical points of your infrastructure. Here's the comparison.
        </p>

        <h2>Blind Spots of Traditional Crawlers</h2>
        <p>
          Classic tools often simulate 'Legacy' Googlebot. They don't systematically check how your content is interpreted by a language model (tokenization, context, vectors).
        </p>
        <p>
          Result: your Semrush score can be excellent while your site is invisible to ChatGPT or Perplexity.
        </p>

        <RichLink
          href="/audit-expert"
          title="Complete your Semrush analysis"
          description="Add the AI dimension to your existing SEO audit"
        />

        <h2>The Importance of Vector Semantic Analysis</h2>
        <p>
          Our audit verifies the semantic coherence of your entities, not just the density of your keywords. It's this coherence that allows AI to trust you on a given topic.
        </p>
        <p>
          LLMs work with vector embeddings. Your content must be positioned in the right semantic space to be associated with the right queries.
        </p>

        <h2>Complementarity, Not Replacement</h2>
        <p>
          Semrush remains useful for backlink analysis and Google position tracking. But supplement it with a GEO audit to cover visibility on generative engines.
        </p>

        <blockquote>
          "In 2026, 35% of web traffic comes from generative engines. Ignoring this dimension in your audits means ignoring a third of your potential audience."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            "Lo que Semrush no ve (renderizado LLM).",
            "Por qué 'Keyword Volume' es una métrica del pasado.",
            "La ventaja de herramientas nativas IA.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Semrush y Ahrefs son herramientas fantásticas para la web de 2020. Pero para la era de los LLM, están ciegos a puntos críticos de tu infraestructura. Aquí está la comparación.
        </p>

        <h2>Los Puntos Ciegos de los Crawlers Tradicionales</h2>
        <p>
          Las herramientas clásicas suelen simular Googlebot versión 'Legacy'. No verifican sistemáticamente cómo tu contenido es interpretado por un modelo de lenguaje (tokenización, contexto, vectores).
        </p>
        <p>
          Resultado: tu puntuación Semrush puede ser excelente mientras tu sitio es invisible para ChatGPT o Perplexity.
        </p>

        <RichLink
          href="/audit-expert"
          title="Completa tu análisis Semrush"
          description="Añade la dimensión IA a tu auditoría SEO existente"
        />

        <h2>La Importancia del Análisis Semántico Vectorial</h2>
        <p>
          Nuestra auditoría verifica la coherencia semántica de tus entidades, no solo la densidad de tus palabras clave. Es esta coherencia la que permite a la IA confiar en ti sobre un tema dado.
        </p>
        <p>
          Los LLM funcionan con embeddings vectoriales. Tu contenido debe estar posicionado en el espacio semántico correcto para ser asociado con las consultas correctas.
        </p>

        <h2>Complementariedad, No Reemplazo</h2>
        <p>
          Semrush sigue siendo útil para el análisis de backlinks y el seguimiento de posiciones en Google. Pero compleméntalo con una auditoría GEO para cubrir la visibilidad en motores generativos.
        </p>

        <blockquote>
          "En 2026, el 35% del tráfico web proviene de motores generativos. Ignorar esta dimensión en tus auditorías significa ignorar un tercio de tu audiencia potencial."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 8: Tableau Comparatif SEO GEO 2026 ---
  'tableau-comparatif-seo-geo-2026': {
    fr: (
      <>
        <SummaryBox
          points={[
            "Comparaison point par point (KPI, Objectifs, Méthodes).",
            "Budget : Faut-il investir en SEO ou GEO ?",
            "Les synergies entre les deux.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Vous êtes perdu entre les acronymes ? SEO, AEO, GEO, SGE... Ce guide visuel et rapide pose les bases définitives pour arbitrer vos budgets marketing cette année et ne pas miser sur le mauvais cheval.
        </p>

        <h2>Les différences fondamentales : Tableau récapitulatif</h2>
        <p>
          En SEO, le KPI est le trafic et le classement. En GEO, le KPI est la citation et la part de voix dans les réponses générées. Le SEO vise le clic, le GEO vise l'influence.
        </p>
        <p>
          <strong>SEO classique :</strong> Position dans les SERPs, taux de clic (CTR), trafic organique.
          <strong>GEO :</strong> Fréquence de citation, précision des informations reprises, autorité perçue par l'IA.
        </p>

        <RichLink
          href="/audit-expert"
          title="Téléchargez votre score GEO"
          description="Obtenez un diagnostic complet SEO + GEO de votre site"
        />

        <h2>Où investir votre premier euro ?</h2>
        <p>
          Si vous démarrez, le GEO est moins saturé et offre des résultats plus rapides grâce à la longue traîne conversationnelle. Ne négligez pas le SEO technique, qui reste le socle commun.
        </p>
        <p>
          La recommandation : 60% du budget sur le SEO technique (qui sert les deux), 40% sur l'optimisation GEO (données structurées, E-E-A-T, fraîcheur).
        </p>

        <h2>Les synergies à exploiter</h2>
        <p>
          Un bon SEO technique (vitesse, mobile, structure) profite aussi au GEO. Les données structurées aident Google ET les LLM. Investir dans l'un renforce l'autre.
        </p>

        <blockquote>
          "Les entreprises qui investissent simultanément en SEO et GEO voient leur visibilité globale augmenter de 150% par rapport à celles qui se concentrent sur un seul canal."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            "Point by point comparison (KPIs, Goals, Methods).",
            "Budget: Should you invest in SEO or GEO?",
            "Synergies between the two.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Lost between acronyms? SEO, AEO, GEO, SGE... This visual and quick guide sets the definitive bases for arbitrating your marketing budgets this year and not betting on the wrong horse.
        </p>

        <h2>Fundamental Differences: Summary Table</h2>
        <p>
          In SEO, the KPI is traffic and ranking. In GEO, the KPI is citation and share of voice in generated responses. SEO aims for the click, GEO aims for influence.
        </p>
        <p>
          <strong>Classic SEO:</strong> Position in SERPs, click-through rate (CTR), organic traffic.
          <strong>GEO:</strong> Citation frequency, accuracy of information picked up, perceived authority by AI.
        </p>

        <RichLink
          href="/audit-expert"
          title="Download your GEO score"
          description="Get a complete SEO + GEO diagnosis of your site"
        />

        <h2>Where to Invest Your First Dollar?</h2>
        <p>
          If you're starting out, GEO is less saturated and offers faster results thanks to the conversational long tail. Don't neglect technical SEO, which remains the common foundation.
        </p>
        <p>
          The recommendation: 60% of budget on technical SEO (which serves both), 40% on GEO optimization (structured data, E-E-A-T, freshness).
        </p>

        <h2>Synergies to Exploit</h2>
        <p>
          Good technical SEO (speed, mobile, structure) also benefits GEO. Structured data helps Google AND LLMs. Investing in one strengthens the other.
        </p>

        <blockquote>
          "Companies that invest simultaneously in SEO and GEO see their overall visibility increase by 150% compared to those who focus on just one channel."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            "Comparación punto por punto (KPIs, Objetivos, Métodos).",
            "Presupuesto: ¿Invertir en SEO o GEO?",
            "Las sinergias entre ambos.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          ¿Perdido entre acrónimos? SEO, AEO, GEO, SGE... Esta guía visual y rápida establece las bases definitivas para arbitrar tus presupuestos de marketing este año y no apostar por el caballo equivocado.
        </p>

        <h2>Las Diferencias Fundamentales: Tabla Resumen</h2>
        <p>
          En SEO, el KPI es el tráfico y el ranking. En GEO, el KPI es la citación y la cuota de voz en las respuestas generadas. El SEO apunta al clic, el GEO apunta a la influencia.
        </p>
        <p>
          <strong>SEO clásico:</strong> Posición en SERPs, tasa de clics (CTR), tráfico orgánico.
          <strong>GEO:</strong> Frecuencia de citación, precisión de la información recogida, autoridad percibida por la IA.
        </p>

        <RichLink
          href="/audit-expert"
          title="Descarga tu puntuación GEO"
          description="Obtén un diagnóstico completo SEO + GEO de tu sitio"
        />

        <h2>¿Dónde Invertir tu Primer Euro?</h2>
        <p>
          Si estás empezando, el GEO está menos saturado y ofrece resultados más rápidos gracias a la cola larga conversacional. No descuides el SEO técnico, que sigue siendo la base común.
        </p>
        <p>
          La recomendación: 60% del presupuesto en SEO técnico (que sirve a ambos), 40% en optimización GEO (datos estructurados, E-E-A-T, frescura).
        </p>

        <h2>Las Sinergias a Explotar</h2>
        <p>
          Un buen SEO técnico (velocidad, móvil, estructura) también beneficia al GEO. Los datos estructurados ayudan a Google Y a los LLM. Invertir en uno refuerza al otro.
        </p>

        <blockquote>
          "Las empresas que invierten simultáneamente en SEO y GEO ven su visibilidad global aumentar un 150% en comparación con las que se concentran en un solo canal."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 9: Liste User-Agents IA 2026 ---
  'liste-user-agents-ia-2026': {
    fr: (
      <>
        <SummaryBox
          points={[
            "Les bots majeurs (OpenAI, Anthropic, Google).",
            "Les bots 'Common Crawl' (CCBot).",
            "Comment les identifier dans vos logs serveurs.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Ne laissez pas des inconnus scraper votre site sans votre accord. Voici la liste tenue à jour des identifiants (User-Agents) des robots d'intelligence artificielle qui parcourent le web aujourd'hui.
        </p>

        <h2>Les 'Big Three' : GPT, Claude et Gemini</h2>
        <p>
          Ce sont les plus actifs. Google-Extended (pour Gemini), GPTBot (pour OpenAI) et ClaudeBot (pour Anthropic). Ils respectent généralement le robots.txt, à condition de bien les nommer.
        </p>
        <p>
          <strong>GPTBot :</strong> User-agent d'OpenAI pour l'entraînement. <strong>ChatGPT-User :</strong> Pour la navigation en temps réel. <strong>Google-Extended :</strong> Pour Gemini et Bard.
        </p>

        <RichLink
          href="/audit-expert"
          title="Alerte nouveaux bots"
          description="Recevez une notification quand de nouveaux User-Agents IA sont détectés"
        />

        <h2>Les crawlers de données brutes à surveiller</h2>
        <p>
          Attention à CCBot (Common Crawl) ou Bytespider. Ils sont souvent plus agressifs et alimentent des bases de données utilisées par de nombreuses IA tiers. Les bloquer peut réduire votre charge serveur.
        </p>
        <p>
          Surveillez aussi Amazonbot, Facebookbot (pour Meta AI), et les nouveaux entrants comme Applebot-Extended pour Apple Intelligence.
        </p>

        <h2>Comment analyser vos logs</h2>
        <p>
          Accédez à vos logs serveur et filtrez par User-Agent. Identifiez la fréquence de crawl, les pages visitées, et le comportement de chaque bot. Ajustez votre robots.txt en fonction.
        </p>

        <blockquote>
          "En 2026, plus de 50 User-Agents IA différents parcourent activement le web. Seuls 10% des sites web ont une politique robots.txt adaptée à cette réalité."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            "Major bots (OpenAI, Anthropic, Google).",
            "Common Crawl bots (CCBot).",
            "How to identify them in your server logs.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Don't let strangers scrape your site without your consent. Here's the updated list of identifiers (User-Agents) of AI robots that crawl the web today.
        </p>

        <h2>The 'Big Three': GPT, Claude and Gemini</h2>
        <p>
          These are the most active. Google-Extended (for Gemini), GPTBot (for OpenAI) and ClaudeBot (for Anthropic). They generally respect robots.txt, as long as you name them correctly.
        </p>
        <p>
          <strong>GPTBot:</strong> OpenAI's user-agent for training. <strong>ChatGPT-User:</strong> For real-time navigation. <strong>Google-Extended:</strong> For Gemini and Bard.
        </p>

        <RichLink
          href="/audit-expert"
          title="New bot alerts"
          description="Get notified when new AI User-Agents are detected"
        />

        <h2>Raw Data Crawlers to Watch</h2>
        <p>
          Watch out for CCBot (Common Crawl) or Bytespider. They are often more aggressive and feed databases used by many third-party AIs. Blocking them can reduce your server load.
        </p>
        <p>
          Also watch Amazonbot, Facebookbot (for Meta AI), and newcomers like Applebot-Extended for Apple Intelligence.
        </p>

        <h2>How to Analyze Your Logs</h2>
        <p>
          Access your server logs and filter by User-Agent. Identify crawl frequency, visited pages, and behavior of each bot. Adjust your robots.txt accordingly.
        </p>

        <blockquote>
          "In 2026, more than 50 different AI User-Agents are actively crawling the web. Only 10% of websites have a robots.txt policy adapted to this reality."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            "Los bots principales (OpenAI, Anthropic, Google).",
            "Los bots 'Common Crawl' (CCBot).",
            "Cómo identificarlos en tus logs de servidor.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          No dejes que desconocidos scrapeen tu sitio sin tu consentimiento. Aquí está la lista actualizada de identificadores (User-Agents) de los robots de inteligencia artificial que recorren la web hoy.
        </p>

        <h2>Los 'Big Three': GPT, Claude y Gemini</h2>
        <p>
          Son los más activos. Google-Extended (para Gemini), GPTBot (para OpenAI) y ClaudeBot (para Anthropic). Generalmente respetan el robots.txt, siempre que los nombres correctamente.
        </p>
        <p>
          <strong>GPTBot:</strong> User-agent de OpenAI para entrenamiento. <strong>ChatGPT-User:</strong> Para navegación en tiempo real. <strong>Google-Extended:</strong> Para Gemini y Bard.
        </p>

        <RichLink
          href="/audit-expert"
          title="Alerta de nuevos bots"
          description="Recibe una notificación cuando se detecten nuevos User-Agents IA"
        />

        <h2>Los Crawlers de Datos Brutos a Vigilar</h2>
        <p>
          Cuidado con CCBot (Common Crawl) o Bytespider. Suelen ser más agresivos y alimentan bases de datos usadas por muchas IAs de terceros. Bloquearlos puede reducir la carga de tu servidor.
        </p>
        <p>
          Vigila también Amazonbot, Facebookbot (para Meta AI), y los nuevos entrantes como Applebot-Extended para Apple Intelligence.
        </p>

        <h2>Cómo Analizar tus Logs</h2>
        <p>
          Accede a tus logs de servidor y filtra por User-Agent. Identifica la frecuencia de rastreo, las páginas visitadas y el comportamiento de cada bot. Ajusta tu robots.txt en consecuencia.
        </p>

        <blockquote>
          "En 2026, más de 50 User-Agents IA diferentes recorren activamente la web. Solo el 10% de los sitios web tienen una política robots.txt adaptada a esta realidad."
        </blockquote>
      </>
    ),
  },

  // --- SATELLITE 10: E-E-A-T Expertise Algorithme ---
  'eeat-expertise-algorithme': {
    fr: (
      <>
        <SummaryBox
          points={[
            "Définition de l'Experience, Expertise, Authoritativeness, Trustworthiness.",
            "L'importance des pages 'Auteur'.",
            "Lier ses profils sociaux via le Schema.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Pour Google et les IA, si vous n'êtes pas un expert vérifié, vous êtes une 'hallucination potentielle'. L'E-E-A-T n'est pas un concept abstrait, c'est une liste de critères techniques à valider.
        </p>

        <h2>Optimiser votre page 'À propos' pour les robots</h2>
        <p>
          Votre page À Propos ne doit pas être vague. Elle doit contenir des liens vers vos profils LinkedIn, vos publications externes et vos certifications. C'est votre CV pour les algorithmes.
        </p>
        <p>
          Incluez des mentions de formations, d'expériences professionnelles et de réalisations concrètes. Chaque élément vérifiable renforce votre score E-E-A-T.
        </p>

        <RichLink
          href="/audit-expert"
          title="Vérifiez vos balises auteur"
          description="Analysez si votre expertise est correctement communiquée aux IA"
        />

        <h2>Lier votre entité numérique (SameAs)</h2>
        <p>
          Utilisez la propriété 'sameAs' dans votre balisage Schema pour dire à Google : 'Ce profil LinkedIn est bien le mien'. Cela consolide votre graphe de connaissance (Knowledge Graph).
        </p>
        <p>
          Connectez tous vos profils professionnels : LinkedIn, Twitter/X, GitHub, ResearchGate, et vos publications sur des sites d'autorité.
        </p>

        <h2>L'Experience : Montrez que vous pratiquez</h2>
        <p>
          Le premier 'E' de E-E-A-T est Experience. Partagez des études de cas, des retours terrain, des exemples concrets. L'IA privilégie les sources qui démontrent une expérience réelle du sujet.
        </p>

        <blockquote>
          "Les auteurs avec un Knowledge Graph établi sont 5x plus susceptibles d'être cités par les IA comme sources fiables."
        </blockquote>
      </>
    ),
    en: (
      <>
        <SummaryBox
          points={[
            "Definition of Experience, Expertise, Authoritativeness, Trustworthiness.",
            "The importance of 'Author' pages.",
            "Linking social profiles via Schema.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          For Google and AI, if you're not a verified expert, you're a 'potential hallucination'. E-E-A-T is not an abstract concept, it's a list of technical criteria to validate.
        </p>

        <h2>Optimize Your 'About' Page for Robots</h2>
        <p>
          Your About page should not be vague. It must contain links to your LinkedIn profiles, external publications, and certifications. It's your CV for algorithms.
        </p>
        <p>
          Include mentions of training, professional experiences, and concrete achievements. Every verifiable element strengthens your E-E-A-T score.
        </p>

        <RichLink
          href="/audit-expert"
          title="Check your author tags"
          description="Analyze if your expertise is correctly communicated to AI"
        />

        <h2>Link Your Digital Entity (SameAs)</h2>
        <p>
          Use the 'sameAs' property in your Schema markup to tell Google: 'This LinkedIn profile is indeed mine'. This consolidates your Knowledge Graph.
        </p>
        <p>
          Connect all your professional profiles: LinkedIn, Twitter/X, GitHub, ResearchGate, and your publications on authority sites.
        </p>

        <h2>Experience: Show That You Practice</h2>
        <p>
          The first 'E' in E-E-A-T is Experience. Share case studies, field feedback, concrete examples. AI favors sources that demonstrate real experience with the subject.
        </p>

        <blockquote>
          "Authors with an established Knowledge Graph are 5x more likely to be cited by AI as reliable sources."
        </blockquote>
      </>
    ),
    es: (
      <>
        <SummaryBox
          points={[
            "Definición de Experience, Expertise, Authoritativeness, Trustworthiness.",
            "La importancia de las páginas 'Autor'.",
            "Vincular perfiles sociales via Schema.",
          ]}
        />

        <p className="text-lg font-medium text-foreground mb-6">
          Para Google y las IA, si no eres un experto verificado, eres una 'alucinación potencial'. E-E-A-T no es un concepto abstracto, es una lista de criterios técnicos a validar.
        </p>

        <h2>Optimiza tu Página 'Acerca de' para los Robots</h2>
        <p>
          Tu página Acerca de no debe ser vaga. Debe contener enlaces a tus perfiles de LinkedIn, publicaciones externas y certificaciones. Es tu CV para los algoritmos.
        </p>
        <p>
          Incluye menciones de formaciones, experiencias profesionales y logros concretos. Cada elemento verificable refuerza tu puntuación E-E-A-T.
        </p>

        <RichLink
          href="/audit-expert"
          title="Verifica tus etiquetas de autor"
          description="Analiza si tu experiencia está correctamente comunicada a las IA"
        />

        <h2>Vincular tu Entidad Digital (SameAs)</h2>
        <p>
          Usa la propiedad 'sameAs' en tu marcado Schema para decir a Google: 'Este perfil de LinkedIn es realmente mío'. Esto consolida tu Knowledge Graph.
        </p>
        <p>
          Conecta todos tus perfiles profesionales: LinkedIn, Twitter/X, GitHub, ResearchGate, y tus publicaciones en sitios de autoridad.
        </p>

        <h2>La Experience: Muestra que Practicas</h2>
        <p>
          La primera 'E' de E-E-A-T es Experience. Comparte estudios de caso, retroalimentación de campo, ejemplos concretos. La IA privilegia las fuentes que demuestran experiencia real con el tema.
        </p>

        <blockquote>
          "Los autores con un Knowledge Graph establecido son 5x más propensos a ser citados por las IA como fuentes confiables."
        </blockquote>
      </>
    ),
  },
};
