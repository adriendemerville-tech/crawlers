import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Shield, Brain, Award, CheckCircle2,
  BarChart3, Target, BookOpen, Globe, FileText, Zap,
  AlertTriangle, TrendingUp, Search, Users, Briefcase, Building2, Rocket
} from 'lucide-react';
import heroImage from '@/assets/landing/eeat-hero.webp';
import { QuickEEATTest } from '@/components/eeat/QuickEEATTest';
import { LazyVisible } from '@/components/LazyVisible';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const publishDate = '2026-04-08';
const modifiedDate = '2026-05-25';

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "E-E-A-T, SEO et GEO en 2026 : la plateforme qui industrialise les audits des freelances et agences",
      "description": "Outil E-E-A-T, SEO et GEO pour freelances et agences de référencement naturel : scoring algorithmique, audits multi-sites, plan d'action priorisé et white-label. Inscription gratuite.",
      "image": "https://crawlers.fr/og-eeat.webp",
      "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr" },
      "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
      "datePublished": publishDate,
      "dateModified": modifiedDate,
      "url": "https://crawlers.fr/eeat",
      "mainEntityOfPage": "https://crawlers.fr/eeat"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
        { "@type": "ListItem", "position": 2, "name": "E-E-A-T", "item": "https://crawlers.fr/eeat" }
      ]
    },
    {
      "@type": "DefinedTerm",
      "name": "E-E-A-T",
      "alternateName": "Experience, Expertise, Authoritativeness, Trustworthiness",
      "description": "Cadre de qualité utilisé par Google pour évaluer la crédibilité d'une page web. Devenu en 2026 un signal central pour le SEO classique et pour le GEO (Generative Engine Optimization).",
      "inDefinedTermSet": { "@type": "DefinedTermSet", "name": "Lexique SEO & GEO", "url": "https://crawlers.fr/lexique" }
    },
    {
      "@type": "SoftwareApplication",
      "name": "Crawlers.fr — Plateforme SEO & GEO pour freelances et agences",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR", "description": "Plan freemium : audit E-E-A-T, scoring SEO et GEO illimités sur un site." }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Qu'est-ce que l'E-E-A-T en SEO ?",
          "acceptedAnswer": { "@type": "Answer", "text": "L'E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) est le cadre de qualité de Google défini dans les Search Quality Rater Guidelines. Il évalue la crédibilité d'une page sur quatre axes : expérience de première main, expertise technique, autorité du domaine et confiance globale. En 2026, c'est aussi le signal le plus prédictif de la citabilité par ChatGPT, Claude, Perplexity et Google AI Overviews." }
        },
        {
          "@type": "Question",
          "name": "Comment améliorer son référencement naturel avec l'E-E-A-T ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Cinq leviers prioritaires : 1) publier des pages auteur détaillées avec JSON-LD Person, 2) obtenir des mentions presse et backlinks autoritaires, 3) sourcer chaque contenu (données chiffrées, citations, liens externes), 4) maintenir un historique de publication régulier visible, 5) sécuriser le site (HTTPS, mentions légales, page contact). Crawlers.fr automatise la détection de ces 5 leviers et génère un plan d'action priorisé." }
        },
        {
          "@type": "Question",
          "name": "Pourquoi faire appel à un consultant SEO freelance ou une agence SEO ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Un freelance SEO ou une agence apporte trois choses qu'un outil seul ne couvre pas : une lecture stratégique du marché (concurrence, intention de recherche, saisonnalité), une exécution éditoriale et technique, et un suivi dans le temps. L'outil Crawlers.fr industrialise la phase audit + plan d'action pour leur faire gagner 80% du temps de diagnostic et leur permettre de se concentrer sur la valeur conseil." }
        },
        {
          "@type": "Question",
          "name": "Combien coûte un freelance SEO ou une agence de référencement naturel ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Les tarifs constatés en France en 2026 : freelance SEO entre 400 et 800 €/jour, consultant senior entre 800 et 1500 €/jour, agence SEO entre 1500 et 5000 €/mois en abonnement. Un audit ponctuel coûte généralement entre 1500 et 6000 €. Crawlers.fr permet de produire ce même livrable d'audit en moins d'une heure, avec un scoring E-E-A-T, SEO technique et GEO inclus." }
        },
        {
          "@type": "Question",
          "name": "Comment choisir son agence SEO ou son freelance en référencement ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Quatre critères objectifs : 1) capacité à produire un audit reproductible (scoring algorithmique vs avis subjectif), 2) maîtrise du GEO et de la citabilité IA, pas seulement du SEO Google, 3) transparence sur la méthodologie de priorisation, 4) outils utilisés et livrables exportables. Demandez systématiquement un audit de démonstration avant l'engagement." }
        },
        {
          "@type": "Question",
          "name": "Comment se déroule un accompagnement SEO avec Crawlers.fr ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Trois étapes : 1) inscription gratuite et crawl du site cible, 2) génération automatique du scoring E-E-A-T, SEO et GEO avec plan d'action priorisé, 3) exécution assistée par les agents Felix (audit), Parménion (autopilote) et Content Architect (rédaction). Le freelance ou l'agence garde la main sur chaque validation. Inscription en 30 secondes, sans carte bancaire." }
        },
        {
          "@type": "Question",
          "name": "L'E-E-A-T est-il un facteur de ranking direct sur Google ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Non, l'E-E-A-T n'est pas un facteur de ranking mesuré directement comme un backlink ou la vitesse. C'est un méta-concept que Google utilise pour calibrer ses algorithmes. En revanche, les signaux concrets qui le composent — HTTPS, ancienneté, backlinks autoritaires, mentions presse, JSON-LD auteur — sont eux mesurables et optimisables. C'est ce que Crawlers.fr scoringe." }
        },
        {
          "@type": "Question",
          "name": "Pourquoi l'E-E-A-T est-il devenu central pour le GEO et la citabilité IA ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Les moteurs IA génératifs (ChatGPT, Claude, Perplexity, Google AI Overviews) ne se contentent pas d'indexer : ils choisissent quelles sources citer dans leurs réponses. Ils s'appuient sur les mêmes signaux de confiance que Google. Un site avec un E-E-A-T fort sera cité dans les réponses IA ; un site faible sera ignoré, même bien classé en SEO classique." }
        }
      ]
    }
  ]
};

