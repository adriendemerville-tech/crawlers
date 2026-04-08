import { useState, useRef, useEffect, useCallback, lazy, Suspense} from 'react';
import { useSaveReport } from '@/hooks/useSaveReport';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { Helmet } from 'react-helmet-async';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSpotifyTrackRotation } from '@/components/ExpertAudit/useSpotifyTrackRotation';
import { PatienceCards } from '@/components/ExpertAudit/PatienceCards';
import { useUrlValidation, normalizeUrl } from '@/hooks/useUrlValidation';
import { UrlValidationBanner } from '@/components/UrlValidationBanner';
import { InlineAuthForm } from '@/components/ExpertAudit/InlineAuthForm';
import microwaveDing from '@/assets/sounds/microwave-ding.mp3';
import {
  Swords, Globe, Target, Brain, CheckCircle2, Search, 
  Music, Star, TrendingUp, TrendingDown,
  MessageSquare, Zap, Loader2, Check, Link2, FileText,
  Trophy, BarChart3, Shield, ArrowRight, Gauge, Award
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


// ==================== TYPES ====================

interface ContentDepth {
  wordCount: number;
  h2Count: number;
  h3Count: number;
  hasJsonLd: boolean;
  hasOpenGraph: boolean;
  hasFAQ: boolean;
  internalLinksCount: number;
  externalLinksCount: number;
  imagesCount: number;
  imagesWithoutAlt: number;
}

interface BacklinkProfile {
  referringDomains: number;
  totalBacklinks: number;
  domainRank: number;
  topAnchors: string[];
}

interface PageSpeedScores {
  performanceMobile: number;
  performanceDesktop: number;
  fcpMs: number;
  lcpMs: number;
  cls: number;
  ttfbMs: number;
}

interface EEATScore {
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  overall: number;
  justification: string;
}

interface SiteAnalysis {
  brand_dna: string;
  strengths: string[];
  weaknesses: string[];
  llm_visibility?: {
    citation_probability: number;
    citation_breakdown?: {
      serp_presence: number;
      structured_data_quality: number;
      content_quotability: number;
      brand_authority: number;
      content_freshness: number;
      business_intent_match: number;
      self_citation_signals: number;
      knowledge_graph_signals: number;
    };
    analysis: string;
    test_queries?: { query: string; purpose: string; target_llms: string[] }[];
  };
  keyword_positioning?: {
    main_keywords: { keyword: string; volume: number; difficulty: number; current_rank: string | number; strategic_analysis?: any }[];
    opportunities?: string[];
    recommendations?: string[];
  };
  aeo_score: number;
  eeat_score?: EEATScore | null;
  expertise_sentiment: { rating: number; justification: string };
}

interface CrossComparison {
  verdict: string;
  authority_winner: string;
  authority_gap: {
    magnitude: string;
    key_factor: string;
    domain_rank_delta?: number;
    referring_domains_ratio?: number;
  };
  content_depth_winner: string;
  content_comparison: {
    word_count_ratio?: number;
    structural_advantage: string;
    technical_seo_edge: string;
  };
  serp_battlefield: {
    overlap_count: number;
    head_to_head?: { keyword: string; site1_rank: string | number; site2_rank: string | number; winner: string; analysis: string }[];
    exclusive_strengths_site1?: string[];
    exclusive_strengths_site2?: string[];
  };
  differentiators: { dimension: string; site1_value: string; site2_value: string; advantage: string; impact: string }[];
  strategic_recommendations: {
    for_site1: string[];
    for_site2: string[];
  };
}

interface SiteResult {
  url: string;
  domain: string;
  metadata: { title: string; h1: string; desc: string };
  analysis: SiteAnalysis;
  llm_raw: any;
  keywords: any[];
  backlinks?: BacklinkProfile | null;
  contentDepth?: ContentDepth | null;
  pagespeed?: PageSpeedScores | null;
  brandColor?: string | null;
}

interface CompareResult {
  site1: SiteResult;
  site2: SiteResult;
  crossComparison?: CrossComparison | null;
  scannedAt: string;
}

// ==================== I18N ====================

const i18n = {
  fr: {
    pageTitle: 'Audit Comparé SEO/GEO — Comparez deux sites | Crawlers.fr',
    pageDesc: 'Comparez deux sites web face-à-face : Brand DNA, SWOT, visibilité LLM et score AEO. Analyse concurrentielle SEO & GEO par IA.',
    badge: 'Audit Comparé',
    h1: 'Comparez deux sites face aux IA',
    subtitle: 'Analysez et comparez la visibilité IA, les mots-clés et la stratégie GEO de deux sites côte à côte.',
    seoParagraph: 'En 2026, les moteurs de réponse génératifs comme ChatGPT, Perplexity et Google SGE redéfinissent la visibilité en ligne. Notre audit comparé analyse côte à côte le Brand DNA, les backlinks, la profondeur de contenu, le score E\u2011E\u2011A\u2011T et la présence dans les LLM de deux sites concurrents — pour identifier précisément les leviers SEO et GEO à activer.',
    credits: '4 crédits',
    confirm: 'Confirmer',
    launch: 'Démarrer',
    confirmBoth: 'Confirmez les deux URLs pour lancer l\'audit',
    confirmSite1: 'Confirmez l\'URL du Site 1',
    confirmSite2: 'Confirmez l\'URL du Site 2',
    errorConfirm: 'Veuillez confirmer les deux URLs avant de lancer l\'audit.',
    insufficientCredits: '4 crédits requis pour un audit comparé.',
    retry: 'L\'analyse a pris trop de temps. Veuillez relancer l\'audit.',
    analysisTime: 'L\'analyse peut prendre jusqu\'à 3 minutes.',
    newAudit: 'Nouvel audit comparé',
    analysisOf: 'Analyse de',
    strengths: 'Forces',
    weaknesses: 'Faiblesses',
    llmVisibility: 'Visibilité LLM',
    brandCited: 'Marque citée',
    brandNotCited: 'Non citée',
    cited: 'Cité',
    absent: 'Absent',
    keywords: 'Mots-clés',
    llmQueries: 'Requêtes LLM',
    aeoScore: 'Score AEO',
    expertise: 'Expertise',
    playlist: 'Playlist Crawlers',
    volume: 'Volume : 50%',
    fetchStep: 'Récupération du contenu...',
    llmStep: 'Interrogation des IA...',
    keywordsStep: 'Étude des mots-clés...',
    analysisStep: 'Analyse comparative...',
    doneStep: 'Génération du rapport...',
    // New keys
    backlinks: 'Backlinks',
    referringDomains: 'Domaines référents',
    domainRank: 'Domain Rank',
    topAnchors: 'Top ancres',
    contentDepth: 'Profondeur de contenu',
    words: 'mots',
    images: 'images',
    withoutAlt: 'sans alt',
    internalLinks: 'Liens internes',
    externalLinks: 'Liens externes',
    crossVerdict: 'Verdict comparatif',
    authorityWinner: 'Gagnant autorité',
    contentWinner: 'Gagnant contenu',
    serpBattlefield: 'Champ de bataille SERP',
    differentiators: 'Facteurs différenciants',
    recommendations: 'Recommandations stratégiques',
    overlappingKeywords: 'Mots-clés en commun',
    exclusiveKeywords: 'Mots-clés exclusifs',
    impact: 'Impact',
    advantage: 'Avantage',
    pagespeed: 'Performance',
    mobile: 'Mobile',
    desktop: 'Desktop',
    eeat: 'Score E-E-A-T',
    experience: 'Expérience',
    expertiseLabel: 'Expertise',
    authority: 'Autorité',
    trust: 'Confiance',
    radarTitle: 'Radar comparatif',
    faqTitle: 'Questions fréquentes sur la concurrence en ligne',
    faq: [
      { q: 'Comment analyser la concurrence SEO de mon site ?', a: 'L\'analyse concurrentielle SEO consiste à comparer les performances techniques (Core Web Vitals, structure HTML), le profil de backlinks, la profondeur de contenu et le score E‑E‑A‑T de votre site face à vos concurrents directs. Notre audit comparé automatise cette analyse en quelques minutes.' },
      { q: 'Pourquoi comparer sa visibilité dans les moteurs IA génératifs ?', a: 'En 2026, ChatGPT, Perplexity et Google SGE génèrent une part croissante du trafic qualifié. Un concurrent mieux cité par ces LLM capte des visiteurs que vous ne voyez jamais dans vos statistiques classiques. Comparer votre présence IA à celle de vos rivaux révèle des opportunités invisibles en SEO traditionnel.' },
      { q: 'Quels critères différencient deux sites concurrents en ligne ?', a: 'Les principaux critères sont : l\'autorité de domaine (backlinks et Domain Rank), la profondeur sémantique (nombre de mots, structure H2/H3), les données structurées (JSON‑LD, FAQ Schema), la vitesse de chargement (LCP, CLS) et la présence dans les réponses des LLM. Notre radar comparatif visualise ces écarts en un coup d\'œil.' },
      { q: 'Qu\'est-ce que le Brand DNA en audit concurrentiel ?', a: 'Le Brand DNA est l\'empreinte numérique unique d\'une marque : sa proposition de valeur, son positionnement sémantique, ses entités associées dans les Knowledge Graphs et sa réputation dans les réponses génératives. Comparer le Brand DNA de deux sites révèle les forces et faiblesses de chaque stratégie de marque en ligne.' },
      { q: 'À quelle fréquence faut-il surveiller ses concurrents ?', a: 'Nous recommandons un audit comparé mensuel pour les marchés compétitifs (e‑commerce, SaaS, finance) et trimestriel pour les autres secteurs. Les algorithmes des moteurs de recherche et des LLM évoluent constamment : un suivi régulier permet d\'anticiper les mouvements concurrentiels et d\'ajuster votre stratégie GEO.' },
    ],
  },
  en: {
    pageTitle: 'Comparative SEO/GEO Audit — Compare two sites | Crawlers.fr',
    pageDesc: 'Compare two websites head-to-head: Brand DNA, SWOT, LLM visibility and AEO score. AI-powered SEO & GEO competitive analysis.',
    badge: 'Comparative Audit',
    h1: 'Compare two sites against AI',
    subtitle: 'Analyze and compare AI visibility, keywords and GEO strategy of two sites side by side.',
    seoParagraph: 'In 2026, generative answer engines like ChatGPT, Perplexity and Google SGE are redefining online visibility. Our comparative audit analyzes Brand DNA, backlinks, content depth, E\u2011E\u2011A\u2011T score and LLM presence of two competing sites side by side — to pinpoint the exact SEO and GEO levers to activate.',
    credits: '4 credits',
    confirm: 'Confirm',
    launch: 'Start',
    confirmBoth: 'Confirm both URLs to launch the audit',
    confirmSite1: 'Confirm Site 1 URL',
    confirmSite2: 'Confirm Site 2 URL',
    errorConfirm: 'Please confirm both URLs before launching the audit.',
    insufficientCredits: '4 credits required for a comparative audit.',
    retry: 'The analysis took too long. Please try again.',
    analysisTime: 'The analysis can take up to 3 minutes.',
    newAudit: 'New comparative audit',
    analysisOf: 'Analyzing',
    strengths: 'Strengths',
    weaknesses: 'Weaknesses',
    llmVisibility: 'LLM Visibility',
    brandCited: 'Brand cited',
    brandNotCited: 'Not cited',
    cited: 'Cited',
    absent: 'Absent',
    keywords: 'Keywords',
    llmQueries: 'LLM Queries',
    aeoScore: 'AEO Score',
    expertise: 'Expertise',
    playlist: 'Crawlers Playlist',
    volume: 'Volume: 50%',
    fetchStep: 'Fetching content...',
    llmStep: 'Querying AI models...',
    keywordsStep: 'Studying keywords...',
    analysisStep: 'Comparative analysis...',
    doneStep: 'Generating report...',
    backlinks: 'Backlinks',
    referringDomains: 'Referring domains',
    domainRank: 'Domain Rank',
    topAnchors: 'Top anchors',
    contentDepth: 'Content Depth',
    words: 'words',
    images: 'images',
    withoutAlt: 'without alt',
    internalLinks: 'Internal links',
    externalLinks: 'External links',
    crossVerdict: 'Comparative Verdict',
    authorityWinner: 'Authority winner',
    contentWinner: 'Content winner',
    serpBattlefield: 'SERP Battlefield',
    differentiators: 'Key Differentiators',
    recommendations: 'Strategic Recommendations',
    overlappingKeywords: 'Overlapping keywords',
    exclusiveKeywords: 'Exclusive keywords',
    impact: 'Impact',
    advantage: 'Advantage',
    pagespeed: 'Performance',
    mobile: 'Mobile',
    desktop: 'Desktop',
    eeat: 'E-E-A-T Score',
    experience: 'Experience',
    expertiseLabel: 'Expertise',
    authority: 'Authority',
    trust: 'Trust',
    radarTitle: 'Comparative Radar',
    faqTitle: 'Frequently Asked Questions about Online Competition',
    faq: [
      { q: 'How do I analyze my site\'s SEO competition?', a: 'SEO competitive analysis involves comparing technical performance (Core Web Vitals, HTML structure), backlink profiles, content depth and E‑E‑A‑T scores of your site against direct competitors. Our comparative audit automates this analysis in minutes.' },
      { q: 'Why compare visibility in generative AI engines?', a: 'In 2026, ChatGPT, Perplexity and Google SGE generate a growing share of qualified traffic. A competitor better cited by these LLMs captures visitors you never see in your classic analytics. Comparing your AI presence to rivals reveals opportunities invisible in traditional SEO.' },
      { q: 'What criteria differentiate two competing sites online?', a: 'Key criteria include: domain authority (backlinks and Domain Rank), semantic depth (word count, H2/H3 structure), structured data (JSON‑LD, FAQ Schema), page speed (LCP, CLS) and presence in LLM responses. Our comparative radar visualizes these gaps at a glance.' },
      { q: 'What is Brand DNA in competitive auditing?', a: 'Brand DNA is a brand\'s unique digital fingerprint: its value proposition, semantic positioning, associated entities in Knowledge Graphs and reputation in generative responses. Comparing the Brand DNA of two sites reveals the strengths and weaknesses of each online brand strategy.' },
      { q: 'How often should I monitor my competitors?', a: 'We recommend a monthly comparative audit for competitive markets (e‑commerce, SaaS, finance) and quarterly for other sectors. Search engine and LLM algorithms constantly evolve: regular monitoring helps anticipate competitive moves and adjust your GEO strategy.' },
    ],
  },
  es: {
    pageTitle: 'Auditoría Comparativa SEO/GEO — Compare dos sitios | Crawlers.fr',
    pageDesc: 'Compare dos sitios web cara a cara: Brand DNA, SWOT, visibilidad LLM y puntuación AEO. Análisis competitivo SEO & GEO con IA.',
    badge: 'Auditoría Comparativa',
    h1: 'Compare dos sitios frente a la IA',
    subtitle: 'Analice y compare la visibilidad IA, las palabras clave y la estrategia GEO de dos sitios lado a lado.',
    seoParagraph: 'En 2026, los motores de respuesta generativos como ChatGPT, Perplexity y Google SGE están redefiniendo la visibilidad en línea. Nuestra auditoría comparativa analiza el Brand DNA, los backlinks, la profundidad de contenido, la puntuación E\u2011E\u2011A\u2011T y la presencia en los LLM de dos sitios competidores — para identificar con precisión las palancas SEO y GEO a activar.',
    credits: '4 créditos',
    confirm: 'Confirmar',
    launch: 'Iniciar',
    confirmBoth: 'Confirme ambas URLs para lanzar la auditoría',
    confirmSite1: 'Confirme la URL del Sitio 1',
    confirmSite2: 'Confirme la URL del Sitio 2',
    errorConfirm: 'Por favor confirme ambas URLs antes de lanzar la auditoría.',
    insufficientCredits: '4 créditos necesarios para una auditoría comparativa.',
    retry: 'El análisis tardó demasiado. Por favor inténtelo de nuevo.',
    analysisTime: 'El análisis puede tardar hasta 3 minutos.',
    newAudit: 'Nueva auditoría comparativa',
    analysisOf: 'Analizando',
    strengths: 'Fortalezas',
    weaknesses: 'Debilidades',
    llmVisibility: 'Visibilidad LLM',
    brandCited: 'Marca citada',
    brandNotCited: 'No citada',
    cited: 'Citado',
    absent: 'Ausente',
    keywords: 'Palabras clave',
    llmQueries: 'Consultas LLM',
    aeoScore: 'Puntuación AEO',
    expertise: 'Experiencia',
    playlist: 'Playlist Crawlers',
    volume: 'Volumen: 50%',
    fetchStep: 'Recuperando contenido...',
    llmStep: 'Consultando modelos IA...',
    keywordsStep: 'Estudiando palabras clave...',
    analysisStep: 'Análisis comparativo...',
    doneStep: 'Generando informe...',
    backlinks: 'Backlinks',
    referringDomains: 'Dominios referentes',
    domainRank: 'Domain Rank',
    topAnchors: 'Top anclas',
    contentDepth: 'Profundidad de contenido',
    words: 'palabras',
    images: 'imágenes',
    withoutAlt: 'sin alt',
    internalLinks: 'Enlaces internos',
    externalLinks: 'Enlaces externos',
    crossVerdict: 'Veredicto comparativo',
    authorityWinner: 'Ganador autoridad',
    contentWinner: 'Ganador contenido',
    serpBattlefield: 'Campo de batalla SERP',
    differentiators: 'Factores diferenciadores',
    recommendations: 'Recomendaciones estratégicas',
    overlappingKeywords: 'Palabras clave en común',
    exclusiveKeywords: 'Palabras clave exclusivas',
    impact: 'Impacto',
    advantage: 'Ventaja',
    pagespeed: 'Rendimiento',
    mobile: 'Móvil',
    desktop: 'Escritorio',
    eeat: 'Puntuación E-E-A-T',
    experience: 'Experiencia',
    expertiseLabel: 'Expertise',
    authority: 'Autoridad',
    trust: 'Confianza',
    radarTitle: 'Radar comparativo',
    faqTitle: 'Preguntas frecuentes sobre la competencia en línea',
    faq: [
      { q: '¿Cómo analizar la competencia SEO de mi sitio?', a: 'El análisis competitivo SEO consiste en comparar el rendimiento técnico (Core Web Vitals, estructura HTML), el perfil de backlinks, la profundidad de contenido y la puntuación E‑E‑A‑T de su sitio frente a sus competidores directos. Nuestra auditoría comparativa automatiza este análisis en minutos.' },
      { q: '¿Por qué comparar la visibilidad en motores IA generativos?', a: 'En 2026, ChatGPT, Perplexity y Google SGE generan una parte creciente del tráfico cualificado. Un competidor mejor citado por estos LLM capta visitantes que nunca ve en sus estadísticas clásicas. Comparar su presencia IA con la de sus rivales revela oportunidades invisibles en SEO tradicional.' },
      { q: '¿Qué criterios diferencian dos sitios competidores en línea?', a: 'Los principales criterios son: autoridad de dominio (backlinks y Domain Rank), profundidad semántica (conteo de palabras, estructura H2/H3), datos estructurados (JSON‑LD, FAQ Schema), velocidad de carga (LCP, CLS) y presencia en las respuestas de los LLM. Nuestro radar comparativo visualiza estas brechas de un vistazo.' },
      { q: '¿Qué es el Brand DNA en una auditoría competitiva?', a: 'El Brand DNA es la huella digital única de una marca: su propuesta de valor, su posicionamiento semántico, sus entidades asociadas en los Knowledge Graphs y su reputación en las respuestas generativas. Comparar el Brand DNA de dos sitios revela las fortalezas y debilidades de cada estrategia de marca en línea.' },
      { q: '¿Con qué frecuencia debo monitorear a mis competidores?', a: 'Recomendamos una auditoría comparativa mensual para mercados competitivos (e‑commerce, SaaS, finanzas) y trimestral para otros sectores. Los algoritmos de los motores de búsqueda y los LLM evolucionan constantemente: un seguimiento regular permite anticipar movimientos competitivos y ajustar su estrategia GEO.' },
    ],
  },
};

// ==================== LOADING STEPS ====================

function getLoadingSteps(t: typeof i18n['fr']) {
  return [
    { id: 'fetch', label: t.fetchStep, icon: Globe },
    { id: 'llm', label: t.llmStep, icon: Brain },
    { id: 'keywords', label: t.keywordsStep, icon: Target },
    { id: 'analysis', label: t.analysisStep, icon: Search },
    { id: 'done', label: t.doneStep, icon: CheckCircle2 },
  ];
}

function CompareLoadingSteps({ siteName, t }: { siteName: string; t: typeof i18n['fr'] }) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = getLoadingSteps(t);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => prev < steps.length - 1 ? prev + 1 : prev);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center py-8 space-y-5">
      <div className="relative">
        <div className="h-[72px] w-[72px] rounded-full border-4 border-muted" />
        <div className="absolute inset-0 h-[72px] w-[72px] rounded-full border-4 border-t-transparent border-primary animate-spin" />
        <motion.div className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Brain className="h-8 w-8 text-primary" />
        </motion.div>
      </div>
      <p className="text-sm font-medium text-foreground truncate max-w-[260px]">{t.analysisOf} {siteName}</p>
      <div className="space-y-3 w-full max-w-[372px]">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = i === currentStep;
          const isComplete = i < currentStep;
          return (
            <motion.div key={step.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: isActive || isComplete ? 1 : 0.3, x: 0 }}
              className={`flex items-center gap-3 p-3.5 rounded-lg text-sm ${isActive ? 'bg-primary/10 border border-primary/30' : isComplete ? 'bg-emerald-500/10' : 'bg-muted/30'}`}>
              <StepIcon className={`h-5 w-5 ${isComplete ? 'text-emerald-500' : isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}>{step.label}</span>
              {isComplete && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== COMPARISON ROW WRAPPER ====================

function ComparisonRow({ children, separator = true }: { children: [React.ReactNode, React.ReactNode]; separator?: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-stretch">
      <div className="min-w-0">{children[0]}</div>
      {separator && (
        <div className="hidden md:flex items-stretch justify-center">
          <div className="w-px bg-border/30" />
        </div>
      )}
      <div className="min-w-0">{children[1]}</div>
    </div>
  );
}

// ==================== INDIVIDUAL CARD RENDERERS ====================

function BrandDnaCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { analysis } = site;
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Brand DNA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground/80 leading-relaxed">{analysis.brand_dna}</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-500 mb-1.5 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {t.strengths}</p>
            {(analysis.strengths || []).map((s, i) => (
              <p key={i} className="text-sm text-foreground/70 pl-3 border-l-2 border-emerald-500/30 mb-1.5">{s}</p>
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-500 mb-1.5 flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5" /> {t.weaknesses}</p>
            {(analysis.weaknesses || []).map((w, i) => (
              <p key={i} className="text-sm text-foreground/70 pl-3 border-l-2 border-rose-500/30 mb-1.5">{w}</p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BacklinksCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { backlinks } = site;
  if (!backlinks) return <div />;
  return (
    <Card className="border-border/50 bg-card/80 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-4 w-4 text-blue-500" /> {t.backlinks}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/30 text-center">
            <p className="text-xl font-bold text-foreground">{backlinks.referringDomains.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{t.referringDomains}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/30 text-center">
            <p className="text-xl font-bold text-foreground">{backlinks.domainRank}</p>
            <p className="text-xs text-muted-foreground">{t.domainRank}</p>
          </div>
        </div>
        <div className="text-sm text-foreground/70">
          <span className="font-medium">{backlinks.totalBacklinks.toLocaleString()}</span> backlinks total
        </div>
        {backlinks.topAnchors.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t.topAnchors}</p>
            <div className="flex flex-wrap gap-1">
              {backlinks.topAnchors.map((a, i) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5">{a}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContentDepthCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { contentDepth } = site;
  if (!contentDepth) return <div />;
  return (
    <Card className="border-border/50 bg-card/80 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-500" /> {t.contentDepth}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-base font-bold text-foreground">{contentDepth.wordCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{t.words}</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-base font-bold text-foreground">{contentDepth.h2Count}</p>
            <p className="text-xs text-muted-foreground">H2</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-base font-bold text-foreground">{contentDepth.h3Count}</p>
            <p className="text-xs text-muted-foreground">H3</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {contentDepth.hasJsonLd && <Badge variant="default" className="text-[10px] px-1.5">JSON-LD</Badge>}
          {contentDepth.hasOpenGraph && <Badge variant="default" className="text-[10px] px-1.5">Open Graph</Badge>}
          {contentDepth.hasFAQ && <Badge variant="default" className="text-[10px] px-1.5">FAQ Schema</Badge>}
          {!contentDepth.hasJsonLd && <Badge variant="outline" className="text-[10px] px-1.5 opacity-50">JSON-LD ✗</Badge>}
          {!contentDepth.hasOpenGraph && <Badge variant="outline" className="text-[10px] px-1.5 opacity-50">OG ✗</Badge>}
        </div>
        <div className="flex justify-between text-xs text-foreground/60">
          <span>{t.internalLinks}: {contentDepth.internalLinksCount}</span>
          <span>{t.externalLinks}: {contentDepth.externalLinksCount}</span>
        </div>
        {contentDepth.imagesWithoutAlt > 0 && (
          <p className="text-xs text-rose-400">{contentDepth.imagesWithoutAlt}/{contentDepth.imagesCount} {t.images} {t.withoutAlt}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LlmVisibilityCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { analysis, llm_raw } = site;
  const llmScore = llm_raw?.overallScore ?? analysis.llm_visibility?.citation_probability ?? 0;
  return (
    <Card className="border-border/50 bg-card/80 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" /> {t.llmVisibility}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold text-foreground">{llmScore}<span className="text-sm text-foreground/50">/100</span></div>
          {llm_raw?.brandMentioned !== undefined && (
            <Badge variant={llm_raw.brandMentioned ? 'default' : 'secondary'} className="text-xs">
              {llm_raw.brandMentioned ? t.brandCited : t.brandNotCited}
            </Badge>
          )}
        </div>
        {analysis.llm_visibility?.analysis && (
          <p className="text-sm text-foreground/70 leading-relaxed">{analysis.llm_visibility.analysis}</p>
        )}
        {llm_raw?.models && Array.isArray(llm_raw.models) && (
          <div className="space-y-1.5">
            {llm_raw.models.map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground/70">{m.name}</span>
                <Badge variant={m.brandMentioned ? 'default' : 'outline'} className="text-xs px-2">
                  {m.brandMentioned ? t.cited : t.absent}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KeywordsCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { analysis } = site;
  // Use analysis.keyword_positioning first, fallback to site.keywords array
  const mainKeywords = analysis.keyword_positioning?.main_keywords?.length
    ? analysis.keyword_positioning.main_keywords
    : (site.keywords || []).map((kw: any) => ({
        keyword: kw.keyword || kw.term || kw,
        volume: kw.volume || kw.search_volume || 0,
        current_rank: kw.current_rank || kw.rank || kw.position || 'N/C',
      }));

  if (!mainKeywords.length) {
    return (
      <Card className="border-border/50 bg-card/80 h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-500" /> {t.keywords}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">Données indisponibles</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-border/50 bg-card/80 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-500" /> {t.keywords}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {mainKeywords.slice(0, 6).map((kw: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm gap-2">
              <span className="text-foreground truncate flex-1">{kw.keyword}</span>
              <span className="text-foreground/50 whitespace-nowrap">{kw.volume} vol</span>
              <Badge variant={typeof kw.current_rank === 'number' && kw.current_rank <= 10 ? 'default' : 'outline'} className="text-xs px-2 whitespace-nowrap">
                {typeof kw.current_rank === 'number' ? `#${kw.current_rank}` : 'N/C'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LlmQueriesCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { analysis } = site;
  if (!analysis.llm_visibility?.test_queries?.length) return <div />;
  const queries = analysis.llm_visibility.test_queries;
  const llmColors: Record<string, string> = {
    'ChatGPT': 'text-emerald-400', 'GPT-4': 'text-emerald-400', 'GPT-5': 'text-emerald-400',
    'Gemini': 'text-blue-400', 'Google': 'text-blue-400',
    'Perplexity': 'text-violet-400',
    'Claude': 'text-amber-400',
    'Mistral': 'text-rose-400',
    'Copilot': 'text-cyan-400',
  };
  const getLlmColor = (name: string) => {
    for (const [key, color] of Object.entries(llmColors)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return color;
    }
    return 'text-teal-400';
  };
  return (
    <Card className="border-border/50 bg-card/80 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-cyan-500" /> {t.llmQueries}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {queries.slice(0, 3).map((q, i) => (
          <div key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-sm font-medium text-foreground">"{q.query}"</p>
            <p className="text-xs text-foreground/60 mt-0.5">{q.purpose}</p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {q.target_llms?.map((llm, j) => {
                const count = queries.filter(qq => qq.target_llms?.includes(llm)).length;
                return (
                  <Badge key={j} variant="outline" className={`text-[10px] px-1.5 ${getLlmColor(llm)}`}>
                    {llm} <span className="ml-0.5 opacity-70">({count})</span>
                  </Badge>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PageSpeedCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { pagespeed } = site;
  if (!pagespeed || (pagespeed.performanceMobile === 0 && pagespeed.performanceDesktop === 0)) return <div />;
  return (
    <Card className="border-border/50 bg-card/80 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Gauge className="h-4 w-4 text-orange-500" /> {t.pagespeed}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/30 text-center">
            <p className={`text-3xl font-bold ${pagespeed.performanceMobile >= 90 ? 'text-emerald-500' : pagespeed.performanceMobile >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
              {pagespeed.performanceMobile}
            </p>
            <p className="text-xs text-muted-foreground">{t.mobile}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/30 text-center">
            <p className={`text-3xl font-bold ${pagespeed.performanceDesktop >= 90 ? 'text-emerald-500' : pagespeed.performanceDesktop >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
              {pagespeed.performanceDesktop}
            </p>
            <p className="text-xs text-muted-foreground">{t.desktop}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-foreground/60">
          <span>FCP: {(pagespeed.fcpMs / 1000).toFixed(1)}s</span>
          <span>LCP: {(pagespeed.lcpMs / 1000).toFixed(1)}s</span>
          <span>CLS: {pagespeed.cls}</span>
          <span>TTFB: {pagespeed.ttfbMs}ms</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EeatCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { analysis } = site;
  if (!analysis.eeat_score) return <div />;
  return (
    <Card className="border-border/50 bg-card/80 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Award className="h-4 w-4 text-indigo-500" /> {t.eeat}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center mb-2">
          <p className="text-3xl font-bold text-foreground">{analysis.eeat_score.overall}<span className="text-sm text-foreground/50">/10</span></p>
        </div>
        <div className="space-y-2">
          {[
            { label: t.experience, value: analysis.eeat_score.experience },
            { label: t.expertiseLabel, value: analysis.eeat_score.expertise },
            { label: t.authority, value: analysis.eeat_score.authoritativeness },
            { label: t.trust, value: analysis.eeat_score.trustworthiness },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-xs text-foreground/60 w-20 shrink-0">{item.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${item.value >= 8 ? 'bg-emerald-500' : item.value >= 5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${(item.value / 10) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground w-5 text-right">{item.value}</span>
            </div>
          ))}
        </div>
        {analysis.eeat_score.justification && (
          <p className="text-xs text-foreground/60 italic mt-1">{analysis.eeat_score.justification}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AeoExpertiseRow({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { analysis } = site;
  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <Card className="border-border/50 bg-card/80">
        <CardContent className="pt-4 text-center">
          <Zap className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-xs text-foreground/60">{t.aeoScore}</p>
          <p className="text-3xl font-bold text-foreground">{analysis.aeo_score}<span className="text-sm text-foreground/50">/100</span></p>
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-card/80">
        <CardContent className="pt-4 text-center">
          <Star className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
          <p className="text-xs text-foreground/60">{t.expertise}</p>
          <div className="flex items-center justify-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(n => (
              <Star key={n} className={`h-4 w-4 ${n <= (analysis.expertise_sentiment?.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} />
            ))}
          </div>
          <p className="text-xs text-foreground/60 mt-1">{analysis.expertise_sentiment?.justification}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SITE COMPARISON GRID (row-based) ====================

function SiteComparisonGrid({ site1, site2, t }: { site1: SiteResult; site2: SiteResult; t: typeof i18n['fr'] }) {
  return (
    <div className="space-y-4">
      <ComparisonRow><BrandDnaCard site={site1} t={t} /><BrandDnaCard site={site2} t={t} /></ComparisonRow>
      <ComparisonRow><BacklinksCard site={site1} t={t} /><BacklinksCard site={site2} t={t} /></ComparisonRow>
      <ComparisonRow><ContentDepthCard site={site1} t={t} /><ContentDepthCard site={site2} t={t} /></ComparisonRow>
      <ComparisonRow><LlmVisibilityCard site={site1} t={t} /><LlmVisibilityCard site={site2} t={t} /></ComparisonRow>
      <ComparisonRow><KeywordsCard site={site1} t={t} /><KeywordsCard site={site2} t={t} /></ComparisonRow>
      <ComparisonRow><LlmQueriesCard site={site1} t={t} /><LlmQueriesCard site={site2} t={t} /></ComparisonRow>
      <ComparisonRow><PageSpeedCard site={site1} t={t} /><PageSpeedCard site={site2} t={t} /></ComparisonRow>
      <ComparisonRow><EeatCard site={site1} t={t} /><EeatCard site={site2} t={t} /></ComparisonRow>
      <ComparisonRow><AeoExpertiseRow site={site1} t={t} /><AeoExpertiseRow site={site2} t={t} /></ComparisonRow>
    </div>
  );
}

// ==================== CROSS-COMPARISON SECTION ====================

const impactColors: Record<string, string> = {
  critique: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
  important: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  mineur: 'text-muted-foreground bg-muted/30 border-border/30',
  critical: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
  minor: 'text-muted-foreground bg-muted/30 border-border/30',
};

function CrossComparisonSection({ cross, site1, site2, t }: { cross: CrossComparison; site1: SiteResult; site2: SiteResult; t: typeof i18n['fr'] }) {
  const site1Domain = site1.domain;
  const site2Domain = site2.domain;

  // Brand colors — fallback to violet/amber if not detected
  const site1Color = site1.brandColor || '#8b5cf6';
  const site2Color = site2.brandColor || '#f59e0b';

  // Build radar data
  const radarData = [
    { dimension: t.aeoScore, site1: site1.analysis.aeo_score || 0, site2: site2.analysis.aeo_score || 0 },
    { dimension: t.eeat, site1: (site1.analysis.eeat_score?.overall || 0) * 10, site2: (site2.analysis.eeat_score?.overall || 0) * 10 },
    { dimension: t.pagespeed, site1: site1.pagespeed?.performanceMobile || 0, site2: site2.pagespeed?.performanceMobile || 0 },
    { dimension: t.backlinks, site1: Math.min(100, (site1.backlinks?.domainRank || 0)), site2: Math.min(100, (site2.backlinks?.domainRank || 0)) },
    { dimension: t.contentDepth, site1: Math.min(100, Math.round((site1.contentDepth?.wordCount || 0) / 30)), site2: Math.min(100, Math.round((site2.contentDepth?.wordCount || 0) / 30)) },
    { dimension: t.expertise, site1: (site1.analysis.expertise_sentiment?.rating || 0) * 20, site2: (site2.analysis.expertise_sentiment?.rating || 0) * 20 },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4 space-y-4">
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> {t.crossVerdict}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-base text-foreground leading-relaxed">{cross.verdict}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Authority winner */}
            <div className="flex items-center gap-3 p-3.5 rounded-lg bg-card border border-border/50">
              <Shield className="h-5 w-5 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-foreground/50 uppercase tracking-wider">{t.authorityWinner}</p>
                <p className="text-base font-bold text-foreground truncate">{cross.authority_winner}</p>
                <p className="text-xs text-foreground/60">
                  {cross.authority_gap?.magnitude} — {cross.authority_gap?.key_factor}
                </p>
              </div>
            </div>
            {/* Content winner */}
            <div className="flex items-center gap-3 p-3.5 rounded-lg bg-card border border-border/50">
              <FileText className="h-5 w-5 text-teal-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-foreground/50 uppercase tracking-wider">{t.contentWinner}</p>
                <p className="text-base font-bold text-foreground truncate">{cross.content_depth_winner}</p>
                <p className="text-xs text-foreground/60">{cross.content_comparison?.structural_advantage}</p>
              </div>
            </div>
          </div>
          {cross.content_comparison?.technical_seo_edge && (
            <p className="text-sm text-foreground/60 italic">{cross.content_comparison.technical_seo_edge}</p>
          )}
        </CardContent>
      </Card>

      {/* SERP Battlefield */}
      {cross.serp_battlefield && (
        (cross.serp_battlefield.head_to_head?.length ?? 0) > 0 ||
        (cross.serp_battlefield.exclusive_strengths_site1?.length ?? 0) > 0 ||
        (cross.serp_battlefield.exclusive_strengths_site2?.length ?? 0) > 0
      ) && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-500" /> {t.serpBattlefield}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cross.serp_battlefield.head_to_head && cross.serp_battlefield.head_to_head.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-2 text-foreground/60 font-medium">{t.keywords}</th>
                      <th className="text-center py-2 text-foreground/60 font-medium">{site1Domain}</th>
                      <th className="text-center py-2 text-foreground/60 font-medium">{site2Domain}</th>
                      <th className="text-center py-2 text-foreground/60 font-medium">🏆</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cross.serp_battlefield.head_to_head.map((h, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="py-2 text-foreground font-medium">{h.keyword}</td>
                        <td className="text-center py-2">
                          <Badge variant={h.winner === site1Domain ? 'default' : 'outline'} className="text-xs px-2">
                            {typeof h.site1_rank === 'number' ? `#${h.site1_rank}` : h.site1_rank}
                          </Badge>
                        </td>
                        <td className="text-center py-2">
                          <Badge variant={h.winner === site2Domain ? 'default' : 'outline'} className="text-xs px-2">
                            {typeof h.site2_rank === 'number' ? `#${h.site2_rank}` : h.site2_rank}
                          </Badge>
                        </td>
                        <td className="text-center py-2 text-xs text-foreground font-medium truncate max-w-[80px]">{h.winner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Exclusive keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {cross.serp_battlefield.exclusive_strengths_site1 && cross.serp_battlefield.exclusive_strengths_site1.length > 0 && (
                <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                  <p className="text-xs text-foreground/60 mb-1.5">{t.exclusiveKeywords} — <span className="font-medium text-violet-400">{site1Domain}</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {cross.serp_battlefield.exclusive_strengths_site1.map((k, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-2 border-violet-500/30">{k}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {cross.serp_battlefield.exclusive_strengths_site2 && cross.serp_battlefield.exclusive_strengths_site2.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <p className="text-xs text-foreground/60 mb-1.5">{t.exclusiveKeywords} — <span className="font-medium text-amber-400">{site2Domain}</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {cross.serp_battlefield.exclusive_strengths_site2.map((k, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-2 border-amber-500/30">{k}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Differentiators */}
      {cross.differentiators && cross.differentiators.length > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" /> {t.differentiators}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {cross.differentiators.map((d, i) => {
              const s1Wins = d.advantage === site1Domain;
              const s2Wins = d.advantage === site2Domain;
              const gradientStyle = s1Wins
                ? { background: 'linear-gradient(to right, hsl(221 83% 53% / 0.12), transparent 60%)' }
                : s2Wins
                  ? { background: 'linear-gradient(to left, hsl(38 92% 50% / 0.12), transparent 60%)' }
                  : {};
              return (
                <div key={i} className={`p-3 rounded-lg border ${impactColors[d.impact] || impactColors.mineur}`} style={gradientStyle}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-foreground">{d.dimension}</span>
                    <Badge variant="outline" className="text-[10px] px-2">{d.impact}</Badge>
                  </div>
                  <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-sm">
                    <div className={`text-center p-1.5 rounded ${s1Wins ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground/50'}`}>
                      {d.site1_value}
                    </div>
                    <span className="text-foreground/40 text-xs">vs</span>
                    <div className={`text-center p-1.5 rounded ${s2Wins ? 'bg-warning/15 font-semibold text-warning' : 'text-foreground/50'}`}>
                      {d.site2_value}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Strategic Recommendations */}
      {cross.strategic_recommendations && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-violet-500/20 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-violet-500" /> {t.recommendations} — {site1Domain}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(cross.strategic_recommendations.for_site1 || []).map((r, i) => (
                  <p key={i} className="text-sm text-foreground/70 pl-3 border-l-2 border-violet-500/30">{r}</p>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-amber-500" /> {t.recommendations} — {site2Domain}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(cross.strategic_recommendations.for_site2 || []).map((r, i) => (
                  <p key={i} className="text-sm text-foreground/70 pl-3 border-l-2 border-amber-500/30">{r}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </motion.div>
  );
}

// ==================== MAIN PAGE ====================

const AuditCompare = () => {
  const { user } = useAuth();
  const { balance, refreshBalance, isAgencyPro } = useCredits();
  const { isAdmin } = useAdmin();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  useCanonicalHreflang('/app/audit-compare');
  const t = i18n[language];
  const isUnlimited = isAgencyPro || isAdmin;
  const { saveReport } = useSaveReport();

  // Pre-fill url1 from expert audit session if available
  const [url1, setUrl1] = useState(() => {
    return sessionStorage.getItem('audit_url') || '';
  });
  const [url2, setUrl2] = useState('');
  const [confirmedUrl1, setConfirmedUrl1] = useState<string | null>(null);
  const [confirmedUrl2, setConfirmedUrl2] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  const validation1 = useUrlValidation(language);
  const validation2 = useUrlValidation(language);

  const { embedContainerRef, stopPlayback, isCustomPlaylist } = useSpotifyTrackRotation(isLoading);
  const dingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Preload ding
  useEffect(() => {
    dingAudioRef.current = new Audio(microwaveDing);
    dingAudioRef.current.volume = 0.6;
  }, []);

  const playDing = useCallback(() => {
    if (dingAudioRef.current) {
      dingAudioRef.current.currentTime = 0;
      dingAudioRef.current.play().catch(() => {});
    }
  }, []);

  // Reset confirmed URL when input changes (track previous to avoid resetting on confirm)
  const url1Ref = useRef(url1);
  const url2Ref = useRef(url2);
  useEffect(() => {
    // Only reset if the change was NOT from a confirm action
    if (url1 !== url1Ref.current && url1 !== confirmedUrl1) {
      setConfirmedUrl1(null);
      validation1.resetValidation();
    }
    url1Ref.current = url1;
  }, [url1]);
  useEffect(() => {
    if (url2 !== url2Ref.current && url2 !== confirmedUrl2) {
      setConfirmedUrl2(null);
      validation2.resetValidation();
    }
    url2Ref.current = url2;
  }, [url2]);

  const handleConfirmUrl1 = () => {
    if (!url1.trim()) return;
    validation1.validateAndCorrect(url1, (validUrl) => {
      setUrl1(validUrl);
      setConfirmedUrl1(validUrl);
    });
  };

  const handleConfirmUrl2 = () => {
    if (!url2.trim()) return;
    validation2.validateAndCorrect(url2, (validUrl) => {
      setUrl2(validUrl);
      setConfirmedUrl2(validUrl);
    });
  };

  const bothConfirmed = !!confirmedUrl1 && !!confirmedUrl2;

  const handleLaunch = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    if (!bothConfirmed) {
      toast({ title: 'Error', description: t.errorConfirm, variant: 'destructive' });
      return;
    }

    // Credit check (skip for unlimited users)
    if (!isUnlimited) {
      if (balance < 4) {
        setShowTopUp(true);
        return;
      }
      // Deduct 4 credits
      const { data: creditResult, error: creditError } = await supabase.rpc('use_credit', {
        p_user_id: user.id,
        p_amount: 4,
        p_description: 'Audit comparé',
      });
      if (creditError || !(creditResult as any)?.success) {
        const errMsg = (creditResult as any)?.error || creditError?.message || t.insufficientCredits;
        if (errMsg.includes('Insufficient')) {
          setShowTopUp(true);
        } else {
          toast({ title: 'Error', description: errMsg, variant: 'destructive' });
        }
        return;
      }
      refreshBalance();
    }

    setIsLoading(true);
    setResult(null);
    retryCountRef.current = 0;

    // Track analytics event
    supabase.from('analytics_events').insert({
      event_type: 'audit_compare_launched',
      url: url1.trim(),
      target_url: url2.trim(),
      user_id: user?.id || null,
    }).then(() => {});

    const checkCache = async (): Promise<any | null> => {
      try {
        const sorted = [url1.trim(), url2.trim()].map(u => u.startsWith('http') ? u : `https://${u}`).sort().join('|');
        const cacheKey = `compare:${sorted}`;
        const { data } = await supabase
          .from('audit_cache')
          .select('result_data')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .single();
        return data?.result_data || null;
      } catch { return null; }
    };

    const attemptAudit = async (): Promise<void> => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('audit-compare', {
          body: { url1: url1.trim(), url2: url2.trim(), skipCache: true, lang: language },
        });

        if (fnError) {
          let detailedMessage = fnError.message || 'Erreur inconnue';
          const fnContext = (fnError as { context?: Response }).context;

          if (fnContext?.status === 401 || fnContext?.status === 403) {
            detailedMessage = 'Authentication required';
          } else if (fnContext?.status === 402) {
            detailedMessage = 'Insufficient credits';
          } else if (fnContext) {
            try {
              const payload = await fnContext.clone().json();
              if (payload?.error) detailedMessage = payload.error;
            } catch {
              try {
                const raw = await fnContext.text();
                if (raw) detailedMessage = raw;
              } catch {
                // keep fallback message
              }
            }
          }

          throw new Error(detailedMessage);
        }

        if (!data?.success) throw new Error(data?.error || 'Erreur inconnue');

        // Stop music
        stopPlayback();

        // 3s silence then ding
        setTimeout(() => {
          playDing();
          setResult(data.data);
          setIsLoading(false);
          refreshBalance();
          
          // Fire-and-forget: trigger CTO Agent for audit-compare
          supabase.functions.invoke('agent-cto', {
            body: { auditResult: data.data, auditType: 'compare', url: url1.trim(), domain: new URL(url1.trim().startsWith('http') ? url1.trim() : `https://${url1.trim()}`).hostname }
          }).catch(() => {});

          // Auto-save report to console
          const domain1 = (() => { try { return new URL(url1.trim().startsWith('http') ? url1.trim() : `https://${url1.trim()}`).hostname; } catch { return url1.trim(); } })();
          const domain2 = (() => { try { return new URL(url2.trim().startsWith('http') ? url2.trim() : `https://${url2.trim()}`).hostname; } catch { return url2.trim(); } })();
          saveReport({
            reportType: 'seo_technical' as any,
            title: `Audit Comparé – ${domain1} vs ${domain2}`,
            url: url1.trim(),
            reportData: data.data,
          }).catch(() => {});
        }, 3000);
      } catch (e: any) {
        const msg = e.message || 'Erreur inconnue';
        
        // Don't retry for auth or credit errors
        if (msg.includes('Authentication')) {
          setIsLoading(false);
          setShowAuthDialog(true);
          return;
        }
        if (msg.includes('Insufficient credits')) {
          setIsLoading(false);
          toast({ title: 'Credits', description: t.insufficientCredits, variant: 'destructive' });
          return;
        }
        
        // Silent retry: first check if result was saved to cache despite timeout
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          console.log(`[audit-compare] Retry ${retryCountRef.current}/${MAX_RETRIES} — checking cache first...`);
          await new Promise(r => setTimeout(r, 3000));

          // Try cache recovery before re-invoking the function
          const cached = await checkCache();
          if (cached) {
            console.log('[audit-compare] ✅ Recovered from cache');
            stopPlayback();
            setTimeout(() => {
              playDing();
              setResult(cached);
              setIsLoading(false);
              // Auto-save recovered result
              const domain1 = (() => { try { return new URL(url1.trim().startsWith('http') ? url1.trim() : `https://${url1.trim()}`).hostname; } catch { return url1.trim(); } })();
              const domain2 = (() => { try { return new URL(url2.trim().startsWith('http') ? url2.trim() : `https://${url2.trim()}`).hostname; } catch { return url2.trim(); } })();
              saveReport({
                reportType: 'seo_technical' as any,
                title: `Audit Comparé – ${domain1} vs ${domain2}`,
                url: url1.trim(),
                reportData: cached,
              }).catch(() => {});
            }, 1500);
            return;
          }

          return attemptAudit();
        }
        
        // All retries exhausted — show a gentle toast, no red banner
        setIsLoading(false);
        toast({ title: 'Timeout', description: t.retry });
      }
    };

    attemptAudit();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>Audit Comparé SEO & GEO vs Concurrents | Crawlers.fr</title>
        <meta name="description" content="Benchmark SEO et GEO vs 3 concurrents. Radar Chart, analyse différentielle, score IAS comparé. Disponible en crédits." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/audit-compare" />
        <meta property="og:title" content="Audit Comparé SEO & GEO vs Concurrents | Crawlers.fr" />
        <meta property="og:description" content="Benchmark SEO et GEO vs 3 concurrents. Radar Chart, analyse différentielle, score IAS comparé. Disponible en crédits." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Audit Comparé SEO & GEO vs Concurrents | Crawlers.fr" />
        <meta name="twitter:description" content="Benchmark SEO et GEO vs 3 concurrents. Radar Chart, analyse différentielle, score IAS comparé. Disponible en crédits." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <Badge variant="outline" className="mb-3 text-xs border-violet-500/30 text-violet-400">
              <Swords className="h-3 w-3 mr-1" /> {t.badge}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-2">
              {t.h1}
            </h1>
            <p className="text-muted-foreground text-sm max-w-3xl mx-auto whitespace-nowrap">
              {t.subtitle}
            </p>
            <p className="text-foreground text-sm max-w-3xl mx-auto mt-8 leading-relaxed">
              {t.seoParagraph}
            </p>
          </motion.div>

          {/* URL Inputs */}
          {!isLoading && !result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start mb-6">
                {/* Site 1 */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Site 1</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="https://site-a.com"
                        value={url1}
                        onChange={e => setUrl1(e.target.value)}
                        className={`h-12 text-sm pr-10 caret-primary ${confirmedUrl1 ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                        disabled={validation1.isValidating}
                      />
                      {confirmedUrl1 && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleConfirmUrl1}
                      disabled={!url1.trim() || validation1.isValidating || !!confirmedUrl1}
                      variant={confirmedUrl1 ? 'default' : 'outline'}
                      className={`h-12 shrink-0 ${confirmedUrl1 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-2 border-violet-500 text-violet-500 hover:bg-violet-500/10'}`}
                    >
                      {validation1.isValidating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : confirmedUrl1 ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        t.confirm
                      )}
                    </Button>
                  </div>
                  <UrlValidationBanner
                    suggestedUrl={validation1.suggestedUrl}
                    urlNotFound={validation1.urlNotFound}
                    suggestionPrefix={validation1.getSuggestionPrefix()}
                    notFoundMessage={validation1.getNotFoundMessage()}
                    onAcceptSuggestion={() => validation1.acceptSuggestion(validation1.suggestedUrl!, (validUrl) => { setUrl1(validUrl); setConfirmedUrl1(validUrl); })}
                    onDismissSuggestion={() => validation1.dismissSuggestion()}
                    onDismissNotFound={() => validation1.dismissNotFound()}
                    onIgnoreSuggestion={() => { const normalized = normalizeUrl(url1); setConfirmedUrl1(normalized); setUrl1(normalized); validation1.dismissSuggestion(); }}
                  />
                </div>

                {/* VS badge */}
                <div className="hidden md:flex items-center justify-center pt-8">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    VS
                  </div>
                </div>

                {/* Site 2 */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Site 2</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="https://site-b.com"
                        value={url2}
                        onChange={e => setUrl2(e.target.value)}
                        className={`h-12 text-sm pr-10 caret-primary ${confirmedUrl2 ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                        disabled={validation2.isValidating}
                      />
                      {confirmedUrl2 && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleConfirmUrl2}
                      disabled={!url2.trim() || validation2.isValidating || !!confirmedUrl2}
                      variant={confirmedUrl2 ? 'default' : 'outline'}
                      className={`h-12 shrink-0 ${confirmedUrl2 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-2 border-violet-500 text-violet-500 hover:bg-violet-500/10'}`}
                    >
                      {validation2.isValidating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : confirmedUrl2 ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        t.confirm
                      )}
                    </Button>
                  </div>
                  <UrlValidationBanner
                    suggestedUrl={validation2.suggestedUrl}
                    urlNotFound={validation2.urlNotFound}
                    suggestionPrefix={validation2.getSuggestionPrefix()}
                    notFoundMessage={validation2.getNotFoundMessage()}
                    onAcceptSuggestion={() => validation2.acceptSuggestion(validation2.suggestedUrl!, (validUrl) => { setUrl2(validUrl); setConfirmedUrl2(validUrl); })}
                    onDismissSuggestion={() => validation2.dismissSuggestion()}
                    onDismissNotFound={() => validation2.dismissNotFound()}
                    onIgnoreSuggestion={() => { const normalized = normalizeUrl(url2); setConfirmedUrl2(normalized); setUrl2(normalized); validation2.dismissSuggestion(); }}
                  />
                </div>
              </div>

              {/* Mobile VS */}
              <div className="md:hidden flex justify-center mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  VS
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  <Button onClick={handleLaunch} size="lg" disabled={!bothConfirmed}
                    className="bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-700 hover:to-amber-600 text-white font-semibold px-8 disabled:opacity-50">
                    <Swords className="h-4 w-4 mr-2" />
                    {t.launch}
                  </Button>
                  {!isUnlimited && (
                    <button
                      type="button"
                      onClick={() => user ? setShowTopUp(true) : setShowAuthDialog(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors cursor-pointer border border-amber-500/40 rounded-lg px-3 py-2"
                    >
                      <CreditCoin size="sm" />
                      <span>{t.credits}</span>
                    </button>
                  )}
                </div>
                {!bothConfirmed && (url1.trim() || url2.trim()) && (
                  <p className="text-xs text-muted-foreground">
                    {!confirmedUrl1 && !confirmedUrl2 ? t.confirmBoth 
                      : !confirmedUrl1 ? t.confirmSite1 : t.confirmSite2}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="relative">
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-0 items-start">
                {/* Left loading */}
                <div className="border-r-0 md:border-r border-border/30 pr-0 md:pr-4">
                  <div className="text-center mb-2">
                    <Badge variant="outline" className="text-xs">{url1.replace(/^https?:\/\//, '').substring(0, 30)}</Badge>
                  </div>
                  <CompareLoadingSteps siteName={new URL(url1.startsWith('http') ? url1 : `https://${url1}`).hostname} t={t} />
                </div>
                
                {/* Center: VS separator (desktop) */}
                <div className="hidden md:flex flex-col items-center px-4 pt-16">
                  <div className="w-px h-16 bg-gradient-to-b from-transparent via-border to-transparent" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg my-3">
                    VS
                  </div>
                  <div className="w-px h-16 bg-gradient-to-b from-transparent via-border to-transparent mb-4" />
                </div>

                {/* Right loading */}
                <div className="pl-0 md:pl-4">
                  <div className="text-center mb-2">
                    <Badge variant="outline" className="text-xs">{url2.replace(/^https?:\/\//, '').substring(0, 30)}</Badge>
                  </div>
                  <CompareLoadingSteps siteName={new URL(url2.startsWith('http') ? url2 : `https://${url2}`).hostname} t={t} />
                </div>
              </div>

              {/* Spotify Player flanked by PatienceCards */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-4 items-end justify-items-center">
                {/* Left infotainment card */}
                <div className="hidden lg:block w-[70%] justify-self-end">
                  <PatienceCards isActive={isLoading} position="left" />
                </div>

                {/* Center: Spotify */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2 justify-center mb-2">
                    <Music className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{isCustomPlaylist ? (language === 'fr' ? 'Ma Playlist' : language === 'es' ? 'Mi Playlist' : 'My Playlist') : t.playlist}</span>
                  </div>
                  <div className="w-full max-w-[672px] overflow-hidden rounded-[12px] bg-[#282828] isolate"
                    style={{ clipPath: 'inset(0 round 12px)' }}>
                    <div ref={embedContainerRef} className="w-full"
                      style={{ transform: 'scale(1.05)', transformOrigin: 'center center' }}
                      aria-label="Playlist Crawlers" />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-1 opacity-60">{t.volume}</p>
                </div>

                {/* Right infotainment card */}
                <div className="hidden lg:block w-[70%] justify-self-start">
                  <PatienceCards isActive={isLoading} position="right" />
                </div>
              </div>

              {/* Mobile: show both cards stacked */}
              <div className="lg:hidden mt-4">
                <PatienceCards isActive={isLoading} position="both" />
              </div>

              <p className="text-sm text-muted-foreground text-center mt-6">
                {t.analysisTime}
              </p>
            </div>
          )}

          {/* Results */}
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              {/* Site headers */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center mb-6">
                <div className="text-center">
                  <Badge className="bg-violet-600 text-white text-xs">{result.site1.domain}</Badge>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{result.site1.metadata.title}</p>
                </div>
                <div className="hidden md:flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    VS
                  </div>
                </div>
                <div className="md:hidden flex justify-center py-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    VS
                  </div>
                </div>
                <div className="text-center">
                  <Badge className="bg-amber-600 text-white text-xs">{result.site2.domain}</Badge>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{result.site2.metadata.title}</p>
                </div>
              </div>

              {/* Row-based comparison */}
              <SiteComparisonGrid site1={result.site1} site2={result.site2} t={t} />

              {/* Always render Radar first */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 space-y-4">
                <Separator className="my-6" />
                <Card className="border-border/50 bg-card/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" /> {t.radarTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center gap-6 mb-3">
                      <div className="flex items-center gap-2"><div className="w-4 h-2 rounded-full" style={{ backgroundColor: result.site1.brandColor || '#8b5cf6' }} /><span className="text-xs font-medium text-white">{result.site1.domain}</span></div>
                      <div className="flex items-center gap-2"><div className="w-4 h-2 rounded-full" style={{ backgroundColor: result.site2.brandColor || '#f59e0b' }} /><span className="text-xs font-medium text-white">{result.site2.domain}</span></div>
                    </div>
                    <ResponsiveContainer width="100%" height={392}>
                      <RadarChart data={[
                        { dimension: t.aeoScore, site1: result.site1.analysis.aeo_score || 0, site2: result.site2.analysis.aeo_score || 0 },
                        { dimension: t.eeat, site1: (result.site1.analysis.eeat_score?.overall || 0) * 10, site2: (result.site2.analysis.eeat_score?.overall || 0) * 10 },
                        { dimension: t.pagespeed, site1: result.site1.pagespeed?.performanceMobile || 0, site2: result.site2.pagespeed?.performanceMobile || 0 },
                        { dimension: t.backlinks, site1: Math.min(100, (result.site1.backlinks?.domainRank || 0)), site2: Math.min(100, (result.site2.backlinks?.domainRank || 0)) },
                        { dimension: t.contentDepth, site1: Math.min(100, Math.round((result.site1.contentDepth?.wordCount || 0) / 30)), site2: Math.min(100, Math.round((result.site2.contentDepth?.wordCount || 0) / 30)) },
                        { dimension: t.expertise, site1: (result.site1.analysis.expertise_sentiment?.rating || 0) * 20, site2: (result.site2.analysis.expertise_sentiment?.rating || 0) * 20 },
                      ]} cx="50%" cy="50%" outerRadius="75%">
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: 'white', fontWeight: 500 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name={result.site1.domain} dataKey="site1" stroke={result.site1.brandColor || '#8b5cf6'} fill={result.site1.brandColor || '#8b5cf6'} fillOpacity={0.2} strokeWidth={2.5} />
                        <Radar name={result.site2.domain} dataKey="site2" stroke={result.site2.brandColor || '#f59e0b'} fill={result.site2.brandColor || '#f59e0b'} fillOpacity={0.2} strokeWidth={2.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Cross-Comparison Section (verdict, SERP, differentiators) */}
              {result.crossComparison && (
                <CrossComparisonSection 
                  cross={result.crossComparison} 
                  site1={result.site1} 
                  site2={result.site2} 
                  t={t} 
                />
              )}

              {/* Restart */}
              <div className="text-center mt-8">
                <Button variant="outline" onClick={() => { setResult(null); setUrl1(''); setUrl2(''); setConfirmedUrl1(null); setConfirmedUrl2(null); }}>
                  {t.newAudit}
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* FAQ Section */}
      <section className="bg-muted/30 py-16 px-4" aria-labelledby="faq-compare-heading">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-compare-heading" className="text-2xl font-bold text-foreground text-center mb-8">
            {t.faqTitle}
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {t.faq.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border rounded-lg bg-card px-6 data-[state=open]:bg-card/80"
              >
                <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                  <h3 className="text-base font-medium">{item.q}</h3>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <Suspense fallback={null}><Footer /></Suspense>
      <CreditTopUpModal open={showTopUp} onOpenChange={setShowTopUp} currentBalance={balance} />
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold text-foreground">
              {language === 'fr' ? 'Connectez-vous pour continuer' : language === 'es' ? 'Inicie sesión para continuar' : 'Sign in to continue'}
            </DialogTitle>
          </DialogHeader>
          <InlineAuthForm 
            defaultMode="signup" 
            onSuccess={() => {
              setShowAuthDialog(false);
              refreshBalance();
            }} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditCompare;
