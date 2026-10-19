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
import { DataTable } from '@/components/seo/DataTable';


/**
 * Démonstrations MCP par page satellite : reproduction d'une session d'agent
 * (fenêtre type Claude Code) qui connecte le serveur MCP Crawlers, appelle un
 * outil, corrige et re-mesure. Rassure le visiteur sur l'usage réel.
 */
const MCP_CONNECT =
  'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/mcp-server · Streamable HTTP · x-marina-key ou Bearer — 27 outils enregistrés (1.2.0)';

const MCP_DEMOS: Record<string, { windowTitle: string; caption: string; steps: McpStep[] }> = {
  'seo-avec-claude': {
    windowTitle: 'Claude Code — serveur MCP Crawlers',
    caption: 'Exemple de dialogue avec des outils enregistrés sur mcp-server. Aucun score d’exemple.',
    steps: [
      { kind: 'user', text: 'Connecte le serveur MCP Crawlers.fr' },
      { kind: 'assistant', text: 'Je me connecte au serveur mcp-server.' },
      { kind: 'connect', text: MCP_CONNECT },
      { kind: 'user', text: 'Audite le SEO de cette URL.' },
      { kind: 'assistant', text: 'J’appelle expert_seo_audit. Pro Agency. La réponse est un job_id, pas le rapport.' },
      {
        kind: 'tool',
        name: 'expert_seo_audit',
        args: '{ "url": "https://exemple.fr/produit" }',
      },
      {
        kind: 'result',
        lines: [
          'job_id à suivre avec get_audit_job.',
          'sync: true force le mode bloquant. Aucune mesure d’exemple.fr ici.',
        ],
      },
      { kind: 'assistant', text: 'Je lis le job avec get_audit_job.' },
      {
        kind: 'tool',
        name: 'get_audit_job',
        args: '{ "job_id": "<uuid renvoyé>" }',
      },
      {
        kind: 'result',
        lines: ['Statut du job, puis le JSON du résultat une fois terminé.'],
      },
      { kind: 'user', text: 'Génère le JavaScript correctif.' },
      { kind: 'assistant', text: 'J’appelle generate_corrective_code.' },
      {
        kind: 'tool',
        name: 'generate_corrective_code',
        args: '{ "url": "https://exemple.fr/produit" }',
      },
      {
        kind: 'result',
        lines: ['JavaScript correctif SEO/GEO. L’application dans le dépôt reste le fait de l’agent.'],
      },
    ],
  },
  'visibilite-ia': {
    windowTitle: 'Claude — serveur MCP Crawlers (visibilité IA)',
    caption: 'Exemple d’appel à check_llm_visibility, outil gratuit réellement enregistré.',
    steps: [
      { kind: 'user', text: 'Connecte le MCP Crawlers.fr' },
      { kind: 'assistant', text: 'Je me connecte au serveur mcp-server.' },
      { kind: 'connect', text: MCP_CONNECT },
      { kind: 'user', text: 'Est-ce que les modèles citent ce domaine ?' },
      { kind: 'assistant', text: 'J’appelle check_llm_visibility. Entrée : domain. Moteurs indiqués : ChatGPT, Gemini, Perplexity, Claude.' },
      {
        kind: 'tool',
        name: 'check_llm_visibility',
        args: '{ "domain": "exemple.fr" }',
      },
      {
        kind: 'result',
        lines: [
          'Visibilité du domaine sur les quatre moteurs nommés dans l’outil.',
          'Aucun taux n’est inventé dans cet exemple.',
        ],
      },
      { kind: 'assistant', text: 'Le score GEO du même domaine se demande avec check_geo_score.' },
      {
        kind: 'tool',
        name: 'check_geo_score',
        args: '{ "domain": "exemple.fr" }',
      },
      {
        kind: 'result',
        lines: ['Score GEO de 0 à 100.'],
      },
    ],
  },
  'audit-seo-par-ia': {
    windowTitle: 'Claude Code — audit SEO piloté par MCP',
    caption: 'Exemple d’appel à expert_seo_audit puis generate_corrective_code. Aucun score d’exemple.',
    steps: [
      { kind: 'user', text: 'Connecte le MCP Crawlers.fr' },
      { kind: 'assistant', text: 'Je me connecte au serveur mcp-server.' },
      { kind: 'connect', text: MCP_CONNECT },
      { kind: 'user', text: 'Audite cette URL.' },
      { kind: 'assistant', text: 'J’appelle expert_seo_audit. Pro Agency. La réponse est un job_id.' },
      {
        kind: 'tool',
        name: 'expert_seo_audit',
        args: '{ "url": "https://exemple.fr" }',
      },
      {
        kind: 'result',
        lines: [
          'job_id à suivre avec get_audit_job.',
          'sync: true force le mode bloquant. Audit décrit comme 200 points.',
        ],
      },
      { kind: 'user', text: 'Produis le correctif.' },
      { kind: 'assistant', text: 'J’appelle generate_corrective_code.' },
      {
        kind: 'tool',
        name: 'generate_corrective_code',
        args: '{ "url": "https://exemple.fr" }',
      },
      {
        kind: 'result',
        lines: ['JavaScript correctif. Pas de patch par framework dans le contrat de l’outil.'],
      },
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
              {section.table && (
                <DataTable
                  caption={section.table.caption}
                  columns={section.table.columns}
                  rows={section.table.rows}
                />
              )}
            </section>
          ))}

          {data.externalRefs && data.externalRefs.length > 0 && (
            <section className="mt-16 pt-10 border-t border-border">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
                Sources et références
              </h2>
              <ul className="space-y-3 list-none p-0">
                {data.externalRefs.map((ref) => (
                  <li key={ref.href} className="rounded-lg border border-border bg-card/30 p-4 not-prose">
                    <a
                      href={ref.href}
                      target="_blank"
                      rel="noopener nofollow"
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {ref.label}
                    </a>
                    <p className="mt-1 text-sm text-foreground/70 leading-relaxed">{ref.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}


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