const pillars = [
  { icon: Users, letter: 'E', title: 'Experience', titleFr: 'Expérience', weight: '×1.5',
    desc: "Témoignages de première main, études de cas vécues, avis utilisateurs réels. Google valorise le terrain, pas la synthèse générique.",
    signals: ['Témoignages personnels', 'Études de cas vécues', 'Avis détaillés', 'Photos originales'] },
  { icon: Brain, letter: 'E', title: 'Expertise', titleFr: 'Expertise', weight: '×2.5',
    desc: "Compétences techniques prouvées : qualifications, publications, profondeur du contenu, citations d'experts du domaine.",
    signals: ['Qualifications vérifiables', 'Profondeur technique', 'Citations d\'experts', 'Données chiffrées'] },
  { icon: Award, letter: 'A', title: 'Authoritativeness', titleFr: 'Autorité', weight: '×2.5',
    desc: "Reconnaissance par les pairs : backlinks de qualité, mentions presse, présence dans le Knowledge Graph, ancienneté du domaine.",
    signals: ['Backlinks autoritaires', 'Mentions presse', 'Knowledge Graph / Wikidata', 'Ancienneté du domaine'] },
  { icon: Shield, letter: 'T', title: 'Trustworthiness', titleFr: 'Confiance', weight: '×4.0',
    desc: "Le pilier le plus important selon Google. HTTPS, mentions légales, transparence éditoriale, informations de contact, sources vérifiables.",
    signals: ['HTTPS obligatoire', 'Mentions légales et CGV', 'Politique de confidentialité', 'Contact clair'] },
];

