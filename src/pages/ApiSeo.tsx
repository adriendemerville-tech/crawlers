import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowRight, Terminal, Zap, Wallet, KeyRound } from 'lucide-react';
import { Link } from '@/lib/router-compat';
import { SiloNav } from '@/components/seo/SiloNav';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const endpoints = [
  {
    method: 'GET',
    path: '/v1/features',
    role: 'Liste les 18 modules disponibles (audit SEO, GEO, analyse sémantique, visibilité IA…). Aucune clé requise.',
  },
  {
    method: 'POST',
    path: '/v1/jobs',
    role: 'Crée un job d\u2019analyse : { "feature": "geo_score", "input": { "url": "…" } }. Répond 202 avec un job_id et un poll_url.',
  },
  {
    method: 'GET',
    path: '/v1/jobs/{id}',
    role: 'Récupère le statut et le résultat JSON du job. À interroger toutes les 2 à 10 secondes.',
  },
  {
    method: 'POST',
    path: '/v1/jobs/{id}/cancel',
    role: 'Annule un job en cours, tant qu\u2019il n\u2019est pas terminé.',
  },
  {
    method: 'GET',
    path: '/marina/v1/audits',
    role: 'API Marina : audit de prospection multi-pages (identité, digital, stratégie) sur un domaine.',
  },
  {
    method: 'GET',
    path: '/parmenion-api/v1/tasks/pending',
    role: 'API Parménion : récupère les tâches de prescription d\u2019optimisations à appliquer.',
  },
];

const faqItems = [
  {
    q: 'Qu’est-ce qu’une API SEO ?',
    a: 'Une API SEO permet de déclencher des analyses de référencement (crawl, positions, audit technique, visibilité IA) depuis un programme au lieu d’une interface web. Celle de Crawlers.fr est une API REST asynchrone : vous créez un job, vous interrogez son statut, vous récupérez un résultat JSON.',
  },
  {
    q: 'Comment fonctionne l’API SEO de Crawlers.fr ?',
    a: 'Vous envoyez un POST /v1/jobs avec le module souhaité (ex. "feature":"geo_score") et l’URL à analyser. L’API renvoie un job_id et un poll_url. Vous interrogez GET /v1/jobs/{id} toutes les 2 à 10 secondes jusqu’à obtenir le résultat structuré. Les jobs longs (crawl complet, audit) ne subissent aucun timeout.',
  },
  {
    q: 'Combien coûte l’API SEO ?',
    a: '100 jobs cumulés sont gratuits chaque mois, sans carte bancaire. Au-delà, le modèle est pay-as-you-go : environ 0,05 € par job en moyenne, facturé au volume réel via Stripe, sans engagement.',
  },
  {
    q: 'Quelle est la différence entre l’API SEO et un outil SEO classique ?',
    a: 'Un outil SEO fournit une interface pour un humain ; une API SEO fournit des données exploitables par un programme. Elle sert à intégrer les audits dans vos propres dashboards, scripts CI/CD, agents IA ou applications clientes, sans copier-coller de rapports.',
  },
  {
    q: 'Peut-on appeler l’API SEO depuis ChatGPT ou un agent IA ?',
    a: 'Oui. Le format REST + JSON et l’authentification par clé Bearer sont directement exploitables par des agents (MCP, function calling, workflows n8n). Les 18 modules couvrent audit technique, score GEO, positions SERP et visibilité dans les LLM.',
  },
  {
    q: 'Quels langages supporte l’API SEO ?',
    a: 'Tous : la seule exigence est de savoir envoyer une requête HTTPS et lire du JSON. Des exemples curl, JavaScript/TypeScript et PHP sont fournis dans la documentation développeurs, et des SDK sont disponibles pour les principaux environnements (Node, Workers, CI/CD).',
  },
];

