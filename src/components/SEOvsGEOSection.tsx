import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Brain, ArrowRight, CheckCircle2, 
  XCircle, AlertTriangle, Zap, Users,
  Globe, Target, TrendingUp, Clock
} from 'lucide-react';

const translations = {
  fr: {
    title: "SEO vs GEO : deux stratégies complémentaires pour dominer en 2026",
    subtitle: "Comprendre les différences fondamentales entre le référencement classique et l'optimisation pour les moteurs de réponse IA",
    introTitle: "L'évolution du paysage digital",
    intro: `Le Search Engine Optimization (SEO) a longtemps été la pierre angulaire de toute stratégie de visibilité en ligne. Pendant plus de deux décennies, les entreprises ont optimisé leurs sites pour apparaître dans les résultats de recherche de Google, Bing et Yahoo. Mais l'émergence de l'intelligence artificielle générative bouleverse profondément ce paradigme. En 2026, une nouvelle discipline s'impose : le Generative Engine Optimization (GEO), l'art d'être cité par les assistants IA comme ChatGPT, Claude, Gemini et Perplexity. Ces deux approches ne sont pas opposées mais complémentaires, et comprendre leurs différences est essentiel pour maintenir sa compétitivité.`,
    criteriaTitle: "Critères d'optimisation : des philosophies distinctes",
    criteriaText: `Le SEO traditionnel repose sur des centaines de facteurs de classement : densité de mots-clés, vitesse de chargement, backlinks, expérience utilisateur, Core Web Vitals, structure du site, balises meta, et bien d'autres. Google analyse ces signaux pour attribuer un score de pertinence à chaque page. Le GEO, en revanche, se concentre sur la citabilité du contenu par les modèles de langage. Les critères clés incluent : la présence de données structurées (Schema.org JSON-LD), la clarté des réponses factuelles, l'autorité des sources citées, la fraîcheur du contenu et la cohérence sémantique. Les LLM privilégient les contenus qui répondent directement aux questions avec des faits vérifiables, des statistiques sourcées et des tableaux comparatifs.`,
    suggestionsTitle: "Nombre de suggestions : la rareté en GEO",
    suggestionsText: `Voici une différence cruciale souvent sous-estimée : alors que Google affiche généralement 10 résultats organiques par page (plus les publicités, les featured snippets et les résultats enrichis), les moteurs de réponse IA ne citent que 3 à 5 sources maximum par réponse. Cette compression drastique de la visibilité signifie que seules les sources les plus pertinentes et les plus fiables sont mentionnées. En SEO, vous pouvez vous contenter d'apparaître en page 2 ou 3 et capter quand même du trafic marginal. En GEO, c'est le "winner takes all" : si vous n'êtes pas dans le top 3 des sources citables, vous êtes invisible. Cette réalité impose une exigence de qualité et de précision sans précédent dans la création de contenu.`,
    competitionTitle: "Impact sur la concurrence : un nouveau champ de bataille",
    competitionText: `Le GEO redistribue les cartes de la compétition digitale. Des sites web qui dominaient grâce à des stratégies de backlinks agressives ou des budgets publicitaires importants peuvent se retrouver ignorés par les IA s'ils ne produisent pas de contenu structuré et factuel. À l'inverse, des petites entreprises avec un contenu de haute qualité et bien balisé peuvent être citées devant des géants de leur industrie. Cette démocratisation apparente cache cependant un défi : les grandes entreprises investissent massivement dans l'optimisation GEO avec des équipes dédiées. Pour les TPE et PME, disposer d'outils automatisés comme Crawlers AI devient un avantage concurrentiel décisif pour analyser et corriger rapidement leurs lacunes techniques.`,
    tableTitle: "Comparatif SEO vs GEO : critères clés",
    tableSeo: "SEO Traditionnel",
    tableGeo: "GEO (IA Générative)",
    tableRows: [
      { 
        criteria: "Objectif principal", 
        seo: "Classement dans les SERP", 
        geo: "Citation par les LLM",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Nombre de positions visibles", 
        seo: "~10 résultats par page", 
        geo: "3-5 sources citées max",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Facteur clé n°1", 
        seo: "Backlinks de qualité", 
        geo: "Données structurées JSON-LD",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Format de contenu idéal", 
        seo: "Long-form optimisé mots-clés", 
        geo: "Réponses factuelles + tableaux",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Vitesse d'indexation", 
        seo: "Jours à semaines", 
        geo: "Mise à jour des modèles (mois)",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Mesurabilité", 
        seo: "Google Search Console, Analytics", 
        geo: "Outils spécialisés (Crawlers AI)",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Coût d'entrée", 
        seo: "Modéré (outils disponibles)", 
        geo: "Élevé (expertise rare)",
        seoStatus: "good",
        geoStatus: "bad"
      },
      { 
        criteria: "Impact long terme", 
        seo: "Trafic organique durable", 
        geo: "Autorité IA croissante",
        seoStatus: "good",
        geoStatus: "good"
      },
    ],
    conclusionTitle: "Pourquoi combiner SEO et GEO en 2026",
    conclusion: `La question n'est plus de choisir entre SEO et GEO, mais de maîtriser les deux. Un site parfaitement optimisé pour Google mais ignoré par ChatGPT perd une part croissante de son audience potentielle, car de plus en plus d'utilisateurs commencent leurs recherches directement dans les assistants IA. Inversement, un site optimisé uniquement pour les LLM sans fondations SEO solides manquera de l'autorité nécessaire pour être considéré comme source fiable. La stratégie gagnante consiste à construire des pages qui excellent dans les deux paradigmes : structure technique irréprochable pour les crawlers, contenu riche et factuel pour les humains, et balisage sémantique complet pour les moteurs de réponse IA. C'est exactement ce que Crawlers AI vous aide à réaliser avec ses audits multi-dimensionnels.`,
  },
  en: {
    title: "SEO vs GEO: Two Complementary Strategies to Dominate in 2026",
    subtitle: "Understanding the fundamental differences between traditional SEO and optimization for AI answer engines",
    introTitle: "The Evolution of the Digital Landscape",
    intro: `Search Engine Optimization (SEO) has long been the cornerstone of any online visibility strategy. For over two decades, businesses have optimized their sites to appear in search results from Google, Bing and Yahoo. But the emergence of generative artificial intelligence profoundly disrupts this paradigm. In 2026, a new discipline is emerging: Generative Engine Optimization (GEO), the art of being cited by AI assistants like ChatGPT, Claude, Gemini and Perplexity. These two approaches are not opposed but complementary, and understanding their differences is essential to maintaining competitiveness.`,
    criteriaTitle: "Optimization Criteria: Distinct Philosophies",
    criteriaText: `Traditional SEO relies on hundreds of ranking factors: keyword density, loading speed, backlinks, user experience, Core Web Vitals, site structure, meta tags, and many others. Google analyzes these signals to assign a relevance score to each page. GEO, on the other hand, focuses on content citability by language models. Key criteria include: presence of structured data (Schema.org JSON-LD), clarity of factual answers, authority of cited sources, content freshness and semantic coherence. LLMs favor content that directly answers questions with verifiable facts, sourced statistics and comparison tables.`,
    suggestionsTitle: "Number of Suggestions: Scarcity in GEO",
    suggestionsText: `Here is a crucial difference often underestimated: while Google typically displays 10 organic results per page (plus ads, featured snippets and rich results), AI answer engines only cite 3 to 5 sources maximum per response. This drastic compression of visibility means that only the most relevant and reliable sources are mentioned. In SEO, you can settle for appearing on page 2 or 3 and still capture marginal traffic. In GEO, it's "winner takes all": if you're not in the top 3 citable sources, you're invisible. This reality imposes an unprecedented requirement for quality and precision in content creation.`,
    competitionTitle: "Impact on Competition: A New Battlefield",
    competitionText: `GEO redistributes the cards of digital competition. Websites that dominated through aggressive backlink strategies or large advertising budgets may find themselves ignored by AI if they don't produce structured and factual content. Conversely, small businesses with high-quality, well-tagged content can be cited ahead of industry giants. This apparent democratization hides a challenge however: large companies are investing heavily in GEO optimization with dedicated teams. For VSBs and SMEs, having automated tools like Crawlers AI becomes a decisive competitive advantage to quickly analyze and correct their technical gaps.`,
    tableTitle: "SEO vs GEO Comparison: Key Criteria",
    tableSeo: "Traditional SEO",
    tableGeo: "GEO (Generative AI)",
    tableRows: [
      { 
        criteria: "Main objective", 
        seo: "Ranking in SERPs", 
        geo: "Citation by LLMs",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Number of visible positions", 
        seo: "~10 results per page", 
        geo: "3-5 sources cited max",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Key factor #1", 
        seo: "Quality backlinks", 
        geo: "JSON-LD structured data",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Ideal content format", 
        seo: "Keyword-optimized long-form", 
        geo: "Factual answers + tables",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Indexing speed", 
        seo: "Days to weeks", 
        geo: "Model updates (months)",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Measurability", 
        seo: "Google Search Console, Analytics", 
        geo: "Specialized tools (Crawlers AI)",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Entry cost", 
        seo: "Moderate (tools available)", 
        geo: "High (rare expertise)",
        seoStatus: "good",
        geoStatus: "bad"
      },
      { 
        criteria: "Long-term impact", 
        seo: "Sustainable organic traffic", 
        geo: "Growing AI authority",
        seoStatus: "good",
        geoStatus: "good"
      },
    ],
    conclusionTitle: "Why Combine SEO and GEO in 2026",
    conclusion: `The question is no longer whether to choose between SEO and GEO, but to master both. A site perfectly optimized for Google but ignored by ChatGPT loses a growing share of its potential audience, as more and more users start their searches directly in AI assistants. Conversely, a site optimized only for LLMs without solid SEO foundations will lack the authority needed to be considered a reliable source. The winning strategy is to build pages that excel in both paradigms: impeccable technical structure for crawlers, rich and factual content for humans, and complete semantic markup for AI answer engines. This is exactly what Crawlers AI helps you achieve with its multi-dimensional audits.`,
  },
  es: {
    title: "SEO vs GEO: Dos Estrategias Complementarias para Dominar en 2026",
    subtitle: "Comprender las diferencias fundamentales entre el SEO clásico y la optimización para motores de respuesta IA",
    introTitle: "La Evolución del Panorama Digital",
    intro: `La Optimización para Motores de Búsqueda (SEO) ha sido durante mucho tiempo la piedra angular de toda estrategia de visibilidad en línea. Durante más de dos décadas, las empresas han optimizado sus sitios para aparecer en los resultados de búsqueda de Google, Bing y Yahoo. Pero la aparición de la inteligencia artificial generativa trastorna profundamente este paradigma. En 2026, una nueva disciplina se impone: la Generative Engine Optimization (GEO), el arte de ser citado por asistentes de IA como ChatGPT, Claude, Gemini y Perplexity. Estos dos enfoques no son opuestos sino complementarios, y comprender sus diferencias es esencial para mantener la competitividad.`,
    criteriaTitle: "Criterios de Optimización: Filosofías Distintas",
    criteriaText: `El SEO tradicional se basa en cientos de factores de clasificación: densidad de palabras clave, velocidad de carga, backlinks, experiencia de usuario, Core Web Vitals, estructura del sitio, meta etiquetas y muchos otros. Google analiza estas señales para asignar una puntuación de relevancia a cada página. El GEO, por otro lado, se centra en la citabilidad del contenido por los modelos de lenguaje. Los criterios clave incluyen: presencia de datos estructurados (Schema.org JSON-LD), claridad de las respuestas factuales, autoridad de las fuentes citadas, frescura del contenido y coherencia semántica. Los LLM favorecen los contenidos que responden directamente a las preguntas con hechos verificables, estadísticas con fuentes y tablas comparativas.`,
    suggestionsTitle: "Número de Sugerencias: La Escasez en GEO",
    suggestionsText: `Aquí hay una diferencia crucial a menudo subestimada: mientras que Google generalmente muestra 10 resultados orgánicos por página (más anuncios, snippets destacados y resultados enriquecidos), los motores de respuesta IA solo citan 3 a 5 fuentes como máximo por respuesta. Esta compresión drástica de la visibilidad significa que solo se mencionan las fuentes más relevantes y confiables. En SEO, puede conformarse con aparecer en la página 2 o 3 y aún captar tráfico marginal. En GEO, es "el ganador se lo lleva todo": si no está entre las 3 principales fuentes citables, es invisible. Esta realidad impone una exigencia de calidad y precisión sin precedentes en la creación de contenido.`,
    competitionTitle: "Impacto en la Competencia: Un Nuevo Campo de Batalla",
    competitionText: `El GEO redistribuye las cartas de la competencia digital. Los sitios web que dominaban gracias a estrategias agresivas de backlinks o presupuestos publicitarios importantes pueden verse ignorados por la IA si no producen contenido estructurado y factual. Por el contrario, las pequeñas empresas con contenido de alta calidad y bien etiquetado pueden ser citadas por delante de gigantes de su industria. Esta aparente democratización esconde sin embargo un desafío: las grandes empresas invierten masivamente en optimización GEO con equipos dedicados. Para las MYPES y PYMES, disponer de herramientas automatizadas como Crawlers AI se convierte en una ventaja competitiva decisiva para analizar y corregir rápidamente sus deficiencias técnicas.`,
    tableTitle: "Comparativa SEO vs GEO: Criterios Clave",
    tableSeo: "SEO Tradicional",
    tableGeo: "GEO (IA Generativa)",
    tableRows: [
      { 
        criteria: "Objetivo principal", 
        seo: "Clasificación en SERPs", 
        geo: "Citación por LLMs",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Número de posiciones visibles", 
        seo: "~10 resultados por página", 
        geo: "3-5 fuentes citadas máx",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Factor clave n°1", 
        seo: "Backlinks de calidad", 
        geo: "Datos estructurados JSON-LD",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Formato de contenido ideal", 
        seo: "Long-form optimizado keywords", 
        geo: "Respuestas factuales + tablas",
        seoStatus: "neutral",
        geoStatus: "neutral"
      },
      { 
        criteria: "Velocidad de indexación", 
        seo: "Días a semanas", 
        geo: "Actualización de modelos (meses)",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Medibilidad", 
        seo: "Google Search Console, Analytics", 
        geo: "Herramientas especializadas (Crawlers AI)",
        seoStatus: "good",
        geoStatus: "warning"
      },
      { 
        criteria: "Costo de entrada", 
        seo: "Moderado (herramientas disponibles)", 
        geo: "Alto (experiencia rara)",
        seoStatus: "good",
        geoStatus: "bad"
      },
      { 
        criteria: "Impacto a largo plazo", 
        seo: "Tráfico orgánico sostenible", 
        geo: "Autoridad IA creciente",
        seoStatus: "good",
        geoStatus: "good"
      },
    ],
    conclusionTitle: "Por Qué Combinar SEO y GEO en 2026",
    conclusion: `La pregunta ya no es si elegir entre SEO y GEO, sino dominar ambos. Un sitio perfectamente optimizado para Google pero ignorado por ChatGPT pierde una parte creciente de su audiencia potencial, ya que cada vez más usuarios comienzan sus búsquedas directamente en los asistentes de IA. Por el contrario, un sitio optimizado solo para LLMs sin bases SEO sólidas carecerá de la autoridad necesaria para ser considerado una fuente confiable. La estrategia ganadora consiste en construir páginas que sobresalgan en ambos paradigmas: estructura técnica impecable para los crawlers, contenido rico y factual para los humanos, y marcado semántico completo para los motores de respuesta IA. Esto es exactamente lo que Crawlers AI le ayuda a lograr con sus auditorías multidimensionales.`,
  },
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'good':
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case 'bad':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
};

