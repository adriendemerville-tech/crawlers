import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { SiloNav } from '@/components/seo/SiloNav';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Check, X, Minus, Trophy, Wallet, Brain, Layers, MapPin, PenLine,
  BarChart3, Bot, ArrowRight, Star,
} from 'lucide-react';
import { Link } from '@/lib/router-compat';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

/* ─── Données des outils ─── */

interface Outil {
  rang: number;
  nom: string;
  url: string;
  pays: string;
  prix: string;
  pointsForts: string[];
  pointFaible: string;
  geo: boolean | 'partiel';
  seo: boolean | 'partiel';
  contenuIA: boolean | 'partiel';
  local: boolean | 'partiel';
  ideal: string;
  note: number; // /10
  crawlers?: boolean;
}

const OUTILS: Outil[] = [
  {
    rang: 1,
    nom: 'SE Ranking',
    url: 'https://seranking.com',
    pays: 'États-Unis / UE',
    prix: 'dès ~65 €/mois',
    pointsForts: [
      'Suite SEO complète : positions, audit, backlinks, concurrentiel',
      'Excellent rapport qualité/prix face à Semrush',
      'Rapports en marque blanche pour agences',
    ],
    pointFaible: 'Mesure GEO encore jeune, base backlinks plus réduite que Semrush',
    geo: 'partiel', seo: true, contenuIA: 'partiel', local: 'partiel',
    ideal: 'Agences et PME qui veulent une suite complète abordable',
    note: 9.2,
  },
  {
    rang: 2,
    nom: 'Crawlers.fr',
    url: 'https://crawlers.fr',
    pays: 'France',
    prix: 'audits gratuits, dès 29 €/mois',
    pointsForts: [
      'GEO natif : Score GEO et citations mesurées dans 6 LLM (ChatGPT, Perplexity, Gemini, Claude, Copilot, Mistral)',
      'Audit technique avec code correctif généré et déploiement CMS (WordPress, Shopify, Wix, PrestaShop)',
      'Matrice de concurrence SEO + IA et cocon sémantique 3D',
    ],
    pointFaible: 'Base de données backlinks moins profonde que les suites historiques',
    geo: true, seo: true, contenuIA: true, local: true,
    ideal: 'Sites francophones, agences marque blanche, visibilité IA',
    note: 9.0,
    crawlers: true,
  },
  {
    rang: 3,
    nom: 'Surfer SEO',
    url: 'https://surferseo.com',
    pays: 'Pologne',
    prix: 'dès ~99 $/mois',
    pointsForts: [
      'Référence de l\'optimisation de contenu on-page',
      'Éditeur de contenu avec scoring NLP en temps réel',
      'Suivi des citations IA (AI Tracker) intégré',
    ],
    pointFaible: 'Pas d\'audit technique ni de backlinks : à compléter avec un autre outil',
    geo: 'partiel', seo: 'partiel', contenuIA: true, local: false,
    ideal: 'Rédacteurs et content managers orientés SERP',
    note: 8.6,
  },
  {
    rang: 4,
    nom: 'ThotSEO',
    url: 'https://thotseo.com',
    pays: 'France',
    prix: 'dès ~49 €/mois',
    pointsForts: [
      'Optimisation sémantique de contenu en français',
      'Analyse concurrentielle SERP et briefs de rédaction',
      'Interface pensée pour les rédacteurs web francophones',
    ],
    pointFaible: 'Périmètre limité au contenu, pas d\'audit technique ni de GEO',
    geo: false, seo: 'partiel', contenuIA: 'partiel', local: false,
    ideal: 'Rédacteurs SEO francophones',
    note: 8.0,
  },
  {
    rang: 5,
    nom: 'SoRank',
    url: 'https://sorank.io',
    pays: 'France',
    prix: 'dès ~39 €/mois',
    pointsForts: [
      'Audit SEO guidé pensé pour les indépendants',
      'Recommandations actionnables plutôt que données brutes',
      'Tarification accessible aux freelances',
    ],
    pointFaible: 'Fonctionnalités avancées (backlinks, GEO) limitées',
    geo: false, seo: true, contenuIA: false, local: 'partiel',
    ideal: 'Freelances SEO et petites agences',
    note: 7.8,
  },
  {
    rang: 6,
    nom: 'Outrank',
    url: 'https://outrank.so',
    pays: 'États-Unis',
    prix: 'dès ~99 $/mois',
    pointsForts: [
      'Génération et publication automatique d\'articles SEO',
      'Approche « autopilot » : recherche de mots-clés + rédaction + publication',
      'Intéressant pour scaler la production de contenu',
    ],
    pointFaible: 'Qualité de contenu variable, supervision éditoriale indispensable',
    geo: false, seo: 'partiel', contenuIA: true, local: false,
    ideal: 'Sites de niche et éditeurs de contenu à volume',
    note: 7.5,
  },
  {
    rang: 7,
    nom: 'ChatSEO',
    url: 'https://chatseo.co',
    pays: 'France',
    prix: 'dès ~29 €/mois',
    pointsForts: [
      'Assistant SEO conversationnel : on discute, l\'outil analyse',
      'Courbe d\'apprentissage quasi nulle',
      'Bonne porte d\'entrée pour les non-spécialistes',
    ],
    pointFaible: 'Profondeur d\'analyse limitée face aux suites complètes',
    geo: 'partiel', seo: 'partiel', contenuIA: 'partiel', local: false,
    ideal: 'Dirigeants de TPE et non-techniciens',
    note: 7.2,
  },
  {
    rang: 8,
    nom: 'Cocolyze',
    url: 'https://cocolyze.com',
    pays: 'France',
    prix: 'dès ~49 €/mois',
    pointsForts: [
      'Suivi de positions simple et visuel',
      'Scan de pages et alertes quotidiennes',
      'Outil français historique, support en français',
    ],
    pointFaible: 'Pas de GEO, fonctionnalités de contenu limitées',
    geo: false, seo: true, contenuIA: false, local: 'partiel',
    ideal: 'PME qui veulent un suivi simple',
    note: 7.0,
  },
  {
    rang: 9,
    nom: 'BotSEO',
    url: 'https://botseo.com',
    pays: 'France',
    prix: 'sur devis / dès ~49 €/mois',
    pointsForts: [
      'Spécialisé crawl et analyse de logs serveur',
      'Compréhension du comportement des bots Google',
      'Pertinent sur les gros sites (e-commerce, médias)',
    ],
    pointFaible: 'Outil de niche technique, pas de suite marketing',
    geo: 'partiel', seo: 'partiel', contenuIA: false, local: false,
    ideal: 'SEO techniques et sites à fort volume de pages',
    note: 6.9,
  },
  {
    rang: 10,
    nom: 'Local Ranker',
    url: 'https://localranker.com',
    pays: 'États-Unis',
    prix: 'dès ~39 $/mois',
    pointsForts: [
      'Grilles de positions locales (geo-grid) précises',
      'Suivi Google Business Profile multi-établissements',
      'Rapports clients pour agences locales',
    ],
    pointFaible: 'Uniquement local : aucun audit de site ni contenu',
    geo: false, seo: false, contenuIA: false, local: true,
    ideal: 'Réseaux d\'établissements et agences locales',
    note: 6.8,
  },
  {
    rang: 11,
    nom: 'Localo',
    url: 'https://localo.com',
    pays: 'Pologne',
    prix: 'dès ~29 €/mois',
    pointsForts: [
      'Optimisation guidée de la fiche Google Business Profile',
      'Tâches hebdomadaires simples pour progresser en local',
      'Très accessible pour un commerçant',
    ],
    pointFaible: 'Périmètre strictement local, pas de SEO de site',
    geo: false, seo: false, contenuIA: false, local: true,
    ideal: 'Commerces et artisans locaux',
    note: 6.7,
  },
];