export default function ApiSeoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SiloNav silo="outil-crawl" />

      <main className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
        <Badge variant="outline" className="mb-4">API · REST async · v1</Badge>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
          API SEO : intégrer les audits SEO et GEO dans vos applications
        </h1>

        <p className="text-lg font-semibold text-foreground mb-6">
          Une API SEO est une interface REST qui permet de lancer des audits de référencement
          depuis un programme plutôt qu’une interface web. L’API SEO de Crawlers.fr expose 18
          modules d’analyse en REST asynchrone, avec 100 jobs gratuits par mois.
        </p>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          Authentification par clé Bearer, réponse JSON structurée, modèle asynchrone par
          polling : vous créez un job, vous interrogez son statut, vous récupérez le résultat.
          Aucun timeout sur les jobs longs (crawl complet, audit multi-pages).
        </p>

        <div className="flex flex-wrap gap-3 mb-12">
          <Button asChild variant="outline">
            <Link to="/developers">Obtenir une clé API <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/developers/docs">Documentation complète</Link>
          </Button>
        </div>

        {/* Endpoints */}
        <section className="mb-14" aria-labelledby="endpoints-titre">
          <h2 id="endpoints-titre" className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Terminal className="h-6 w-6" /> Endpoints principaux
          </h2>
          <p className="text-muted-foreground mb-6">
            Base : <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">https://api.crawlers.fr</code>
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold">Méthode</th>
                  <th className="px-4 py-3 font-semibold">Endpoint</th>
                  <th className="px-4 py-3 font-semibold">Rôle</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e) => (
                  <tr key={e.path} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono">{e.method}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{e.path}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Exemples */}
        <section className="mb-14" aria-labelledby="exemples-titre">
          <h2 id="exemples-titre" className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Zap className="h-6 w-6" /> Exemple de requête et de réponse
          </h2>
          <p className="mb-4 text-muted-foreground">Créer un job de score GEO :</p>
          <pre className="rounded-lg border border-border bg-muted/40 p-4 text-xs font-mono overflow-x-auto mb-6">
{`curl -X POST https://api.crawlers.fr/v1/jobs \\
  -H "Authorization: Bearer crw_live_..." \\
  -d '{"feature":"geo_score","input":{"url":"https://exemple.fr"}}'

# 202 Accepted
{ "job_id": "5d6e7f12-...", "status": "queued",
  "poll_url": "/v1/jobs/5d6e7f12-..." }`}
          </pre>
          <p className="mb-4 text-muted-foreground">Récupérer le résultat :</p>
          <pre className="rounded-lg border border-border bg-muted/40 p-4 text-xs font-mono overflow-x-auto">
{`curl https://api.crawlers.fr/v1/jobs/5d6e7f12-... \\
  -H "Authorization: Bearer crw_live_..."

# 200 OK
{ "status": "succeeded",
  "result": { "geo_score": 68, "checks": [ /* … */ ] } }`}
          </pre>
        </section>

        {/* Quotas & tarifs */}
        <section className="mb-14" aria-labelledby="tarifs-titre">
          <h2 id="tarifs-titre" className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Quotas et tarifs
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border p-5">
              <KeyRound className="h-5 w-5 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">100 jobs gratuits / mois</h3>
              <p className="text-sm text-muted-foreground">Sans carte bancaire, renouvelés chaque mois.</p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <Wallet className="h-5 w-5 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Pay-as-you-go</h3>
              <p className="text-sm text-muted-foreground">~0,05 € par job en moyenne, facturé au volume réel via Stripe.</p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <Zap className="h-5 w-5 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Sans engagement</h3>
              <p className="text-sm text-muted-foreground">Auth par clé Bearer, clé révocable à tout moment depuis le dashboard.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14" aria-labelledby="faq-titre">
          <h2 id="faq-titre" className="text-2xl font-bold mb-6">FAQ — API SEO</h2>
          <Accordion type="single" collapsible>
            {faqItems.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <div className="rounded-lg border border-border p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold mb-1">Prêt à intégrer l’API SEO ?</h2>
            <p className="text-sm text-muted-foreground">Créez votre clé, testez les 18 modules avec 100 jobs gratuits.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link to="/developers">Page développeurs <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
