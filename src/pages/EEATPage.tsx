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
  ArrowRight, Shield, Brain, Award, Handshake, CheckCircle2,
  BarChart3, Target, BookOpen, Globe, FileText, Zap,
  AlertTriangle, TrendingUp, Search, Users
} from 'lucide-react';
import heroImage from '@/assets/landing/eeat-hero.webp';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const publishDate = '2026-04-08';

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "E-E-A-T : le facteur de confiance Google décisif pour le SEO et le GEO en 2026",
      "description": "Comprendre l'E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) de Google : définition, impact sur le SEO et le GEO, méthodologie de scoring algorithmique, et actions concrètes pour améliorer votre crédibilité.",
      "image": "https://crawlers.fr/og-eeat.webp",
      "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr" },
      "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
      "datePublished": publishDate,
      "dateModified": publishDate,
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
      "description": "Cadre de qualité utilisé par Google pour évaluer la crédibilité d'une page web. Introduit dans les Search Quality Rater Guidelines, l'E-E-A-T est devenu un signal indirect de classement et un facteur clé de citabilité par les moteurs IA génératifs.",
      "inDefinedTermSet": {
        "@type": "DefinedTermSet",
        "name": "Lexique SEO & GEO",
        "url": "https://crawlers.fr/lexique"
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Qu'est-ce que l'E-E-A-T de Google ?",
          "acceptedAnswer": { "@type": "Answer", "text": "L'E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) est le cadre de qualité utilisé par Google pour évaluer la crédibilité d'une page web. Introduit dans les Search Quality Rater Guidelines et renforcé en 2022 avec l'ajout de l'Experience, il sert de référence aux quality raters humains et influence indirectement le classement." }
        },
        {
          "@type": "Question",
          "name": "L'E-E-A-T est-il un facteur de ranking Google ?",
          "acceptedAnswer": { "@type": "Answer", "text": "L'E-E-A-T n'est pas un facteur de ranking direct comme un backlink ou la vitesse de chargement. C'est un méta-concept que Google utilise pour calibrer ses algorithmes. Cependant, les signaux concrets qui composent l'E-E-A-T (liens entrants autoritaires, HTTPS, mentions presse, ancienneté du domaine) sont eux des facteurs mesurables." }
        },
        {
          "@type": "Question",
          "name": "Pourquoi l'E-E-A-T est-il important pour le GEO ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Les moteurs IA génératifs (ChatGPT, Claude, Perplexity) puisent dans les mêmes signaux de confiance que Google pour choisir leurs sources. Un site avec un E-E-A-T fort a plus de chances d'être cité dans les réponses IA, car il est perçu comme fiable et expert." }
        },
        {
          "@type": "Question",
          "name": "Comment mesurer son score E-E-A-T ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Crawlers.fr propose un scoring E-E-A-T algorithmique qui évalue 4 axes pondérés : Trustworthiness (×4.0), Expertise (×2.5), Authoritativeness (×2.5) et Experience (×1.5). Le score intègre des signaux techniques (HTTPS, ancienneté du domaine, liens sortants) et des malus automatiques pour les lacunes détectées." }
        },
        {
          "@type": "Question",
          "name": "Comment améliorer son E-E-A-T rapidement ?",
          "acceptedAnswer": { "@type": "Answer", "text": "Les 5 actions les plus impactantes : 1) Ajouter des pages auteur avec biographies détaillées, 2) Obtenir des mentions dans la presse ou des sites autoritaires, 3) Enrichir le contenu avec des citations, données et sources vérifiables, 4) Maintenir un historique de publication régulier, 5) Sécuriser le site en HTTPS avec des politiques de confidentialité claires." }
        }
      ]
    }
  ]
};

