import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, Shield, Fingerprint, Brain, Search, BarChart3, 
  Layers, Target, Bot, CheckCircle2, XCircle, Zap, Globe, 
  FileSearch, Network, TrendingUp
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

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
    momentumTitle: 'Le SEO évolue. Et vous ?',
    stat1: '18M', stat1Label: "d'utilisateurs ChatGPT en France",
    stat2: '168', stat2Label: "critères d'audit analysés",
    stat3: '4', stat3Label: 'LLMs interrogés simultanément',
    stat4: '30s', stat4Label: "pour votre Score GEO",
    // Features
    feat1Title: 'Score GEO', feat1Desc: "Mesurez votre visibilité dans ChatGPT, Gemini, Perplexity et Claude. Score sur 100, recommandations actionnables.",
    feat1Cta: 'Tester mon Score GEO',
    feat2Title: 'Audit Expert 168 critères', feat2Desc: "Diagnostic technique et sémantique complet : balises, données structurées, performance, sécurité, accessibilité.",
    feat2Cta: "Lancer l'Audit Expert",
    feat3Title: 'Cocon Sémantique 3D', feat3Desc: "Visualisez et construisez votre architecture de contenu avec l'IA. Stratège conversationnel et graphe interactif.",
    feat3Cta: 'Découvrir Cocon 3D',
    feat4Title: "Matrice d'audit", feat4Desc: "Moteur d'audit sur-mesure avec KPIs pondérés, import CSV/DOCX, prompts LLM et score global /100.",
    feat4Cta: "Ouvrir la Matrice",
    // Identity First
    idTitle: "L'approche Identity-First",
    idSubtitle: "Les LLMs ne crawlent pas comme Google. Ils cherchent votre identité sémantique.",
    idPoint1: 'Carte d\'identité sémantique de votre entreprise',
    idPoint2: 'Taxonomie dynamique enrichie par IA vocale',
    idPoint3: 'Différenciation face aux concurrents SERP et IA',
    idCta: 'Créer ma carte d\'identité',
    // Hybrid
    hybridTitle: 'SEO + GEO : le duo gagnant',
    hybridSubtitle: "Le premier outil français qui combine optimisation moteurs classiques ET moteurs génératifs.",
    colSeo: 'SEO classique', colCrawlers: 'Crawlers.fr',
    row1: 'Audit technique complet',
    row2: 'Score de visibilité IA',
    row3: 'Carte d\'identité sémantique',
    row4: 'Cocon sémantique IA',
    row5: 'Détection de drop prédictive',
    row6: 'Architecte de contenu IA',
    hybridCta: 'Essayer gratuitement',
    // Trust
    trustTitle: '1er outil français SEO + GEO',
    trustUrls: 'URLs analysées',
    trustAudits: 'Audits générés',
    trustSites: 'Sites suivis',
  },
  en: {
    momentumTitle: 'SEO is evolving. Are you?',
    stat1: '18M', stat1Label: 'ChatGPT users in France',
    stat2: '168', stat2Label: 'audit criteria analyzed',
    stat3: '4', stat3Label: 'LLMs queried simultaneously',
    stat4: '30s', stat4Label: 'for your GEO Score',
    feat1Title: 'GEO Score', feat1Desc: 'Measure your visibility in ChatGPT, Gemini, Perplexity and Claude. Score out of 100 with actionable recommendations.',
    feat1Cta: 'Test my GEO Score',
    feat2Title: '168-Criteria Expert Audit', feat2Desc: 'Complete technical & semantic diagnosis: tags, structured data, performance, security, accessibility.',
    feat2Cta: 'Launch Expert Audit',
    feat3Title: '3D Semantic Cocoon', feat3Desc: 'Visualize and build your content architecture with AI. Conversational strategist and interactive graph.',
    feat3Cta: 'Discover Cocoon 3D',
    feat4Title: 'Audit Matrix', feat4Desc: 'Custom audit engine with weighted KPIs, CSV/DOCX import, LLM prompts and global /100 score.',
    feat4Cta: 'Open the Matrix',
    idTitle: 'The Identity-First Approach',
    idSubtitle: "LLMs don't crawl like Google. They seek your semantic identity.",
    idPoint1: 'Semantic identity card for your business',
    idPoint2: 'Dynamic taxonomy enriched by voice AI',
    idPoint3: 'Differentiation from SERP and AI competitors',
    idCta: 'Create my identity card',
    hybridTitle: 'SEO + GEO: the winning duo',
    hybridSubtitle: 'The first French tool combining classic search engine optimization AND generative engine optimization.',
    colSeo: 'Classic SEO', colCrawlers: 'Crawlers.fr',
    row1: 'Complete technical audit', row2: 'AI visibility score', row3: 'Semantic identity card',
    row4: 'AI semantic cocoon', row5: 'Predictive drop detection', row6: 'AI content architect',
    hybridCta: 'Try for free',
    trustTitle: '#1 French SEO + GEO tool',
    trustUrls: 'URLs analyzed', trustAudits: 'Audits generated', trustSites: 'Sites tracked',
  },
  es: {
    momentumTitle: 'El SEO evoluciona. ¿Y tú?',
    stat1: '18M', stat1Label: 'usuarios de ChatGPT en Francia',
    stat2: '168', stat2Label: 'criterios de auditoría',
    stat3: '4', stat3Label: 'LLMs consultados simultáneamente',
    stat4: '30s', stat4Label: 'para tu Score GEO',
    feat1Title: 'Score GEO', feat1Desc: 'Mide tu visibilidad en ChatGPT, Gemini, Perplexity y Claude. Puntuación sobre 100 con recomendaciones.',
    feat1Cta: 'Probar mi Score GEO',
    feat2Title: 'Auditoría Experta 168 criterios', feat2Desc: 'Diagnóstico técnico y semántico completo: etiquetas, datos estructurados, rendimiento, seguridad.',
    feat2Cta: 'Lanzar Auditoría Experta',
    feat3Title: 'Cocón Semántico 3D', feat3Desc: 'Visualiza y construye tu arquitectura de contenido con IA. Estratega conversacional y grafo interactivo.',
    feat3Cta: 'Descubrir Cocón 3D',
    feat4Title: 'Matriz de auditoría', feat4Desc: 'Motor de auditoría personalizado con KPIs ponderados, importación CSV/DOCX, prompts LLM y puntuación global /100.',
    feat4Cta: 'Abrir la Matriz',
    idTitle: 'El enfoque Identity-First',
    idSubtitle: 'Los LLMs no rastrean como Google. Buscan tu identidad semántica.',
    idPoint1: 'Tarjeta de identidad semántica de tu empresa',
    idPoint2: 'Taxonomía dinámica enriquecida por IA de voz',
    idPoint3: 'Diferenciación frente a competidores SERP e IA',
    idCta: 'Crear mi tarjeta de identidad',
    hybridTitle: 'SEO + GEO: el dúo ganador',
    hybridSubtitle: 'La primera herramienta francesa que combina optimización SEO clásica Y optimización para motores generativos.',
    colSeo: 'SEO clásico', colCrawlers: 'Crawlers.fr',
    row1: 'Auditoría técnica completa', row2: 'Puntuación de visibilidad IA', row3: 'Tarjeta de identidad semántica',
    row4: 'Cocón semántico IA', row5: 'Detección predictiva de caída', row6: 'Arquitecto de contenido IA',
    hybridCta: 'Probar gratis',
    trustTitle: '1ª herramienta francesa SEO + GEO',
    trustUrls: 'URLs analizadas', trustAudits: 'Auditorías generadas', trustSites: 'Sitios monitorizados',
  },
};

