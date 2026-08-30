import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Check, X, ExternalLink, Target, Users, Wallet, Zap, Brain,
  BarChart3, Shield, Bot, FileCode, Network, Gauge, Layers,
  ArrowRight, HelpCircle, Cpu, Globe, FileText, Rocket,
} from 'lucide-react';
import { Link } from '@/lib/router-compat';
import { SiloNav } from '@/components/seo/SiloNav';
import { DirectAnswer } from '@/components/seo/DirectAnswer';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


const SITE_URL = 'https://crawlers.fr';

/* ─── Structured Data ─── */

const articleSD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Crawlers.fr vs Semrush : Comparatif Complet 2026",
  "description": "Comparaison détaillée entre Crawlers.fr et Semrush : 25+ critères, tarifs, fonctionnalités SEO, GEO, IA, agences. Guide pour choisir l'outil adapté.",
  "author": { "@type": "Person", "name": "Adrien de Volontat", "url": `${SITE_URL}/a-propos` },
  "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": SITE_URL },
  "datePublished": "2026-02-03",
  "dateModified": "2026-04-06",
  "wordCount": 3600,
  "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/comparatif-crawlers-semrush` },
};

const breadcrumbSD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE_URL },
    { "@type": "ListItem", "position": 2, "name": "Comparatifs", "item": `${SITE_URL}/comparatif-crawlers-semrush` },
    { "@type": "ListItem", "position": 3, "name": "Crawlers.fr vs Semrush", "item": `${SITE_URL}/comparatif-crawlers-semrush` },
  ],
};

const faqItems = [
  {
    q: "Quelle est la différence principale entre Crawlers.fr et Semrush ?",
    a: "Semrush est une suite SEO complète axée sur le référencement Google (mots-clés, backlinks, positions). Crawlers.fr est une plateforme Identity-First qui combine SEO technique, GEO (visibilité IA) et génération de contenu/code correctif. Les deux sont complémentaires.",
  },
  {
    q: "Semrush est-il meilleur que Crawlers.fr pour le SEO ?",
    a: "Pour la recherche de mots-clés, l'analyse de backlinks et le suivi de positions Google, Semrush est supérieur. Pour l'audit technique avec code correctif, l'optimisation GEO (ChatGPT, Perplexity, Gemini), le cocon sémantique 3D et la génération de contenu IA, Crawlers.fr est plus avancé.",
  },
  {
    q: "Combien coûte Crawlers.fr par rapport à Semrush ?",
    a: "Semrush Pro démarre à 139,95$/mois (~130€). Crawlers.fr propose des audits gratuits, des crédits à partir de 5€, et des abonnements Pro Agency à 29€/mois ou Pro Agency+ à 79€/mois avec tout illimité. Soit 2 à 20 fois moins cher selon l'usage.",
  },
  {
    q: "Crawlers.fr remplace-t-il Semrush ?",
    a: "Non. Les deux outils répondent à des besoins différents. Beaucoup de nos utilisateurs Pro utilisent les deux : Semrush pour le suivi de positions et l'analyse concurrentielle, Crawlers.fr pour l'audit technique automatisé, le GEO, le Content Architect et le déploiement CMS direct.",
  },
  {
    q: "Puis-je utiliser Crawlers.fr en marque blanche pour mes clients ?",
    a: "Oui. Le plan Pro Agency (29€/mois) inclut la marque blanche avec logo, couleurs et rapports personnalisés + 2 comptes collaborateurs. Le plan Pro Agency+ (79€/mois) ajoute l'API Marina en marque blanche complète + 3 comptes.",
  },
  {
    q: "Crawlers.fr peut-il déployer les corrections directement sur mon site ?",
    a: "Oui. Crawlers.fr se connecte à WordPress, Shopify, Wix et PrestaShop via des connecteurs CMS natifs. Code Architect génère le code correctif et peut le déployer directement sur votre site, sans intervention manuelle.",
  },
  {
    q: "Qu'est-ce que le Score GEO et pourquoi Semrush ne le propose pas ?",
    a: "Le Score GEO mesure la capacité de votre site à être cité par les IA génératives (ChatGPT, Gemini, Perplexity, Claude). Il analyse la structure sémantique, les données JSON-LD, l'accessibilité aux crawlers IA et la cohérence E-E-A-T. Semrush se concentre sur le SEO Google traditionnel et n'évalue pas cette dimension.",
  },
  {
    q: "Crawlers.fr analyse-t-il les Core Web Vitals comme Semrush ?",
    a: "Oui. L'audit technique SEO de Crawlers.fr intègre les données terrain CrUX (Chrome UX Report) et les mesures labo Lighthouse/PageSpeed Insights : LCP, FCP, CLS, TBT, Speed Index, TTFB. Le tout avec un code correctif généré automatiquement.",
  },
];

const coverageFaqItems = [
  {
    q: "Le crawler Semrush Enterprise analyse-t-il le rendu JavaScript ?",
    a: "Le Site Audit de Semrush, y compris en offre Enterprise, explore jusqu'à 100 000 URLs par campagne avec un rendu JavaScript limité aux configurations prises en charge. Crawlers.fr émule simultanément Googlebot, GPTBot, ClaudeBot, PerplexityBot et Applebot-Extended, et mesure la parité de rendu entre lecture humaine et lecture bot sur chaque page.",
  },
  {
    q: "Quelles sont les limites du crawl Semrush ?",
    a: "Le crawl Semrush est plafonné par votre abonnement (de 100 000 à 100 000+ URLs selon le plan), avec une fréquence de recrawl hebdomadaire sur les sites configurés. Les quotas sont partagés avec les autres outils de la suite. L'API SEO de Crawlers.fr fonctionne en pay-as-you-go : 100 jobs gratuits par mois puis environ 0,05 € par job, sans plafond d'engagement.",
  },
  {
    q: "Semrush vs Screaming Frog : quel crawler choisir ?",
    a: "Screaming Frog est un crawler desktop payant par licence (199 £/an) limité à 500 URLs en version gratuite, puissant pour l'audit technique ponctuel mais sans suivi continu ni GEO. Semrush intègre le crawl dans une suite complète. Crawlers.fr combine les deux usages : crawl multi-bots en continu, score GEO et patch de code déployable via connecteurs CMS.",
  },
];
const faqSD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [...faqItems, ...coverageFaqItems].map(({ q, a }) => ({
    "@type": "Question",
    "name": q,
    "acceptedAnswer": { "@type": "Answer", "text": a },
  })),
};



