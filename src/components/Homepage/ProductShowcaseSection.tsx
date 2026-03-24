import { memo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BarChart3, Network, Search, MapPin, TrendingUp, Shield, Eye, Zap
} from 'lucide-react';

import consoleDashboard from '@/assets/screenshots/console-dashboard.png';
import cocoonGraph from '@/assets/screenshots/cocoon-graph.png';
import keywordsAudit from '@/assets/screenshots/keywords-audit.png';
import gmbReviews from '@/assets/screenshots/gmb-reviews.png';

/** Animated screenshot card with 3D perspective tilt */
function ShowcaseCard({
  image,
  title,
  subtitle,
  description,
  badge,
  badgeColor,
  icon: Icon,
  tiltDirection = 'left',
  delay = 0,
  features,
}: {
  image: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  tiltDirection?: 'left' | 'right' | 'none';
  delay?: number;
  features: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const tiltClass =
    tiltDirection === 'left'
      ? 'lg:-rotate-2 hover:rotate-0'
      : tiltDirection === 'right'
      ? 'lg:rotate-2 hover:rotate-0'
      : 'hover:scale-[1.02]';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-8 lg:gap-12 lg:grid-cols-2 items-center"
    >
      {/* Screenshot */}
      <div
        className={`relative group transition-transform duration-500 ease-out ${tiltClass}`}
        style={{ perspective: '1200px' }}
      >
        {/* Glow behind */}
        <div className={`absolute -inset-4 rounded-3xl bg-gradient-to-br ${badgeColor} opacity-[0.07] blur-2xl group-hover:opacity-[0.12] transition-opacity duration-500`} />

        <div className="relative rounded-2xl overflow-hidden border-2 border-border/50 shadow-2xl shadow-black/10 dark:shadow-black/30 group-hover:border-primary/30 transition-colors duration-300">
          {/* Browser chrome bar */}
          <div className="bg-muted/80 dark:bg-muted/40 border-b border-border/50 px-4 py-2.5 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
            </div>
            <div className="flex-1 mx-8">
              <div className="bg-background/60 rounded-md px-3 py-1 text-[10px] text-muted-foreground font-mono text-center truncate">
                crawlers.fr
              </div>
            </div>
          </div>
          <img
            src={image}
            alt={title}
            className="w-full h-auto"
            loading="lazy"
          />
        </div>
      </div>

      {/* Text content */}
      <div className="space-y-5">
        <Badge className={`${badgeColor} border-current/20 text-xs font-semibold px-3 py-1`}>
          <Icon className="w-3.5 h-3.5 mr-1.5" />
          {badge}
        </Badge>

        <h3 className="text-2xl sm:text-3xl font-bold text-foreground font-display leading-tight">
          {title}
        </h3>

        <p className="text-sm text-muted-foreground/80 font-medium uppercase tracking-wider">
          {subtitle}
        </p>

        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>

        <ul className="space-y-2.5 pt-2">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
              <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

const ProductShowcaseSection = memo(() => {
  const { language } = useLanguage();

  const showcases = [
    {
      image: consoleDashboard,
      title: language === 'fr' ? 'Console de pilotage unifiée' : 'Unified Control Console',
      subtitle: language === 'fr' ? 'Monitoring SEO · GEO · IA' : 'SEO · GEO · AI Monitoring',
      description: language === 'fr'
        ? 'Suivez l\'évolution de vos scores SEO, GEO, Performance et Visibilité IA en temps réel. L\'Autopilote Parménion lance des audits automatiques et maintient vos sites à leur meilleur niveau.'
        : 'Track your SEO, GEO, Performance and AI Visibility scores in real-time. The Parmenion Autopilot runs automatic audits and keeps your sites at peak performance.',
      badge: language === 'fr' ? 'Console' : 'Console',
      badgeColor: 'bg-primary/10 text-primary',
      icon: BarChart3,
      tiltDirection: 'left' as const,
      features: language === 'fr'
        ? [
            '9 KPIs temps réel : Performance, SEO, GEO, Visibilité IA, Citation LLM…',
            'Graphiques d\'évolution multi-métriques sur 90 jours',
            'Autopilote IA avec cycles d\'audit automatisés',
            'Intégration Google Search Console & GA4 native',
          ]
        : [
            '9 real-time KPIs: Performance, SEO, GEO, AI Visibility, LLM Citation…',
            'Multi-metric evolution charts over 90 days',
            'AI Autopilot with automated audit cycles',
            'Native Google Search Console & GA4 integration',
          ],
    },
    {
      image: cocoonGraph,
      title: language === 'fr' ? 'Cocon sémantique en 3D' : '3D Semantic Cocoon',
      subtitle: language === 'fr' ? 'Stratège Cocoon · Maillage IA' : 'Cocoon Strategist · AI Linking',
      description: language === 'fr'
        ? 'Visualisez l\'architecture complète de votre site en 3D. Identifiez les pages orphelines, les flux de liens et les clusters thématiques. Le Stratège IA prescrit des actions concrètes pour optimiser votre maillage interne.'
        : 'Visualize your complete site architecture in 3D. Identify orphan pages, link flows and thematic clusters. The AI Strategist prescribes concrete actions to optimize your internal linking.',
      badge: language === 'fr' ? 'Cocoon' : 'Cocoon',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      icon: Network,
      tiltDirection: 'right' as const,
      features: language === 'fr'
        ? [
            'Vue 3D interactive : Force, Radiale et perspective',
            'Détection automatique des pages orphelines et profondes',
            'Scores E-E-A-T, GEO, Citabilité LLM par page',
            'Auto-Maillage IA : liens internes générés automatiquement',
          ]
        : [
            'Interactive 3D view: Force, Radial and perspective',
            'Automatic orphan and deep page detection',
            'Per-page E-E-A-T, GEO, LLM Citability scores',
            'AI Auto-Linking: automatically generated internal links',
          ],
    },
    {
      image: keywordsAudit,
      title: language === 'fr' ? 'Intelligence mots-clés' : 'Keyword Intelligence',
      subtitle: language === 'fr' ? 'DataForSEO · Analyse stratégique' : 'DataForSEO · Strategic Analysis',
      description: language === 'fr'
        ? 'Croisez les données DataForSEO, Semrush et SEO.fr pour identifier vos opportunités stratégiques. Analyse comparative des volumes, difficultés et positions avec classification par intention de recherche.'
        : 'Cross-reference DataForSEO, Semrush and SEO.fr data to identify strategic opportunities. Comparative analysis of volumes, difficulty and positions with search intent classification.',
      badge: language === 'fr' ? 'Mots-clés' : 'Keywords',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      icon: Search,
      tiltDirection: 'left' as const,
      features: language === 'fr'
        ? [
            'Top 5 opportunités stratégiques identifiées par l\'IA',
            'Classification automatique : Transactionnelle, Décisionnelle, Informationnelle',
            'Analyse de difficulté et position sur chaque mot-clé',
            'Détection des contenus manquants vs concurrence',
          ]
        : [
            'Top 5 strategic opportunities identified by AI',
            'Automatic classification: Transactional, Decisional, Informational',
            'Difficulty and position analysis for each keyword',
            'Missing content detection vs competition',
          ],
    },
    {
      image: gmbReviews,
      title: language === 'fr' ? 'Google Business Profile' : 'Google Business Profile',
      subtitle: language === 'fr' ? 'Avis · Fiches · Concurrence locale' : 'Reviews · Listings · Local Competition',
      description: language === 'fr'
        ? 'Gérez vos fiches Google Business Profile directement depuis Crawlers. Suivez vos avis, répondez aux clients et analysez la concurrence locale — le tout intégré à votre stratégie SEO globale.'
        : 'Manage your Google Business Profile listings directly from Crawlers. Track reviews, respond to customers and analyze local competition — all integrated into your global SEO strategy.',
      badge: 'GBP',
      badgeColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      icon: MapPin,
      tiltDirection: 'right' as const,
      features: language === 'fr'
        ? [
            'Gestion multi-établissements (Paris, Lyon…)',
            'Suivi des avis et réponses directement depuis la console',
            'Analyse de la concurrence locale par zone',
            'Statistiques d\'engagement et visibilité GBP',
          ]
        : [
            'Multi-location management (Paris, Lyon…)',
            'Review tracking and responses directly from the console',
            'Local competition analysis by area',
            'GBP engagement and visibility statistics',
          ],
    },
  ];

  return (
    <section className="relative py-20 sm:py-32 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.03),transparent_50%)]" />

      <div className="relative mx-auto max-w-6xl px-4 space-y-8">
        {/* Section header */}
        <div className="text-center mb-16 sm:mb-24">
          <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary px-3 py-1 text-xs font-semibold">
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            {language === 'fr' ? 'Découvrir la plateforme' : 'Discover the platform'}
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground font-display">
            {language === 'fr' ? 'Tout ce dont vous avez besoin,' : 'Everything you need,'}
            <br />
            <span className="text-primary">
              {language === 'fr' ? 'au même endroit.' : 'in one place.'}
            </span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
            {language === 'fr'
              ? 'De l\'audit technique au pilotage stratégique, chaque module est conçu pour fonctionner ensemble.'
              : 'From technical audit to strategic management, every module is designed to work together.'}
          </p>
        </div>

        {/* Showcase items */}
        <div className="space-y-24 sm:space-y-32">
          {showcases.map((item, i) => (
            <div key={i} className={i % 2 === 1 ? 'lg:[direction:rtl] lg:[&>*]:[direction:ltr]' : ''}>
              <ShowcaseCard {...item} delay={0.1} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
ProductShowcaseSection.displayName = 'ProductShowcaseSection';

export { ProductShowcaseSection };