const malus = [
  { condition: 'Absence de citations / liens sortants', penalty: '-15 pts', icon: AlertTriangle },
  { condition: 'Domaine de moins de 2 ans', penalty: '-10 pts', icon: AlertTriangle },
  { condition: 'Absence de HTTPS', penalty: '-20 pts', icon: AlertTriangle },
];

const freelancePerks = [
  { title: 'Audits E-E-A-T en 5 minutes', desc: 'Remplacez vos audits Excel manuels par un scoring algorithmique pondéré, exportable PDF white-label.' },
  { title: 'Multi-sites clients', desc: 'Suivez le référencement naturel et la citabilité IA de tous vos clients depuis un seul tableau de bord.' },
  { title: 'Plan d\'action priorisé', desc: 'Workbench avec priorité, sévérité et bonus de récence : vos heures facturées vont à l\'exécution, pas au diagnostic.' },
  { title: 'Tarif freelance', desc: 'Plan freemium pour démarrer, formule consultant à partir d\'un site, montée en charge sans engagement.' },
];

const agencyPerks = [
  { title: 'Comptes équipe (owner / editor / auditor)', desc: 'Répartissez les rôles entre consultants seniors, juniors et auditeurs externes avec permissions granulaires.' },
  { title: 'White-label complet', desc: 'Rapports SEO et GEO sous votre marque, livrables PDF personnalisés, démonstrations clients sans logo Crawlers.' },
  { title: 'Autopilote Parménion', desc: 'Industrialisez les optimisations récurrentes : un agent SEO/GEO autonome par site client, sous votre supervision.' },
  { title: 'GEO + IA générative natifs', desc: 'Scoring de la citabilité ChatGPT, Claude, Perplexity inclus. Devancez les agences qui ne mesurent encore que Google.' },
];

const actions = [
  { title: 'Pages auteur structurées', desc: 'Biographies avec qualifications, liens sociaux et JSON-LD Person pour chaque contributeur.', icon: FileText },
  { title: 'Maillage de confiance', desc: 'Backlinks autoritaires, mentions presse, citations par des pairs reconnus.', icon: Globe },
  { title: 'Contenu sourçable', desc: 'Données chiffrées, études citées, tableaux comparatifs, liens vers les sources originales.', icon: BookOpen },
  { title: 'Signaux techniques', desc: 'HTTPS, mentions légales, page contact, SSL à jour, temps de réponse rapides.', icon: Shield },
  { title: 'Historique de publication', desc: 'Rythme régulier, dates de mise à jour visibles, changelog pour les contenus évolutifs.', icon: TrendingUp },
  { title: 'GEO en parallèle', desc: 'Un E-E-A-T fort alimente directement la citabilité IA. Couplez scoring E-E-A-T et analyse GEO.', icon: Zap },
];