/* ─── Comparison table data ─── */

type Row = {
  cat: string;
  criteria: string;
  crawlers: string;
  semrush: string;
  cWin: boolean | null;
  sWin: boolean | null;
};

const comparisonData: Row[] = [
  // Tarifs & Accès
  { cat: "Tarifs", criteria: "Prix d'entrée", crawlers: "Gratuit (audits de base)", semrush: "139,95 $/mois (~130€)", cWin: true, sWin: false },
  { cat: "Tarifs", criteria: "Abonnement agence", crawlers: "29€/mois (Pro Agency) ou 79€/mois (Pro Agency+)", semrush: "~230€/mois (Guru) + add-ons", cWin: true, sWin: false },
  { cat: "Tarifs", criteria: "Inscription obligatoire", crawlers: "Non (audits immédiats)", semrush: "Oui + CB souvent requise", cWin: true, sWin: false },
  // SEO Technique
  { cat: "SEO Technique", criteria: "Audit technique (PageSpeed, CWV)", crawlers: "Oui (CrUX + Lighthouse, 4 catégories)", semrush: "Oui (Site Audit)", cWin: null, sWin: null },
  { cat: "SEO Technique", criteria: "Crawl de site (liens, structure)", crawlers: "Oui (jusqu'à 50 000 pages/mois Pro+)", semrush: "Oui (jusqu'à 100 000 pages)", cWin: null, sWin: null },
  { cat: "SEO Technique", criteria: "Génération de code correctif", crawlers: "Oui (JSON-LD, meta, scripts injectables)", semrush: "Non", cWin: true, sWin: false },
  { cat: "SEO Technique", criteria: "Déploiement CMS direct", crawlers: "Oui (WordPress, Shopify, Wix, PrestaShop)", semrush: "Non", cWin: true, sWin: false },
  { cat: "SEO Technique", criteria: "Analyse des logs serveur", crawlers: "Oui (Pro Agency+)", semrush: "Oui (add-on Log File Analyzer)", cWin: null, sWin: null },
  // GEO & IA
  { cat: "GEO & IA", criteria: "Score GEO (citabilité IA)", crawlers: "Oui (métrique propriétaire)", semrush: "Non", cWin: true, sWin: false },
  { cat: "GEO & IA", criteria: "Benchmark LLM (ChatGPT, Gemini, Claude…)", crawlers: "Oui (test multi-providers en temps réel)", semrush: "Non", cWin: true, sWin: false },
  { cat: "GEO & IA", criteria: "Profondeur LLM (analyse des sources citées)", crawlers: "Oui", semrush: "Non", cWin: true, sWin: false },
  { cat: "GEO & IA", criteria: "Audit robots.txt pour crawlers IA", crawlers: "Oui (GPTBot, ClaudeBot, PerplexityBot…)", semrush: "Partiel (focus Googlebot)", cWin: true, sWin: false },
  { cat: "GEO & IA", criteria: "Audit E-E-A-T complet", crawlers: "Oui (168 critères, scoring multi-axes)", semrush: "Partiel (recommandations génériques)", cWin: true, sWin: false },
  // Contenu & Stratégie
  { cat: "Contenu", criteria: "Recherche de mots-clés", crawlers: "Non", semrush: "Oui (26 milliards de mots-clés)", cWin: false, sWin: true },
  { cat: "Contenu", criteria: "Génération de contenu IA (Content Architect)", crawlers: "Oui (pages complètes SEO+GEO optimisées)", semrush: "Partiel (SEO Writing Assistant)", cWin: true, sWin: false },
  { cat: "Contenu", criteria: "Cocon sémantique 3D (Cocoon)", crawlers: "Oui (graphe interactif, clusters, maillage)", semrush: "Non", cWin: true, sWin: false },
  { cat: "Contenu", criteria: "Analyse concurrentielle", crawlers: "Audit comparé multi-sites", semrush: "Avancée (trafic, mots-clés, pubs)", cWin: false, sWin: true },
  // Backlinks & Positionnement
  { cat: "Tracking", criteria: "Analyse backlinks", crawlers: "Oui (snapshots hebdomadaires)", semrush: "Oui (43T+ liens indexés)", cWin: false, sWin: true },
  { cat: "Tracking", criteria: "Suivi de positionnement Google", crawlers: "Non", semrush: "Oui (jusqu'à 5 000 mots-clés)", cWin: false, sWin: true },
  { cat: "Tracking", criteria: "Suivi GSC/GA4 intégré", crawlers: "Oui (connexion directe, observatoire)", semrush: "Oui", cWin: null, sWin: null },
  // Agence
  { cat: "Agence", criteria: "Marque blanche (White Label)", crawlers: "Oui (logo, couleurs, rapports, API)", semrush: "Non (branding Semrush imposé)", cWin: true, sWin: false },
  { cat: "Agence", criteria: "Dashboard multi-clients", crawlers: "Oui (inclus dès 29€/mois)", semrush: "Oui (add-on payant)", cWin: true, sWin: false },
  { cat: "Agence", criteria: "Plans d'action pilotables", crawlers: "Oui (tâches, suivi, export)", semrush: "Non", cWin: true, sWin: false },
  { cat: "Agence", criteria: "Autopilote SEO (Parménion)", crawlers: "Oui (maintenance prédictive automatisée)", semrush: "Non", cWin: true, sWin: false },
  // Divers
  { cat: "Divers", criteria: "API disponible", crawlers: "Oui (API Marina, Pro Agency+)", semrush: "Oui (API complète)", cWin: null, sWin: null },
  { cat: "Divers", criteria: "SEA → SEO Bridge", crawlers: "Oui (identification mots-clés Ads capturables)", semrush: "Partiel (données PPC)", cWin: true, sWin: false },
  { cat: "Divers", criteria: "Support en français natif", crawlers: "Oui (chat IA + équipe FR)", semrush: "Oui (traduit)", cWin: null, sWin: null },
  { cat: "Divers", criteria: "Courbe d'apprentissage", crawlers: "Faible (30 secondes pour un audit)", semrush: "Élevée (formation requise)", cWin: true, sWin: false },
];

