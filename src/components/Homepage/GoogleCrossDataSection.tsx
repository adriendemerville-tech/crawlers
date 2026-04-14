import { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, AlertTriangle, TrendingUp, DollarSign,
  Search, BarChart3, Brain, Zap
} from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

const innovations = [
  {
    icon: <AlertTriangle className="h-6 w-6" />,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    title: 'Alertes anomalies',
    sources: 'GSC + GA4 + Google Ads + Cocoon',
    desc: 'L\'IA croise les métriques de Search Console, GA4, Google Ads et les données propriétaires de Cocoon pour calculer un Z-score sur 8 semaines glissantes. Résultat : des alertes automatiques quand une métrique dévie de la normale — avant même que l\'impact ne soit visible.',
    result: 'Bannière d\'alerte avec sévérité, direction et recommandation d\'action.',
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    title: 'Prédiction de ROI SEO',
    sources: 'GA4 + GSC + DataForSEO + Revenue Events',
    desc: 'En combinant le trafic organique réel (GSC), les conversions (GA4), les revenus (webhooks e-commerce) et les positions SERP, l\'algorithme projette le ROI des actions SEO à T+30, T+60 et T+90 jours avec un indice de fiabilité.',
    result: 'Score de prédiction avec marge d\'erreur et trajectoire visuelle.',
  },
  {
    icon: <DollarSign className="h-6 w-6" />,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    title: 'Économies SEA',
    sources: 'Google Ads + GSC + Cocoon (Content Gaps)',
    desc: 'Le module SEA → SEO Bridge croise les mots-clés achetés en Google Ads avec les positions organiques et les gaps stratégiques détectés par Cocoon. Il identifie les mots-clés payants capturables en SEO et calcule les économies mensuelles potentielles.',
    result: 'Dashboard avec opportunités classées et injection 1-clic dans le Workbench.',
  },
];

export const GoogleCrossDataSection = memo(() => (
  <section className="relative py-16 lg:py-24">
    <div className="mx-auto max-w-6xl px-4">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="text-center mb-12">
        <motion.div variants={fadeUp}>
          <Badge variant="outline" className="mb-4 gap-1.5 border-primary/30 px-3 py-1 text-xs">
            <Brain className="h-3 w-3" /> Intelligence croisée
          </Badge>
        </motion.div>
        <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
          Quand la suite Google rencontre l'IA Crawlers
        </motion.h2>
        <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Nos algorithmes croisent en continu vos données Google (Ads, Search Console, Analytics, Tag Manager) avec les données propriétaires de Cocoon pour révéler des insights qu'aucun outil ne peut produire seul.
        </motion.p>
      </motion.div>

      {/* Source badges */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10 flex flex-wrap items-center justify-center gap-2">
        {[
          { icon: <Search className="h-3 w-3" />, label: 'Search Console' },
          { icon: <BarChart3 className="h-3 w-3" />, label: 'GA4' },
          { icon: <DollarSign className="h-3 w-3" />, label: 'Google Ads' },
          { icon: <Zap className="h-3 w-3" />, label: 'GTM' },
          { icon: <Brain className="h-3 w-3" />, label: 'Cocoon IA' },
        ].map((s, i) => (
          <Badge key={i} variant="secondary" className="gap-1 px-3 py-1.5 text-xs font-medium">
            {s.icon} {s.label}
          </Badge>
        ))}
      </motion.div>

      {/* Innovation cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {innovations.map((item, i) => (
          <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={fadeUp}>
            <Card className="group h-full border-border/50 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="flex h-full flex-col p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${item.bg}`}>
                    <span className={item.color}>{item.icon}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                </div>

                <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">{item.sources}</p>

                <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>

                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                  <p className="flex items-start gap-1.5 text-xs font-medium text-[#895bf5]">
                    <Zap className="mt-0.5 h-3 w-3 shrink-0" />
                    {item.result}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mt-10 text-center">
        <Link to="/sea-seo-bridge">
          <Button variant="outline" size="lg" className="gap-2 text-sm group">
            Découvrir le SEA → SEO Bridge
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </motion.div>
    </div>
  </section>
));

GoogleCrossDataSection.displayName = 'GoogleCrossDataSection';