const FAQ = [
  {
    q: 'Quel est le meilleur nouvel outil SEO en 2026 ?',
    a: 'SE Ranking est le nouvel outil SEO le plus complet en 2026 : suivi de positions, audit, backlinks et analyse concurrentielle à partir d\'environ 65 €/mois. Pour le GEO (visibilité dans ChatGPT, Perplexity, Gemini), Crawlers.fr est la référence française avec un audit technique et GEO gratuit.',
  },
  {
    q: 'Quelle alternative à Semrush pour le GEO ?',
    a: 'Crawlers.fr est l\'alternative française à Semrush orientée GEO : Score GEO, citations mesurées dans 6 LLM, audit technique avec code correctif et déploiement CMS. Les audits sont gratuits et les abonnements démarrent à 29 €/mois.',
  },
  {
    q: 'Semrush ou Ahrefs sont-ils encore indispensables ?',
    a: 'Ils restent des références pour la donnée backlinks et les volumes de mots-clés, mais leur prix (130 à 450 €/mois) et l\'absence de mesure GEO native font qu\'une nouvelle génération d\'outils couvre l\'essentiel des besoins pour 2 à 10 fois moins cher.',
  },
  {
    q: 'Quel outil SEO pour une TPE ou un commerce local ?',
    a: 'Localo et Local Ranker sont spécialisés en référencement local (fiche Google Business Profile, geo-grid). Cocolyze offre un suivi simple et abordable. Pour combiner local et visibilité IA, Crawlers.fr inclut un module Google Business Profile et la détection de zone de chalandise.',
  },
  {
    q: 'Qu\'est-ce qu\'un outil GEO ?',
    a: 'Un outil GEO (Generative Engine Optimization) mesure et améliore la visibilité d\'un site dans les réponses des IA génératives : ChatGPT, Perplexity, Gemini, Claude, Copilot, Mistral. Il analyse les citations, le balisage structuré, les passages citables et l\'accessibilité aux crawlers IA.',
  },
];

