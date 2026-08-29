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
 * Cible : « alternative Screaming Frog », « Screaming Frog en ligne », « Screaming Frog gratuit ».
 */

const ROWS: { criteria: string; sf: string; crawlers: string }[] = [
  { criteria: 'Nature de l’outil', sf: 'Logiciel à installer sur Windows, macOS ou Linux', crawlers: 'Application en ligne, rien à installer' },
  { criteria: 'Limite gratuite', sf: '500 URL par crawl, fonctions avancées désactivées', crawlers: 'Deux rapports complets offerts sans compte, jusqu’à 10 000 URL selon l’offre' },
  { criteria: 'Ressources machine', sf: 'Consomme la RAM et le CPU de votre poste, gros sites difficiles', crawlers: 'Crawl exécuté côté serveur, votre poste reste libre' },
  { criteria: 'Rendu JavaScript', sf: 'Rendu JS possible, lourd et lent en local', crawlers: 'Rendu JS systématique et détection de coquille JS (HTML servi vide aux robots)' },
  { criteria: 'Interprétation des résultats', sf: 'Tableaux de données brutes à analyser soi-même', crawlers: 'Plan d’action priorisé impact/effort, constats injectés dans un workbench' },
  { criteria: 'Visibilité dans les moteurs IA', sf: 'Non couvert', crawlers: '9 questions posées réellement à ChatGPT, Gemini, Perplexity, Claude, Mistral' },
  { criteria: 'Architecture sémantique', sf: 'Liens internes en liste, profondeur de clic', crawlers: 'Cocon sémantique 3D, cannibalisation pilier/satellite, plan de maillage' },
  { criteria: 'Rapports client', sf: 'Exports CSV et Excel', crawlers: 'Rapport PDF de 20+ pages, marque blanche dès l’offre agence' },
  { criteria: 'Travail en équipe', sf: 'Licence par poste, crawls locaux non partagés', crawlers: 'Rôles owner / editor / auditor, historique partagé' },
  { criteria: 'Langue et support', sf: 'Anglais', crawlers: 'Français, support et agents intégrés' },
];

import { FAQS, CANONICAL } from './ComparatifCrawlersScreamingFrog.seo';

export default function ComparatifCrawlersScreamingFrog() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">Accueil</Link>
          <span className="mx-2">/</span>
          <Link to="/comparatif-crawlers-semrush" className="hover:underline">Comparatifs</Link>
          <span className="mx-2">/</span>
          <span aria-current="page">Crawlers.fr vs Screaming Frog</span>
        </nav>

        <Badge variant="outline" className="text-xs uppercase mb-4">Comparatif</Badge>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Alternative à Screaming Frog : le crawl en ligne, sans limite de 500 URL
        </h1>

        <p className="text-lg text-foreground/80 leading-relaxed mb-6">
          Screaming Frog est le crawler de bureau de référence depuis plus de dix ans. Sa limite n’est
          pas la qualité de l’exploration, mais son modèle : un logiciel installé sur votre poste, un
          plafond de 500 URL en version gratuite, et des tableaux de données qu’il faut savoir lire.
          Crawlers.fr prend le problème par l’autre bout : le crawl tourne côté serveur et le rapport
          sort déjà interprété.
        </p>

        <section className="mb-14 overflow-x-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Tableau comparatif</h2>
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-semibold">Critère</th>
                <th className="p-3 font-semibold">Screaming Frog</th>
                <th className="p-3 font-semibold">Crawlers.fr</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.criteria} className="border-b border-border/60 align-top">
                  <td className="p-3 font-medium">{r.criteria}</td>
                  <td className="p-3 text-foreground/80">{r.sf}</td>
                  <td className="p-3 text-foreground/80">{r.crawlers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">Quand rester sur Screaming Frog</h2>
          <p className="text-base leading-relaxed text-foreground/80 mb-4">
            Pour une extraction personnalisée en XPath, l’audit d’une préproduction inaccessible depuis
            l’extérieur, ou une configuration d’exploration très fine que vous rejouez à l’identique
            chaque semaine, le logiciel de bureau reste l’outil le plus direct.
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">Quand basculer sur Crawlers.fr</h2>
          <p className="text-base leading-relaxed text-foreground/80">
            Dès que le site dépasse quelques milliers d’URL, que le HTML dépend du JavaScript, que le
            livrable doit être lisible par un client, ou que la question porte sur l’architecture et la
            présence dans les réponses IA. Voir l’{' '}
            <Link to="/crawl" className="underline">outil de crawl de site web</Link>, l’{' '}
            <Link to="/audit-expert" className="underline">audit expert 200+ critères</Link> et le{' '}
            <Link to="/generative-engine-optimization" className="underline">référencement IA</Link>.
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

        <SiloNav silo="comparatifs" currentPath="/comparatif-crawlers-screaming-frog" className="mb-14" />

        <section className="rounded-2xl border border-border bg-card/40 p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Lancez un crawl sans rien installer</h2>
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