/* ─── Helpers ─── */

const StatusIcon = ({ win }: { win: boolean | null }) => {
  if (win === true) return <Check className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (win === false) return <X className="h-4 w-4 text-red-400 shrink-0" />;
  return <span className="h-4 w-4 rounded-full bg-muted-foreground/30 block shrink-0" />;
};

/* ─── Component ─── */

const ComparatifCrawlersSemrush = () => {
  useCanonicalHreflang('/comparatif-crawlers-semrush');

  const categories = [...new Set(comparisonData.map(r => r.cat))];

  return (
    <>
      <Helmet>
        <meta name="author" content="Adrien de Volontat" />
        <script type="application/ld+json">{JSON.stringify(articleSD)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSD)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSD)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1">
          {/* ═══ Hero ═══ */}
          <section className="py-10 md:py-16 bg-gradient-to-b from-primary/5 to-background">
            <div className="container mx-auto px-4 max-w-4xl text-center">
              <Badge variant="outline" className="mb-4 text-xs md:text-sm">Comparatif mis à jour — Avril 2026</Badge>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-5 text-foreground leading-tight">
                Crawlers, l'alternative française à Semrush : le comparatif complet 2026
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto">
                28 critères analysés objectivement. Semrush reste la référence du SEO traditionnel.
                Crawlers.fr innove avec le <strong className="text-primary">GEO</strong>, le <strong>Content Architect</strong>, le <strong>Cocoon 3D</strong> et le déploiement CMS direct.
                Voici comment choisir selon vos vrais besoins.
              </p>

              <DirectAnswer
                className="mt-8"
                question="Quelle est la meilleure alternative française à Semrush en 2026 ?"
                answer={<>Semrush reste la référence pour la donnée de marché et le monitoring SEO historique, avec une profondeur d'index que personne n'égale en France. Crawlers.fr prend l'autre bout du problème : l'exécution — audit GEO, Content Architect, Cocoon 3D et déploiement direct dans le CMS — à un tarif pensé pour les TPE, PME et agences françaises.</>}
                facts={[
                  { label: 'Quoi', value: 'Comparatif sur 28 critères, SEO classique et GEO' },
                  { label: 'Qui', value: 'TPE, PME, freelances et agences francophones' },
                  { label: 'Pourquoi', value: 'Semrush mesure, Crawlers exécute (contenu, code, maillage)' },
                  { label: 'Combien', value: 'Crawlers à partir de 29 €/mois, Semrush au-delà de 130 $/mois' },
                  { label: 'Quand', value: 'Comparatif mis à jour en avril 2026' },
                ]}
              />
            </div>
          </section>

          {/* ═══ Résumé à puces ═══ */}
          <section className="py-8 md:py-10 bg-muted/30" aria-labelledby="resume">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 id="resume" className="text-xl md:text-2xl font-bold mb-6 text-foreground flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                En résumé : ce qu'il faut retenir
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <img src="https://www.semrush.com/favicon.ico" alt="Logo Semrush" className="h-4 w-4" />
                    Les forces de Semrush
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Base de 26 milliards de mots-clés avec volumes et CPC</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> 43 trillions de backlinks indexés</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Suivi de positionnement Google (5 000 mots-clés)</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Analyse concurrentielle avancée (trafic, pubs)</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Écosystème mature (10M+ utilisateurs, depuis 2008)</li>
                  </ul>
                </div>
                <div className="bg-card rounded-xl border border-primary/30 p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <img src="/favicon.svg" alt="Logo Crawlers.fr" className="h-5 w-5" />
                    Les forces de Crawlers.fr
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Audits gratuits sans inscription (technique, GEO, crawlers IA)</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Score GEO + Benchmark LLM (ChatGPT, Gemini, Claude, Perplexity)</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Content Architect : génération de pages complètes SEO+GEO</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Code Architect : code correctif injectable + déploiement CMS</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Cocoon 3D, marque blanche, Autopilote Parménion</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> À partir de 0€ — Pro Agency dès 29€/mois</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ H2 : Deux visions du référencement ═══ */}
          <section className="py-10 md:py-14 bg-background">
            <div className="container mx-auto px-4 max-w-4xl">
              <article className="prose prose-sm md:prose-lg dark:prose-invert max-w-none">
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
                  <Target className="h-5 w-5 text-primary" />
                  Deux visions du référencement en 2026
                </h2>
                <p>
                  Le paysage du référencement a profondément changé. Google traite encore{' '}
                  <a href="https://www.internetlivestats.com/google-search-statistics/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    8,5 milliards de recherches par jour <ExternalLink className="h-3 w-3" />
                  </a>, mais les moteurs de réponse IA — ChatGPT, Perplexity, Google Gemini, Claude — captent une part croissante des requêtes informationnelles. Selon{' '}
                  <a href="https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    Gartner <ExternalLink className="h-3 w-3" />
                  </a>, le volume de recherche traditionnel pourrait baisser de 25% d'ici fin 2026.
                </p>
                <p>
                  <strong>Semrush</strong> excelle dans le SEO classique : mots-clés, positionnement, backlinks, veille concurrentielle. C'est l'outil de référence pour les agences SEO et les grandes entreprises depuis 2008.
                </p>
                <p>
                  <strong>Crawlers.fr</strong> adopte une approche <strong className="text-primary">Identity-First</strong> : construire la carte d'identité numérique de votre site, auditer les 168 critères techniques et sémantiques, mesurer le Score GEO, et livrer le code correctif prêt à déployer. Un angle mort que Semrush n'adresse pas.
                </p>

                <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 text-primary">
                  <Users className="h-5 w-5" />
                  À qui s'adresse chaque outil ?
                </h3>

                <div className="grid md:grid-cols-2 gap-4 not-prose my-6">
                  <div className="bg-muted/30 rounded-lg p-5 border-l-4 border-muted-foreground">
                    <p className="font-semibold text-foreground mb-2">Choisissez Semrush si :</p>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li>• Vous êtes une agence SEO gérant 10+ clients</li>
                      <li>• Vous avez un budget marketing de 5 000€+/mois</li>
                      <li>• Vous avez besoin de suivi de positionnement quotidien</li>
                      <li>• L'analyse concurrentielle détaillée est critique</li>
                    </ul>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-5 border-l-4 border-primary">
                    <p className="font-semibold text-foreground mb-2">Choisissez Crawlers.fr si :</p>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li>• Vous voulez auditer et corriger votre site rapidement</li>
                      <li>• Vous visez la visibilité IA (ChatGPT, Gemini, Perplexity)</li>
                      <li>• Vous êtes freelance, PME ou consultant</li>
                      <li>• Vous avez besoin de marque blanche et dashboard agence</li>
                      <li>• Vous voulez générer du contenu SEO+GEO optimisé</li>
                    </ul>
                  </div>
                </div>

                {/* ═══ H2 : Crawl Semrush vs Crawl Crawlers.fr ═══ */}
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
                  <Gauge className="h-5 w-5 text-primary" />
                  Crawl Semrush vs crawl Crawlers.fr : deux moteurs, deux philosophies
                </h2>
                <p>
                  Le <strong>crawl Semrush</strong> (Site Audit) parcourt jusqu'à 100 000 pages par projet et remonte plus de 140 vérifications techniques : balises, statuts HTTP, sitemap, hreflang, JavaScript, Core Web Vitals. C'est un moteur SEO robuste, orienté <em>Googlebot</em>, avec un rapport clair et exportable.
                </p>
                <p>
                  Le <strong>crawl Crawlers.fr</strong> pousse la logique plus loin : il émule <strong>simultanément Googlebot, GPTBot, ClaudeBot, PerplexityBot et Applebot-Extended</strong>, mesure la parité de rendu entre humains et bots IA, et remonte pour chaque page un <Link to="/geo-score" className="text-primary hover:underline font-medium">Score GEO</Link> individuel. Là où Semrush s'arrête au diagnostic, Crawlers.fr génère le <strong>patch de code</strong> (JSON-LD, meta, hreflang, canonical) et peut le pousser via <Link to="/connexion-cms" className="text-primary hover:underline font-medium">connecteurs CMS</Link>.
                </p>

                <h3 className="text-lg font-semibold text-primary">Différences mesurables entre les deux crawls</h3>
                <div className="overflow-x-auto rounded-lg border border-border bg-card my-4 not-prose">
                  <table className="w-full text-xs sm:text-sm" aria-label="Différences crawl Semrush vs Crawlers.fr">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left p-3 font-semibold text-foreground">Dimension du crawl</th>
                        <th className="text-left p-3 font-semibold text-foreground">Semrush Site Audit</th>
                        <th className="text-left p-3 font-semibold text-foreground bg-primary/5">Crawlers.fr</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50"><td className="p-3 font-medium text-foreground">User-agents émulés</td><td className="p-3">Googlebot (desktop/mobile)</td><td className="p-3 bg-primary/5">Googlebot + 5 bots IA (GPTBot, ClaudeBot, PerplexityBot, Applebot-Extended, CCBot)</td></tr>
                      <tr className="border-b border-border/50"><td className="p-3 font-medium text-foreground">Volume mensuel</td><td className="p-3">Jusqu'à 100 000 pages (Guru+)</td><td className="p-3 bg-primary/5">Jusqu'à 50 000 pages (Pro Agency+) — crawl priorisé par PageRank interne</td></tr>
                      <tr className="border-b border-border/50"><td className="p-3 font-medium text-foreground">Fréquence par défaut</td><td className="p-3">Hebdomadaire</td><td className="p-3 bg-primary/5">Quotidienne sur les pages actives, hebdo sur les stales (scheduler pondéré)</td></tr>
                      <tr className="border-b border-border/50"><td className="p-3 font-medium text-foreground">Sortie du diagnostic</td><td className="p-3">Rapport HTML + CSV</td><td className="p-3 bg-primary/5">Rapport + patch de code injectable + plan Autopilot Parménion</td></tr>
                      <tr className="border-b border-border/50"><td className="p-3 font-medium text-foreground">Parité SPA / bots IA</td><td className="p-3">Non mesurée</td><td className="p-3 bg-primary/5">Oui — comparaison word_count JS vs no-JS, H1 unique, cloaking check</td></tr>
                      <tr><td className="p-3 font-medium text-foreground">Analyse des logs serveur</td><td className="p-3">Add-on payant</td><td className="p-3 bg-primary/5">Inclus dans Pro Agency+ (visites GPTBot, ClaudeBot, PerplexityBot vérifiées rDNS/ASN)</td></tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-lg font-semibold text-primary">Quand choisir le crawl Semrush ?</h3>
                <p>
                  Choisissez Semrush pour un audit purement SEO à destination des équipes marketing habituées à l'écosystème (Site Audit, Position Tracking, Keyword Magic Tool couplés). Le rapport est mature, exportable et compris de tous les référenceurs.
                </p>

                <h3 className="text-lg font-semibold text-primary">Quand choisir le crawl Crawlers.fr ?</h3>
                <p>
                  Choisissez Crawlers.fr si votre priorité est la <strong>visibilité dans les moteurs IA</strong>, si vous voulez sortir de l'audit avec le patch prêt à déployer, ou si vous avez besoin d'un crawl multi-bots pour valider votre <Link to="/blog/crawler-definition-seo-geo" className="text-primary hover:underline font-medium">stratégie GEO</Link>. L'<Link to="/api-seo" className="text-primary hover:underline font-medium">API SEO REST</Link> permet en outre d'intégrer ces audits dans vos propres applications. La complémentarité avec Semrush reste possible — beaucoup d'utilisateurs Pro combinent les deux.
                </p>

                {/* ═══ H2 : Tarifs ═══ */}
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
                  <Wallet className="h-5 w-5 text-primary" />
                  Comparatif des tarifs : 0€ vs 130€/mois
                </h2>

                <h3 className="text-lg font-semibold text-primary">Tarification Semrush (avril 2026)</h3>
                <div className="bg-muted/50 rounded-lg p-5 my-4 not-prose">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <strong className="text-foreground">Pro</strong> : 139,95 $/mois (~130€) — 5 projets, 500 mots-clés</li>
                    <li>• <strong className="text-foreground">Guru</strong> : 249,95 $/mois (~230€) — 15 projets, 1 500 mots-clés</li>
                    <li>• <strong className="text-foreground">Business</strong> : 499,95 $/mois (~460€) — 40 projets, 5 000 mots-clés</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">* -17% en engagement annuel. Essai gratuit 7 jours disponible.</p>
                </div>

                <h3 className="text-lg font-semibold text-primary">Tarification Crawlers.fr (avril 2026)</h3>
                <div className="bg-primary/5 rounded-lg p-5 my-4 border border-primary/20 not-prose">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <strong className="text-foreground">Audits gratuits</strong> : Crawlers IA, PageSpeed, Score GEO — sans inscription</li>
                    <li>• <strong className="text-foreground">Audit Expert</strong> : Gratuit avec inscription (168 critères)</li>
                    <li>• <strong className="text-foreground">Crédits</strong> : Pack Essentiel 10 crédits (5€), Lite 50 crédits (19€), Premium 150 crédits (45€), Ultime 500 crédits (99€)</li>
                    <li>• <strong className="text-foreground">Pro Agency</strong> : 29€/mois — 5 000 pages crawlées, 80 pages Content Architect, marque blanche + 2 comptes</li>
                    <li>• <strong className="text-foreground">Pro Agency+</strong> : 79€/mois — 50 000 pages crawlées, 150 pages Content Architect, API Marina, logs serveur, SEA→SEO Bridge, 3 comptes</li>
                    <li>• <strong className="text-foreground">Enterprise</strong> : Sur demande — serveur dédié, utilisateurs illimités, SLA garanti, SSO SAML</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">* Sans engagement, résiliable à tout moment. <p className="text-xs text-muted-foreground mt-3">* Sans engagement, résiliable à tout moment. 20 crédits offerts à l'inscription.</p>.</p>
                </div>

                <p>
                  Le calcul est éloquent : un an de Semrush Pro coûte environ <strong>1 560€</strong>.
                  Un an de Crawlers.fr Pro Agency coûte <strong>708€</strong> avec des fonctionnalités que Semrush ne propose tout simplement pas (code correctif, Content Architect, Cocoon 3D, marque blanche incluse).
                </p>

                {/* ═══ H2 : Ce que Semrush fait mieux ═══ */}
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
                  <Zap className="h-5 w-5 text-primary" />
                  Ce que Semrush fait mieux (et beaucoup mieux)
                </h2>
                <p>
                  Semrush est un outil mature, développé depuis 2008, avec des ressources considérables. Voici ses avantages objectifs :
                </p>
                <ul>
                  <li><strong>Recherche de mots-clés</strong> : 26 milliards de mots-clés avec volume, difficulté, CPC, tendances. Crawlers.fr ne propose pas cette fonctionnalité.</li>
                  <li><strong>Analyse de backlinks</strong> : 43 trillions de liens indexés. Profil de liens de n'importe quel concurrent.</li>
                  <li><strong>Suivi de positionnement</strong> : Jusqu'à 5 000 mots-clés quotidiennement.</li>
                  <li><strong>Analyse concurrentielle</strong> : Estimation du trafic, des mots-clés et dépenses publicitaires des concurrents.</li>
                  <li><strong>Content Marketing Suite</strong> : SEO Writing Assistant, Topic Research, Brand Monitoring.</li>
                </ul>
                <p className="italic text-muted-foreground">
                  Si ces fonctionnalités sont votre priorité, Semrush est le meilleur choix. Nous ne prétendons pas le remplacer sur ces points.
                </p>

                {/* ═══ H2 : Ce que Crawlers.fr fait que Semrush ne fait pas ═══ */}
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
                  <Brain className="h-5 w-5 text-primary" />
                  Ce que Crawlers.fr fait que Semrush ne fait pas
                </h2>

                <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <Bot className="h-4 w-4" /> GEO : visibilité dans les moteurs IA
                </h3>
                <p>
                  Crawlers.fr est la seule plateforme à proposer un <Link to="/methodologie" className="text-primary hover:underline font-medium">Score GEO</Link> mesurant la capacité de votre site à être cité par ChatGPT, Gemini, Perplexity et Claude. Le <Link to="/llm-benchmark" className="text-primary hover:underline font-medium">Benchmark LLM</Link> teste votre visibilité en temps réel auprès de chaque provider IA. La <strong>Profondeur LLM</strong> analyse les sources que les IA citent et votre position dans ce paysage.
                </p>

                <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <FileCode className="h-4 w-4" /> Code Architect : du diagnostic au déploiement
                </h3>
                <p>
                  Là où Semrush se limite à lister les problèmes, Crawlers.fr génère le <strong>code correctif</strong> : JSON-LD, meta tags, scripts d'optimisation LCP, balises OpenGraph. Via les <Link to="/connexion-cms" className="text-primary hover:underline font-medium">connecteurs CMS</Link> (WordPress, Shopify, Wix, PrestaShop), ce code peut être déployé directement sur votre site sans intervention manuelle.
                </p>

                <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Content Architect : génération de contenu IA
                </h3>
                <p>
                  <Link to="/content-architect" className="text-primary hover:underline font-medium">Content Architect</Link> génère des pages complètes, optimisées simultanément pour le SEO et le GEO : hiérarchie sémantique, données structurées, maillage interne, signaux E-E-A-T. Jusqu'à 80 pages/mois (Pro) ou 150 pages/mois (Pro+).
                </p>

                <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <Network className="h-4 w-4" /> Cocoon 3D : cocon sémantique intelligent
                </h3>
                <p>
                  Le <Link to="/features/cocoon" className="text-primary hover:underline font-medium">Cocoon 3D</Link> construit un graphe sémantique interactif de votre site : clusters thématiques, maillage interne, détection de cannibalisation. Un outil unique que Semrush ne propose pas.
                </p>

                <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <Cpu className="h-4 w-4" /> Autopilote Parménion : maintenance SEO prédictive
                </h3>
                <p>
                  L'<strong>Autopilote Parménion</strong> surveille automatiquement votre site, détecte les anomalies (chute de performance, erreurs techniques, nouvelles opportunités) et lance les diagnostics et corrections de manière autonome. Semrush n'offre rien d'équivalent.
                </p>

                <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <Globe className="h-4 w-4" /> SEA → SEO Bridge
                </h3>
                <p>
                  Le <Link to="/sea-seo-bridge" className="text-primary hover:underline font-medium">SEA → SEO Bridge</Link> identifie vos mots-clés Google Ads capturables en SEO organique et calcule vos économies mensuelles potentielles. Une fonctionnalité exclusive incluse dans Pro Agency+.
                </p>

                {/* ═══ CTA mid-article ═══ */}
                <div className="my-8 p-6 rounded-xl bg-primary/5 border border-primary/20 text-center not-prose">
                  <p className="text-lg font-semibold text-foreground mb-2">Curieux de votre visibilité IA ?</p>
                  <p className="text-sm text-muted-foreground mb-4">Lancez un audit gratuit en 30 secondes — aucune carte bancaire requise.</p>
                  <Button asChild size="lg" variant="hero">
                    <Link to="/audit-expert">
                      <Rocket className="h-4 w-4 mr-2" />
                      Lancer mon audit GEO gratuit
                    </Link>
                  </Button>
                </div>

                {/* ═══ H2 : Cas d'usage ═══ */}
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Cas d'usage concrets : quel outil pour quel profil ?
                </h2>
              </article>

              <div className="grid md:grid-cols-2 gap-4 my-6">
                {[
                  { name: "Marie, consultante en communication", desc: "Budget limité. Veut être citée quand ses prospects interrogent ChatGPT.", tool: "Crawlers.fr", reason: "Audit gratuit + Content Architect", primary: true },
                  { name: "Alexandre, responsable SEO en agence", desc: "Gère 15 clients, besoin de suivi de positions et backlinks.", tool: "Semrush", reason: "Rank tracking + analyse concurrentielle", primary: false },
                  { name: "Sophie, artisan boulanger", desc: "Veut apparaître quand on demande « meilleure boulangerie Lyon » à Perplexity.", tool: "Crawlers.fr", reason: "Audit gratuit + GEO local", primary: true },
                  { name: "Thomas, freelance SEO/GEO", desc: "Gère 5 clients, a besoin de rapports marque blanche et de contenu IA.", tool: "Crawlers.fr Pro Agency", reason: "29€/mois tout inclus vs 230€+ chez Semrush", primary: true },
                ].map((c, i) => (
                  <div key={i} className={`bg-muted/30 rounded-lg p-5 border-l-4 ${c.primary ? 'border-primary' : 'border-muted-foreground'}`}>
                    <p className="font-semibold text-foreground text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                    <p className="text-xs mt-2">
                      <strong className={c.primary ? 'text-primary' : 'text-foreground'}>→ {c.tool}</strong>
                      <span className="text-muted-foreground"> — {c.reason}</span>
                    </p>
                  </div>
                ))}
              </div>

              <article className="prose prose-sm md:prose-lg dark:prose-invert max-w-none">
                {/* ═══ H2 : Complémentarité ═══ */}
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
                  <Shield className="h-5 w-5 text-primary" />
                  Notre position : complémentarité, pas concurrence
                </h2>
                <p>
                  Nous ne cherchons pas à remplacer Semrush. Certains de nos utilisateurs Pro les plus actifs utilisent les deux : Semrush pour le suivi de positions et l'analyse concurrentielle, Crawlers.fr pour l'audit technique automatisé, le GEO, le Content Architect et le déploiement CMS direct.
                </p>
                <p>
                  La <strong>stack idéale en 2026</strong> combine un outil SEO traditionnel (Semrush ou Ahrefs) pour le tracking Google, et Crawlers.fr pour la dimension Identity-First, GEO, la génération de contenu et la maintenance automatisée via l'Autopilote Parménion.
                </p>
              </article>
            </div>
          </section>

          {/* ═══ Tableau comparatif complet ═══ */}
          <section className="py-10 md:py-14 bg-muted/30" aria-labelledby="tableau">
            <div className="container mx-auto px-4 max-w-5xl">
              <h2 id="tableau" className="text-xl md:text-2xl font-bold text-center mb-2 text-foreground">
                Tableau Comparatif Complet — 28 Critères
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Données mises à jour avril 2026 • Sources : semrush.com, documentation officielle, tests internes
              </p>

              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
                <table className="w-full text-xs sm:text-sm min-w-[580px]" role="table" aria-label="Comparaison 28 critères Crawlers.fr vs Semrush">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-semibold text-foreground min-w-[160px] border-r border-border">Critère</th>
                      <th className="text-center p-3 font-semibold min-w-[180px] border-r border-border bg-primary/5">
                        <span className="inline-flex items-center gap-1.5">
                          <img src="/favicon.svg" alt="Logo Crawlers.fr" className="h-4 w-4" /> Crawlers.fr
                        </span>
                      </th>
                      <th className="text-center p-3 font-semibold min-w-[180px]">
                        <span className="inline-flex items-center gap-1.5">
                          <img src="https://www.semrush.com/favicon.ico" alt="Logo Semrush" className="h-3.5 w-3.5" /> Semrush
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => (
                      <>
                        <tr key={`cat-${cat}`} className="bg-muted/60">
                          <td colSpan={3} className="px-3 py-2 font-semibold text-xs text-foreground uppercase tracking-wider">{cat}</td>
                        </tr>
                        {comparisonData.filter(r => r.cat === cat).map((row, idx) => (
                          <tr key={`${cat}-${idx}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-medium text-foreground border-r border-border">{row.criteria}</td>
                            <td className="p-3 border-r border-border bg-primary/5">
                              <div className="flex items-center gap-2 justify-center">
                                <StatusIcon win={row.cWin} />
                                <span className="text-xs text-muted-foreground">{row.crawlers}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2 justify-center">
                                <StatusIcon win={row.sWin} />
                                <span className="text-xs text-muted-foreground">{row.semrush}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] md:text-xs text-muted-foreground text-center mt-4">
                💡 Ce tableau est une comparaison factuelle — chaque outil a ses forces selon votre contexte et vos objectifs.
              </p>
            </div>
          </section>

          {/* ═══ FAQ ═══ */}
          <section className="py-10 md:py-14 bg-background" aria-labelledby="faq-heading">
            <div className="container mx-auto px-4 max-w-3xl">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground mb-4">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  <span>Questions fréquentes</span>
                </div>
                <h2 id="faq-heading" className="text-xl md:text-2xl font-bold text-foreground">
                  FAQ : Crawlers.fr vs Semrush
                </h2>
              </div>

              <Accordion type="single" collapsible className="space-y-3">
                {[...faqItems, ...coverageFaqItems].map((item, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg bg-card px-6 data-[state=open]:bg-card/80">
                    <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                      <h3 className="text-sm md:text-base font-medium">{item.q}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm pb-4">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* ═══ Crawl Semrush Enterprise : rendu JS ═══ */}
          <section className="py-8 md:py-10">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-xl md:text-2xl font-bold mb-4 text-foreground">
                Le crawler Semrush Enterprise : rendu JavaScript et plafonds
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                L'offre Semrush Enterprise augmente le volume de crawl du Site Audit et autorise
                le rendu JavaScript sur les projets configurés pour cela. En pratique, l'exploration
                reste pilotée par la suite Semrush : le bot unique analyse la page comme le ferait
                un moteur de recherche classique, sans émuler les crawlers IA.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Crawlers.fr prend le contre-pied : chaque crawl émule plusieurs robots en parallèle
                (Googlebot, GPTBot, ClaudeBot, PerplexityBot, Applebot-Extended) et compare la
                lecture humaine à la lecture machine. L'écart constaté — contenu non servi en SSR,
                JSON-LD absent en rendu bot — alimente directement le Score GEO de chaque page.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                À noter : l'<Link to="/api-seo" className="text-primary hover:underline font-medium">API SEO REST</Link> de
                Crawlers.fr permet de déclencher ces crawls depuis vos propres outils (scripts CI/CD,
                dashboards clients, agents IA), avec 100 jobs gratuits par mois.
              </p>
            </div>
          </section>

          {/* ═══ Semrush vs Screaming Frog ═══ */}
          <section className="py-8 md:py-10 bg-muted/20">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-xl md:text-2xl font-bold mb-6 text-foreground">
                Semrush vs Screaming Frog : quel crawler pour quel usage ?
              </h2>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="px-4 py-3 font-semibold">Critère</th>
                      <th className="px-4 py-3 font-semibold">Semrush</th>
                      <th className="px-4 py-3 font-semibold">Screaming Frog</th>
                      <th className="px-4 py-3 font-semibold">Crawlers.fr</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 font-medium text-foreground">Type</td>
                      <td className="px-4 py-3">Suite cloud</td>
                      <td className="px-4 py-3">Logiciel desktop</td>
                      <td className="px-4 py-3">Plateforme cloud + API</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 font-medium text-foreground">Volume d'URLs</td>
                      <td className="px-4 py-3">Jusqu'à 100 000 / campagne</td>
                      <td className="px-4 py-3">500 gratuites, illimité payant</td>
                      <td className="px-4 py-3">Jusqu'à 10 000 pages / audit</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 font-medium text-foreground">Rendu JS</td>
                      <td className="px-4 py-3">Limité, selon configuration</td>
                      <td className="px-4 py-3">Oui (Chrome embarqué)</td>
                      <td className="px-4 py-3">Multi-bots : Googlebot + GPTBot + ClaudeBot + PerplexityBot</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 font-medium text-foreground">Fréquence</td>
                      <td className="px-4 py-3">Hebdomadaire par projet</td>
                      <td className="px-4 py-3">Manuelle</td>
                      <td className="px-4 py-3">À la demande, planifiable par cron</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 font-medium text-foreground">Prix</td>
                      <td className="px-4 py-3">À partir de 139,95 $/mois</td>
                      <td className="px-4 py-3">199 £/an par licence</td>
                      <td className="px-4 py-3">Audits gratuits, crédits dès 5 €, Pro dès 29 €/mois</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-foreground">GEO / visibilité IA</td>
                      <td className="px-4 py-3">Non</td>
                      <td className="px-4 py-3">Non</td>
                      <td className="px-4 py-3">Score GEO + Benchmark LLM</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ═══ Crawl Semrush : limites et quotas ═══ */}
          <section className="py-8 md:py-10">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-xl md:text-2xl font-bold mb-4 text-foreground">
                Crawl Semrush : limites et quotas en pratique
              </h2>
              <ul className="space-y-3 text-muted-foreground leading-relaxed list-disc pl-5">
                <li>
                  <strong className="text-foreground">Volume</strong> : le nombre d'URLs explorées
                  dépend du plan (Site Audit plafonné par abonnement, quotas partagés avec les autres
                  outils de la suite). Les sites volumineux doivent activer l'offre Enterprise.
                </li>
                <li>
                  <strong className="text-foreground">Fréquence</strong> : un recrawl hebdomadaire par
                  projet configuré, pas de planification multi-bots ni de jobs à la demande via API.
                </li>
                <li>
                  <strong className="text-foreground">Perspective</strong> : un seul bot par crawl,
                  sans comparaison entre lecture humaine et lecture bot IA — la parité de rendu n'est
                  pas mesurée.
                </li>
                <li>
                  <strong className="text-foreground">Automatisation</strong> : pas d'API de crawl
                  publique ; les données sont consultables dans l'interface ou exportables en CSV.
                  Crawlers.fr expose le même périmètre via son <Link to="/api-seo" className="text-primary hover:underline font-medium">API SEO REST</Link> en pay-as-you-go.
                </li>
              </ul>
            </div>
          </section>

          {/* ═══ Maillage interne ═══ */}
          <section className="py-8 md:py-10 bg-muted/20">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-lg md:text-xl font-bold mb-4 text-foreground">
                Pour aller plus loin
              </h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { to: "/audit-expert", label: "Audit Expert SEO+GEO", desc: "168 critères analysés gratuitement" },
                  { to: "/api-seo", label: "API SEO REST", desc: "Endpoints, JSON, quotas et tarifs" },
                  { to: "/methodologie", label: "Notre méthodologie", desc: "Comment nous auditons votre site" },
                  { to: "/guide-audit-seo", label: "Guide Audit SEO 2026", desc: "Guide complet pour auditer votre site" },
                  { to: "/content-architect", label: "Content Architect", desc: "Créez du contenu IA optimisé" },
                  { to: "/features/cocoon", label: "Cocoon 3D", desc: "Cocon sémantique interactif" },
                  { to: "/pro-agency", label: "Plans Pro Agency", desc: "Offres agences dès 29€/mois" },
                  { to: "/sea-seo-bridge", label: "SEA → SEO Bridge", desc: "Économies Google Ads calculées" },
                  { to: "/tarifs", label: "Tous les tarifs", desc: "Crédits, packs et abonnements" },
                  { to: "/analyse-site-web-gratuit", label: "Analyse de site gratuite", desc: "Lancez un audit en 30 secondes" },
                ].map(link => (
                  <Link key={link.to} to={link.to} className="group flex items-start gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors">
                    <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ CTA final ═══ */}
          <section className="py-10 md:py-16 bg-gradient-to-b from-background to-primary/5">
            <div className="container mx-auto px-4 max-w-3xl text-center">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">
                Prêt à tester Crawlers.fr gratuitement ?
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mb-6">
                Lancez un audit de votre site en 30 secondes. Aucune carte bancaire requise.
                Découvrez si votre site est visible pour les IA génératives.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" variant="hero">
                  <Link to="/audit-expert">Lancer un Audit Gratuit</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/tarifs">Voir les Tarifs</Link>
                </Button>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-5">
                Semrush reste un excellent choix pour le SEO avancé.{' '}
                <a href="https://www.semrush.com/signup/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Essayez leur version d'essai gratuite →
                </a>
              </p>
            </div>
          </section>
          <SiloNav
            silo="comparatifs"
            currentPath="/comparatif-crawlers-semrush"
            heading="Les autres comparatifs du silo"
            className="mt-12"
          />
        </main>

        <Suspense fallback={null}><Footer /></Suspense>
      </div>
    </>
  );
};

export default ComparatifCrawlersSemrush;