const pillars = [
  {
    icon: Users,
    letter: 'E',
    title: 'Experience',
    titleFr: 'Expérience',
    weight: '×1.5',
    desc: "L'auteur a-t-il une expérience directe du sujet ? Google valorise les témoignages de première main, les avis de vrais utilisateurs et les retours d'expérience terrain — pas les synthèses génériques.",
    signals: ['Témoignages personnels', 'Études de cas vécues', 'Avis détaillés produits/services', 'Photos originales'],
  },
  {
    icon: Brain,
    letter: 'E',
    title: 'Expertise',
    titleFr: 'Expertise',
    weight: '×2.5',
    desc: "L'auteur possède-t-il les compétences techniques nécessaires ? Un article médical par un médecin, un guide juridique par un avocat. L'expertise se prouve par les qualifications, les publications et la profondeur du contenu.",
    signals: ['Qualifications vérifiables', 'Profondeur technique du contenu', 'Citations d\'experts', 'Données chiffrées et sources'],
  },
  {
    icon: Award,
    letter: 'A',
    title: 'Authoritativeness',
    titleFr: 'Autorité',
    weight: '×2.5',
    desc: "Le site ou l'auteur est-il reconnu comme une référence dans son domaine ? L'autorité se mesure par les backlinks de qualité, les mentions presse, la présence dans Google Knowledge Graph et les citations par les pairs.",
    signals: ['Backlinks de sites autoritaires', 'Mentions presse et médias', 'Présence Knowledge Graph / Wikidata', 'Ancienneté du domaine'],
  },
  {
    icon: Shield,
    letter: 'T',
    title: 'Trustworthiness',
    titleFr: 'Confiance',
    weight: '×4.0',
    desc: "Le site inspire-t-il confiance ? C'est le pilier le plus important selon Google. HTTPS, politique de confidentialité, informations de contact, transparence sur l'auteur et les sources. Un site non sécurisé ou opaque perd immédiatement en crédibilité.",
    signals: ['HTTPS obligatoire', 'Mentions légales et CGV', 'Politique de confidentialité', 'Informations de contact claires'],
  },
];

const malus = [
  { condition: 'Absence de citations/liens sortants', penalty: '-15 pts', icon: AlertTriangle },
  { condition: 'Domaine de moins de 2 ans', penalty: '-10 pts', icon: AlertTriangle },
  { condition: 'Absence de HTTPS', penalty: '-20 pts', icon: AlertTriangle },
];

const actions = [
  {
    title: 'Pages auteur structurées',
    desc: 'Créer des biographies détaillées avec qualifications, liens sociaux et JSON-LD Person pour chaque contributeur.',
    icon: FileText,
  },
  {
    title: 'Maillage de confiance',
    desc: 'Développer un réseau de backlinks autoritaires, mentions presse et citations par des pairs reconnus dans le domaine.',
    icon: Globe,
  },
  {
    title: 'Contenu sourçable et factuel',
    desc: 'Enrichir chaque page avec des données chiffrées, des études citées, des tableaux comparatifs et des liens vers les sources originales.',
    icon: BookOpen,
  },
  {
    title: 'Signaux techniques de confiance',
    desc: 'HTTPS, politique de confidentialité, mentions légales, page contact, certificats SSL à jour et temps de réponse rapides.',
    icon: Shield,
  },
  {
    title: 'Historique de publication',
    desc: 'Maintenir un rythme de publication régulier avec des dates de mise à jour visibles et des changelog pour les contenus évolutifs.',
    icon: TrendingUp,
  },
  {
    title: 'Optimisation GEO parallèle',
    desc: 'Un bon E-E-A-T alimente directement votre citabilité par les moteurs IA. Combinez le scoring E-E-A-T avec l\'analyse GEO pour maximiser votre visibilité.',
    icon: Zap,
  },
];

