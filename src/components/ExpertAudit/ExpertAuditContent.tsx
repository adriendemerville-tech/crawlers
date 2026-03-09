import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Target, Zap, Brain, Shield, BarChart3, 
  CheckCircle2, TrendingUp, Globe 
} from 'lucide-react';

const contentData = {
  fr: {
    heroTitle: "Optimisez votre visibilité SEO et IA avec le Score 200",
    heroSubtitle: "L'outil de référence pour évaluer et améliorer votre présence sur Google, ChatGPT, Claude et les moteurs de recherche génératifs de 2026.",
    
    introTitle: "Pourquoi le Score SEO 200 est essentiel en 2026 ?",
    introText: "Les règles du référencement évoluent rapidement. En 2026, votre site doit être visible non seulement sur Google, mais aussi dans les réponses des intelligences artificielles génératives comme ChatGPT, Claude, Perplexity et Google SGE. Le Score SEO 200 est le premier indicateur complet qui mesure votre performance sur ces deux dimensions critiques.",
    
    pillarsTitle: "Les 5 piliers de l'excellence SEO & IA",
    pillars: [
      {
        icon: "Zap",
        title: "Performance (40 points)",
        description: "Vitesse de chargement, Core Web Vitals (LCP, CLS, TBT). Un site rapide est mieux indexé par Google et plus facilement analysé par les crawlers IA."
      },
      {
        icon: "Settings",
        title: "Socle Technique (50 points)",
        description: "Score SEO PageSpeed, protocole HTTPS, accessibilité HTTP. Les fondations techniques garantissent une indexation optimale."
      },
      {
        icon: "FileText",
        title: "Sémantique & Contenu (60 points)",
        description: "Balises Title et Meta, hiérarchie H1, densité de contenu. Un contenu structuré est plus facilement compris par les LLM."
      },
      {
        icon: "Brain",
        title: "Préparation IA & GEO (30 points)",
        description: "Données structurées JSON-LD, robots.txt permissif pour GPTBot et ClaudeBot. Maximisez votre citabilité dans les réponses IA."
      },
      {
        icon: "Shield",
        title: "Santé & Sécurité (20 points)",
        description: "Certificat SSL, analyse Safe Browsing. Un site sécurisé inspire confiance aux utilisateurs et aux algorithmes."
      }
    ],
    
    geoTitle: "Qu'est-ce que le GEO (Generative Engine Optimization) ?",
    geoText: "Le GEO est la nouvelle discipline du marketing digital qui vise à optimiser votre contenu pour être cité comme source fiable par les moteurs de recherche génératifs. Contrairement au SEO classique qui cible les liens bleus de Google, le GEO se concentre sur la citabilité : votre capacité à apparaître dans les réponses textuelles des IA.",
    
    geoPoints: [
      "Création de contenu factuel avec données chiffrées et sources vérifiables",
      "Intégration de données structurées Schema.org pour la compréhension sémantique",
      "Optimisation du robots.txt pour autoriser les crawlers IA (GPTBot, ClaudeBot, PerplexityBot)",
      "Développement de l'autorité d'entité via Wikidata, presse et écosystème web"
    ],

    seoGeoTitle: "SEO et GEO : deux stratégies complémentaires en 2026",
    seoGeoText: "Le référencement naturel (SEO) et l'optimisation pour les moteurs génératifs (GEO) ne sont pas des approches concurrentes — elles se renforcent mutuellement. Un socle technique solide (HTTPS, Core Web Vitals, balisage HTML propre) facilite à la fois l'indexation Google et le crawling par GPTBot, ClaudeBot ou PerplexityBot. De même, un contenu sémantiquement riche avec des données structurées JSON-LD améliore votre positionnement classique tout en augmentant votre taux de citation par les LLM.",
    
    codeTitle: "Du diagnostic au code correctif en un clic",
    codeText: "Contrairement aux outils d'audit traditionnels qui se limitent à lister des erreurs, Crawlers.fr génère un code correctif personnalisé (JSON-LD, balises meta, robots.txt) directement injectable dans votre CMS. Chaque recommandation est priorisée par impact SEO et GEO, et le code est adapté à votre stack technique — WordPress, Shopify, ou site custom. Vous passez du diagnostic à l'action sans intervention développeur.",
    
    ctaTitle: "Analysez votre site gratuitement",
    ctaText: "Obtenez votre Score SEO 200 en quelques secondes et découvrez vos opportunités d'amélioration pour dominer l'écosystème Search & IA de 2026."
  },
  en: {
    heroTitle: "Optimize your SEO and AI visibility with Score 200",
    heroSubtitle: "The reference tool to evaluate and improve your presence on Google, ChatGPT, Claude, and the generative search engines of 2026.",
    
    introTitle: "Why is the SEO 200 Score essential in 2026?",
    introText: "SEO rules are evolving rapidly. In 2026, your site must be visible not only on Google but also in the responses of generative AI like ChatGPT, Claude, Perplexity, and Google SGE. The SEO 200 Score is the first comprehensive indicator that measures your performance on these two critical dimensions.",
    
    pillarsTitle: "The 5 pillars of SEO & AI excellence",
    pillars: [
      {
        icon: "Zap",
        title: "Performance (40 points)",
        description: "Loading speed, Core Web Vitals (LCP, CLS, TBT). A fast site is better indexed by Google and more easily analyzed by AI crawlers."
      },
      {
        icon: "Settings",
        title: "Technical Foundation (50 points)",
        description: "PageSpeed SEO score, HTTPS protocol, HTTP accessibility. Technical foundations ensure optimal indexing."
      },
      {
        icon: "FileText",
        title: "Semantics & Content (60 points)",
        description: "Title and Meta tags, H1 hierarchy, content density. Structured content is more easily understood by LLMs."
      },
      {
        icon: "Brain",
        title: "AI & GEO Readiness (30 points)",
        description: "JSON-LD structured data, permissive robots.txt for GPTBot and ClaudeBot. Maximize your citability in AI responses."
      },
      {
        icon: "Shield",
        title: "Health & Security (20 points)",
        description: "SSL certificate, Safe Browsing analysis. A secure site inspires trust in users and algorithms."
      }
    ],
    
    geoTitle: "What is GEO (Generative Engine Optimization)?",
    geoText: "GEO is the new digital marketing discipline that aims to optimize your content to be cited as a reliable source by generative search engines. Unlike traditional SEO which targets Google's blue links, GEO focuses on citability: your ability to appear in AI text responses.",
    
    geoPoints: [
      "Creating factual content with data and verifiable sources",
      "Integrating Schema.org structured data for semantic understanding",
      "Optimizing robots.txt to allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot)",
      "Developing entity authority via Wikidata, press, and web ecosystem"
    ],

    seoGeoTitle: "SEO and GEO: two complementary strategies in 2026",
    seoGeoText: "Search engine optimization (SEO) and generative engine optimization (GEO) are not competing approaches — they reinforce each other. A solid technical foundation (HTTPS, Core Web Vitals, clean HTML markup) facilitates both Google indexing and crawling by GPTBot, ClaudeBot or PerplexityBot. Similarly, semantically rich content with JSON-LD structured data improves your traditional ranking while increasing your LLM citation rate.",
    
    codeTitle: "From diagnosis to corrective code in one click",
    codeText: "Unlike traditional audit tools that only list errors, Crawlers.fr generates custom corrective code (JSON-LD, meta tags, robots.txt) directly injectable into your CMS. Each recommendation is prioritized by SEO and GEO impact, and the code is adapted to your tech stack — WordPress, Shopify, or custom site. Go from diagnosis to action without developer intervention.",
    
    ctaTitle: "Analyze your site for free",
    ctaText: "Get your SEO 200 Score in seconds and discover improvement opportunities to dominate the 2026 Search & AI ecosystem."
  },
  es: {
    heroTitle: "Optimiza tu visibilidad SEO e IA con el Score 200",
    heroSubtitle: "La herramienta de referencia para evaluar y mejorar tu presencia en Google, ChatGPT, Claude y los motores de búsqueda generativos de 2026.",
    
    introTitle: "¿Por qué el Score SEO 200 es esencial en 2026?",
    introText: "Las reglas del SEO evolucionan rápidamente. En 2026, tu sitio debe ser visible no solo en Google, sino también en las respuestas de las inteligencias artificiales generativas como ChatGPT, Claude, Perplexity y Google SGE. El Score SEO 200 es el primer indicador completo que mide tu rendimiento en estas dos dimensiones críticas.",
    
    pillarsTitle: "Los 5 pilares de la excelencia SEO e IA",
    pillars: [
      {
        icon: "Zap",
        title: "Rendimiento (40 puntos)",
        description: "Velocidad de carga, Core Web Vitals (LCP, CLS, TBT). Un sitio rápido es mejor indexado por Google y más fácilmente analizado por los crawlers IA."
      },
      {
        icon: "Settings",
        title: "Base Técnica (50 puntos)",
        description: "Score SEO PageSpeed, protocolo HTTPS, accesibilidad HTTP. Los fundamentos técnicos garantizan una indexación óptima."
      },
      {
        icon: "FileText",
        title: "Semántica y Contenido (60 puntos)",
        description: "Etiquetas Title y Meta, jerarquía H1, densidad de contenido. Un contenido estructurado es más fácilmente comprendido por los LLM."
      },
      {
        icon: "Brain",
        title: "Preparación IA y GEO (30 puntos)",
        description: "Datos estructurados JSON-LD, robots.txt permisivo para GPTBot y ClaudeBot. Maximiza tu citabilidad en las respuestas IA."
      },
      {
        icon: "Shield",
        title: "Salud y Seguridad (20 puntos)",
        description: "Certificado SSL, análisis Safe Browsing. Un sitio seguro inspira confianza a los usuarios y algoritmos."
      }
    ],
    
    geoTitle: "¿Qué es el GEO (Generative Engine Optimization)?",
    geoText: "El GEO es la nueva disciplina del marketing digital que busca optimizar tu contenido para ser citado como fuente confiable por los motores de búsqueda generativos. A diferencia del SEO clásico que apunta a los enlaces azules de Google, el GEO se centra en la citabilidad: tu capacidad de aparecer en las respuestas textuales de las IA.",
    
    geoPoints: [
      "Creación de contenido factual con datos y fuentes verificables",
      "Integración de datos estructurados Schema.org para comprensión semántica",
      "Optimización del robots.txt para permitir crawlers IA (GPTBot, ClaudeBot, PerplexityBot)",
      "Desarrollo de autoridad de entidad vía Wikidata, prensa y ecosistema web"
    ],
    
    ctaTitle: "Analiza tu sitio gratis",
    ctaText: "Obtén tu Score SEO 200 en segundos y descubre oportunidades de mejora para dominar el ecosistema Search e IA de 2026."
  }
};

