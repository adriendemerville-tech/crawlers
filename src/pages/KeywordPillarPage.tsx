import { Header } from '@/components/Header';
import { Link, useLocation, Navigate } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { KEYWORD_PILLARS } from '@/data/keywordPillars';
import { siloForPath } from '@/data/silos';
import { SiloNav } from '@/components/seo/SiloNav';
import { McpSessionAnimation, type McpStep } from '@/components/Mcp/McpSessionAnimation';

/**
 * Démonstrations MCP par page satellite : reproduction d'une session d'agent
 * (fenêtre type Claude Code) qui connecte le serveur MCP Crawlers, appelle un
 * outil, corrige et re-mesure. Rassure le visiteur sur l'usage réel.
 */
const MCP_DEMOS: Record<string, { windowTitle: string; caption: string; steps: McpStep[] }> = {
  'seo-avec-claude': {
    windowTitle: 'Claude Code — serveur MCP Crawlers',
    caption: 'Reproduction d’une session réelle : Claude Code pilote Crawlers via le MCP.',
    steps: [
      { kind: 'user', text: 'Connecte le serveur MCP Crawlers.fr' },
      { kind: 'assistant', text: 'Je me connecte au serveur MCP Crawlers.' },
      { kind: 'connect', text: 'https://crawlers.fr/mcp · Streamable HTTP · OAuth 2.1 — connecté : 14 outils, 3 ressources' },
      { kind: 'user', text: 'Audit le SEO de ma page produit.' },
      { kind: 'assistant', text: 'J’utilise l’outil audit_page pour analyser la page.' },
      {
        kind: 'tool',
        name: 'audit_page',
        args: '{ "url": "https://exemple.fr/produit" }',
      },
      {
        kind: 'dashboard',
        title: 'Résultats — audit_page',
        metrics: [
          { label: 'Score SEO', value: '58/100', tone: 'bad' },
          { label: 'Constats', value: '3', tone: 'warn' },
          { label: 'Critiques', value: '2', tone: 'bad' },
          { label: 'Corrections dispo', value: '3/3', tone: 'good' },
        ],
        rows: [
          { id: 'SEO-H1-001', severity: 'high', label: 'Aucun h1 dans le HTML servi' },
          { id: 'SEO-SCHEMA-003', severity: 'high', label: 'Schema Product absent' },
          { id: 'SEO-META-007', severity: 'medium', label: 'Meta description trop courte' },
        ],
      },
      { kind: 'assistant', text: 'Veux-tu que j’exporte ces constats, ou que je corrige les deux critiques avec get_fix ?' },
      { kind: 'user', text: 'Corrige les deux critiques.' },
      { kind: 'assistant', text: 'J’utilise l’outil get_fix pour générer le patch adapté à ta stack.' },
      {
        kind: 'tool',
        name: 'get_fix',
        args: '{ "finding_ids": ["SEO-H1-001", "SEO-SCHEMA-003"], "framework": "nextjs" }',
      },
      {
        kind: 'result',
        lines: ['patch: h1 unique + schema Product/Offer', 'fichier: app/produit/page.tsx'],
      },
      { kind: 'assistant', text: 'Patch appliqué. Je relance audit_page pour vérifier.' },
      {
        kind: 'dashboard',
        title: 'Vérification — audit_page (comparaison)',
        metrics: [
          { label: 'Score SEO', value: '58 → 91', tone: 'good' },
          { label: 'SEO-H1-001', value: 'Résolu', tone: 'good' },
          { label: 'SEO-SCHEMA-003', value: 'Résolu', tone: 'good' },
          { label: 'Reste', value: '1 medium', tone: 'warn' },
        ],
      },
    ],
  },
  'visibilite-ia': {
    windowTitle: 'Claude — serveur MCP Crawlers (visibilité IA)',
    caption: 'Reproduction d’une session réelle : mesure des citations dans les réponses IA, puis correction.',
    steps: [
      { kind: 'user', text: 'Est-ce que ChatGPT et Perplexity citent mon site sur mes requêtes clés ?' },
      {
        kind: 'tool',
        name: 'connect',
        args: 'https://crawlers.fr/mcp  ·  Streamable HTTP  ·  OAuth 2.1\n→ connecté : 14 outils, 3 ressources',
      },
      {
        kind: 'tool',
        name: 'ai_visibility',
        args: '{ "url": "https://exemple.fr", "engines": ["chatgpt", "gemini", "perplexity", "claude"] }',
      },
      {
        kind: 'result',
        lines: [
          'citation_rate: 8% (2/25 questions)',
          'chatgpt: 0   gemini: 1   perplexity: 1   claude: 0',
          'sources citées à votre place : 2 concurrents',
          'findings: GEO-ANSWER-001 (high), GEO-FANOUT-004 (medium)',
        ],
      },
      { kind: 'user', text: 'Corrige GEO-ANSWER-001.' },
      {
        kind: 'tool',
        name: 'get_fix',
        args: '{ "finding_id": "GEO-ANSWER-001" }',
      },
      {
        kind: 'result',
        lines: ['patch: bloc réponse directe + 3 passages citables + schema FAQPage'],
      },
      { kind: 'assistant', text: 'Correctif appliqué. Je re-mesure la visibilité.' },
      {
        kind: 'tool',
        name: 'ai_visibility',
        args: '{ "url": "https://exemple.fr", "compare_to": "run_7b30" }',
      },
      { kind: 'result', lines: ['citation_rate: 8% → 29%', 'GEO-ANSWER-001: résolu'] },
    ],
  },
  'audit-seo-par-ia': {
    windowTitle: 'Claude Code — audit SEO piloté par MCP',
    caption: 'Reproduction d’une session réelle : audit complet, corrections, vérification — sans ouvrir l’interface.',
    steps: [
      { kind: 'user', text: 'Lance un audit SEO complet de mon site et corrige ce qui est critique.' },
      {
        kind: 'tool',
        name: 'connect',
        args: 'https://crawlers.fr/mcp  ·  Streamable HTTP  ·  OAuth 2.1\n→ connecté : 14 outils, 3 ressources',
      },
      {
        kind: 'tool',
        name: 'audit_site',
        args: '{ "domain": "exemple.fr", "max_pages": 200 }',
      },
      {
        kind: 'result',
        lines: [
          '198 pages crawlées · score global 64/100',
          'critiques: 7 (canonicals, h1, pages orphelines)',
          'findings normalisés: SEO-CANON-002 ×4, SEO-ORPHAN-010 ×2…',
        ],
      },
      {
        kind: 'tool',
        name: 'get_fix',
        args: '{ "finding_id": "SEO-CANON-002", "framework": "nextjs" }',
      },
      {
        kind: 'result',
        lines: ['patch: metadata.alternates.canonical sur 4 pages', 'fichiers touchés: 4'],
      },
      { kind: 'assistant', text: 'Corrections appliquées. Je relance l’audit sur les pages touchées.' },
      {
        kind: 'tool',
        name: 'audit_page',
        args: '{ "url": "https://exemple.fr/contact", "compare_to": "run_5d12" }',
      },
      { kind: 'result', lines: ['score: 64 → 92', 'SEO-CANON-002: résolu sur 4/4 pages'] },
    ],
  },
};

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

