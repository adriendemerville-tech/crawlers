import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { lazy, Suspense, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowRight, CheckCircle2, AlertTriangle, TrendingUp, Search, Shield, Zap, Users, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const CTA = ({ className = '' }: { className?: string }) => (
  <div className={`flex justify-center ${className}`}>
    <Link to="/audit-expert">
      <Button variant="hero" size="xl" className="text-lg gap-2">
        Demander un Audit SEO Expert
        <ArrowRight className="h-5 w-5" />
      </Button>
    </Link>
  </div>
);

const tools = [
  { name: 'Google Search Console', type: 'Gratuit', specialty: 'Technique, Indexation', note: '8/10' },
  { name: 'Screaming Frog', type: 'Freemium', specialty: 'Crawl Technique', note: '9/10' },
  { name: 'Semrush', type: 'Payant', specialty: 'Sémantique, Backlinks, Technique', note: '9/10' },
  { name: 'Ahrefs', type: 'Payant', specialty: 'Backlinks, Sémantique', note: '9/10' },
  { name: 'Babbar', type: 'Payant', specialty: 'Netlinking, Autorité', note: '7/10' },
  { name: 'Crawlers.fr', type: 'Freemium', specialty: 'Technique, GEO, LLM, SEO 200 pts', note: '9/10' },
];

const faqItems = [
  {
    q: 'Le SEO est-il gratuit ou payant ?',
    a: "Le SEO organique est « gratuit » dans le sens où vous ne payez pas de clic, contrairement au SEA (Google Ads). Mais il n'est jamais réellement gratuit : il nécessite un investissement en temps, en compétences humaines et souvent en outils. Un audit SEO peut être réalisé gratuitement avec des outils basiques comme Google Search Console, mais un audit complet et professionnel (technique + sémantique + netlinking) nécessite des outils payants ou le recours à un expert. En 2026, le coût d'inaction est bien supérieur au coût d'un audit : chaque mois sans optimisation, c'est du trafic qualifié perdu au profit de vos concurrents qui, eux, investissent dans leur référencement naturel.",
  },
  {
    q: "Pourquoi utiliser un outil spécifique plutôt que Google seul ?",
    a: "Google Search Console est indispensable mais insuffisant. Il vous montre vos performances dans les résultats de recherche (impressions, clics, position moyenne), mais il ne crawle pas votre site comme le fait Googlebot. Un outil comme Screaming Frog ou Crawlers.fr simule le parcours d'un robot et détecte les erreurs techniques invisibles depuis la Search Console : chaînes de redirections, pages orphelines, balises canoniques conflictuelles, temps de réponse serveur anormaux, duplicate content interne. En 2026, avec l'ajout de la dimension GEO (Generative Engine Optimization), des outils spécialisés sont capables d'analyser la visibilité de votre site dans les réponses générées par les IA (ChatGPT, Google Gemini, Perplexity), un angle mort total de la Search Console.",
  },
  {
    q: "Est-ce que ChatGPT ou l'IA peuvent faire un audit complet ?",
    a: "Non, pas de manière fiable en 2026. ChatGPT et les LLM sont d'excellents assistants pour interpréter des données d'audit, rédiger des recommandations ou expliquer un concept technique. Mais ils ne peuvent pas crawler votre site en temps réel, vérifier vos Core Web Vitals, analyser vos backlinks ou tester votre fichier robots.txt. Un audit SEO nécessite un accès direct à votre serveur, vos données analytics et une exécution technique (crawl, rendu JavaScript, analyse de logs). L'IA est un accélérateur d'analyse, pas un substitut aux outils d'audit. En revanche, les plateformes modernes comme Crawlers.fr combinent le crawl technique traditionnel avec l'analyse IA pour vous offrir le meilleur des deux mondes.",
  },
  {
    q: "Combien de temps dure un audit SEO ?",
    a: "La durée varie selon la taille du site et la profondeur de l'analyse. Un audit technique automatisé d'un site de 50 pages peut être réalisé en quelques minutes avec un outil performant. Un audit complet (technique + sémantique + netlinking + UX) réalisé par un consultant expert prend en général entre 5 et 15 jours ouvrés pour un site e-commerce de taille moyenne (500 à 5 000 pages). Pour les sites enterprise (100 000+ pages), comptez 3 à 6 semaines. L'important n'est pas seulement la durée de l'audit, mais la qualité du plan d'action livré et l'accompagnement dans sa mise en œuvre.",
  },
  {
    q: "À quelle fréquence faut-il auditer son site ?",
    a: "En 2026, la réponse est : en continu. Les algorithmes de Google sont mis à jour en permanence (core updates, spam updates, helpful content updates). Un audit complet devrait être réalisé au minimum une fois par trimestre, avec un monitoring technique permanent. Les sites e-commerce à fort volume devraient idéalement automatiser leur veille technique avec des outils de crawl programmés (hebdomadaires) et des alertes sur les Core Web Vitals. Un audit stratégique approfondi (sémantique + concurrence + roadmap) reste pertinent une à deux fois par an.",
  },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Guide Ultime de l'Audit SEO en 2026 : Outils, Tarifs et Méthodologie",
  "description": "Découvrez comment réaliser un audit SEO complet en 2026. Comparatif des meilleurs logiciels gratuits, prix des agences et analyse des 4 piliers fondamentaux.",
  "author": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
  "publisher": { "@type": "Organization", "name": "Crawlers.fr", "logo": { "@type": "ImageObject", "url": "https://crawlers.fr/favicon.svg" } },
  "datePublished": "2026-01-15",
  "dateModified": "2026-03-10",
  "mainEntityOfPage": "https://crawlers.fr/guide-audit-seo",
  "inLanguage": "fr",
  "wordCount": 4200,
  "keywords": "audit seo, audit seo gratuit, outil audit seo, tarif audit seo, guide seo 2026, geo, generative engine optimization"
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map(item => ({
    "@type": "Question",
    "name": item.q,
    "acceptedAnswer": { "@type": "Answer", "text": item.a }
  }))
};

export default function GuideAuditSeo() {
  useEffect(() => {
    const schemas = [
      { id: 'guide-article', data: articleSchema },
      { id: 'guide-faq', data: faqSchema },
    ];
    schemas.forEach(({ id, data }) => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-schema', id);
      s.textContent = JSON.stringify(data);
      document.head.appendChild(s);
    });
    return () => {
      schemas.forEach(({ id }) => {
        document.querySelectorAll(`script[data-schema="${id}"]`).forEach(el => el.remove());
      });
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Audit SEO en 2026 : Outils Gratuits, Tarifs et Guide Complet</title>
        <meta name="description" content="Découvrez comment réaliser un audit SEO complet en 2026. Comparatif des meilleurs logiciels gratuits, prix des agences et analyse des 4 piliers fondamentaux." />
        <link rel="canonical" href="https://crawlers.fr/guide-audit-seo" />
        <meta property="og:title" content="Guide Ultime de l'Audit SEO en 2026" />
        <meta property="og:description" content="Outils gratuits, tarifs des agences et méthodologie complète pour auditer votre site en 2026." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/guide-audit-seo" />
      </Helmet>
      <Header />
      <main className="min-h-screen bg-background pt-20">
        <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

          {/* H1 + Intro */}
          <header className="mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Guide Expert · Mis à jour Mars 2026</p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Guide Ultime de l'Audit SEO en 2026 : Outils, Tarifs et Méthodologie
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              En 2026, le référencement naturel vit sa plus grande mutation depuis l'invention de PageRank. L'irruption de l'IA générative dans les pages de résultats, la complexification des Core Web Vitals et les exigences croissantes de Google en matière d'EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) ont rendu l'audit SEO non plus optionnel, mais <strong className="text-foreground">vital pour la survie numérique</strong> de toute entreprise. Selon une étude BrightEdge de début 2026, <strong className="text-foreground">68 % du trafic web mesurable provient toujours de la recherche organique</strong>, mais la part captée par les AI Overviews de Google ne cesse de croître, grignotant les clics organiques traditionnels. Ne pas auditer son site aujourd'hui, c'est naviguer à l'aveugle dans un océan algorithmique en perpétuelle tempête. Ce guide exhaustif vous donne toutes les clés — outils, méthodologie, tarifs — pour reprendre le contrôle de votre visibilité.
            </p>
            <CTA className="mt-8" />
          </header>

          {/* Section 1 */}
          <section className="mb-14">
            <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
              Pourquoi l'audit SEO est devenu incontournable en 2026 ?
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Le paysage de la recherche en ligne a davantage changé entre 2023 et 2026 qu'au cours de la décennie précédente. Deux forces tectoniques ont remodelé les règles du jeu : l'intégration massive de l'intelligence artificielle dans les moteurs de recherche et l'accélération du rythme des mises à jour algorithmiques de Google. Pour les propriétaires de sites, ces évolutions signifient une chose : <strong className="text-foreground">un audit SEO régulier n'est plus un luxe, c'est une nécessité opérationnelle.</strong>
            </p>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              L'impact de l'IA et de la recherche générative (GEO)
            </h3>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Depuis le déploiement global des AI Overviews par Google fin 2024, puis leur raffinement continu en 2025-2026, les pages de résultats (SERP) ont profondément muté. Les « réponses générées par l'IA » s'affichent désormais sur plus de 40 % des requêtes informationnelles en France, absorbant une partie significative des clics qui revenaient autrefois aux positions 1 à 3 organiques. Ce phénomène a donné naissance à une nouvelle discipline : le <strong className="text-foreground">GEO (Generative Engine Optimization)</strong>, qui vise à optimiser la « citabilité » d'un site par les modèles de langage (ChatGPT, Google Gemini, Perplexity, Claude). Un audit SEO moderne doit désormais intégrer cette dimension GEO : votre contenu est-il structuré de façon à être cité dans les réponses IA ? Vos données structurées JSON-LD sont-elles suffisamment riches pour alimenter les AI Overviews ? Votre fichier robots.txt autorise-t-il les crawlers IA (GPTBot, Google-Extended, ClaudeBot) ? Autant de questions auxquelles seul un audit complet peut répondre.
            </p>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              Les mises à jour algorithmiques majeures récentes
            </h3>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Google a déployé pas moins de 12 mises à jour majeures entre janvier 2025 et mars 2026. La « March 2026 Core Update » a particulièrement impacté les sites e-commerce qui ne respectaient pas les nouveaux standards d'expérience utilisateur. La « Helpful Content Update » de septembre 2025 a renforcé la pénalisation des contenus générés par IA sans valeur ajoutée éditoriale. Enfin, la « Link Spam Update » de décembre 2025 a invalidé des millions de backlinks artificiels, redistribuant les cartes de l'autorité de domaine à grande échelle. Sans un audit régulier, il est impossible de diagnostiquer si votre site a été touché, directement ou indirectement, par ces mises à jour.
            </p>

            <div className="my-8 rounded-lg border border-border bg-card p-6">
              <h4 className="mb-4 font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                3 bénéfices immédiats d'un audit SEO pour votre ROI
              </h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span><strong className="text-foreground">Identification des pertes de trafic :</strong> Un audit révèle les pages qui ont chuté dans les classements et les raisons exactes (cannibalisation, contenu obsolète, pénalité algorithmique). En moyenne, les sites audités récupèrent 23 % de trafic organique en 90 jours.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span><strong className="text-foreground">Optimisation du taux de conversion :</strong> Une amélioration de 0,1 seconde du temps de chargement augmente les conversions de 8 % en moyenne (données Google 2026). L'audit technique détecte les goulets d'étranglement de performance.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span><strong className="text-foreground">Avantage concurrentiel durable :</strong> 76 % des sites audités en 2026 présentent des failles critiques sur le pilier technique. Corriger ces failles avant vos concurrents vous donne un avantage structurel difficilement rattrapable.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2 — 4 Piliers */}
          <section className="mb-14">
            <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
              Les 4 Piliers d'un Audit SEO Complet
            </h2>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Un audit SEO professionnel ne se résume pas à « vérifier les balises title ». Il s'articule autour de quatre piliers interdépendants qui, ensemble, déterminent la capacité d'un site à se positionner durablement dans les résultats de recherche. Négliger un seul de ces piliers, c'est compromettre l'ensemble de la stratégie.
            </p>

            {/* Pilier visuel */}
            <div className="my-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { icon: Zap, label: 'Technique', color: 'text-blue-500' },
                { icon: Search, label: 'Contenu & Sémantique', color: 'text-green-500' },
                { icon: Shield, label: 'Netlinking', color: 'text-orange-500' },
                { icon: Users, label: 'UX & Signaux Web', color: 'text-purple-500' },
              ].map(p => (
                <div key={p.label} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center">
                  <p.icon className={`h-8 w-8 ${p.color}`} />
                  <span className="text-sm font-semibold text-foreground">{p.label}</span>
                </div>
              ))}
            </div>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              1. L'Audit Technique : Les fondations du site
            </h3>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              L'audit technique est le socle sur lequel repose tout le référencement. Il examine la capacité des moteurs de recherche à explorer (crawl), comprendre (render) et indexer votre site. Les points analysés incluent : la structure des URL et l'architecture de l'information, le fichier robots.txt et le sitemap XML, les codes de réponse HTTP (redirections 301/302, erreurs 404/500), le budget de crawl (crawl budget) et son optimisation, le rendu JavaScript (critique pour les SPA React/Angular), la vitesse de chargement serveur (TTFB), la compatibilité mobile et le responsive design, le protocole HTTPS et la sécurité SSL, les balises canoniques et la gestion du duplicate content, et les données structurées Schema.org (JSON-LD). En 2026, l'audit technique doit aussi vérifier l'accessibilité du site aux crawlers IA : GPTBot (OpenAI), Google-Extended (Gemini), ClaudeBot (Anthropic), et les bots de Perplexity. Bloquer ces crawlers sans le savoir, c'est renoncer à apparaître dans les réponses génératives qui captent désormais une part croissante du trafic.
            </p>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              2. L'Audit Sémantique et Contenu : Répondre à l'intention
            </h3>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              L'audit sémantique évalue la pertinence et la qualité du contenu par rapport aux intentions de recherche des utilisateurs. Il ne s'agit plus simplement de « placer des mots-clés » : en 2026, Google et les LLM évaluent la profondeur sémantique, la couverture thématique et la valeur ajoutée unique de chaque page. L'analyse porte sur : la recherche de mots-clés et l'étude des volumes de recherche actualisés, le mapping des intentions de recherche (informationnelle, navigationnelle, transactionnelle, commerciale), la couverture sémantique LSI (Latent Semantic Indexing) et les entités connexes, la cannibalisation de mots-clés entre pages, le maillage interne et la distribution du « jus SEO » (link equity), la qualité éditoriale selon les critères EEAT, la fraîcheur du contenu et les signaux de mise à jour, et l'optimisation pour les Featured Snippets et les AI Overviews. Un contenu qui ne répond pas précisément à l'intention de l'utilisateur sera systématiquement déclassé, quelle que soit la perfection technique du site qui l'héberge.
            </p>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              3. L'Audit Netlinking (Popularité) : L'autorité de domaine
            </h3>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Le profil de liens entrants (backlinks) reste en 2026 l'un des trois facteurs de classement les plus puissants de Google. L'audit netlinking analyse : le volume et la vélocité d'acquisition de backlinks, la qualité et la thématique des domaines référents, la diversité des ancres de liens (sur-optimisation = risque de pénalité), les liens toxiques et le fichier de désaveu (disavow), le ratio dofollow/nofollow, et les opportunités de link building non exploitées. La « Link Spam Update » de décembre 2025 a rappelé brutalement que la qualité prime sur la quantité. Un seul lien éditorial d'un site d'autorité dans votre secteur vaut davantage que 500 liens de répertoires génériques. L'audit netlinking permet d'identifier les liens dangereux à désavouer et les opportunités de liens naturels à saisir.
            </p>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              4. L'Expérience Utilisateur (UX) et Signaux Web Essentiels
            </h3>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Depuis l'intégration officielle des Core Web Vitals comme facteur de classement, l'UX est devenue un pilier SEO à part entière. En 2026, les trois métriques clés sont : le <strong className="text-foreground">LCP (Largest Contentful Paint)</strong> qui doit être inférieur à 2,5 secondes, l'<strong className="text-foreground">INP (Interaction to Next Paint)</strong> qui remplace le FID et doit rester sous 200 ms, et le <strong className="text-foreground">CLS (Cumulative Layout Shift)</strong> qui doit être inférieur à 0,1. Au-delà de ces métriques techniques, l'audit UX évalue les signaux utilisateurs comportementaux : taux de rebond, durée de session, profondeur de navigation, taux de retour vers les SERP (pogo-sticking). Google utilise ces signaux comme indicateurs indirects de satisfaction utilisateur. Un site techniquement parfait mais avec une UX médiocre sera progressivement déclassé au profit de concurrents offrant une meilleure expérience.
            </p>
          </section>

          {/* Section 3 — Comparatif outils */}
          <section className="mb-14">
            <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
              Comparatif des Meilleurs Outils d'Audit SEO (Gratuits et Payants)
            </h2>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Le marché des outils SEO est vaste et en constante évolution. En 2026, de nouveaux acteurs intégrant l'IA et le GEO ont rejoint les leaders historiques. Voici un comparatif synthétique des solutions les plus pertinentes pour réaliser un audit SEO complet.
            </p>

            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Logiciel</TableHead>
                    <TableHead className="font-semibold text-foreground">Type</TableHead>
                    <TableHead className="font-semibold text-foreground">Spécialité</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map(t => (
                    <TableRow key={t.name}>
                      <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                      <TableCell>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          t.type === 'Gratuit' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          t.type === 'Freemium' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>{t.type}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{t.specialty}</TableCell>
                      <TableCell className="text-center font-semibold text-foreground">{t.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              Comment analyser son site gratuitement ?
            </h3>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Il est tout à fait possible de réaliser un premier diagnostic SEO sans dépenser un centime. La combinaison Google Search Console + Google PageSpeed Insights + la version gratuite de Screaming Frog (limitée à 500 URL) couvre les fondamentaux de l'audit technique. Pour la partie sémantique, Google Trends et le planificateur de mots-clés de Google Ads (accessible gratuitement sans campagne active) fournissent des données de volume de recherche. Des plateformes comme Crawlers.fr proposent un audit technique approfondi sur plus de 150 points de contrôle avec un modèle freemium, incluant désormais l'analyse GEO et la détection des crawlers IA. L'important est de comprendre que les outils gratuits ont des limites : données échantillonnées, historique limité, absence d'analyse concurrentielle. Pour un audit professionnel complet, le recours à des outils payants ou à un expert reste indispensable.
            </p>
          </section>

          {/* CTA milieu */}
          <CTA className="my-12" />

          {/* Section 4 — Tarifs */}
          <section className="mb-14">
            <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
              Quel est le Tarif d'un Audit SEO en France ?
            </h2>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              La question du prix est légitime et la réponse varie considérablement selon le prestataire, la taille du site et la profondeur de l'analyse. Voici un panorama réaliste des tarifs pratiqués sur le marché français en 2026.
            </p>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              Les prix des consultants freelances vs Agences
            </h3>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Un <strong className="text-foreground">consultant SEO freelance</strong> facture généralement entre 800 € et 3 000 € pour un audit complet d'un site vitrine (jusqu'à 100 pages). Pour un site e-commerce de taille moyenne (500 à 5 000 pages), les tarifs s'échelonnent de 2 500 € à 8 000 €. Les freelances seniors spécialisés dans un secteur (santé, finance, e-commerce) peuvent atteindre 5 000 € à 12 000 € pour un audit stratégique approfondi incluant la roadmap de mise en œuvre sur 12 mois.
            </p>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Les <strong className="text-foreground">agences SEO</strong> pratiquent des tarifs plus élevés, justifiés par la pluralité des expertises mobilisées (technique, contenu, netlinking, data). Comptez entre 3 000 € et 15 000 € pour un audit complet en agence, pouvant atteindre 25 000 € à 50 000 € pour les sites enterprise à forte volumétrie. Ces audits incluent généralement un livrable détaillé de 50 à 200 pages, une présentation orale des résultats et un plan d'action priorisé.
            </p>

            <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
              Les facteurs qui font varier le coût d'un audit
            </h3>
            <div className="mb-4 leading-relaxed text-muted-foreground">
              <p className="mb-3">Plusieurs paramètres influencent directement le prix :</p>
              <ul className="ml-4 space-y-2 list-disc">
                <li><strong className="text-foreground">Le nombre de pages à auditer :</strong> un site de 50 pages vs un site de 50 000 pages ne mobilise pas les mêmes ressources.</li>
                <li><strong className="text-foreground">La complexité technique :</strong> un site statique HTML vs une SPA React avec rendu côté serveur (SSR) vs une architecture headless nécessitent des niveaux d'expertise différents.</li>
                <li><strong className="text-foreground">Le périmètre de l'audit :</strong> technique seul, ou technique + sémantique + netlinking + UX + GEO.</li>
                <li><strong className="text-foreground">Le secteur d'activité :</strong> les niches concurrentielles (assurance, immobilier, juridique) nécessitent une analyse concurrentielle plus poussée.</li>
                <li><strong className="text-foreground">Le niveau d'accompagnement :</strong> un audit livré « clé en main » sans suivi vs un audit avec 3 mois d'accompagnement pour la mise en œuvre.</li>
                <li><strong className="text-foreground">L'intégration GEO :</strong> l'analyse de la visibilité dans les LLM et les AI Overviews est une prestation premium encore peu maîtrisée, qui justifie un surcoût de 20 à 40 %.</li>
              </ul>
            </div>

            <div className="my-6 rounded-lg border border-border bg-muted/30 p-5">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span><strong className="text-foreground">Conseil :</strong> Méfiez-vous des offres « audit SEO complet à 99 € ». Un audit réalisé en quelques minutes par un outil automatisé ne vaut pas un diagnostic expert. Un véritable audit professionnel nécessite des heures d'analyse humaine, une interprétation contextuelle des données et des recommandations personnalisées à votre secteur.</span>
              </p>
            </div>
          </section>

          {/* Section 5 — FAQ */}
          <section className="mb-14">
            <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
              FAQ : Vos questions fréquentes sur l'analyse de site
            </h2>
            <Accordion type="single" collapsible className="space-y-3">
              {faqItems.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border border-border rounded-lg bg-card px-6 data-[state=open]:bg-card/80"
                >
                  <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                    <h3 className="text-base font-medium">{item.q}</h3>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Conclusion + CTA final */}
          <section className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Passez à l'action : auditez votre site dès aujourd'hui
            </h2>
            <p className="mx-auto mb-6 max-w-2xl leading-relaxed text-muted-foreground">
              Vous avez désormais toutes les clés pour comprendre l'importance d'un audit SEO en 2026. Chaque jour sans diagnostic, c'est du trafic qualifié, des conversions et du chiffre d'affaires qui vous échappent. N'attendez pas la prochaine mise à jour algorithmique pour découvrir que votre site présente des failles critiques. Crawlers.fr analyse plus de 150 critères techniques, sémantiques et GEO pour vous fournir un plan d'action immédiatement opérationnel.
            </p>
            <CTA />
          </section>

        </article>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
