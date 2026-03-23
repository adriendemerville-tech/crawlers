import { memo, useEffect, useRef, useState } from 'react';
import { AIBotsLeadMagnet } from '@/components/Homepage/AIBotsLeadMagnet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, Shield, Fingerprint, Brain, 
  Target, FileSearch, Network, Layers,
  CheckCircle2, XCircle, TrendingUp, BarChart3, AlertTriangle,
  Bot, Globe, Zap, Search
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import llmChatgpt from '@/assets/llm-chatgpt.png';
import llmGemini from '@/assets/llm-gemini.png';
import llmPerplexity from '@/assets/llm-perplexity.png';
import llmClaude from '@/assets/llm-claude.png';
import llmGrok from '@/assets/llm-grok.png';
import llmMistral from '@/assets/mistral-logo-2025.png';

/* ─── Animated Counter ─── */
function AnimatedCounter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        const duration = 1800;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  return <span ref={ref}>{prefix}{count.toLocaleString('fr-FR')}{suffix}</span>;
}

/* ─── i18n ─── */
const i18n = {
  fr: {
    momentumTitle: 'En janvier 2028, il y aura autant de recherches via les agents IA que sur Google',
    momentumText: "Google intègre des réponses générées par IA directement dans ses résultats. Les moteurs de recherche traditionnels ne sont plus les seuls arbitres de votre visibilité en ligne. Si votre site n'est pas optimisé pour les LLMs, vous êtes déjà invisible pour une part croissante de vos prospects.",
    stat1: '200M', stat1Label: "d'utilisateurs de LLMs en Europe",
    stat2: 'x3', stat2Label: "taux de conversion LLM vs Google",
    stat3: '6', stat3Label: 'LLMs interrogés simultanément',
    stat4: '5', stat4Label: "outils GEO automatisés",
    // Features
    feat1Title: 'Score GEO — Visibilité IA en temps réel',
    feat1Desc: "Votre site est-il cité par ChatGPT, Gemini, Perplexity ou Claude ? Le Score GEO est le premier indicateur français qui mesure votre présence dans les réponses générées par l'intelligence artificielle. En 30 secondes, obtenez un score sur 100 avec des recommandations actionnables : données structurées manquantes, fichiers robots.txt mal configurés, absence de llms.txt, sémantique insuffisante. Chaque point gagné améliore votre probabilité d'être cité comme source par les LLMs.",
    feat1Cta: 'Tester mon Score GEO',
    feat2Title: 'Audit Expert — 168 critères techniques et sémantiques',
    feat2Desc: "L'Audit Expert de Crawlers analyse votre site sur 168 critères répartis en 6 catégories : balises HTML (title, meta, Hn), données structurées (JSON-LD, Schema.org), performance (Core Web Vitals, temps de chargement), sécurité (HTTPS, headers), accessibilité et optimisation pour les moteurs génératifs. Chaque critère est pondéré selon son impact réel sur votre référencement. Le rapport inclut un plan d'action priorisé et du code correctif prêt à déployer.",
    feat2Cta: "Lancer l'Audit Expert",
    feat3Title: 'Cocon Sémantique 3D — Architecture de contenu intelligente',
    feat3Desc: "Le module Cocon 3D combine un stratège conversationnel IA et un graphe interactif en trois dimensions pour concevoir votre architecture de contenu. L'IA analyse votre domaine, identifie les clusters thématiques, détecte les risques de cannibalisation et propose un maillage interne optimisé. Chaque nœud du graphe représente une page avec son score E-E-A-T, son potentiel de trafic et ses liens internes recommandés.",
    feat3Cta: 'Découvrir Cocon 3D',
    feat4Title: "Matrice d'audit — Votre moteur d'audit personnalisé",
    feat4Desc: "La Matrice d'audit est un outil unique qui vous permet de créer vos propres grilles d'évaluation. Importez vos KPIs depuis un fichier CSV ou DOCX, définissez des seuils et pondérations personnalisés, et testez vos pages contre des prompts LLM. Le moteur supporte 6 types de KPIs : balises, données structurées, performance, sécurité, prompts LLM et métriques combinées. Score pondéré global sur 100.",
    feat4Cta: "Ouvrir la Matrice",
    // Identity First
    idTitle: "L'approche Identity-First",
    idTitle2: "être reconnu, pas seulement indexé",
    idSubtitle: "Les LLMs ne crawlent pas votre site comme Googlebot. Ils cherchent à comprendre qui vous êtes, ce que vous faites et ce qui vous différencie. Sans identité sémantique claire, l'IA vous confond avec vos concurrents — ou vous ignore.",
    idPoint1Title: 'Carte d\'identité sémantique',
    idPoint1: 'Définissez votre entreprise en classes structurées que les LLMs comprennent : activité, zone géographique, cibles, concurrents, différenciateurs.',
    idPoint2Title: 'Taxonomie enrichie par IA vocale',
    idPoint2: 'Dictez votre positionnement au micro. L\'IA transcrit, résume et structure vos réponses en taxonomie exploitable par les moteurs génératifs.',
    idPoint3Title: 'Différenciation concurrentielle',
    idPoint3: 'Identifiez précisément avec qui les IA vous confondent et corrigez votre empreinte sémantique pour vous démarquer dans les réponses générées.',
    idCta: 'Créer ma carte d\'identité',
    // Hybrid
    hybridTitle: 'SEO + GEO : le premier outil français hybride',
    hybridSubtitle: "Les outils SEO classiques analysent votre site pour Google. Crawlers.fr est le premier outil francophone à combiner l'optimisation pour les moteurs de recherche traditionnels ET pour les moteurs génératifs (ChatGPT, Gemini, Perplexity, Claude). Cette approche hybride vous garantit une visibilité maximale, quel que soit le canal de recherche utilisé par vos prospects.",
    colSeo: 'SEO classique', colCrawlers: 'Crawlers.fr',
    row1: 'Audit technique complet',
    row2: 'Score de visibilité IA',
    row3: 'Carte d\'identité sémantique',
    row4: 'Cocon sémantique IA',
    row5: 'Code correctif dynamique',
    row6: 'Maintenance SEO & GEO automatisée',
    hybridCta: 'Essayer gratuitement',
    // Trust
    trustTitle: 'La première plateforme française SEO + GEO full-stack',
    trustText: "Crawlers.fr est la première plateforme française à couvrir l'intégralité de la boucle SEO et GEO : audit technique, correctif généré automatiquement, déploiement en 30 secondes, et mesure d'impact réelle à T+30, T+60 et T+90 jours.\n\nDeux assistants IA spécialisés vous accompagnent à chaque étape : le Stratège Cocoon pour l'analyse de votre graphe sémantique 3D, et l'Assistant Crawlers pour exploiter toute la profondeur de votre data SEO et GEO. La gestion de votre fiche Google Business Profile est intégrée nativement.",
    trustDoubt: "Des doutes ? Les fonctions back-end de Crawlers.fr",
    trustDoubtLine2: "sont consultables sur demande.",
    trustApiTitle: 'Intégrations natives',
    trustApiGoogle: 'APIs Google',
    trustApiCms: 'APIs CMS',
  },
  en: {
    momentumTitle: 'By January 2028, AI agents will generate as many searches as Google',
    momentumText: "Google integrates AI-generated answers directly into its results. Traditional search engines are no longer the only arbiters of your online visibility. If your site isn't optimized for LLMs, you're already invisible to a growing share of your prospects.",
    stat1: '200M', stat1Label: 'LLM users in Europe',
    stat2: 'x3', stat2Label: 'LLM conversion rate vs Google',
    stat3: '6', stat3Label: 'LLMs queried simultaneously',
    stat4: '5', stat4Label: 'automated GEO tools',
    feat1Title: 'GEO Score — Real-time AI Visibility',
    feat1Desc: 'Is your site cited by ChatGPT, Gemini, Perplexity or Claude? The GEO Score is the first French indicator measuring your presence in AI-generated answers. In 30 seconds, get a score out of 100 with actionable recommendations: missing structured data, misconfigured robots.txt, absent llms.txt, insufficient semantics. Every point gained improves your probability of being cited as a source by LLMs.',
    feat1Cta: 'Test my GEO Score',
    feat2Title: 'Expert Audit — 168 Technical & Semantic Criteria',
    feat2Desc: "Crawlers' Expert Audit analyzes your site across 168 criteria in 6 categories: HTML tags (title, meta, Hn), structured data (JSON-LD, Schema.org), performance (Core Web Vitals, load time), security (HTTPS, headers), accessibility and generative engine optimization. Each criterion is weighted by real SEO impact. The report includes a prioritized action plan and deploy-ready corrective code.",
    feat2Cta: 'Launch Expert Audit',
    feat3Title: '3D Semantic Cocoon — Intelligent Content Architecture',
    feat3Desc: 'The Cocoon 3D module combines a conversational AI strategist and an interactive 3D graph to design your content architecture. The AI analyzes your domain, identifies thematic clusters, detects cannibalization risks and proposes optimized internal linking. Each graph node represents a page with its E-E-A-T score, traffic potential and recommended internal links.',
    feat3Cta: 'Discover Cocoon 3D',
    feat4Title: 'Audit Matrix — Your Custom Audit Engine',
    feat4Desc: 'The Audit Matrix lets you create your own evaluation grids. Import KPIs from CSV or DOCX files, define custom thresholds and weights, and test your pages against LLM prompts. The engine supports 6 KPI types: tags, structured data, performance, security, LLM prompts and combined metrics. Global weighted score out of 100.',
    feat4Cta: 'Open the Matrix',
    idTitle: 'The Identity-First Approach',
    idTitle2: 'be recognized, not just indexed',
    idSubtitle: "LLMs don't crawl your site like Googlebot. They seek to understand who you are, what you do and what differentiates you. Without a clear semantic identity, AI confuses you with competitors — or ignores you entirely.",
    idPoint1Title: 'Semantic Identity Card',
    idPoint1: 'Define your business in structured classes that LLMs understand: activity, geographic zone, targets, competitors, differentiators.',
    idPoint2Title: 'Voice AI-Enriched Taxonomy',
    idPoint2: 'Dictate your positioning via microphone. AI transcribes, summarizes and structures your answers into taxonomy usable by generative engines.',
    idPoint3Title: 'Competitive Differentiation',
    idPoint3: 'Identify precisely who AI confuses you with and correct your semantic footprint to stand out in generated answers.',
    idCta: 'Create my identity card',
    hybridTitle: 'SEO + GEO: The First French Hybrid Tool',
    hybridSubtitle: "Classic SEO tools analyze your site for Google. Crawlers.fr is the first French tool combining optimization for traditional search engines AND generative engines (ChatGPT, Gemini, Perplexity, Claude). This hybrid approach guarantees maximum visibility, regardless of the search channel used by your prospects.",
    colSeo: 'Classic SEO', colCrawlers: 'Crawlers.fr',
    row1: 'Complete technical audit', row2: 'AI visibility score', row3: 'Semantic identity card',
    row4: 'AI semantic cocoon', row5: 'Dynamic corrective code', row6: 'Automated SEO & GEO maintenance',
    hybridCta: 'Try for free',
    trustTitle: 'The first French full-stack SEO + GEO platform',
    trustText: 'Crawlers.fr is the first French platform to cover the entire SEO and GEO loop: technical audit, automatically generated fix, deployment in 30 seconds, and real impact measurement at T+30, T+60 and T+90 days.\n\nTwo specialized AI assistants accompany you at every step: the Cocoon Strategist for your 3D semantic graph analysis, and the Crawlers Assistant to leverage the full depth of your SEO and GEO data. Google Business Profile management is natively integrated.',
    trustDoubt: 'Any doubts? Crawlers.fr back-end functions',
    trustDoubtLine2: 'are available for review on request.',
    trustApiTitle: 'Native integrations',
    trustApiGoogle: 'Google APIs',
    trustApiCms: 'CMS APIs',
  },
  es: {
    momentumTitle: 'En enero 2028, habrá tantas búsquedas vía agentes IA como en Google',
    momentumText: 'Google integra respuestas generadas por IA directamente en sus resultados. Los motores de búsqueda tradicionales ya no son los únicos árbitros de su visibilidad en línea. Si su sitio no está optimizado para los LLMs, ya es invisible para una parte creciente de sus prospectos.',
    stat1: '200M', stat1Label: 'usuarios de LLMs en Europa',
    stat2: 'x3', stat2Label: 'tasa de conversión LLM vs Google',
    stat3: '6', stat3Label: 'LLMs consultados simultáneamente',
    stat4: '5', stat4Label: 'herramientas GEO automatizadas',
    feat1Title: 'Score GEO — Visibilidad IA en tiempo real',
    feat1Desc: '¿Tu sitio es citado por ChatGPT, Gemini, Perplexity o Claude? El Score GEO es el primer indicador francés que mide tu presencia en las respuestas generadas por IA. En 30 segundos, obtén una puntuación sobre 100 con recomendaciones accionables: datos estructurados faltantes, robots.txt mal configurado, ausencia de llms.txt, semántica insuficiente.',
    feat1Cta: 'Probar mi Score GEO',
    feat2Title: 'Auditoría Experta — 168 criterios técnicos y semánticos',
    feat2Desc: 'La Auditoría Experta de Crawlers analiza tu sitio en 168 criterios en 6 categorías: etiquetas HTML, datos estructurados (JSON-LD, Schema.org), rendimiento (Core Web Vitals), seguridad (HTTPS, headers), accesibilidad y optimización para motores generativos. Cada criterio está ponderado por su impacto real. El informe incluye un plan de acción priorizado y código correctivo listo para implementar.',
    feat2Cta: 'Lanzar Auditoría Experta',
    feat3Title: 'Cocón Semántico 3D — Arquitectura de contenido inteligente',
    feat3Desc: 'El módulo Cocón 3D combina un estratega conversacional IA y un grafo interactivo en 3D para diseñar tu arquitectura de contenido. La IA analiza tu dominio, identifica clusters temáticos, detecta riesgos de canibalización y propone un enlazado interno optimizado.',
    feat3Cta: 'Descubrir Cocón 3D',
    feat4Title: 'Matriz de auditoría — Tu motor de auditoría personalizado',
    feat4Desc: 'La Matriz de auditoría te permite crear tus propias grillas de evaluación. Importa KPIs desde CSV o DOCX, define umbrales y ponderaciones personalizados, y prueba tus páginas contra prompts LLM. Puntuación ponderada global sobre 100.',
    feat4Cta: 'Abrir la Matriz',
    idTitle: 'El enfoque Identity-First',
    idTitle2: 'ser reconocido, no solo indexado',
    idSubtitle: 'Los LLMs no rastrean tu sitio como Googlebot. Buscan entender quién eres, qué haces y qué te diferencia. Sin una identidad semántica clara, la IA te confunde con tus competidores — o te ignora.',
    idPoint1Title: 'Tarjeta de identidad semántica',
    idPoint1: 'Define tu empresa en clases estructuradas que los LLMs entienden: actividad, zona geográfica, targets, competidores, diferenciadores.',
    idPoint2Title: 'Taxonomía enriquecida por IA de voz',
    idPoint2: 'Dicta tu posicionamiento al micrófono. La IA transcribe, resume y estructura tus respuestas en taxonomía explotable por motores generativos.',
    idPoint3Title: 'Diferenciación competitiva',
    idPoint3: 'Identifica con quién la IA te confunde y corrige tu huella semántica para destacar en las respuestas generadas.',
    idCta: 'Crear mi tarjeta de identidad',
    hybridTitle: 'SEO + GEO: la primera herramienta francesa híbrida',
    hybridSubtitle: 'Las herramientas SEO clásicas analizan tu sitio para Google. Crawlers.fr es la primera herramienta francófona que combina optimización para motores tradicionales Y motores generativos (ChatGPT, Gemini, Perplexity, Claude).',
    colSeo: 'SEO clásico', colCrawlers: 'Crawlers.fr',
    row1: 'Auditoría técnica completa', row2: 'Puntuación de visibilidad IA', row3: 'Tarjeta de identidad semántica',
    row4: 'Cocón semántico IA', row5: 'Código correctivo dinámico', row6: 'Mantenimiento SEO & GEO automatizado',
    hybridCta: 'Probar gratis',
    trustTitle: 'La primera plataforma francesa full-stack SEO + GEO',
    trustText: 'Crawlers.fr es la primera plataforma francesa en cubrir todo el ciclo SEO y GEO: auditoría técnica, corrección generada automáticamente, despliegue en 30 segundos y medición de impacto real a T+30, T+60 y T+90 días.\n\nDos asistentes IA especializados te acompañan en cada etapa: el Estratega Cocoon para el análisis de tu grafo semántico 3D, y el Asistente Crawlers para aprovechar toda la profundidad de tus datos SEO y GEO. La gestión de Google Business Profile está integrada nativamente.',
    trustDoubt: '¿Dudas? Las funciones back-end de Crawlers.fr',
    trustDoubtLine2: 'son consultables bajo solicitud.',
    trustApiTitle: 'Integraciones nativas',
    trustApiGoogle: 'APIs Google',
    trustApiCms: 'APIs CMS',
  },
};

