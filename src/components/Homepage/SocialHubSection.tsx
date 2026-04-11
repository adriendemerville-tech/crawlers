import { memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Share2, ArrowRight, TrendingUp, Brain, Search,
  Target, BarChart3, Link2, Sparkles, Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

const translations = {
  fr: {
    badge: 'Social × SEO × GEO',
    title: 'Social Hub',
    subtitle: 'Le chaînon manquant entre SEO, réseaux sociaux et GEO',
    description: 'La plupart des outils sociaux ignorent vos données SEO. Crawlers.fr croise vos mots-clés, votre cocon sémantique et vos scores E-E-A-T pour générer des publications sociales qui renforcent votre visibilité organique — et alimentent les moteurs de réponse IA.',
    enrichment: 'En retour, les données issues de vos réseaux sociaux (nom commercial, secteur, taille d\'équipe, description…) viennent enrichir automatiquement la carte d\'identité de votre site — pour une compréhension plus fine de votre marque et une stratégie SEO/GEO véritablement alignée sur votre business.',
    features: [
      {
        icon: Search,
        label: 'Mots-clés SEO → posts sociaux',
        desc: 'Vos mots-clés cibles (keyword_universe) alimentent automatiquement la génération de contenus sociaux. Chaque post renforce votre empreinte sémantique.',
      },
      {
        icon: Link2,
        label: 'Smart Linking contextuel',
        desc: 'L\'algorithme sélectionne la page la plus pertinente de votre site (score cocon + E-E-A-T + intention) pour chaque publication.',
      },
      {
        icon: Brain,
        label: 'Impact direct sur le GEO',
        desc: 'Les signaux sociaux (mentions, partages, engagement) sont captés par les LLMs. Un post LinkedIn bien ranké peut propulser votre marque dans les réponses Perplexity et ChatGPT.',
      },
      {
        icon: TrendingUp,
        label: 'Boucle de rétroaction mesurable',
        desc: 'Corrélation automatique : publication sociale → trafic organique → citation LLM. Mesurez l\'impact réel de chaque post sur votre GEO score.',
      },
    ],
    cta: 'Accéder au Social Hub',
    stats: [
      { value: '3', label: 'plateformes' },
      { value: 'SEO', label: 'data-driven' },
      { value: 'GEO', label: 'impact mesuré' },
    ],
    diagramTitle: 'Boucle SEO → Social → GEO',
    diagramSteps: [
      { icon: Search, label: 'Données SEO', sub: 'Keywords · Cocon · E-E-A-T' },
      { icon: Share2, label: 'Publication sociale', sub: 'LinkedIn · Facebook · Instagram' },
      { icon: Globe, label: 'Signaux web', sub: 'Mentions · Backlinks · Engagement' },
      { icon: Brain, label: 'Visibilité GEO', sub: 'Citations LLM · Rang IA' },
    ],
  },
  en: {
    badge: 'Social × SEO × GEO',
    title: 'Social Hub',
    subtitle: 'The missing link between SEO, social media, and GEO',
    description: 'Most social tools ignore your SEO data. Crawlers.fr crosses your keywords, semantic cocoon, and E-E-A-T scores to generate social posts that boost your organic visibility — and feed AI answer engines.',
    enrichment: 'In return, data from your social profiles (business name, industry, team size, description…) automatically enriches your site\'s identity card — for a deeper understanding of your brand and an SEO/GEO strategy truly aligned with your business.',
    features: [
      {
        icon: Search,
        label: 'SEO keywords → social posts',
        desc: 'Your target keywords (keyword_universe) automatically feed social content generation. Every post strengthens your semantic footprint.',
      },
      {
        icon: Link2,
        label: 'Contextual Smart Linking',
        desc: 'The algorithm selects the most relevant page on your site (cocoon score + E-E-A-T + intent) for each publication.',
      },
      {
        icon: Brain,
        label: 'Direct GEO impact',
        desc: 'Social signals (mentions, shares, engagement) are captured by LLMs. A well-ranked LinkedIn post can propel your brand into Perplexity and ChatGPT answers.',
      },
      {
        icon: TrendingUp,
        label: 'Measurable feedback loop',
        desc: 'Automatic correlation: social post → organic traffic → LLM citation. Measure the real impact of each post on your GEO score.',
      },
    ],
    cta: 'Access Social Hub',
    stats: [
      { value: '3', label: 'platforms' },
      { value: 'SEO', label: 'data-driven' },
      { value: 'GEO', label: 'measured impact' },
    ],
    diagramTitle: 'SEO → Social → GEO Loop',
    diagramSteps: [
      { icon: Search, label: 'SEO Data', sub: 'Keywords · Cocoon · E-E-A-T' },
      { icon: Share2, label: 'Social Publishing', sub: 'LinkedIn · Facebook · Instagram' },
      { icon: Globe, label: 'Web Signals', sub: 'Mentions · Backlinks · Engagement' },
      { icon: Brain, label: 'GEO Visibility', sub: 'LLM Citations · AI Rank' },
    ],
  },
  es: {
    badge: 'Social × SEO × GEO',
    title: 'Social Hub',
    subtitle: 'El eslabón perdido entre SEO, redes sociales y GEO',
    description: 'La mayoría de herramientas sociales ignoran sus datos SEO. Crawlers.fr cruza sus palabras clave, cocoon semántico y puntuaciones E-E-A-T para generar publicaciones que refuerzan su visibilidad orgánica — y alimentan los motores de respuesta IA.',
    enrichment: 'A cambio, los datos de sus perfiles sociales (nombre comercial, sector, tamaño del equipo, descripción…) enriquecen automáticamente la tarjeta de identidad de su sitio — para una comprensión más profunda de su marca y una estrategia SEO/GEO alineada con su negocio.',
    features: [
      {
        icon: Search,
        label: 'Keywords SEO → posts sociales',
        desc: 'Sus palabras clave (keyword_universe) alimentan automáticamente la generación de contenido social.',
      },
      {
        icon: Link2,
        label: 'Smart Linking contextual',
        desc: 'El algoritmo selecciona la página más relevante de su sitio para cada publicación.',
      },
      {
        icon: Brain,
        label: 'Impacto directo en GEO',
        desc: 'Las señales sociales son captadas por los LLMs. Un post bien posicionado puede impulsar su marca en las respuestas de IA.',
      },
      {
        icon: TrendingUp,
        label: 'Bucle de retroalimentación medible',
        desc: 'Correlación automática: publicación social → tráfico orgánico → citación LLM.',
      },
    ],
    cta: 'Acceder al Social Hub',
    stats: [
      { value: '3', label: 'plataformas' },
      { value: 'SEO', label: 'data-driven' },
      { value: 'GEO', label: 'impacto medido' },
    ],
    diagramTitle: 'Bucle SEO → Social → GEO',
    diagramSteps: [
      { icon: Search, label: 'Datos SEO', sub: 'Keywords · Cocoon · E-E-A-T' },
      { icon: Share2, label: 'Publicación social', sub: 'LinkedIn · Facebook · Instagram' },
      { icon: Globe, label: 'Señales web', sub: 'Menciones · Backlinks · Engagement' },
      { icon: Brain, label: 'Visibilidad GEO', sub: 'Citaciones LLM · Ranking IA' },
    ],
  },
};

export const SocialHubSection = memo(() => {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  return (
    <section className="border-y border-border bg-gradient-to-br from-emerald-50/40 via-background to-teal-50/30 dark:from-emerald-950/15 dark:via-background dark:to-teal-950/10 py-20 md:py-28 overflow-hidden">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="outline" className="mb-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-3 py-1 text-xs font-semibold gap-1.5">
            <Sparkles className="h-3 w-3" />
            {t.badge}
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            {t.title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t.subtitle}
          </p>
        </motion.div>

        {/* Main content: features + diagram */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
          {/* Left: description + features */}
          <motion.div
            className="flex-1 space-y-8"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="text-muted-foreground leading-relaxed text-[15px]">
              {t.description}
            </p>
            <p className="text-muted-foreground leading-relaxed text-[15px] italic border-l-2 border-emerald-500/30 pl-4">
              {t.enrichment}
            </p>

            <div className="grid gap-5">
              {t.features.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <motion.div
                    key={i}
                    className="flex gap-4 p-4 rounded-xl bg-card/60 border border-border/50 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: 0.15 + i * 0.08 }}
                  >
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground mb-1">{feat.label}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Right: Loop diagram + stats + CTA */}
          <motion.div
            className="flex-shrink-0 w-full lg:w-[400px] space-y-6"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Circular loop diagram */}
            <div className="rounded-2xl border border-emerald-500/20 bg-card shadow-xl shadow-emerald-500/5 p-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 text-center flex items-center justify-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                {t.diagramTitle}
              </p>

              <div className="relative space-y-0">
                {t.diagramSteps.map((step, i) => {
                  const StepIcon = step.icon;
                  const isLast = i === t.diagramSteps.length - 1;
                  return (
                    <div key={i}>
                      <motion.div
                        className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
                      >
                        <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <StepIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{step.label}</p>
                          <p className="text-[10px] text-muted-foreground">{step.sub}</p>
                        </div>
                      </motion.div>
                      {!isLast && (
                        <div className="flex justify-center py-1">
                          <div className="w-px h-4 bg-emerald-500/30" />
                          <span className="text-emerald-500/60 text-[10px] ml-1">↓</span>
                        </div>
                      )}
                      {isLast && (
                        <div className="flex justify-center pt-2">
                          <div className="flex items-center gap-1 text-[10px] text-emerald-500/70 font-semibold">
                            <span>↻</span>
                            <span>{language === 'fr' ? 'Boucle de renforcement' : language === 'es' ? 'Bucle de refuerzo' : 'Reinforcement loop'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {t.stats.map((stat, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-card border border-border/50">
                  <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="text-center">
              <Link to="/app/social">
                <Button
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-8 shadow-lg"
                >
                  <Share2 className="h-5 w-5" />
                  {t.cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
});

SocialHubSection.displayName = 'SocialHubSection';