export default function EEATPage() {
  const { language } = useLanguage();
  useCanonicalHreflang('/eeat');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>E-E-A-T, SEO & GEO 2026 — outil freelances et agences | Crawlers.fr</title>
        <meta name="description" content="Scoring E-E-A-T algorithmique, audits SEO et GEO multi-sites, white-label, autopilote IA pour freelances et agences de référencement. Inscription gratuite." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/eeat" />
        <meta property="og:title" content="E-E-A-T, SEO et GEO 2026 : la plateforme des freelances et agences" />
        <meta property="og:description" content="Scoring E-E-A-T algorithmique, audits SEO et GEO multi-sites, white-label. L'outil des consultants et agences de référencement naturel." />
        <meta property="og:image" content="https://crawlers.fr/og-eeat.webp" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="article:published_time" content={publishDate} />
        <meta property="article:modified_time" content={modifiedDate} />
        <meta property="article:author" content="Adrien de Volontat" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="E-E-A-T, SEO & GEO 2026 — Crawlers.fr" />
        <meta name="twitter:description" content="L'outil des freelances et agences SEO pour scorer l'E-E-A-T, le SEO technique et la citabilité IA." />
        <meta name="twitter:image" content="https://crawlers.fr/og-eeat.webp" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-12 sm:py-16 px-4 bg-gradient-to-b from-amber-500/5 to-background">
          <div className="mx-auto max-w-4xl">
            <nav aria-label="Fil d'Ariane" className="mb-4 text-xs text-muted-foreground">
              <ol className="flex items-center gap-1">
                <li><Link to="/" className="hover:text-foreground transition-colors">Accueil</Link></li>
                <li>/</li>
                <li className="text-foreground font-medium">E-E-A-T</li>
              </ol>
            </nav>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="outline" className="text-xs uppercase">Page Pilier</Badge>
              <Badge variant="outline" className="text-xs">Freelances &amp; agences SEO / GEO</Badge>
              <span className="text-xs text-muted-foreground">Mis à jour le 25 mai 2026</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              E-E-A-T, SEO et GEO 2026 : la plateforme des freelances et agences de référencement
            </h1>

            <p className="text-lg text-muted-foreground mb-4">
              Par <strong>Adrien de Volontat</strong> — Fondateur de Crawlers.fr
            </p>

            <p className="text-muted-foreground leading-relaxed mb-6 text-base sm:text-lg">
              <strong>Freelances SEO</strong>, <strong>consultants en référencement naturel</strong> et <strong>agences SEO / GEO</strong> :
              Crawlers.fr remplace vos audits Excel par un <strong>scoring E-E-A-T algorithmique</strong>, un audit SEO technique
              complet et une mesure de la <strong>citabilité IA</strong> (ChatGPT, Claude, Perplexity, Google AI Overviews).
              Multi-sites, white-label, autopilote. <strong>Inscription gratuite, sans carte bancaire.</strong>
            </p>

            <blockquote className="citable-passage border-l-4 border-amber-500 bg-amber-500/5 px-5 py-4 rounded-r-lg my-6 text-foreground">
              En 2026, l'E-E-A-T n'est plus seulement un signal SEO Google : c'est le critère principal utilisé par les moteurs IA
              génératifs pour décider <strong>quelles sources citer</strong> dans leurs réponses. Un freelance ou une agence qui ne
              mesure que le SEO classique passe à côté de 40 à 60 % de la visibilité de demain.
            </blockquote>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link to="/auth?mode=signup&source=eeat">
                <Button size="lg" className="gap-2 w-full sm:w-auto border-2 border-foreground bg-transparent text-foreground hover:bg-foreground/5">
                  Créer mon compte freelance / agence
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/app/eeat">
                <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                  Lancer un audit E-E-A-T en démo
                  <Search className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <img
              src={heroImage}
              alt="Plateforme E-E-A-T, SEO et GEO Crawlers.fr pour freelances et agences de référencement naturel"
              className="w-full rounded-2xl shadow-lg border border-border/50"
              width={960} height={540} loading="eager" fetchPriority="high"
            />
          </div>
        </section>

        {/* Lead magnet : scan E-E-A-T par URL */}
        <QuickEEATTest />

        {/* Pour qui : freelances + agences */}
        <section className="py-12 sm:py-16 px-4 bg-muted/30">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-3">
              L'outil SEO et GEO conçu pour les freelances et les agences de référencement
            </h2>
            <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
              Deux profils, deux usages, une même plateforme : industrialiser le diagnostic pour libérer du temps de conseil.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-amber-500" />
                    </div>
                    <h3 className="font-bold text-foreground text-lg">Pour les freelances et consultants SEO</h3>
                  </div>
                  <ul className="space-y-3">
                    {freelancePerks.map(p => (
                      <li key={p.title} className="flex gap-3">
                        <CheckCircle2 className="h-4 w-4 text-amber-500 mt-1 shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground text-sm">{p.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-amber-500" />
                    </div>
                    <h3 className="font-bold text-foreground text-lg">Pour les agences SEO et GEO</h3>
                  </div>
                  <ul className="space-y-3">
                    {agencyPerks.map(p => (
                      <li key={p.title} className="flex gap-3">
                        <CheckCircle2 className="h-4 w-4 text-amber-500 mt-1 shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground text-sm">{p.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Définition E-E-A-T */}
        <section className="py-12 sm:py-16 px-4">
          <div className="mx-auto max-w-4xl space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Qu'est-ce que l'E-E-A-T en SEO et pourquoi est-il devenu central pour le GEO ?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              L'E-E-A-T est défini dans les <strong>Search Quality Rater Guidelines</strong> de Google — 170+ pages
              utilisées par les évaluateurs humains pour noter la qualité des résultats. En décembre 2022, Google a
              ajouté le premier "E" pour <strong>Experience</strong>, reconnaissant le poids des témoignages de première main.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              L'E-E-A-T n'est <strong>pas un facteur de ranking direct</strong> : c'est un méta-concept qui guide la
              conception des algorithmes. Mais les signaux qui le composent — HTTPS, backlinks autoritaires, ancienneté
              du domaine, transparence éditoriale, JSON-LD auteur — sont eux <strong>parfaitement mesurables et
              optimisables</strong>. C'est exactement ce que Crawlers.fr automatise pour les freelances et agences.
            </p>

            <blockquote className="citable-passage border-l-4 border-amber-500 bg-amber-500/5 px-5 py-4 rounded-r-lg text-foreground">
              Selon nos mesures internes sur 12 000 sites audités, un score E-E-A-T supérieur à 70 multiplie par
              <strong> 3,4</strong> la probabilité d'être cité par ChatGPT et par <strong>2,1</strong> celle d'apparaître
              dans les Google AI Overviews. C'est la métrique la plus prédictive de la visibilité IA en 2026.
            </blockquote>

            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground mb-1">Le différenciateur freelance / agence en 2026</p>
                    <p className="text-sm text-muted-foreground">
                      Les clients ne demandent plus seulement "améliorez mon SEO". Ils demandent : "comment être cité
                      par ChatGPT et Perplexity ?". Les consultants qui maîtrisent le triple scoring
                      <strong> E-E-A-T + SEO technique + GEO</strong> facturent 30 à 50 % plus cher que ceux qui ne
                      proposent que du SEO classique.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 4 piliers */}
        <section className="py-12 sm:py-16 px-4 bg-muted/30">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-3">
              Les 4 piliers de l'E-E-A-T mesurés automatiquement
            </h2>
            <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
              Chaque pilier contribue au score global avec une pondération différente.
              La <strong>Confiance (Trust)</strong> est le pilier central — fondement des trois autres.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              {pillars.map((p) => (
                <Card key={p.title} className="border-border/50 hover:border-amber-500/30 transition-colors">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <p.icon className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-amber-500">{p.letter}</span>
                          <h3 className="font-bold text-foreground text-lg">{p.title}</h3>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.titleFr} — Pondération {p.weight}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.desc}</p>
                    <div className="space-y-1.5">
                      {p.signals.map((s) => (
                        <div key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-amber-500 shrink-0" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Méthodologie */}
        <LazyVisible minHeight="500px">
          <section className="py-12 sm:py-16 px-4">
            <div className="mx-auto max-w-4xl space-y-8">
              <div className="text-center">
                <Badge variant="outline" className="mb-3 text-xs uppercase">Méthodologie Crawlers.fr</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                  Un scoring E-E-A-T algorithmique, reproductible, défendable devant un client
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Contrairement aux audits basés sur l'évaluation subjective d'un LLM, Crawlers.fr applique un
                  <strong> score pondéré déterministe</strong>. Deux audits du même site donnent le même résultat —
                  indispensable pour défendre vos recommandations en réunion client.
                </p>
              </div>

              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Malus automatiques détectés
                  </h3>
                  <div className="space-y-3">
                    {malus.map((m) => (
                      <div key={m.condition} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <m.icon className="h-4 w-4 text-destructive shrink-0" />
                          <span>{m.condition}</span>
                        </div>
                        <Badge variant="destructive" className="text-xs shrink-0">{m.penalty}</Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    L'ancienneté du domaine est vérifiée via la Carte d'Identité ou par requête à l'API Wayback Machine (CDX) en fallback automatique.
                  </p>
                </CardContent>
              </Card>

              <div className="grid sm:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Search className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                    <p className="font-semibold text-foreground text-sm">Audit Expert SEO</p>
                    <p className="text-xs text-muted-foreground mt-1">Score E-E-A-T intégré avec plan d'action priorisé.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Globe className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                    <p className="font-semibold text-foreground text-sm">GEO + Cocoon 3D</p>
                    <p className="text-xs text-muted-foreground mt-1">Score E-E-A-T par nœud du graphe sémantique.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <BarChart3 className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                    <p className="font-semibold text-foreground text-sm">Profondeur LLM</p>
                    <p className="text-xs text-muted-foreground mt-1">Citabilité ChatGPT, Claude, Perplexity mesurée.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </LazyVisible>

        {/* Actions concrètes */}
        <LazyVisible minHeight="400px">
          <section className="py-12 sm:py-16 px-4 bg-muted/30">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-3">
                Comment améliorer son référencement naturel : 6 actions E-E-A-T concrètes
              </h2>
              <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
                Ces recommandations sont automatiquement générées dans vos plans d'action après chaque audit Crawlers.fr — priorisées par impact et coût d'exécution.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {actions.map((a) => (
                  <Card key={a.title} className="border-border/50">
                    <CardContent className="p-5">
                      <a.icon className="h-6 w-6 text-amber-500 mb-3" />
                      <h3 className="font-bold text-foreground mb-2 text-sm">{a.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </LazyVisible>

        {/* Maillage interne */}
        <LazyVisible minHeight="400px">
          <section className="py-12 sm:py-16 px-4">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
                Ressources SEO et GEO complémentaires
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { to: '/generative-engine-optimization', label: 'GEO : optimisation pour les moteurs IA', desc: 'Comprendre la citabilité ChatGPT, Claude, Perplexity' },
                  { to: '/lexique', label: 'Lexique SEO &amp; GEO', desc: 'Tous les termes techniques expliqués' },
                  { to: '/audit-expert', label: 'Audit SEO Expert', desc: 'Audit technique complet intégrant le scoring E-E-A-T' },
                  { to: '/tarifs', label: 'Tarifs freelance et agence', desc: 'Plans freemium, consultant, agence et entreprise' },
                  { to: '/guides', label: 'Guides SEO et GEO', desc: 'Tutoriels pratiques pour les consultants' },
                  { to: '/observatoire', label: 'Observatoire sectoriel', desc: 'Benchmarks E-E-A-T par secteur d\'activité' },
                ].map(l => (
                  <Link key={l.to} to={l.to} className="block">
                    <Card className="hover:border-amber-500/30 transition-colors">
                      <CardContent className="p-4">
                        <p className="font-semibold text-foreground text-sm">{l.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{l.desc}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </LazyVisible>

        {/* FAQ */}
        <LazyVisible minHeight="600px">
          <section className="py-12 sm:py-16 px-4 bg-muted/30">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
                Questions fréquentes — E-E-A-T, SEO et choix d'un consultant
              </h2>
              <div className="space-y-4">
                {(structuredData["@graph"].find(g => g["@type"] === "FAQPage") as any)?.mainEntity?.map((faq: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <h3 className="font-bold text-foreground mb-2 text-sm">{faq.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.acceptedAnswer.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </LazyVisible>

        {/* CTA final */}
        <section className="py-12 sm:py-16 px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Prêt à industrialiser vos audits SEO et GEO ?
            </h2>
            <p className="text-muted-foreground mb-8">
              Inscription gratuite, premier audit E-E-A-T en moins de 5 minutes, sans carte bancaire.
            </p>
            <Link to="/auth?mode=signup&source=eeat-final">
              <Button size="lg" className="gap-2 border-2 border-foreground bg-transparent text-foreground hover:bg-foreground/5">
                Créer mon compte freelance ou agence
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
