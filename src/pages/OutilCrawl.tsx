import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SiloNav } from '@/components/seo/SiloNav';
import { FAQS } from './OutilCrawl.seo';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

/**
 * Pilier « Outil de crawl » — page produit canonique pour les requêtes
 * crawl website / crawl wordpress / site crawler.
 * /app/site-crawl reste l'application (noindex, canonical vers cette page).
 */

const STEPS = [
  {
    title: '1. Découverte des URL',
    body: "Le crawler lit d'abord sitemap.xml (et les sitemaps index imbriqués), puis complète en parcours BFS depuis la page d'accueil. Sur un site sans sitemap, la découverte reste complète jusqu'à 10 000 URL.",
  },
  {
    title: '2. Récupération du HTML réel',
    body: "Chaque URL est récupérée avec un rendu JavaScript quand c'est nécessaire. C'est ce qui permet de détecter la « coquille JS » : un site dont le HTML servi aux robots est vide alors que la page s'affiche normalement dans un navigateur.",
  },
  {
    title: '3. Analyse technique par page',
    body: 'Statut HTTP, chaînes de redirection, canonical, hreflang, balises title et meta description (longueur et unicité), structure Hn, images sans alt, poids de page, liens internes et externes, directives robots.',
  },
  {
    title: '4. Analyse d’architecture',
    body: "Profondeur de clic, pages orphelines, maillage entrant et sortant, détection d'intention (Know / Do / Buy / Navigate) et repérage des pages qui se cannibalisent entre elles.",
  },
  {
    title: '5. Plan d’action priorisé',
    body: 'Chaque constat est classé par impact et par effort, avec la liste exacte des URL concernées. Export CSV et rapport PDF, en marque blanche sur les offres agence.',
  },
];

const CHECKS = [
  { label: 'Codes HTTP et redirections', body: '404, 410, 5xx, chaînes et boucles de redirection, redirections internes évitables.' },
  { label: 'Indexabilité', body: 'robots.txt, meta robots, X-Robots-Tag, canonical incohérente, noindex accidentel.' },
  { label: 'Liens cassés', body: 'Liens internes et sortants vérifiés avec la règle des deux constats consécutifs, pour éliminer les faux positifs.' },
  { label: 'Contenu', body: 'Pages trop courtes, quasi-doublons (SimHash), titres et descriptions dupliqués, année périmée.' },
  { label: 'Performance', body: 'Temps de réponse serveur, poids des pages, images non optimisées, scripts bloquants.' },
  { label: 'Visibilité IA', body: 'Passages citables, JSON-LD, blocs Q&A : les signaux qui déclenchent une citation dans ChatGPT ou Perplexity.' },
];

export default function OutilCrawl() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">Accueil</Link>
          <span className="mx-2">/</span>
          <span aria-current="page">Outil de crawl</span>
        </nav>

        <Badge variant="outline" className="text-xs uppercase mb-4">Page produit</Badge>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Outil de crawl de site web : analyser jusqu’à 10 000 pages
        </h1>

        <p className="text-lg text-foreground/80 leading-relaxed mb-6">
          Crawlers.fr est un site crawler hébergé : vous entrez un domaine, il parcourt les URL comme
          le ferait GoogleBot, puis restitue pour chaque page les erreurs techniques, la place dans
          l’architecture et le niveau de citabilité par les moteurs IA. Aucune installation, aucun
          plugin, résultats exploitables en quelques minutes.
        </p>

        <blockquote className="citable-passage border-l-4 border-primary bg-muted/40 pl-4 py-3 my-6 text-base text-foreground italic">
          Un crawl Crawlers.fr couvre jusqu’à 10 000 URL par site, combine découverte sitemap-first et
          parcours en largeur, et produit trois couches d’analyse : technique, architecture et GEO.
        </blockquote>

        <div className="flex flex-wrap gap-3 mb-12">
          <Link to="/app/site-crawl">
            <Button variant="outline" size="lg" className="gap-2">
              Lancer un crawl
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/marina">
            <Button variant="outline" size="lg" className="gap-2">
              Rapport complet gratuit
            </Button>
          </Link>
        </div>

        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            Comment fonctionne le crawl, étape par étape
          </h2>
          <div className="space-y-5">
            {STEPS.map((step) => (
              <article key={step.title} className="rounded-xl border border-border p-5">
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed text-foreground/80">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            Ce que le crawl contrôle sur chaque URL
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 list-none p-0">
            {CHECKS.map((c) => (
              <li key={c.label} className="rounded-xl border border-border p-5">
                <span className="flex items-center gap-2 font-semibold mb-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {c.label}
                </span>
                <p className="text-sm leading-relaxed text-foreground/80">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
            Crawler un site WordPress
          </h2>
          <p className="text-base leading-relaxed text-foreground/80 mb-4">
            WordPress génère mécaniquement des URL à faible valeur : archives d’auteur, pagination
            profonde, doublons entre étiquettes et catégories, pièces jointes indexables. Le crawl les
            isole en un passage et indique celles à passer en noindex, celles à fusionner et celles à
            supprimer. Pour les sites connectés, les correctifs de balises et de maillage peuvent être
            poussés directement dans le CMS depuis{' '}
            <Link to="/modifier-code-wordpress" className="underline">l’injection de code</Link>.
          </p>
          <p className="text-base leading-relaxed text-foreground/80">
            Le même mécanisme s’applique aux autres CMS : le crawl lit le HTML servi, pas la base de
            données, il ne dépend donc d’aucune extension.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Questions fréquentes</h2>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-lg border border-border bg-card/30 p-4">
                <summary className="cursor-pointer font-semibold list-none flex justify-between items-center gap-4">
                  <span>{f.q}</span>
                  <span className="text-foreground/50 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <SiloNav silo="outil-crawl" currentPath="/crawl" className="mb-14" />

        <section className="rounded-2xl border border-border bg-card/40 p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Crawlez votre site maintenant</h2>
          <p className="text-foreground/80 mb-6">
            Analyse technique, architecture et visibilité IA dans un seul rapport.
          </p>
          <Link to="/app/site-crawl">
            <Button variant="outline" size="lg" className="gap-2">
              Démarrer le crawl
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