export default function EEATPage() {
  const { language } = useLanguage();
  useCanonicalHreflang('/eeat');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>E-E-A-T : Experience, Expertise, Autorité, Confiance — Guide SEO & GEO 2026 | Crawlers.fr</title>
        <meta name="description" content="Comprendre l'E-E-A-T de Google : définition des 4 piliers (Experience, Expertise, Authoritativeness, Trust), impact sur le SEO et le GEO, scoring algorithmique Crawlers.fr et plan d'action concret." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://crawlers.fr/eeat" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/eeat" />
        <meta property="og:title" content="E-E-A-T : le facteur de confiance Google pour le SEO et le GEO en 2026" />
        <meta property="og:description" content="Comprendre l'E-E-A-T : définition, scoring algorithmique pondéré, actions concrètes et impact sur la citabilité IA." />
        <meta property="og:image" content="https://crawlers.fr/og-eeat.webp" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="article:published_time" content={publishDate} />
        <meta property="article:author" content="Adrien de Volontat" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="E-E-A-T : Guide SEO & GEO 2026 | Crawlers.fr" />
        <meta name="twitter:description" content="Comprendre l'E-E-A-T de Google : 4 piliers, scoring algorithmique, plan d'action." />
        <meta name="twitter:image" content="https://crawlers.fr/og-eeat.webp" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero — no framer-motion for LCP */}
        <section className="py-12 sm:py-16 px-4 bg-gradient-to-b from-amber-500/5 to-background">
          <div className="mx-auto max-w-4xl">
            <nav aria-label="Fil d'Ariane" className="mb-4 text-xs text-muted-foreground">
              <ol className="flex items-center gap-1">
                <li><Link to="/" className="hover:text-foreground transition-colors">Accueil</Link></li>
                <li>/</li>
                <li className="text-foreground font-medium">E-E-A-T</li>
              </ol>
            </nav>

            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-xs uppercase">Page Pilier</Badge>
              <span className="text-xs text-muted-foreground">Mis à jour le 8 avril 2026</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              E-E-A-T : le facteur de confiance Google décisif pour le SEO et le GEO en 2026
            </h1>

            <p className="text-lg text-muted-foreground mb-4">
              Par <strong>Adrien de Volontat</strong> — Fondateur de Crawlers.fr
            </p>

            <p className="text-muted-foreground leading-relaxed mb-8 text-base sm:text-lg">
              L'<strong>E-E-A-T</strong> (Experience, Expertise, Authoritativeness, Trustworthiness) est le cadre 
              de qualité utilisé par Google pour évaluer la crédibilité d'une page web. En 2026, il ne concerne plus 
              seulement le SEO classique : les moteurs IA génératifs (ChatGPT, Claude, Perplexity) utilisent les 
              mêmes signaux de confiance pour choisir quelles sources citer dans leurs réponses. Comprendre et 
              optimiser son E-E-A-T est devenu indispensable pour rester visible — sur Google comme dans les 
              réponses des IA.
            </p>

            <img 
              src={heroImage} 
              alt="Les 4 piliers E-E-A-T : Experience, Expertise, Authoritativeness, Trustworthiness représentés par des colonnes lumineuses interconnectées"
              className="w-full rounded-2xl shadow-lg border border-border/50"
              width={960}
              height={540}
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </section>

        {/* Définition & Contexte */}
        <section className="py-12 sm:py-16 px-4">
          <div className="mx-auto max-w-4xl space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Qu'est-ce que l'E-E-A-T de Google ?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              L'E-E-A-T est un acronyme défini dans les <strong>Search Quality Rater Guidelines</strong> de Google — 
              un document de 170+ pages utilisé par les évaluateurs humains pour noter la qualité des résultats de recherche. 
              En décembre 2022, Google a ajouté le premier "E" pour <strong>Experience</strong>, reconnaissant l'importance 
              des témoignages de première main.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Bien que l'E-E-A-T ne soit <strong>pas un facteur de ranking direct</strong> (comme un backlink ou la 
              vitesse de chargement), c'est un méta-concept qui guide la conception des algorithmes. Les signaux 
              concrets qui le composent — HTTPS, backlinks autoritaires, ancienneté du domaine, transparence 
              éditoriale — sont eux des facteurs mesurables et optimisables.
            </p>

            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground mb-1">Pourquoi l'E-E-A-T est crucial pour le GEO</p>
                    <p className="text-sm text-muted-foreground">
                      Les moteurs IA génératifs (ChatGPT, Claude, Perplexity, Google SGE) ne se contentent pas d'indexer : 
                      ils <strong>choisissent</strong> quelles sources citer dans leurs réponses. Un site avec un E-E-A-T 
                      fort est perçu comme fiable et expert — il sera cité. Un site sans signaux de confiance sera ignoré, 
                      même s'il apparaît en première page de Google.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Les 4 piliers */}
        <section className="py-12 sm:py-16 px-4 bg-muted/30">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-3">
              Les 4 piliers de l'E-E-A-T
            </h2>
            <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
              Chaque pilier contribue au score global avec une pondération différente. 
              La <strong>Confiance (Trust)</strong> est le pilier central — c'est le fondement des trois autres.
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

        {/* Méthodologie Crawlers */}
        <section className="py-12 sm:py-16 px-4">
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-3 text-xs uppercase">Méthodologie Crawlers.fr</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                Un scoring E-E-A-T algorithmique, pas subjectif
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Contrairement aux approches basées sur l'évaluation subjective d'un LLM, Crawlers.fr utilise un 
                <strong> score algorithmique pondéré</strong> qui garantit la reproductibilité et la cohérence des résultats.
              </p>
            </div>

            {/* Pondérations */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pillars.map((p) => (
                <Card key={p.title} className="text-center">
                  <CardContent className="p-4">
                    <p.icon className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">{p.titleFr}</p>
                    <p className="text-2xl font-black text-foreground">{p.weight}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Malus automatiques */}
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
                  L'ancienneté du domaine est vérifiée via la Carte d'Identité du site ou par requête à 
                  l'API Wayback Machine (CDX) en fallback automatique.
                </p>
              </CardContent>
            </Card>

            {/* Intégration écosystème */}
            <div className="grid sm:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Search className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <p className="font-semibold text-foreground text-sm">Audit Expert</p>
                  <p className="text-xs text-muted-foreground mt-1">Score E-E-A-T intégré dans chaque audit complet avec plan d'action priorisé</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Globe className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <p className="font-semibold text-foreground text-sm">GEO + Cocoon</p>
                  <p className="text-xs text-muted-foreground mt-1">Score E-E-A-T par nœud dans le graphe sémantique 3D</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <BarChart3 className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <p className="font-semibold text-foreground text-sm">Profondeur LLM</p>
                  <p className="text-xs text-muted-foreground mt-1">L'E-E-A-T influence directement la profondeur de citation par les IA</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Actions concrètes */}
        <section className="py-12 sm:py-16 px-4 bg-muted/30">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-3">
              6 actions concrètes pour améliorer votre E-E-A-T
            </h2>
            <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
              Ces recommandations sont automatiquement générées dans vos plans d'action après chaque audit Crawlers.fr.
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

        {/* À qui ça sert */}
        <section className="py-12 sm:py-16 px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
              À qui sert l'analyse E-E-A-T ?
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: 'Consultants SEO & Agences', desc: 'Intégrez un scoring E-E-A-T objectif dans vos audits et démontrez l\'impact de vos recommandations avec des métriques chiffrées.' },
                { title: 'Sites YMYL (Your Money, Your Life)', desc: 'Santé, finance, droit : les domaines sensibles où Google applique les critères E-E-A-T les plus stricts. Un déficit de confiance = invisibilité.' },
                { title: 'E-commerce & Marques', desc: 'Prouvez la légitimité de vos produits avec des signaux de confiance solides. L\'E-E-A-T influence les conversions autant que le ranking.' },
                { title: 'Créateurs de contenu', desc: 'Passez de "contenu générique IA" à "source citée par les IA". L\'E-E-A-T est le différenciateur entre le contenu remplaçable et la référence.' },
              ].map((item) => (
                <Card key={item.title}>
                  <CardContent className="p-5">
                    <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 sm:py-16 px-4 bg-gradient-to-b from-amber-500/5 to-background">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Mesurez votre E-E-A-T gratuitement
            </h2>
            <p className="text-muted-foreground mb-8">
              Lancez un Audit Expert sur votre URL et obtenez votre score E-E-A-T algorithmique 
              avec un plan d'action personnalisé.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/app/eeat">
               <Button size="lg" className="gap-2 w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 shadow-lg">
                  Lancer l'audit E-E-A-T gratuit
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/generative-engine-optimization">
                <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                  Découvrir le GEO
                  <Globe className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ visuelle */}
        <section className="py-12 sm:py-16 px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
              Questions fréquentes sur l'E-E-A-T
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
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