/* ─── Section 1: Momentum KPIs ─── */
const MomentumSection = memo(() => {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;
  const stats = [
    { value: 18000000, label: t.stat1Label, suffix: '', prefix: '' },
    { value: 168, label: t.stat2Label, suffix: '', prefix: '' },
    { value: 4, label: t.stat3Label, suffix: '', prefix: '' },
    { value: 30, label: t.stat4Label, suffix: 's', prefix: '' },
  ];
  return (
    <section className="border-y border-border bg-card/50 py-10 md:py-14">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-xl font-bold text-foreground sm:text-2xl mb-8">{t.momentumTitle}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-brand-violet">
                <AnimatedCounter end={s.value} suffix={s.suffix} prefix={s.prefix} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
MomentumSection.displayName = 'MomentumSection';

/* ─── Section 2: Feature Showcase ─── */
const features = [
  { icon: Target, ctaLink: '/?tab=geo', gradient: 'from-violet-500/10 to-primary/5', iconColor: 'text-brand-violet' },
  { icon: FileSearch, ctaLink: '/audit-expert', gradient: 'from-primary/10 to-sky-500/5', iconColor: 'text-primary' },
  { icon: Network, ctaLink: '/cocoon', gradient: 'from-emerald-500/10 to-teal-500/5', iconColor: 'text-success' },
  { icon: Layers, ctaLink: '/matrice', gradient: 'from-amber-500/10 to-orange-500/5', iconColor: 'text-warning' },
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
      <div className="container mx-auto px-4 space-y-16 md:space-y-24">
        {items.map((item, i) => {
          const feat = features[i];
          const Icon = feat.icon;
          const isReversed = i % 2 !== 0;
          return (
            <div key={i} className={cn(
              'flex flex-col md:flex-row items-center gap-8 md:gap-14',
              isReversed && 'md:flex-row-reverse'
            )}>
              {/* Visual block */}
              <div className={cn(
                'flex-1 flex items-center justify-center rounded-2xl p-10 md:p-16 bg-gradient-to-br min-h-[200px]',
                feat.gradient
              )}>
                <Icon className={cn('h-20 w-20 md:h-28 md:w-28', feat.iconColor)} strokeWidth={1.2} />
              </div>
              {/* Text block */}
              <div className="flex-1 space-y-4">
                <h3 className="text-2xl font-bold text-foreground sm:text-3xl">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                <Link to={feat.ctaLink}>
                  <Button variant="hero" className="gap-2 mt-2">
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
    { icon: Fingerprint, text: t.idPoint1 },
    { icon: Brain, text: t.idPoint2 },
    { icon: Shield, text: t.idPoint3 },
  ];

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-brand-violet-muted/30 via-background to-background">
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-violet/10 border border-brand-violet/20 px-4 py-1.5 text-sm font-semibold text-brand-violet mb-5">
          <Fingerprint className="h-4 w-4" />
          Identity-First
        </div>
        <h2 className="text-2xl font-bold text-foreground sm:text-4xl mb-3">{t.idTitle}</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-10">{t.idSubtitle}</p>

        <div className="grid md:grid-cols-3 gap-6">
          {points.map((pt, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-violet/10">
                <pt.icon className="h-6 w-6 text-brand-violet" />
              </div>
              <p className="text-sm font-medium text-foreground">{pt.text}</p>
            </div>
          ))}
        </div>

        <Link to="/mes-sites" className="mt-8 inline-block">
          <Button variant="hero" className="gap-2">
            {t.idCta}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
});
IdentityFirstSection.displayName = 'IdentityFirstSection';

/* ─── Section 4: SEO + GEO Hybrid Comparison ─── */
const HybridSection = memo(() => {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;
  const rows = [t.row1, t.row2, t.row3, t.row4, t.row5, t.row6];
  const seoHas = [true, false, false, false, false, false];

  return (
    <section className="py-16 md:py-24 bg-card/50 border-y border-border">
      <div className="container mx-auto px-4 max-w-3xl text-center">
        <h2 className="text-2xl font-bold text-foreground sm:text-4xl mb-3">{t.hybridTitle}</h2>
        <p className="text-muted-foreground mb-10">{t.hybridSubtitle}</p>

        <div className="overflow-hidden rounded-xl border border-border">
          {/* Header */}
          <div className="grid grid-cols-3 bg-muted/50 text-sm font-semibold text-foreground">
            <div className="p-3 text-left">&nbsp;</div>
            <div className="p-3 text-center border-l border-border">{t.colSeo}</div>
            <div className="p-3 text-center border-l border-border text-brand-violet">{t.colCrawlers}</div>
          </div>
          {/* Rows */}
          {rows.map((row, i) => (
            <div key={i} className={cn('grid grid-cols-3 text-sm', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
              <div className="p-3 text-left text-foreground font-medium">{row}</div>
              <div className="p-3 flex items-center justify-center border-l border-border">
                {seoHas[i] ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
              <div className="p-3 flex items-center justify-center border-l border-border">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            </div>
          ))}
        </div>

        <Link to="/" className="mt-8 inline-block">
          <Button variant="hero" className="gap-2">
            {t.hybridCta}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
});
HybridSection.displayName = 'HybridSection';

/* ─── Section 5: Trust Banner ─── */
const TrustBanner = memo(() => {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;

  return (
    <section className="py-12 md:py-16 bg-gradient-to-r from-primary/5 via-brand-violet/5 to-primary/5">
      <div className="container mx-auto px-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-violet mb-6">{t.trustTitle}</p>
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
              <AnimatedCounter end={45000} suffix="+" />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t.trustUrls}</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
              <AnimatedCounter end={12000} suffix="+" />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t.trustAudits}</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
              <AnimatedCounter end={850} suffix="+" />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t.trustSites}</p>
          </div>
        </div>
      </div>
    </section>
  );
});
TrustBanner.displayName = 'TrustBanner';

/* ─── Export all sections ─── */
export { MomentumSection, FeatureShowcase, IdentityFirstSection, HybridSection, TrustBanner };