const iconMap: Record<string, React.ReactNode> = {
  Zap: <Zap className="h-6 w-6 text-primary" />,
  Settings: <BarChart3 className="h-6 w-6 text-primary" />,
  FileText: <Target className="h-6 w-6 text-primary" />,
  Brain: <Brain className="h-6 w-6 text-primary" />,
  Shield: <Shield className="h-6 w-6 text-primary" />
};

export function ExpertAuditContent() {
  const { language } = useLanguage();
  const content = contentData[language] || contentData.fr;

  return (
    <section className="container mx-auto px-4 py-12 max-w-6xl space-y-16">
      {/* Introduction */}
      <div className="text-center max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {content.introTitle}
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          {content.introText}
        </p>
      </div>

      {/* 5 Pillars */}
      <div>
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          {content.pillarsTitle}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {content.pillars.map((pillar, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 p-2 rounded-lg bg-primary/10">
                    {iconMap[pillar.icon]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {pillar.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* GEO Explanation */}
      <div className="bg-gradient-to-br from-primary/5 via-transparent to-primary/5 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            {content.geoTitle}
          </h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6">
          {content.geoText}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {content.geoPoints.map((point, index) => (
            <div key={index} className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">{point}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center bg-card border rounded-2xl p-8">
        <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          {content.ctaTitle}
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          {content.ctaText}
        </p>
      </div>
    </section>
  );
}
