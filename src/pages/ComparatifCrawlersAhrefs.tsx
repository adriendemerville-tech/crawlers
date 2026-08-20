import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { SiloNav } from '@/components/seo/SiloNav';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

/**
 * Satellite du silo « Comparatifs », chapeauté par /comparatif-crawlers-semrush.
 * Cible : « alternative Ahrefs », « Ahrefs vs », « Ahrefs prix ».
 */

const ROWS: { criteria: string; ahrefs: string; crawlers: string }[] = [
  { criteria: 'Prix d’entrée', ahrefs: '€/mois par siège, engagement mensuel', crawlers: 'Audit complet gratuit, puis crédits à l’usage' },
  { criteria: 'Index de backlinks propriétaire', ahrefs: 'Oui, c’est son point fort historique', crawlers: 'Non : données de backlinks agrégées via API tierces' },
  { criteria: 'Crawl technique du site', ahrefs: 'Site Audit, crédits par URL', crawlers: 'Jusqu’à 10 000 URL, rendu JS et détection de coquille JS' },
  { criteria: 'Visibilité dans les moteurs IA', ahrefs: 'Suivi partiel des mentions IA', crawlers: '9 questions posées réellement à ChatGPT, Gemini, Perplexity, Claude, Mistral' },
  { criteria: 'Architecture et cannibalisation', ahrefs: 'Rapports de liens internes', crawlers: 'Cocon sémantique 3D, détection de cannibalisation pilier/satellite' },
  { criteria: 'Plan d’action', ahrefs: 'Liste de constats à interpréter', crawlers: 'Plan priorisé impact/effort, tâches injectées dans un workbench' },
  { criteria: 'Rapports en marque blanche', ahrefs: 'Selon l’offre', crawlers: 'Inclus dès l’offre agence, PDF complet' },
  { criteria: 'Interface et support', ahrefs: 'Anglais', crawlers: 'Français, support et agents intégrés' },
];

const FAQS = [
  {
    q: 'Quelle est la meilleure alternative à Ahrefs en 2026 ?',
    a: "Cela dépend de l'usage. Pour la prospection de backlinks à grande échelle, l'index propriétaire d'Ahrefs reste difficile à remplacer. Pour l'audit technique, l'architecture sémantique et la visibilité dans les moteurs IA, Crawlers.fr couvre le besoin avec un audit complet gratuit et un plan d'action priorisé.",
  },
  {
    q: 'Crawlers.fr remplace-t-il Ahrefs ?',
    a: "Sur le crawl, l'architecture et le GEO, oui. Sur l'exploration d'un index de liens de plusieurs milliards d'URL, non : les deux outils sont complémentaires. Beaucoup d'équipes gardent Ahrefs pour le netlinking et pilotent le SEO technique et la visibilité IA avec Crawlers.fr.",
  },
  {
    q: 'Ahrefs mesure-t-il la citation par ChatGPT ?',
    a: "Ahrefs a ajouté un suivi des mentions dans les réponses IA, mais il n'interroge pas les modèles avec un jeu de questions calibré sur votre marché. Crawlers.fr pose 9 questions rédigées à partir de la carte d'identité du site, réparties en découverte, comparaison et contexte, et mesure la citation réelle.",
  },
  {
    q: 'Peut-on tester sans carte bancaire ?',
    a: 'Oui. Deux rapports complets sont offerts sans compte sur Marina, puis chaque rapport coûte 30 crédits.',
  },
];

const CANONICAL = 'https://crawlers.fr/comparatif-crawlers-ahrefs';

export default function ComparatifCrawlersAhrefs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">Accueil</Link>
          <span className="mx-2">/</span>
          <Link to="/comparatif-crawlers-semrush" className="hover:underline">Comparatifs</Link>
          <span className="mx-2">/</span>
          <span aria-current="page">Crawlers.fr vs Ahrefs</span>
        </nav>

        <Badge variant="outline" className="text-xs uppercase mb-4">Comparatif</Badge>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Alternative à Ahrefs : Crawlers.fr vs Ahrefs, 8 critères de décision
        </h1>

        <p className="text-lg text-foreground/80 leading-relaxed mb-6">
          Ahrefs s’est imposé par son index de backlinks. Crawlers.fr aborde le problème par l’autre
          bout : l’état technique réel du site, son architecture sémantique et sa citabilité par les
          moteurs génératifs. Voici où chaque outil est le plus utile, sans caricature.
        </p>

        <blockquote className="citable-passage border-l-4 border-primary bg-muted/40 pl-4 py-3 my-6 text-base text-foreground italic">
          Ahrefs est le meilleur choix pour explorer un index de backlinks à grande échelle.
          Crawlers.fr est le meilleur choix pour auditer un site jusqu’à 10 000 URL, corriger son
          architecture et mesurer sa citation réelle dans ChatGPT, Gemini, Perplexity, Claude et Mistral.
        </blockquote>

        <section className="mb-14 overflow-x-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Tableau comparatif</h2>
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-semibold">Critère</th>
                <th className="p-3 font-semibold">Ahrefs</th>
                <th className="p-3 font-semibold">Crawlers.fr</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.criteria} className="border-b border-border/60 align-top">
                  <td className="p-3 font-medium">{r.criteria}</td>
                  <td className="p-3 text-foreground/80">{r.ahrefs}</td>
                  <td className="p-3 text-foreground/80">{r.crawlers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">Quand rester sur Ahrefs</h2>
          <p className="text-base leading-relaxed text-foreground/80 mb-4">
            Si votre métier principal est le netlinking — qualification de domaines référents,
            analyse de profils de liens concurrents, suivi de campagnes d’acquisition — l’index
            d’Ahrefs reste l’actif décisif. Aucun outil hébergé ne le reproduit à ce niveau de
            fraîcheur.
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">Quand basculer sur Crawlers.fr</h2>
          <p className="text-base leading-relaxed text-foreground/80">
            Si votre problème est un site qui stagne, un blog qui se cannibalise, un HTML servi vide
            aux robots ou une marque absente des réponses IA, l’index de liens ne vous dira rien. Le{' '}
            <Link to="/crawl" className="underline">crawl technique</Link> et le{' '}
            <Link to="/generative-engine-optimization" className="underline">référencement IA</Link>{' '}
            traitent directement ces causes.
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

        <SiloNav silo="comparatifs" currentPath="/comparatif-crawlers-ahrefs" className="mb-14" />

        <section className="rounded-2xl border border-border bg-card/40 p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Comparez sur vos propres données</h2>
          <p className="text-foreground/80 mb-6">
            Deux rapports complets offerts, sans compte, puis 30 crédits par rapport.
          </p>
          <Link to="/marina">
            <Button variant="outline" size="lg" className="gap-2">
              Lancer un audit gratuit
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

export const AHREFS_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Alternative à Ahrefs : Crawlers.fr vs Ahrefs, 8 critères de décision',
    description:
      'Comparatif Crawlers.fr vs Ahrefs : backlinks, crawl technique, architecture sémantique, visibilité dans les moteurs IA, tarifs et marque blanche.',
    author: {
      '@type': 'Person',
      name: 'Adrien de Volontat',
      url: 'https://crawlers.fr/auteur/adrien-de-volontat',
    },
    publisher: { '@type': 'Organization', name: 'Crawlers.fr', url: 'https://crawlers.fr' },
    mainEntityOfPage: CANONICAL,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://crawlers.fr/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Comparatifs',
        item: 'https://crawlers.fr/comparatif-crawlers-semrush',
      },
      { '@type': 'ListItem', position: 3, name: 'Crawlers.fr vs Ahrefs', item: CANONICAL },
    ],
  },
];