/**
 * Reusable pillar page for the 5 SEO/GEO lexical-expansion pages.
 * Renders H1/H2/H3, FAQ, internal links, Article + FAQPage JSON-LD.
 *
 * Routed via /:slug where slug is one of the keys in KEYWORD_PILLARS.
 */
export default function KeywordPillarPage() {
  const location = useLocation();
  const slug = location.pathname.replace(/^\/+/, '').split('/')[0];
  const data = KEYWORD_PILLARS[slug];
  useCanonicalHreflang(`/${slug}`);

  if (!data) return <Navigate to="/404" replace />;

  const silo = siloForPath(`/${slug}`);

  // Passages citables : première phrase des 3 premières sections (visibilité LLM)
  const citable = data.sections
    .slice(0, 3)
    .map(s => (s.body.split(/(?<=\.)\s/)[0] || '').trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-background text-foreground">


      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 md:py-20">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">Accueil</Link>
          <span className="mx-2">/</span>
          <span aria-current="page">{data.primaryKeyword}</span>
        </nav>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">{data.h1}</h1>
        <p className="text-lg text-foreground/80 leading-relaxed mb-8">{data.intro}</p>

        <section aria-label="Réponse directe" className="mb-10 rounded-xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70 mb-3">
            Réponse directe
          </h2>
          <div className="space-y-3">
            {citable.map((passage, i) => (
              <blockquote key={i} className="citable-passage text-base leading-relaxed text-foreground/90 border-l-2 border-primary/60 pl-4">
                {passage}
              </blockquote>
            ))}
          </div>
        </section>

        {MCP_DEMOS[slug] && (
          <McpSessionAnimation
            windowTitle={MCP_DEMOS[slug].windowTitle}
            caption={MCP_DEMOS[slug].caption}
            steps={MCP_DEMOS[slug].steps}
          />
        )}

        <div className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground">
          {data.sections.map((section, si) => (
            <section key={si} className="mb-12">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{section.h2}</h2>
              <p className="text-base leading-relaxed mb-6">{section.body}</p>
              {section.h3s?.map((h3, hi) => (
                <article key={hi} className="mb-5">
                  <h3 className="text-xl font-semibold mt-6 mb-2">{h3.title}</h3>
                  <p className="text-base leading-relaxed">{h3.body}</p>
                </article>
              ))}
            </section>
          ))}

          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Questions fréquentes</h2>
            <div className="space-y-4">
              {data.faqs.map((f, i) => (
                <details key={i} className="group rounded-lg border border-border bg-card/30 p-4">
                  <summary className="cursor-pointer font-semibold list-none flex justify-between items-center">
                    <span>{f.q}</span>
                    <span className="text-foreground/50 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Pour aller plus loin</h2>
            <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
              {data.relatedLinks.map((link, i) => (
                <li key={i}>
                  <Link
                    to={link.to}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4 hover:border-foreground/40 transition-colors no-underline"
                  >
                    <span className="font-medium text-foreground">{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-foreground/60" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {silo && (
            <SiloNav silo={silo.id} currentPath={`/${slug}`} className="mt-16" />
          )}

          <section className="mt-16 rounded-2xl border border-border bg-card/40 p-8 text-center">
            <div className="inline-flex items-center gap-2 mb-3 text-sm text-foreground/70">
              <CheckCircle2 className="h-4 w-4" />
              Audit gratuit, sans inscription, 90 secondes
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Lancez votre audit maintenant</h2>
            <p className="text-foreground/80 mb-6">Diagnostic SEO et GEO complet sur votre URL, avec plan d'action priorisé.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/audit-geo-seo">
                <Button variant="outline" size="lg" className="gap-2">
                  Auditer mon site
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="outline" size="lg" className="gap-2">
                  Créer un compte gratuit
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