export function SEOvsGEOSection() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/30" aria-label="SEO vs GEO comparaison">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center gap-3 mb-4">
            <Badge variant="outline" className="gap-2">
              <Search className="h-3.5 w-3.5" />
              SEO
            </Badge>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <Badge className="gap-2 bg-primary">
              <Brain className="h-3.5 w-3.5" />
              GEO
            </Badge>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            {t.title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t.subtitle}
          </p>
        </motion.div>

        {/* Introduction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-primary" />
                {t.introTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                {t.intro}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Content Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-6 mb-10"
        >
          {/* Criteria Card */}
          <motion.div variants={itemVariants}>
            <Card className="hover:shadow-lg transition-shadow duration-300 overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-gradient-to-b from-primary to-primary/50" />
                <div className="flex-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="h-5 w-5 text-primary" />
                      {t.criteriaTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t.criteriaText}
                    </p>
                  </CardContent>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Suggestions Card */}
          <motion.div variants={itemVariants}>
            <Card className="hover:shadow-lg transition-shadow duration-300 overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-gradient-to-b from-warning to-warning/50" />
                <div className="flex-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Zap className="h-5 w-5 text-warning" />
                      {t.suggestionsTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t.suggestionsText}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Search className="h-3 w-3" />
                        Google: ~10 résultats
                      </Badge>
                      <Badge variant="outline" className="gap-1 border-warning text-warning">
                        <Brain className="h-3 w-3" />
                        LLM: 3-5 sources
                      </Badge>
                    </div>
                  </CardContent>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Competition Card */}
          <motion.div variants={itemVariants}>
            <Card className="hover:shadow-lg transition-shadow duration-300 overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-gradient-to-b from-orange-500 to-orange-500/50" />
                <div className="flex-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5 text-orange-500" />
                      {t.competitionTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t.competitionText}
                    </p>
                  </CardContent>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10"
        >
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-warning/10 to-primary/10 py-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t.tableTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" itemScope itemType="https://schema.org/Table">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-semibold min-w-[150px]">Critère</th>
                      <th className="text-center p-3 font-semibold min-w-[180px]">
                        <div className="flex items-center justify-center gap-2">
                          <Search className="h-4 w-4 text-blue-500" />
                          {t.tableSeo}
                        </div>
                      </th>
                      <th className="text-center p-3 font-semibold min-w-[180px]">
                        <div className="flex items-center justify-center gap-2">
                          <Brain className="h-4 w-4 text-primary" />
                          {t.tableGeo}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.tableRows.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium text-foreground">{row.criteria}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-muted-foreground text-xs">{row.seo}</span>
                            {getStatusIcon(row.seoStatus)}
                          </div>
                        </td>
                        <td className="p-3 text-center bg-primary/5">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-muted-foreground text-xs">{row.geo}</span>
                            {getStatusIcon(row.geoStatus)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Conclusion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                {t.conclusionTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                {t.conclusion}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
