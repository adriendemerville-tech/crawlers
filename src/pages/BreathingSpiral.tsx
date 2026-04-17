import { memo, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, useInView } from 'framer-motion';
import {
  Activity, Shield, TrendingUp, Target, Zap, BarChart3,
  ArrowRight, Brain, Compass, RefreshCw, Eye, ChevronDown,
} from 'lucide-react';

const SITE_URL = 'https://crawlers.fr';

/* ─── Animated Spiral SVG ─── */
const BreathingSpiralAnimation = memo(() => {
  const [phase, setPhase] = useState<'expand' | 'contract'>('expand');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setPhase(p => (p === 'expand' ? 'contract' : 'expand'));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const rings = [
    { ring: 1, label: 'Ring 1 · Core', color: 'hsl(var(--primary))', baseR: 60 },
    { ring: 2, label: 'Ring 2 · Adjacent', color: 'hsl(var(--brand-violet))', baseR: 120 },
    { ring: 3, label: 'Ring 3 · Autorité', color: 'hsl(var(--muted-foreground))', baseR: 180 },
  ];

  return (
    <div className="relative w-full max-w-lg mx-auto aspect-square">
      <svg viewBox="0 0 400 400" className="w-full h-full" aria-label="Animation de la Breathing Spiral montrant la contraction et l'expansion des anneaux thématiques">
        <defs>
          <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <circle cx="200" cy="200" r="190" fill="url(#core-glow)" />

        {/* Rings */}
        {rings.map((r, i) => {
          const breathOffset = phase === 'contract' ? -15 * (i + 1) : 10 * (i + 1);
          const radius = r.baseR + breathOffset;
          const dashLen = 2 * Math.PI * radius;

          return (
            <g key={r.ring}>
              <circle
                cx="200" cy="200" r={radius}
                fill="none" stroke={r.color} strokeWidth={phase === 'contract' && i === 0 ? 3 : 1.5}
                strokeDasharray={`${dashLen * 0.7} ${dashLen * 0.3}`}
                strokeLinecap="round" opacity={0.5 + (i === 0 && phase === 'contract' ? 0.4 : 0)}
                style={{
                  transition: 'all 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformOrigin: '200px 200px',
                  transform: `rotate(${tick * 15 + i * 30}deg)`,
                }}
              />
              {/* Ring label */}
              <text
                x="200" y={200 - radius - 8}
                textAnchor="middle" fill={r.color} fontSize="10" fontFamily="var(--font-sans)"
                opacity={0.7}
                style={{ transition: 'all 2.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
              >
                {r.label}
              </text>
            </g>
          );
        })}

        {/* Center core */}
        <circle
          cx="200" cy="200"
          r={phase === 'contract' ? 18 : 12}
          fill="hsl(var(--primary))"
          opacity={phase === 'contract' ? 1 : 0.7}
          style={{ transition: 'all 2.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />

        {/* Phase indicator */}
        <text x="200" y="370" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12" fontFamily="var(--font-sans)">
          {phase === 'contract' ? '⟵ Contraction · Consolidation' : 'Expansion · Croissance ⟶'}
        </text>

        {/* Signal arrows (anomaly indicators) */}
        {phase === 'contract' && (
          <>
            {[45, 135, 225, 315].map(angle => {
              const rad = (angle * Math.PI) / 180;
              const x1 = 200 + Math.cos(rad) * 160;
              const y1 = 200 + Math.sin(rad) * 160;
              const x2 = 200 + Math.cos(rad) * 80;
              const y2 = 200 + Math.sin(rad) * 80;
              return (
                <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="hsl(var(--destructive))" strokeWidth="1" opacity="0.4"
                  strokeDasharray="4 4"
                  style={{ transition: 'opacity 1s ease-in' }}
                />
              );
            })}
          </>
        )}
      </svg>

      {/* Status badge */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors duration-1000 ${
          phase === 'contract'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-success/10 text-success'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${phase === 'contract' ? 'bg-destructive' : 'bg-success'} animate-pulse`} />
          {phase === 'contract' ? 'Anomalie détectée' : 'Croissance stable'}
        </span>
      </div>
    </div>
  );
});
BreathingSpiralAnimation.displayName = 'BreathingSpiralAnimation';

/* ─── Signal Weight Chart ─── */
const SIGNALS = [
  { name: 'Proximité anneau', weight: 18, icon: Target, desc: 'Priorise le cœur de métier (Ring 1) avant l\'expansion' },
  { name: 'Maturité cluster', weight: 18, icon: BarChart3, desc: 'Mesure la couverture thématique de chaque cluster' },
  { name: 'Sévérité', weight: 12, icon: Shield, desc: 'Gravité technique des problèmes détectés' },
  { name: 'Urgence anomalie', weight: 12, icon: Zap, desc: 'Chutes GSC/GA4 détectées en temps réel' },
  { name: 'Boost saisonnier', weight: 10, icon: Activity, desc: 'Adaptation automatique aux pics de demande' },
  { name: 'Déclin vélocité', weight: 8, icon: TrendingUp, desc: 'Perte ≥3 positions sur 3 semaines' },
  { name: 'Couverture mots-clés', weight: 8, icon: Compass, desc: 'Taux de couverture de l\'univers sémantique' },
  { name: 'Momentum concurrent', weight: 7, icon: Eye, desc: 'Concurrent gagne ≥5 positions' },
  { name: 'Urgence GMB', weight: 7, icon: Brain, desc: 'Chute ranking local ou perte d\'avis' },
];

const SignalBar = memo(({ signal, index }: { signal: typeof SIGNALS[0]; index: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const Icon = signal.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="group"
    >
      <div className="flex items-center gap-3 mb-1">
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">{signal.name}</span>
        <span className="text-xs font-mono text-muted-foreground">{signal.weight}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden ml-7">
        <motion.div
          className="h-full rounded-full bg-primary/70"
          initial={{ width: 0 }}
          animate={inView ? { width: `${signal.weight * 5}%` } : {}}
          transition={{ delay: index * 0.08 + 0.2, duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1 ml-7 opacity-0 group-hover:opacity-100 transition-opacity">
        {signal.desc}
      </p>
    </motion.div>
  );
});
SignalBar.displayName = 'SignalBar';

/* ─── Breathing Events Table ─── */
const BREATHING_EVENTS = [
  { event: 'Anomalie GSC/GA4', effect: 'Contraction vers Ring 1', mechanism: 'anomaly_urgency booste les items core', direction: '⟵' },
  { event: 'Saisonnalité (Black Friday)', effect: 'Contraction temporaire Ring 1', mechanism: 'seasonal_boost repriorise les pages commerciales', direction: '⟵' },
  { event: 'Concurrent gagne terrain', effect: 'Contraction ciblée', mechanism: 'competitor_momentum booste le keyword menacé', direction: '⟵' },
  { event: 'Érosion lente (velocity decay)', effect: 'Contraction progressive', mechanism: 'Auto-génère des content_upgrade', direction: '⟵' },
  { event: 'Maturité Ring 1 > 70%', effect: 'Expansion vers Ring 2', mechanism: 'cluster_maturity_gap des rings extérieurs devient prioritaire', direction: '⟶' },
  { event: 'Stabilité confirmée', effect: 'Expansion vers Ring 3', mechanism: 'Aucune anomalie + couverture core solide', direction: '⟶' },
];

/* ─── Main Page ─── */
function BreathingSpiralPage() {
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });

  const canonicalUrl = `${SITE_URL}/breathing-spiral`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Breathing Spiral : Le SEO qui respire avec votre site',
    description: 'La Breathing Spiral est un système homéostatique de pilotage SEO qui oscille dynamiquement entre consolidation et expansion, piloté par 9 signaux temps réel.',
    author: { '@type': 'Organization', name: 'Crawlers.fr' },
    publisher: { '@type': 'Organization', name: 'Crawlers.fr', logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` } },
    datePublished: '2026-04-12',
    dateModified: '2026-04-12',
    image: `${SITE_URL}/favicon.svg`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    inLanguage: 'fr-FR',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Qu\'est-ce que la Breathing Spiral en SEO ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'La Breathing Spiral est un système de pilotage SEO homéostatique qui oscille entre contraction (consolidation du cœur de métier) et expansion (croissance vers des thématiques adjacentes), piloté par 9 signaux temps réel issus de Google Search Console, GA4 et de l\'analyse concurrentielle.',
        },
      },
      {
        '@type': 'Question',
        name: 'En quoi la Breathing Spiral diffère-t-elle du SEO traditionnel ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Le SEO traditionnel suit un plan éditorial statique. La Breathing Spiral s\'adapte en temps réel aux événements perturbateurs (chutes de positions, saisonnalité, concurrence) en repriorisant automatiquement les actions. Elle garantit une fondation solide avant toute expansion horizontale.',
        },
      },
      {
        '@type': 'Question',
        name: 'Comment fonctionne le spiral_score ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Le spiral_score est une note composite de 0 à 100 qui agrège 9 signaux pondérés : proximité d\'anneau (18%), maturité cluster (18%), sévérité (12%), urgence anomalie (12%), boost saisonnier (10%), déclin vélocité (8%), couverture mots-clés (8%), momentum concurrent (7%) et urgence GMB (7%). Il est recalculé toutes les 6 heures.',
        },
      },
      {
        '@type': 'Question',
        name: 'Comment la Breathing Spiral valide-t-elle ses décisions ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Chaque décision est évaluée à T+30 jours via un reward_signal (-100 à +100). Ce signal compare l\'impact réel (delta clics, positions, CTR, impressions) au score de priorité attribué au moment de la décision. Une pénalité supplémentaire est appliquée si un item sur-priorisé produit un résultat négatif. Ce mécanisme de rétroaction permet d\'affiner progressivement les poids du scoring.',
        },
      },
    ],
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Breathing Spiral', item: canonicalUrl },
    ],
  };

  return (
    <>
      <Helmet>
        <title>Breathing Spiral : Le SEO Adaptatif Piloté par l'IA | Crawlers.fr</title>
        <meta name="description" content="La Breathing Spiral est un système homéostatique de pilotage SEO. 9 signaux temps réel pilotent l'oscillation entre consolidation et expansion pour une croissance organique durable." />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <meta property="og:type" content="article" />
        <meta property="og:title" content="Breathing Spiral : Le SEO qui respire avec votre site" />
        <meta property="og:description" content="Un système homéostatique de pilotage SEO piloté par 9 signaux temps réel. Consolidation quand il faut, expansion quand c'est possible." />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Breathing Spiral : Le SEO Adaptatif" />
        <meta name="twitter:description" content="9 signaux. 3 anneaux. 1 spirale qui respire. Découvrez le pilotage SEO homéostatique." />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main>
          {/* ── Hero ── */}
          <section ref={heroRef} className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={heroInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6 }}
                >
                  {/* Breadcrumb */}
                  <nav aria-label="Fil d'Ariane" className="mb-6">
                    <ol className="flex items-center gap-2 text-xs text-muted-foreground">
                      <li><Link to="/" className="hover:text-primary transition-colors">Accueil</Link></li>
                      <li>/</li>
                      <li className="text-foreground font-medium">Breathing Spiral</li>
                    </ol>
                  </nav>

                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
                    Breathing Spiral
                    <span className="block text-primary mt-2">Le SEO qui respire avec votre site</span>
                  </h1>
                  <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
                    Un système <strong>homéostatique</strong> de pilotage SEO qui oscille dynamiquement entre
                    consolidation et expansion — piloté par <strong>9 signaux temps réel</strong> issus de
                    Google Search Console, GA4 et de l'analyse concurrentielle.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild size="lg" variant="hero">
                      <Link to="/audit-expert">Activer l'Autopilot <ArrowRight className="ml-2 w-4 h-4" /></Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <a href="#fonctionnement">Comment ça marche <ChevronDown className="ml-1 w-4 h-4" /></a>
                    </Button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={heroInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  <BreathingSpiralAnimation />
                </motion.div>
              </div>
            </div>
          </section>

          {/* ── Concept Section ── */}
          <section className="py-16 sm:py-20 bg-muted/30">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8 text-center">
                Pourquoi le SEO statique est obsolète
              </h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="text-destructive">✕</span> Plan éditorial statique
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Calendrier fixe, indifférent aux signaux terrain</li>
                      <li>• Croissance horizontale sans fondation solide</li>
                      <li>• Réaction lente aux chutes de positions</li>
                      <li>• Pas de priorisation par ROI réel</li>
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="text-primary">✓</span> Breathing Spiral
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• <strong>9 signaux temps réel</strong> pilotent chaque décision</li>
                      <li>• Consolidation avant expansion (Ring 1 → 2 → 3)</li>
                      <li>• Réaction automatique en <strong>&lt;6 heures</strong></li>
                      <li>• Priorisation par conversion GA4 réelle</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* ── Fonctionnement détaillé ── */}
          <section id="fonctionnement" className="py-16 sm:py-20 scroll-mt-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 text-center">
                Les 3 anneaux de la spirale
              </h2>
              <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
                Chaque mot-clé est automatiquement classifié dans un anneau par le classificateur sémantique,
                basé sur l'identité du site (secteur, produits, audience cible).
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-16">
                {[
                  { ring: 1, title: 'Core', desc: 'Mots-clés cœur de métier. Produits, services, marque. Fondation obligatoire avant toute expansion.', threshold: 'Maturité > 70% requise', color: 'primary' },
                  { ring: 2, title: 'Adjacent', desc: 'Thématiques connexes. Audience cible, cas d\'usage, problématiques clients.', threshold: 'Accessible après Ring 1 mature', color: 'brand-violet' },
                  { ring: 3, title: 'Autorité', desc: 'Thématiques d\'autorité. Tendances sectorielles, études, thought leadership.', threshold: 'Expansion de prestige', color: 'muted-foreground' },
                ].map((r, i) => (
                  <motion.div
                    key={r.ring}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                  >
                    <Card>
                      <CardContent className="pt-6">
                        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium mb-3 bg-${r.color}/10 text-${r.color}`}
                          style={{ backgroundColor: `hsl(var(--${r.color}) / 0.1)`, color: `hsl(var(--${r.color}))` }}
                        >
                          Ring {r.ring} · {r.title}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{r.desc}</p>
                        <p className="text-xs font-medium text-foreground/70">{r.threshold}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* ── Signal Weights ── */}
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 text-center">
                Les 9 signaux du spiral_score
              </h2>
              <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
                Chaque signal est pondéré et recalculé toutes les 6 heures. La note composite (0-100)
                détermine la prochaine action à exécuter.
              </p>

              <div className="max-w-xl mx-auto space-y-4">
                {SIGNALS.map((s, i) => (
                  <SignalBar key={s.name} signal={s} index={i} />
                ))}
              </div>

              {/* Formula */}
              <div className="mt-10 p-4 rounded-lg bg-muted/50 border text-xs font-mono text-muted-foreground overflow-x-auto">
                <p className="mb-1 text-foreground font-semibold text-sm font-sans">Formule du spiral_score :</p>
                <code>
                  spiral_score = (ring_proximity × 0.18) + (cluster_maturity_gap × 0.18) + (severity × 0.12) + (anomaly_urgency × 0.12) + (seasonal_boost × 0.10) + (velocity_decay × 0.08) + (keyword_coverage × 0.08) + (competitor_momentum × 0.07) + (gmb_urgency × 0.07) × conversion_weight − cooldown_malus
                </code>
              </div>
            </div>
          </section>

          {/* ── Breathing Events Table ── */}
          <section className="py-16 sm:py-20 bg-muted/30">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 text-center">
                Comment la spirale respire ?
              </h2>
              <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
                La spirale n'est pas monotone — elle oscille entre contraction et expansion
                en réponse aux événements du terrain.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Événement</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Direction</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Effet</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground hidden sm:table-cell">Mécanisme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BREATHING_EVENTS.map((e, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-3 font-medium text-foreground">{e.event}</td>
                        <td className="py-3 px-3 text-lg">{e.direction}</td>
                        <td className="py-3 px-3 text-muted-foreground">{e.effect}</td>
                        <td className="py-3 px-3 text-muted-foreground text-xs hidden sm:table-cell">{e.mechanism}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Reward Signal / Feedback Loop ── */}
          <section className="py-16 sm:py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 text-center">
                Boucle de rétroaction : le scoring qui apprend
              </h2>
              <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
                Chaque décision prise par la spirale est évaluée à T+30 jours.
                Le <strong>reward_signal</strong> mesure l'impact réel pour affiner les poids du scoring.
              </p>

              <div className="grid sm:grid-cols-3 gap-6 mb-10">
                {[
                  { step: '1', title: 'Capture', desc: 'Le spiral_score de l\'item choisi est enregistré au moment de la décision (spiral_score_at_decision).' },
                  { step: '2', title: 'Mesure à T+30', desc: 'Delta clics (40%), delta position (25%), delta CTR (20%) et delta impressions (15%) sont comparés à la baseline.' },
                  { step: '3', title: 'Reward Signal', desc: 'Un score de -100 à +100 est calculé. Pénalité de sur-priorisation si le spiral_score était élevé mais l\'outcome négatif.' },
                ].map((s) => (
                  <Card key={s.step}>
                    <CardContent className="pt-6">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm mb-3">
                        {s.step}
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
                      <p className="text-sm text-muted-foreground">{s.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
                <p className="mb-1 text-foreground font-semibold">Formule du reward_signal :</p>
                <code className="text-xs font-mono block overflow-x-auto">
                  reward = (Δclicks × 0.40) + (−Δposition × 0.25) + (ΔCTR × 0.20) + (Δimpressions × 0.15) − over_prioritization_penalty
                </code>
                <p className="mt-2 text-xs">
                  Ce dataset <em>spiral_score ↔ reward_signal</em> permettra à terme une régression pour calibrer automatiquement les 9 poids du scoring.
                </p>
              </div>
            </div>
          </section>

          {/* ── Saturation Intelligence (weekly) ── */}
          <section className="py-16 sm:py-20 bg-muted/30">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 text-center">
                Intelligence de saturation hebdomadaire
              </h2>
              <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
                Tous les dimanches, trois jobs autonomes recalculent l'état du site et alimentent le pipeline éditorial
                avec un signal de <strong>saturation thématique</strong>. Objectif : ne jamais publier un contenu sur un angle déjà saturé,
                concentrer la production sur les <strong>gaps angulaires</strong> à fort potentiel.
              </p>

              <div className="grid sm:grid-cols-3 gap-6 mb-10">
                {[
                  { time: '02:00 UTC', title: 'Cocoon refresh', desc: 'Recalcul du graphe de maillage interne pour chaque site activé. Détection des nouvelles cannibalisations et des évolutions de profondeur.' },
                  { time: '03:00 UTC', title: 'CMS cache refresh', desc: 'Synchronisation des contenus publiés (WordPress, Shopify, IKtracker, Drupal, Odoo, PrestaShop). Base à jour pour la suite.' },
                  { time: '04:00 UTC', title: 'Saturation LLM', desc: 'Analyse ciblée des clusters prioritaires (spiral_score ≥ 50). Gemini 3 Flash extrait les angles, Gemini 2.5 Pro synthétise score + gaps.' },
                ].map((j, i) => (
                  <Card key={j.title}>
                    <CardContent className="pt-6">
                      <div className="text-xs font-mono text-primary mb-2">{j.time}</div>
                      <h3 className="font-semibold text-foreground mb-2">Job {i + 1} — {j.title}</h3>
                      <p className="text-sm text-muted-foreground">{j.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-card border text-sm text-muted-foreground">
                <p className="text-foreground font-semibold mb-2">Économie d'échelle</p>
                <p>
                  L'analyse LLM ne porte que sur les clusters flaggés prioritaires par le scoring local et le moteur cocoon.
                  Coût moyen : <strong>~0,09 €/site/semaine</strong>. Le snapshot est ensuite injecté automatiquement dans le Stage 0
                  du pipeline éditorial pour orienter chaque génération vers un angle non-saturé.
                </p>
              </div>
            </div>
          </section>

          {/* ── GEO Elegance Section ── */}
          <section className="py-16 sm:py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8 text-center">
                Pourquoi la Breathing Spiral est taillée pour le GEO
              </h2>

              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  { icon: RefreshCw, title: 'Adaptation en temps réel', desc: 'Les LLMs évaluent la fraîcheur et la pertinence. La spirale garantit que le contenu core est toujours à jour avant d\'étendre la couverture.' },
                  { icon: Target, title: 'Profondeur > Largeur', desc: 'Les moteurs génératifs favorisent les sources qui démontrent une expertise profonde. Ring 1 construit cette autorité thématique.' },
                  { icon: Brain, title: 'Cohérence sémantique', desc: 'Le maillage interne suit la structure en anneaux. Les LLMs comprennent mieux un site dont l\'architecture reflète la hiérarchie d\'expertise.' },
                  { icon: Shield, title: 'Résilience anti-fragile', desc: 'Face aux mises à jour d\'algorithme (Google ou LLM), la spirale se contracte pour consolider, puis reprend son expansion. Le site ne s\'effondre jamais.' },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card className="h-full">
                      <CardContent className="pt-6">
                        <item.icon className="w-8 h-8 text-primary mb-3" />
                        <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQ (visible for GEO) ── */}
          <section className="py-16 sm:py-20 bg-muted/30">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8 text-center">
                Questions fréquentes
              </h2>
              <div className="space-y-6">
                {faqSchema.mainEntity.map((faq, i) => (
                  <div key={i} className="border-b border-border/50 pb-6">
                    <h3 className="font-semibold text-foreground mb-2">{faq.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.acceptedAnswer.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="py-16 sm:py-20">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Activez la Breathing Spiral sur votre site
              </h2>
              <p className="text-muted-foreground mb-8">
                Commencez par un audit expert pour cartographier vos anneaux,
                puis laissez l'Autopilot piloter la spirale.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" variant="hero">
                  <Link to="/audit-expert">Lancer l'audit expert <ArrowRight className="ml-2 w-4 h-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/blog">Explorer le blog</Link>
                </Button>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default memo(BreathingSpiralPage);