/* ─── Petits composants ─── */

function Mark({ v }: { v: boolean | 'partiel' }) {
  if (v === true) return <Check className="w-4 h-4 text-emerald-500 mx-auto" aria-label="Oui" />;
  if (v === 'partiel') return <Minus className="w-4 h-4 text-amber-500 mx-auto" aria-label="Partiel" />;
  return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" aria-label="Non" />;
}

function Note({ n }: { n: number }) {
  const color = n >= 8.5 ? 'text-emerald-500' : n >= 7.5 ? 'text-amber-500' : 'text-muted-foreground';
  return <span className={`font-bold tabular-nums ${color}`}>{n.toFixed(1)}</span>;
}

/* ─── Page ─── */

export default function MeilleursOutilsSeoGeo2026() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 py-10 md:py-14 max-w-5xl">
        <SiloNav silo="comparatifs" currentPath="/meilleurs-outils-seo-geo-2026" className="mb-10" />

        {/* Hero */}
        <header className="mb-10">
          <Badge variant="outline" className="mb-4 border-primary/50 text-primary">
            Classement 2026 — Nouvelle génération
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Les meilleurs nouveaux outils SEO et GEO en 2026 pour remplacer Semrush et Ahrefs
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            SE Ranking, Crawlers.fr, Surfer SEO, ThotSEO, SoRank, Outrank, ChatSEO, Cocolyze,
            BotSEO, Local Ranker, Localo : onze outils récents qui couvrent le SEO, le contenu IA,
            le local et la visibilité dans les moteurs génératifs — souvent pour une fraction du
            prix des suites historiques.
          </p>
        </header>

        {/* Pourquoi Semrush reste la référence */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Pourquoi Semrush est encore la référence des outils SEO ?
          </h2>
          <blockquote className="citable-passage border-l-2 border-primary pl-4 mb-4 text-muted-foreground">
            Semrush reste la référence des outils SEO en 2026 grâce à la profondeur de ses données :
            plus de 25 milliards de mots-clés, une base de backlinks parmi les plus vastes du marché,
            et un historique de positions qui couvre plus de dix ans. Ahrefs occupe une position
            comparable sur l'analyse de liens. Pour les grandes équipes SEO, ces bases de données
            restent difficiles à égaler.
          </blockquote>
          <p className="text-muted-foreground mb-3">
            Semrush et Ahrefs dominent le marché depuis plus de quinze ans. Leur force tient à trois
            actifs : des <strong className="text-foreground">bases de données massives</strong> (mots-clés,
            backlinks, SERP historiques), un <strong className="text-foreground">écosystème complet</strong> (audit,
            positions, contenu, publicité, réseaux sociaux) et une <strong className="text-foreground">reconnaissance
            de marque</strong> qui en fait le choix par défaut dans les appels d'offres.
          </p>
          <p className="text-muted-foreground">
            Mais cette domination a un prix — littéralement — et elle s'est construite avant
            l'irruption des moteurs de réponse IA. C'est précisément là que la nouvelle génération
            d'outils attaque.
          </p>
        </section>

        {/* Pourquoi changer */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Alors, pourquoi changer pour une alternative à Semrush ?
          </h2>
          <blockquote className="citable-passage border-l-2 border-primary pl-4 mb-6 text-muted-foreground">
            Les raisons de changer pour une alternative à Semrush en 2026 sont au nombre de quatre :
            le prix (130 à 450 €/mois contre 29 à 99 €/mois pour les nouveaux acteurs), l'absence
            de mesure GEO native (visibilité dans ChatGPT, Perplexity, Gemini), des stacks
            spécialisées plus efficaces qu'une suite généraliste, et l'automatisation de la
            génération de contenu par IA que les outils historiques ont tardé à intégrer.
          </blockquote>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: Wallet,
                title: 'Le prix',
                text: 'Semrush Pro démarre autour de 130 €/mois, Guru à 250 €, Business à 450 €. SE Ranking, SoRank ou Crawlers.fr couvrent l\'essentiel des besoins d\'une PME ou d\'une agence pour 29 à 65 €/mois.',
              },
              {
                icon: Brain,
                title: 'L\'IA est partout',
                text: 'La recherche bascule : une partie croissante des réponses vient de ChatGPT, Perplexity ou Gemini. Les suites historiques ont ajouté le GEO en surcouche tardive ; les nouveaux outils comme Crawlers.fr l\'ont au cœur du produit.',
              },
              {
                icon: Layers,
                title: 'Des stacks spécialisées',
                text: 'Plutôt qu\'une suite généraliste à 250 €/mois, combiner des outils spécialisés (ex. SE Ranking + Crawlers.fr + Surfer) donne souvent une couverture supérieure pour un coût équivalent ou inférieur.',
              },
              {
                icon: PenLine,
                title: 'La génération de contenu',
                text: 'Surfer SEO, Outrank ou le Content Architect de Crawlers.fr génèrent briefs et articles optimisés, parfois publiés automatiquement sur votre CMS. Un périmètre que Semrush ne couvre que partiellement.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-border bg-card/40 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-primary" aria-hidden />
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Classement */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" aria-hidden />
            Le classement 2026 des nouveaux outils SEO et GEO
          </h2>
          <p className="text-muted-foreground mb-8">
            Onze outils évalués sur leur couverture SEO, leur prise en charge du GEO, la génération
            de contenu, le local et le rapport qualité/prix.
          </p>
          <div className="space-y-5">
            {OUTILS.map((o) => (
              <article
                key={o.nom}
                className={`rounded-2xl border p-5 md:p-6 ${
                  o.crawlers
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border bg-card/40'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-2xl font-bold text-primary tabular-nums">#{o.rang}</span>
                  <h3 className="text-xl font-bold">{o.nom}</h3>
                  {o.crawlers && (
                    <Badge className="bg-primary text-primary-foreground">Notre outil — avis transparent</Badge>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500" aria-hidden />
                    <Note n={o.note} />
                    <span className="text-muted-foreground text-sm">/10</span>
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {o.pays} · {o.prix} ·{' '}
                  <a
                    href={o.url}
                    target="_blank"
                    rel={o.crawlers ? undefined : 'nofollow noopener'}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {o.url.replace('https://', '')}
                  </a>
                </p>
                <ul className="space-y-1.5 mb-3">
                  {o.pointsForts.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <X className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" aria-hidden />
                    <span>{o.pointFaible}</span>
                  </li>
                </ul>
                <p className="text-sm">
                  <span className="font-semibold">Idéal pour :</span>{' '}
                  <span className="text-muted-foreground">{o.ideal}</span>
                </p>
                {o.crawlers && (
                  <p className="mt-3">
                    <Link
                      to="/audit-expert"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/40 px-4 py-2 text-sm font-medium no-underline hover:border-primary transition-colors"
                    >
                      Lancer un audit SEO + GEO gratuit <ArrowRight className="w-4 h-4" aria-hidden />
                    </Link>
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Tableau comparatif */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" aria-hidden />
            Tableau comparatif des 11 outils
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            <Check className="inline w-3.5 h-3.5 text-emerald-500" aria-hidden /> couvert ·{' '}
            <Minus className="inline w-3.5 h-3.5 text-amber-500" aria-hidden /> partiel ·{' '}
            <X className="inline w-3.5 h-3.5 text-muted-foreground/40" aria-hidden /> absent
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/60">
                  <th className="text-left p-3 font-semibold">Outil</th>
                  <th className="p-3 font-semibold text-center">SEO</th>
                  <th className="p-3 font-semibold text-center">
                    <span className="inline-flex items-center gap-1"><Bot className="w-3.5 h-3.5" aria-hidden /> GEO</span>
                  </th>
                  <th className="p-3 font-semibold text-center">Contenu IA</th>
                  <th className="p-3 font-semibold text-center">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden /> Local</span>
                  </th>
                  <th className="text-left p-3 font-semibold">Prix d'entrée</th>
                  <th className="p-3 font-semibold text-center">Note</th>
                </tr>
              </thead>
              <tbody>
                {OUTILS.map((o) => (
                  <tr
                    key={o.nom}
                    className={`border-b border-border/50 ${o.crawlers ? 'bg-primary/5' : ''}`}
                  >
                    <td className="p-3 font-medium whitespace-nowrap">
                      #{o.rang} {o.nom}
                    </td>
                    <td className="p-3 text-center"><Mark v={o.seo} /></td>
                    <td className="p-3 text-center"><Mark v={o.geo} /></td>
                    <td className="p-3 text-center"><Mark v={o.contenuIA} /></td>
                    <td className="p-3 text-center"><Mark v={o.local} /></td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{o.prix}</td>
                    <td className="p-3 text-center"><Note n={o.note} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Verdict */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Notre verdict</h2>
          <blockquote className="citable-passage border-l-2 border-primary pl-4 mb-4 text-muted-foreground">
            En 2026, la meilleure stack SEO-GEO pour une PME ou une agence francophone combine SE
            Ranking pour le suivi de positions et le concurrentiel classique, et Crawlers.fr pour
            l'audit technique, la visibilité dans les IA génératives et le déploiement des
            corrections. Surfer SEO complète idéalement pour la production de contenu. Coût total :
            environ 100 à 200 €/mois, contre 250 à 450 €/mois pour une suite historique seule sans
            GEO natif.
          </blockquote>
          <p className="text-muted-foreground">
            Aucun outil ne fait tout parfaitement. Le bon réflexe en 2026 n'est plus de chercher la
            suite unique, mais d'assembler deux ou trois spécialistes : un tracker, un outil GEO et,
            si vous produisez du contenu, un optimiseur rédactionnel. Pour le local pur, Localo ou
            Local Ranker suffisent largement.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Questions fréquentes</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-primary/50 bg-primary/5 p-6 md:p-8 text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            Mesurez votre visibilité SEO et GEO en 2 minutes
          </h2>
          <p className="text-muted-foreground mb-5 max-w-2xl mx-auto">
            Audit technique, Score GEO et citations dans 6 IA génératives — gratuit, sans carte
            bancaire.
          </p>
          <Link
            to="/audit-expert"
            className="inline-flex items-center gap-2 rounded-lg border border-foreground/40 px-6 py-3 font-medium no-underline hover:border-primary transition-colors"
          >
            Lancer mon audit gratuit <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </section>

        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </main>
    </div>
  );
}