/* ─── Section 1: Momentum KPIs ─── */
const MomentumSection = memo(() => {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;
  const stats = [
    { label: t.stat1Label, display: t.stat1 },
    { label: t.stat2Label, display: t.stat2 },
    { label: t.stat3Label, display: t.stat3 },
    { label: t.stat4Label, display: t.stat4 },
  ];

  const llmLogos = [
    { name: 'ChatGPT', src: llmChatgpt },
    { name: 'Gemini', src: llmGemini },
    { name: 'Perplexity', src: llmPerplexity },
    { name: 'Claude', src: llmClaude },
    { name: 'Grok', src: llmGrok },
    { name: 'Mistral', src: llmMistral },
  ];

  return (
    <section className="border-y border-border bg-card/50 py-12 md:py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <h2 className="text-center text-xl font-bold text-foreground sm:text-2xl mb-4">{t.momentumTitle}</h2>
        <p className="text-center text-muted-foreground text-base sm:text-lg max-w-3xl mx-auto mb-8 leading-relaxed">{t.momentumText}</p>

        {/* LLM logos */}
        <div className="flex items-center justify-center gap-10 mb-10 flex-wrap">
          {llmLogos.map((llm) => (
            <div key={llm.name} className="flex flex-col items-center gap-2">
              <img src={llm.src} alt={llm.name} className="h-14 w-14 object-contain" />
              <span className="text-base font-semibold text-foreground">{llm.name}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-brand-violet">{s.display}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* AI Bots Lead Magnet */}
        <AIBotsLeadMagnet />
      </div>
    </section>
  );
});
MomentumSection.displayName = 'MomentumSection';

/* ─── Section 2: Feature Showcase (redesigned — small icons, no card bg, more text) ─── */
const features = [
  { icon: Target, ctaLink: '/?tab=geo' },
  { icon: FileSearch, ctaLink: '/audit-expert' },
  { icon: Network, ctaLink: '/cocoon' },
  { icon: Layers, ctaLink: '/matrice' },
];

const FeatureShowcase = memo(() => {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;
  const items = [
    { title: t.feat1Title, desc: t.feat1Desc, cta: t.feat1Cta },
    { title: t.feat2Title, desc: t.feat2Desc, cta: t.feat2Cta },
    { title: t.feat3Title, desc: t.feat3Desc, cta: t.feat3Cta },
    { title: t.feat4Title, desc: t.feat4Desc, cta: t.feat4Cta },
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 max-w-4xl space-y-14 md:space-y-20">
        {items.map((item, i) => {
          const feat = features[i];
          const Icon = feat.icon;
          return (
            <div key={i} className="space-y-3">
              {/* Icon + Title inline */}
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-brand-violet shrink-0" strokeWidth={1.8} />
                <h3 className="text-xl font-bold text-foreground sm:text-2xl">{item.title}</h3>
              </div>
              {/* Description — rich text for SEO */}
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed pl-8">{item.desc}</p>
              {/* CTA — transparent with violet border */}
              <div className="pl-8 pt-2">
                <Link to={feat.ctaLink}>
                   <Button variant="outline" className="gap-2 bg-gradient-to-br from-violet-600 to-amber-500 text-white border-violet-600 hover:from-violet-700 hover:to-amber-600 shadow-md">
                    {item.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});
FeatureShowcase.displayName = 'FeatureShowcase';

/* ─── Section 3: Identity First ─── */
const IdentityFirstSection = memo(() => {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;
  const points = [
    { icon: Fingerprint, title: t.idPoint1Title, text: t.idPoint1 },
    { icon: Brain, title: t.idPoint2Title, text: t.idPoint2 },
    { icon: Shield, title: t.idPoint3Title, text: t.idPoint3 },
  ];

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-brand-violet-muted/30 via-background to-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-violet/10 border border-brand-violet/20 px-4 py-1.5 text-sm font-semibold text-brand-violet mb-5">
            <Fingerprint className="h-3.5 w-3.5" />
            Identity-First
          </div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl mb-1">{t.idTitle}</h2>
          <h2 className="text-2xl font-bold text-brand-violet sm:text-3xl mb-4">{t.idTitle2}</h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">{t.idSubtitle}</p>
        </div>

        <div className="space-y-8">
          {points.map((pt, i) => (
            <div key={i} className="flex items-start gap-4">
              <pt.icon className="h-5 w-5 text-brand-violet shrink-0 mt-1" strokeWidth={1.8} />
              <div>
                <h4 className="font-semibold text-foreground text-lg mb-1">{pt.title}</h4>
                <p className="text-base text-muted-foreground leading-relaxed">{pt.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/mes-sites">
             <Button variant="outline" className="gap-2 bg-gradient-to-br from-violet-600 to-amber-500 text-white border-violet-600 hover:from-violet-700 hover:to-amber-600 shadow-md">
              {t.idCta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
});
IdentityFirstSection.displayName = 'IdentityFirstSection';

/* ─── Section 4: SEO + GEO Hybrid Comparison ─── */
const competitorFeatures = [
  { key: 'audit_technique', fr: 'Audit technique complet', en: 'Full technical audit', es: 'Auditoría técnica completa' },
  { key: 'score_geo', fr: 'Score de visibilité IA', en: 'AI visibility score', es: 'Puntuación de visibilidad IA' },
  { key: 'identite', fr: 'Carte d\'identité sémantique', en: 'Semantic identity card', es: 'Tarjeta de identidad semántica' },
  { key: 'cocon', fr: 'Cocon sémantique IA', en: 'AI semantic cocoon', es: 'Cocón semántico IA' },
  { key: 'code_correctif', fr: 'Code correctif dynamique', en: 'Dynamic corrective code', es: 'Código correctivo dinámico' },
  { key: 'maintenance', fr: 'Maintenance SEO & GEO automatisée', en: 'Automated SEO & GEO maintenance', es: 'Mantenimiento SEO & GEO automatizado' },
  { key: 'gmb', fr: 'Gestion Google Business Profile', en: 'Google Business Profile management', es: 'Gestión Google Business Profile' },
  { key: 'assistants', fr: '2 assistants IA spécialisés', en: '2 specialized AI assistants', es: '2 asistentes IA especializados' },
];

// [Screaming Frog, Surfer SEO, Semrush, Meteoria, Crawlers.fr]
// true = ✅, false = ❌, 'partial' = ⚠️
const competitorMatrix: Record<string, (boolean | 'partial')[]> = {
  audit_technique: [true, false, true, false, true],
  score_geo: [false, false, false, true, true],
  identite: [false, false, false, false, true],
  cocon: [false, 'partial', false, false, true],
  code_correctif: [false, false, false, false, true],
  maintenance: [false, false, false, false, true],
  gmb: [false, false, 'partial', false, true],
  assistants: [false, false, false, false, true],
};

const competitors = ['Screaming Frog', 'Surfer SEO', 'Semrush', 'Meteoria', 'Crawlers.fr'];

const HybridSection = memo(() => {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;
  const rows = [t.row1, t.row2, t.row3, t.row4, t.row5, t.row6];
  const seoHas = [true, false, false, false, false, false];
  const lang = language as 'fr' | 'en' | 'es';

  return (
    <section className="py-16 md:py-24 bg-card/50 border-y border-border">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl mb-3">{t.hybridTitle}</h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">{t.hybridSubtitle}</p>
        </div>

        {/* Table 1: SEO classique vs Crawlers */}
        <div className="overflow-hidden rounded-xl border border-border max-w-3xl mx-auto">
          <div className="grid grid-cols-3 bg-muted/50 text-sm sm:text-base font-semibold text-foreground">
            <div className="p-4 text-left">&nbsp;</div>
            <div className="p-4 text-center border-l border-border">{t.colSeo}</div>
            <div className="p-4 text-center border-l border-border text-brand-violet font-bold">{t.colCrawlers}</div>
          </div>
          {rows.map((row, i) => (
            <div key={i} className={cn('grid grid-cols-3 text-sm sm:text-base', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
              <div className="p-4 text-left text-foreground font-medium">{row}</div>
              <div className="p-4 flex items-center justify-center border-l border-border">
                {seoHas[i] ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-muted-foreground/40" />}
              </div>
              <div className="p-4 flex items-center justify-center border-l border-border">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            </div>
          ))}
        </div>

        {/* Table 2: Competitive comparison */}
        <h3 className="text-xl font-bold text-foreground sm:text-2xl text-center mt-16 mb-6">
          {lang === 'fr' ? 'Crawlers.fr face à la concurrence' : lang === 'es' ? 'Crawlers.fr frente a la competencia' : 'Crawlers.fr vs the competition'}
        </h3>
        <div className="overflow-x-auto">
          <div className="overflow-hidden rounded-xl border border-border min-w-[700px]">
            <div className="grid grid-cols-6 bg-muted/50 text-xs sm:text-sm font-semibold text-foreground">
              <div className="p-3">&nbsp;</div>
              {competitors.map((c, i) => (
                <div key={c} className={cn('p-3 text-center border-l border-border', i === 4 && 'text-brand-violet font-bold')}>{c}</div>
              ))}
            </div>
            {competitorFeatures.map((feat, i) => (
              <div key={feat.key} className={cn('grid grid-cols-6 text-xs sm:text-sm', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                <div className="p-3 text-left text-foreground font-medium">{feat[lang] || feat.fr}</div>
                {competitorMatrix[feat.key].map((has, j) => (
                  <div key={j} className="p-3 flex items-center justify-center border-l border-border">
                    {has === true ? <CheckCircle2 className={cn('h-4 w-4', j === 4 ? 'text-brand-violet' : 'text-success')} /> : has === 'partial' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-10">
          <Link to="/">
            <Button variant="outline" className="gap-2 bg-gradient-to-br from-violet-600 to-amber-500 text-white border-violet-600 hover:from-violet-700 hover:to-amber-600 shadow-md">
              {t.hybridCta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
});
HybridSection.displayName = 'HybridSection';

/* ─── Section 5: Trust Banner ─── */
const googleApis = [
  'Google Search Console',
  'Google Analytics 4',
  'Google Business Profile',
  'Google Ads',
  'Google PageSpeed Insights',
];
const cmsApis = [
  'WordPress (REST API)',
  'Shopify',
  'Webflow',
  'Wix',
  'Prestashop',
];

const TrustBanner = memo(() => {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;

  return (
    <section className="py-14 md:py-20 bg-gradient-to-r from-primary/5 via-brand-violet/5 to-primary/5">
      <div className="container mx-auto px-4 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-violet mb-5 text-center">{t.trustTitle}</p>
        <div className="text-foreground text-base sm:text-lg leading-relaxed max-w-3xl mx-auto text-center mb-10 space-y-4">
          {t.trustText.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {/* Doubt phrase */}
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-8">
          {t.trustDoubt}<br />
          {(t as any).trustDoubtLine2}
        </h2>

        {/* API Table */}
        <div className="overflow-hidden rounded-xl border border-border max-w-2xl mx-auto">
          <div className="grid grid-cols-2 bg-muted/50 text-sm font-semibold text-foreground">
            <div className="p-3 text-center">{t.trustApiGoogle}</div>
            <div className="p-3 text-center border-l border-border">{t.trustApiCms}</div>
          </div>
          {googleApis.map((api, i) => (
            <div key={i} className={cn('grid grid-cols-2 text-sm', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
              <div className="p-3 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="text-foreground">{api}</span>
              </div>
              <div className="p-3 flex items-center gap-2 border-l border-border">
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="text-foreground">{cmsApis[i]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Stats under table */}
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-10">
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-extrabold text-brand-violet">12</p>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'fr' ? 'Algorithmes propriétaires' : language === 'es' ? 'Algoritmos propietarios' : 'Proprietary algorithms'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-extrabold text-brand-violet">113</p>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'fr' ? "Fonctions d'audit" : language === 'es' ? 'Funciones de auditoría' : 'Audit functions'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-extrabold text-brand-violet">9</p>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'fr' ? 'Outils' : language === 'es' ? 'Herramientas' : 'Tools'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});
TrustBanner.displayName = 'TrustBanner';

export { MomentumSection, FeatureShowcase, IdentityFirstSection, HybridSection, TrustBanner };
