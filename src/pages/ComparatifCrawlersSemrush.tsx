import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Minus, ExternalLink, Target, Users, Wallet, Zap, Brain, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

const SITE_URL = 'https://crawlers.fr';

const ComparatifCrawlersSemrush = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/comparatif-crawlers-semrush');
  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Crawlers.fr vs Semrush : Comparatif Honnête 2026",
    "description": "Comparaison objective entre Crawlers.fr et Semrush. Fonctionnalités, tarifs, cibles. Quel outil choisir selon votre profil ?",
    "author": {
      "@type": "Organization",
      "name": "Crawlers.fr",
      "url": SITE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": "Crawlers.fr",
      "url": SITE_URL
    },
    "datePublished": "2026-02-03",
    "dateModified": "2026-02-03",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${SITE_URL}/comparatif-crawlers-semrush`
    }
  };

  const comparisonStructuredData = {
    "@context": "https://schema.org",
    "@type": "Table",
    "about": "Comparaison Crawlers.fr vs Semrush",
    "description": "Tableau comparatif des fonctionnalités, tarifs et cibles entre Crawlers.fr et Semrush pour le SEO et GEO en 2026"
  };

  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Accueil",
        "item": SITE_URL
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Crawlers.fr vs Semrush",
        "item": `${SITE_URL}/comparatif-crawlers-semrush`
      }
    ]
  };

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Quelle est la différence principale entre Crawlers.fr et Semrush ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Crawlers.fr se spécialise dans le GEO (Generative Engine Optimization) pour optimiser la visibilité sur les IA comme ChatGPT et Perplexity. Semrush est une suite SEO complète axée sur le référencement Google traditionnel avec des outils d'analyse concurrentielle avancés."
        }
      },
      {
        "@type": "Question",
        "name": "Semrush est-il meilleur que Crawlers.fr ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Semrush est plus puissant et complet pour le SEO traditionnel. Crawlers.fr est plus adapté aux TPE/PME qui veulent se préparer à l'ère des moteurs de réponse IA sans investir 130€/mois. Les deux outils répondent à des besoins différents."
        }
      },
      {
        "@type": "Question",
        "name": "Combien coûte Crawlers.fr par rapport à Semrush ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Crawlers.fr propose des audits gratuits et un système de crédits à partir de 5€. Semrush démarre à 129,95$/mois (plan Pro). Crawlers.fr est environ 20 à 50 fois moins cher pour des besoins ponctuels."
        }
      }
    ]
  };

  const comparisonData = [
    {
      criteria: "Spécialisation principale",
      crawlers: "GEO (Generative Engine Optimization)",
      semrush: "SEO traditionnel (Google, Bing)",
      crawlersNote: "Focus IA",
      semrushNote: "Focus moteurs classiques"
    },
    {
      criteria: "Cible utilisateur",
      crawlers: "TPE, PME, freelances, blogueurs",
      semrush: "Agences, grandes entreprises, experts SEO",
      crawlersNote: "Accessible",
      semrushNote: "Professionnel"
    },
    {
      criteria: "Prix d'entrée",
      crawlers: "Gratuit (audits de base)",
      semrush: "129,95 $/mois",
      crawlersNote: "À partir de 0€",
      semrushNote: "~120€/mois"
    },
    {
      criteria: "Analyse des crawlers IA",
      crawlers: "Oui (GPTBot, ClaudeBot, Perplexity...)",
      semrush: "Non",
      crawlersWin: true,
      semrushWin: false
    },
    {
      criteria: "Audit robots.txt pour LLM",
      crawlers: "Oui (détection blocages IA)",
      semrush: "Partiel (focus Googlebot)",
      crawlersWin: true,
      semrushWin: false
    },
    {
      criteria: "Recherche de mots-clés",
      crawlers: "Non",
      semrush: "Oui (base de 26 milliards)",
      crawlersWin: false,
      semrushWin: true
    },
    {
      criteria: "Analyse backlinks",
      crawlers: "Non",
      semrush: "Oui (43T+ liens indexés)",
      crawlersWin: false,
      semrushWin: true
    },
    {
      criteria: "Audit technique SEO",
      crawlers: "Oui (PageSpeed, Core Web Vitals)",
      semrush: "Oui (Site Audit complet)",
      crawlersWin: null,
      semrushWin: null
    },
    {
      criteria: "Suivi de positionnement",
      crawlers: "Non",
      semrush: "Oui (jusqu'à 5000 mots-clés)",
      crawlersWin: false,
      semrushWin: true
    },
    {
      criteria: "Génération de code correctif",
      crawlers: "Oui (JSON-LD, meta tags automatiques)",
      semrush: "Non",
      crawlersWin: true,
      semrushWin: false
    },
    {
      criteria: "Marque Blanche (White Label)",
      crawlers: "Oui (logo, couleurs, rapports personnalisés)",
      semrush: "Non (branding Semrush imposé)",
      crawlersWin: true,
      semrushWin: false
    },
    {
      criteria: "Dashboard Agence multi-clients",
      crawlers: "Oui (gestion clients, dossiers, suivi)",
      semrush: "Oui (Client Manager, add-on payant)",
      crawlersWin: null,
      semrushWin: null
    },
    {
      criteria: "Analyse concurrentielle",
      crawlers: "Limitée (focus visibilité IA)",
      semrush: "Avancée (trafic, mots-clés, pubs)",
      crawlersWin: false,
      semrushWin: true
    },
    {
      criteria: "Courbe d'apprentissage",
      crawlers: "Faible (interface simple)",
      semrush: "Élevée (outil complexe)",
      crawlersNote: "5 min",
      semrushNote: "Plusieurs heures"
    },
    {
      criteria: "Support en français",
      crawlers: "Oui (natif)",
      semrush: "Oui (traduit)",
      crawlersWin: null,
      semrushWin: null
    },
    {
      criteria: "API disponible",
      crawlers: "Non",
      semrush: "Oui (API complète)",
      crawlersWin: false,
      semrushWin: true
    }
  ];

  const renderStatus = (win: boolean | null | undefined) => {
    if (win === true) return <Check className="h-5 w-5 text-emerald-500" />;
    if (win === false) return <X className="h-5 w-5 text-red-400" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <>
      <Helmet>
        <title>Crawlers.fr vs Semrush : Comparatif Honnête 2026 | Quel Outil Choisir ?</title>
        <meta 
          name="description" 
          content="Comparaison objective Crawlers.fr vs Semrush : fonctionnalités, tarifs, cibles. Semrush est plus puissant, Crawlers.fr plus accessible. Guide pour bien choisir." 
        />
        <link rel="canonical" href={`${SITE_URL}/comparatif-crawlers-semrush`} />
        
        <meta property="og:title" content="Crawlers.fr vs Semrush : Le Comparatif Honnête" />
        <meta property="og:description" content="Semrush est plus puissant pour le SEO. Crawlers.fr est spécialisé GEO et 20x moins cher. Découvrez quel outil correspond à vos besoins." />
        <meta property="og:url" content={`${SITE_URL}/comparatif-crawlers-semrush`} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content="fr_FR" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Crawlers.fr vs Semrush : Comparatif 2026" />
        <meta name="twitter:description" content="Comparaison honnête entre un outil GEO accessible et une suite SEO professionnelle." />
        
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Crawlers.fr" />
        
        <script type="application/ld+json">{JSON.stringify(articleStructuredData)}</script>
        <script type="application/ld+json">{JSON.stringify(comparisonStructuredData)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbStructuredData)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1">
          {/* Hero Section */}
          <section className="py-8 md:py-12 lg:py-16 bg-gradient-to-b from-primary/5 to-background">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto text-center">
                <Badge variant="outline" className="mb-3 md:mb-4 text-xs md:text-sm">Comparatif 2026</Badge>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground leading-tight px-2">
                  Crawlers.fr et Semrush, deux outils aux fonctionnalités bien différentes
                </h1>
                <p className="text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto px-2">
                  Deux outils, deux philosophies. Semrush est une référence mondiale du SEO. 
                  Crawlers.fr est un nouvel acteur spécialisé GEO. Voici une comparaison factuelle 
                  pour vous aider à choisir selon <strong>vos vrais besoins</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* Fair Play Summary Table */}
          <section className="py-8 md:py-10 bg-muted/30">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-xl md:text-2xl font-bold text-center mb-2 text-foreground">
                  L'Approche "Fair Play" en 30 Secondes
                </h2>
                <p className="text-center text-muted-foreground mb-4 md:mb-6 text-sm md:text-base">
                  Comparaison honnête sans langue de bois
                </p>
                
                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm -mx-2 md:mx-0">
                  <table className="w-full text-xs sm:text-sm min-w-[480px]" aria-label="Comparatif synthétique Semrush vs Crawlers.fr">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-foreground">Critère</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-foreground">
                          <span className="inline-flex items-center gap-1">
                            <img src="https://www.semrush.com/favicon.ico" alt="" className="h-3 w-3 md:h-4 md:w-4" />
                            Semrush
                          </span>
                        </th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-primary">
                          <span className="inline-flex items-center gap-1 md:gap-1.5">
                            <img src="/favicon.svg" alt="" className="h-4 w-4 md:h-5 md:w-5" />
                            Crawlers.fr
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Prix de départ</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground">~130$/mois</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-[10px] md:text-xs">0€ (Gratuit)</Badge>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Inscription requise</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground text-[10px] md:text-sm">Obligatoire + CB souvent</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px] md:text-sm">Aucune (Immédiat)</span>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Focus Principal</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground text-[10px] md:text-sm">Mots-clés & Backlinks (Google)</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span className="text-primary font-medium text-[10px] md:text-sm">Technique & Visibilité IA (ChatGPT)</span>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Score GEO (IA)</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground">Indisponible</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <Badge variant="default" className="bg-primary text-[10px] md:text-xs">Natif</Badge>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Audit stratégique</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px] md:text-sm">Disponible</span>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px] md:text-sm">Disponible</span>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Plans d'action pilotables</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground">Indisponible</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <Badge variant="default" className="bg-primary text-[10px] md:text-xs">Natif</Badge>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Génération de &lt;script&gt; correctif</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground">Indisponible</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <Badge variant="default" className="bg-primary text-[10px] md:text-xs">Natif</Badge>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Marque Blanche (White Label)</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground">Indisponible</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <Badge variant="default" className="bg-primary text-[10px] md:text-xs">Pro Agency</Badge>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Dashboard Agence multi-clients</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground text-[10px] md:text-sm">Add-on payant</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <Badge variant="default" className="bg-primary text-[10px] md:text-xs">Inclus (59€/mois)</Badge>
                        </td>
                      </tr>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Complexité</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground text-[10px] md:text-sm">Usine à gaz (Expert requis)</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px] md:text-sm">Simple & Rapide (30 sec)</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-foreground">Public Idéal</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center text-muted-foreground text-[10px] md:text-sm">Grosses Agences & E-commerce</td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span className="text-primary font-medium text-[10px] md:text-sm">Freelances, PME & Indie Hackers</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-center text-[10px] md:text-xs text-muted-foreground mt-3 md:mt-4">
                  💡 Ce tableau n'est pas un jugement de valeur — chaque outil a ses forces selon votre contexte.
                </p>
              </div>
            </div>
          </section>

          {/* Introduction */}
          <section className="py-8 md:py-12 bg-background">
            <div className="container mx-auto px-4">
              <article className="max-w-4xl mx-auto prose prose-sm md:prose-lg dark:prose-invert">
                <p className="text-base md:text-lg leading-relaxed">
                  Soyons honnêtes dès le départ : <strong>Semrush est un outil plus complet et plus puissant que Crawlers.fr</strong>. 
                  Avec plus de 10 millions d'utilisateurs, une base de données de 26 milliards de mots-clés et 43 trillions 
                  de backlinks indexés, Semrush s'est imposé comme <em>la</em> référence mondiale pour les professionnels du SEO.
                </p>
                
                <p className="text-base md:text-lg leading-relaxed">
                  Alors pourquoi créer ce comparatif ? Parce que <strong>tout le monde n'a pas besoin d'un outil aussi puissant</strong>. 
                  Et surtout, tout le monde n'a pas un budget de 130€ par mois à consacrer au référencement. 
                  Ce guide s'adresse à ceux qui cherchent la solution adaptée à leur situation réelle, 
                  pas forcément l'outil le plus impressionnant du marché.
                </p>

                <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4 text-primary flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Deux visions du référencement en 2026
                </h3>
                
                <p className="leading-relaxed">
                  Le paysage du référencement a profondément changé. D'un côté, le SEO traditionnel reste crucial : 
                  Google traite encore{' '}
                  <a 
                    href="https://www.internetlivestats.com/google-search-statistics/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    8,5 milliards de recherches par jour
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  . De l'autre, les moteurs de réponse IA comme{' '}
                  <a 
                    href="https://chat.openai.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    ChatGPT
                  </a>
                  ,{' '}
                  <a 
                    href="https://www.perplexity.ai/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Perplexity
                  </a>
                  {' '}et{' '}
                  <a 
                    href="https://gemini.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Gemini
                  </a>
                  {' '}captent une part croissante des requêtes informationnelles.
                </p>

                <p className="leading-relaxed">
                  <strong>Semrush</strong> excelle dans le SEO classique : analyse de mots-clés, suivi de positionnement, 
                  audit de backlinks, veille concurrentielle. C'est l'outil idéal pour les agences SEO et les entreprises 
                  qui investissent massivement dans leur stratégie de contenu.
                </p>

                <p className="leading-relaxed">
                  <strong>Crawlers.fr</strong> se positionne différemment. Notre spécialité, c'est le{' '}
                  <strong className="text-primary">GEO (Generative Engine Optimization)</strong>
                  {' '}: s'assurer que votre site est correctement lu, compris et cité par les intelligences artificielles 
                  génératives. Un angle mort que la plupart des outils SEO traditionnels n'adressent pas encore.
                </p>

                <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4 text-primary flex items-center gap-2">
                  <Users className="h-4 w-4 md:h-5 md:w-5" />
                  À qui s'adresse chaque outil ?
                </h3>

                <p className="leading-relaxed">
                  <strong>Choisissez Semrush si vous êtes :</strong>
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Une agence SEO gérant plusieurs clients</li>
                  <li>Une entreprise avec un budget marketing conséquent (5000€+/mois)</li>
                  <li>Un expert SEO cherchant des données de marché exhaustives</li>
                  <li>Un e-commerce nécessitant un suivi de positionnement quotidien sur des milliers de mots-clés</li>
                </ul>

                <p className="leading-relaxed mt-4">
                  <strong>Choisissez Crawlers.fr si vous êtes :</strong>
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Une TPE ou PME avec un budget limité</li>
                  <li>Un freelance ou consultant indépendant</li>
                  <li>Un blogueur ou créateur de contenu</li>
                  <li>Quelqu'un qui veut préparer son site pour l'ère des IA génératives</li>
                  <li>Un professionnel qui a besoin d'audits ponctuels, pas d'un abonnement mensuel</li>
                </ul>

                <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4 text-primary flex items-center gap-2">
                  <Wallet className="h-4 w-4 md:h-5 md:w-5" />
                  La question du prix : l'éléphant dans la pièce
                </h3>

                <p className="leading-relaxed">
                  Parlons argent. C'est souvent le critère décisif, et c'est normal. Voici les tarifs au 1er février 2026 
                  selon les{' '}
                  <a 
                    href="https://www.semrush.com/prices/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    données officielles Semrush
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  :
                </p>

                <div className="bg-muted/50 rounded-lg p-6 my-6">
                  <p className="font-semibold mb-3">Tarification Semrush :</p>
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Pro</strong> : 129,95 $/mois (~120€) — 5 projets, 500 mots-clés suivis</li>
                    <li>• <strong>Guru</strong> : 249,95 $/mois (~230€) — 15 projets, 1500 mots-clés</li>
                    <li>• <strong>Business</strong> : 499,95 $/mois (~460€) — 40 projets, 5000 mots-clés</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    * Engagement annuel recommandé pour -17%. Essai gratuit 7 jours disponible.
                  </p>
                </div>

                <div className="bg-primary/5 rounded-lg p-6 my-6 border border-primary/20">
                  <p className="font-semibold mb-3">Tarification Crawlers.fr :</p>
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Audits de base</strong> : Gratuits (Crawlers IA, PageSpeed, Score GEO)</li>
                    <li>• <strong>Audit expert SEO</strong> : Gratuit avec inscription</li>
                    <li>• <strong>Audit stratégique IA</strong> : 2 crédits par audit</li>
                    <li>• <strong>Pack Essentiel</strong> : 10 crédits pour 5€</li>
                    <li>• <strong>Pack Pro</strong> : 50 crédits pour 19€</li>
                    <li>• <strong>Pack Premium</strong> : 150 crédits pour 45€</li>
                    <li>• <strong>Pro Agency</strong> : 59€/mois — illimité, marque blanche, dashboard agence</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    * Pas d'abonnement obligatoire pour les packs. Les crédits n'expirent pas.
                  </p>
                </div>

                <p className="leading-relaxed">
                  Le calcul est simple : un an de Semrush Pro coûte environ <strong>1 440€</strong>. 
                  Avec ce budget sur Crawlers.fr, vous pourriez réaliser plus de <strong>4 800 audits stratégiques</strong>. 
                  Évidemment, la comparaison s'arrête là car les fonctionnalités ne sont pas identiques.
                </p>

                <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4 text-primary flex items-center gap-2">
                  <Zap className="h-4 w-4 md:h-5 md:w-5" />
                  Ce que Semrush fait mieux (beaucoup mieux)
                </h3>

                <p className="leading-relaxed">
                  Reconnaissons les forces de Semrush. C'est un outil mature, développé depuis 2008, avec des ressources 
                  considérables. Voici ce qu'il fait objectivement mieux :
                </p>

                <ul className="list-disc pl-6 space-y-3">
                  <li>
                    <strong>Recherche de mots-clés</strong> : Base de données de 26 milliards de mots-clés avec volume de recherche, 
                    difficulté, CPC, tendances. Crawlers.fr ne propose pas cette fonctionnalité.
                  </li>
                  <li>
                    <strong>Analyse de backlinks</strong> : 43 trillions de liens indexés. Vous pouvez espionner le profil de liens 
                    de n'importe quel concurrent. Crawlers.fr n'analyse pas les backlinks.
                  </li>
                  <li>
                    <strong>Suivi de positionnement</strong> : Suivez jusqu'à 5000 mots-clés quotidiennement. 
                    Crawlers.fr ne propose pas de rank tracking.
                  </li>
                  <li>
                    <strong>Analyse concurrentielle</strong> : Estimez le trafic, les mots-clés et les dépenses publicitaires 
                    de vos concurrents. Une mine d'or pour la stratégie.
                  </li>
                  <li>
                    <strong>Outils de Content Marketing</strong> : SEO Writing Assistant, Topic Research, Brand Monitoring... 
                    Une suite complète pour les équipes marketing.
                  </li>
                </ul>

                <p className="leading-relaxed mt-4 italic text-muted-foreground">
                  Si vous avez besoin de ces fonctionnalités, Semrush est probablement le meilleur choix. 
                  Nous ne prétendons pas le remplacer sur ces points.
                </p>

                <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4 text-primary flex items-center gap-2">
                  <Brain className="h-4 w-4 md:h-5 md:w-5" />
                  Ce que Crawlers.fr fait différemment
                </h3>

                <p className="leading-relaxed">
                  Notre valeur ajoutée se situe ailleurs. Nous avons construit Crawlers.fr pour répondre à une question 
                  que beaucoup se posent en 2026 : <em>« Mon site est-il visible pour ChatGPT et les autres IA ? »</em>
                </p>

                <ul className="list-disc pl-6 space-y-3">
                  <li>
                    <strong>Analyse des crawlers IA</strong> : Nous testons spécifiquement GPTBot (OpenAI), ClaudeBot (Anthropic), 
                    Google-Extended (Gemini), PerplexityBot et Applebot-Extended. Semrush se concentre sur Googlebot.
                  </li>
                  <li>
                    <strong>Audit robots.txt orienté LLM</strong> : Nous vérifions si votre fichier robots.txt bloque 
                    involontairement les crawlers d'IA générative. Un problème fréquent et invisible.
                  </li>
                  <li>
                    <strong>Score GEO</strong> : Un indicateur unique mesurant votre « citabilité » par les modèles de langage. 
                    Données structurées, hiérarchie sémantique, contenu parsable...
                  </li>
                  <li>
                    <strong>Génération de code correctif</strong> : Nous générons automatiquement le code JSON-LD, 
                    les balises meta et les correctifs à implémenter. Pas juste un diagnostic, une solution.
                  </li>
                  <li>
                    <strong>Accessibilité financière</strong> : Un freelance peut auditer son site pour 0€. 
                    Une TPE peut obtenir un audit stratégique complet pour moins de 2€.
                  </li>
                  <li>
                    <strong>Marque Blanche (White Label)</strong> : L'offre{' '}
                    <Link to="/pro-agency" className="text-primary hover:underline font-medium">Pro Agency</Link>
                    {' '}à 59€/mois permet de personnaliser entièrement les rapports avec votre propre logo, 
                    vos couleurs et votre nom de marque. Idéal pour les consultants et agences qui veulent 
                    présenter des livrables professionnels sous leur propre identité à leurs clients finaux.
                  </li>
                  <li>
                    <strong>Dashboard Agence dédié</strong> : Gestion multi-clients avec dossiers, suivi 
                    de l'évolution technique, export PDF personnalisé et plans d'action pilotables — 
                    le tout inclus dans l'abonnement Pro Agency, sans add-on payant supplémentaire.
                  </li>
                </ul>

                <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4 text-primary flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
                  Cas d'usage concrets
                </h3>

                <p className="leading-relaxed">
                  Pour mieux comprendre, voici trois profils types et l'outil qui leur correspond :
                </p>

                <div className="bg-muted/30 rounded-lg p-4 md:p-5 my-3 md:my-4 border-l-4 border-primary">
                  <p className="font-semibold">Marie, consultante en communication</p>
                  <p className="text-sm mt-2">
                    Budget marketing : 200€/mois. Elle veut s'assurer que son site personnel apparaît 
                    quand ses prospects demandent des recommandations à ChatGPT. 
                    <strong className="text-primary"> → Crawlers.fr</strong> (audits ponctuels, pas d'abonnement)
                  </p>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 md:p-5 my-3 md:my-4 border-l-4 border-muted-foreground">
                  <p className="font-semibold text-sm md:text-base">Alexandre, responsable SEO d'une agence</p>
                  <p className="text-xs md:text-sm mt-2">
                    Gère 15 clients avec des rapports mensuels. A besoin de suivre les positions, 
                    analyser les backlinks et surveiller la concurrence. 
                    <strong> → Semrush</strong> (fonctionnalités avancées indispensables)
                  </p>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 md:p-5 my-3 md:my-4 border-l-4 border-primary">
                  <p className="font-semibold text-sm md:text-base">Sophie, artisan boulanger</p>
                  <p className="text-xs md:text-sm mt-2">
                    Veut que sa boulangerie apparaisse quand quelqu'un demande « meilleure boulangerie à Lyon » 
                    à Perplexity ou Google. Budget quasi nul. 
                    <strong className="text-primary"> → Crawlers.fr</strong> (audit gratuit + optimisation locale)
                  </p>
                </div>

                {/* Mid-article CTA */}
                <div className="my-8 p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-lg font-semibold text-foreground mb-2">
                    Curieux de votre visibilité IA ?
                  </p>
                  <p className="text-sm text-foreground/70 mb-4">
                    Découvrez gratuitement si votre site est cité par ChatGPT, Gemini et Perplexity.
                  </p>
                  <Button asChild size="lg" variant="hero">
                    <Link to="/audit-expert">
                      Lancer mon audit GEO gratuit
                    </Link>
                  </Button>
                </div>

                <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4 text-primary">
                  Notre position : complémentarité, pas concurrence
                </h3>

                <p className="leading-relaxed">
                  Nous ne cherchons pas à remplacer Semrush. D'ailleurs, certains de nos utilisateurs les plus actifs 
                  utilisent les deux outils. Semrush pour leur stratégie SEO long terme, Crawlers.fr pour s'assurer 
                  qu'ils ne sont pas invisibles dans l'écosystème IA émergent.
                </p>

                <p className="leading-relaxed">
                  Le référencement de demain sera hybride. Ignorer le SEO traditionnel serait une erreur. 
                  Ignorer le GEO en serait une autre. Selon{' '}
                  <a 
                    href="https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026"
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Gartner
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  , le volume de recherche sur les moteurs traditionnels pourrait baisser de 25% d'ici 2026 
                  au profit des assistants IA.
                </p>

                <p className="leading-relaxed">
                  La question n'est plus « Semrush ou Crawlers.fr ? » mais « Comment couvrir les deux fronts ? ». 
                  Pour les entreprises avec les moyens, la réponse est simple : les deux. 
                  Pour les autres, Crawlers.fr offre un point d'entrée accessible vers l'optimisation GEO.
                </p>
              </article>
            </div>
          </section>

          {/* Comparison Table */}
          <section className="py-8 md:py-12 bg-muted/30">
            <div className="container mx-auto px-4">
              <div className="max-w-5xl mx-auto">
                <Card className="overflow-hidden border">
                  <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 py-3 md:py-5 px-3 md:px-6">
                    <CardTitle className="text-lg md:text-xl lg:text-2xl text-center">
                      Tableau Comparatif Complet
                    </CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground text-center">
                      14 critères analysés objectivement — Données mises à jour février 2026
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto -mx-px">
                      <table className="w-full text-xs sm:text-sm border-collapse min-w-[550px]" role="table" aria-label="Comparaison Crawlers.fr vs Semrush">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="text-left p-2 md:p-3 font-semibold min-w-[120px] md:min-w-[180px] border-r border-border">
                              Critère
                            </th>
                            <th className="text-center p-2 md:p-3 font-semibold min-w-[130px] md:min-w-[200px] border-r border-border bg-primary/5">
                              <div className="flex items-center justify-center gap-1 md:gap-2">
                                <span className="text-primary font-bold">Crawlers.fr</span>
                              </div>
                            </th>
                            <th className="text-center p-2 md:p-3 font-semibold min-w-[130px] md:min-w-[200px]">
                              <div className="flex items-center justify-center gap-1 md:gap-2">
                                <span>Semrush</span>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonData.map((row, idx) => (
                            <tr key={idx} className="border-b border-border hover:bg-muted/20 transition-colors">
                              <td className="p-3 font-medium border-r border-border bg-card">
                                {row.criteria}
                              </td>
                              <td className="p-3 text-center border-r border-border bg-primary/5">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-2">
                                    {row.crawlersWin !== undefined && renderStatus(row.crawlersWin)}
                                    <span className="text-xs">{row.crawlers}</span>
                                  </div>
                                  {row.crawlersNote && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {row.crawlersNote}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-2">
                                    {row.semrushWin !== undefined && renderStatus(row.semrushWin)}
                                    <span className="text-xs">{row.semrush}</span>
                                  </div>
                                  {row.semrushNote && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {row.semrushNote}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Sources : semrush.com/prices, documentation officielle Semrush, tests internes Crawlers.fr. 
                  Dernière vérification : 03/02/2026.
                </p>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-10 md:py-16 bg-gradient-to-b from-background to-primary/5">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 md:mb-6 px-2">
                  Prêt à tester Crawlers.fr gratuitement ?
                </h2>
                <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8 px-2">
                  Lancez un audit de votre site en 30 secondes. Aucune carte bancaire requise. 
                  Découvrez si votre site est visible pour les IA génératives.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
                  <Button asChild size="lg" variant="hero">
                    <Link to="/audit-expert">
                      Lancer un Audit Gratuit
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/tarifs">
                      Voir les Tarifs
                    </Link>
                  </Button>
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-4 md:mt-6 px-2">
                  Semrush reste un excellent choix pour le SEO avancé.{' '}
                  <a 
                    href="https://www.semrush.com/signup/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Essayez leur version d'essai gratuite →
                  </a>
                </p>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default ComparatifCrawlersSemrush;
