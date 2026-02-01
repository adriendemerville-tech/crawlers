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
};
