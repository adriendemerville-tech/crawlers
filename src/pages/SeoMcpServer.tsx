import { Header } from '@/components/Header';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { McpSessionAnimation } from '@/components/Mcp/McpSessionAnimation';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

const TOOLS: { name: string; body: string }[] = [
  { name: 'crawl_site', body: 'Starts an asynchronous crawl of a domain and returns a job id. Poll get_job for progress and results.' },
  { name: 'audit_page', body: 'Audits a single URL: HTTP status, canonical, headings, metadata, structured data, render-shell detection, extracted text.' },
  { name: 'audit_site', body: 'Runs a full technical and generative-visibility audit across a crawled domain.' },
  { name: 'list_findings', body: 'Returns normalised findings with a stable rule id, severity, evidence and whether a fix is available.' },
  { name: 'get_fix', body: 'Returns the correction for a finding, adapted to your stack: plain HTML, WordPress, Next.js or TanStack Start.' },
  { name: 'check_indexability', body: 'Checks robots.txt, meta robots, canonical target and HTTP chain for a given URL.' },
  { name: 'analyze_schema', body: 'Validates JSON-LD against the visible content and reports mismatches, not just syntax errors.' },
  { name: 'analyze_links', body: 'Internal link graph for a page or a site: inbound links, click depth, orphan detection, broken link verdicts.' },
  { name: 'ai_visibility', body: 'Queries the major generative engines on a generated question set and reports observed brand citations.' },
  { name: 'get_job', body: 'Reads the status and payload of any asynchronous job. Free of charge.' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is an SEO MCP server?',
    a: 'A Model Context Protocol server that exposes SEO measurement as callable tools, so an AI coding agent can audit a page, read structured findings, apply a fix and re-audit to verify the result.',
  },
  {
    q: 'Which clients are supported?',
    a: 'Any MCP client speaking Streamable HTTP with OAuth 2.1 authentication, including Claude Desktop, Claude Code and Cursor.',
  },
  {
    q: 'How is it billed?',
    a: 'Reads and job status calls are free. Tools that trigger a crawl or a computation consume your plan quota first, then your pay-as-you-go developer wallet. Every billed call is logged with its cost.',
  },
  {
    q: 'Does the agent change my site?',
    a: 'No. Crawlers returns findings and proposed corrections. Your agent applies them in your repository or through your connected CMS.',
  },
  {
    q: 'Is generative visibility included?',
    a: 'Yes. Alongside classic technical SEO, the server measures whether generative engines such as ChatGPT, Gemini, Perplexity and Claude cite your pages.',
  },
  {
    q: 'Why not let the model audit the page itself?',
    a: 'A language model cannot measure served HTML, HTTP status or render behaviour. Without a crawl it produces plausible guesses instead of verifiable findings.',
  },
];

/**
 * English-language landing page targeting the "SEO MCP server" query for the
 * US/UK developer market. Distinct intent from the FR GEO silo, so it lives on
 * its own path with its own canonical.
 */
export default function SeoMcpServer() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 md:py-20" lang="en">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span aria-current="page">SEO MCP server</span>
        </nav>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
          SEO MCP server: give your coding agent a real audit engine
        </h1>

        <blockquote className="citable-passage border-l-2 border-border pl-4 text-lg text-foreground/85 leading-relaxed mb-10">
          Crawlers.fr exposes its crawl and audit engine as a Model Context Protocol server. Claude
          Code, Claude Desktop and Cursor can call it to audit a URL, receive normalised findings,
          request a stack-specific fix, apply it, then re-audit to prove the problem is gone.
        </blockquote>

        <McpSessionAnimation
          windowTitle="Claude Code — Crawlers MCP server"
          caption="Typographic reproduction of a real session: audit, fix, re-audit."
          steps={[
            { kind: 'user', text: 'Connect the Crawlers.fr MCP server' },
            { kind: 'assistant', text: 'Connecting to the Crawlers MCP server.' },
            {
              kind: 'connect',
              text: 'https://crawlers.fr/mcp · Streamable HTTP · OAuth 2.1 — connected: 14 tools, 3 resources',
            },
            { kind: 'user', text: 'Audit the SEO of /contact.' },
            { kind: 'assistant', text: 'I’ll use the audit_page tool to analyse the page.' },
            {
              kind: 'tool',
              name: 'audit_page',
              args: '{ "url": "https://example.com/contact" }',
            },
            {
              kind: 'dashboard',
              title: 'Results — audit_page',
              metrics: [
                { label: 'SEO score', value: '61/100', tone: 'warn' },
                { label: 'Findings', value: '3', tone: 'warn' },
                { label: 'Critical', value: '2', tone: 'bad' },
                { label: 'Fixes available', value: '3/3', tone: 'good' },
              ],
              rows: [
                { id: 'SEO-CANON-002', severity: 'high', label: 'Missing canonical' },
                { id: 'SEO-H1-001', severity: 'high', label: 'No h1 in served HTML' },
                { id: 'SEO-META-007', severity: 'medium', label: 'Meta description too short' },
              ],
            },
            {
              kind: 'assistant',
              text: 'Want me to export these findings, or fix the two critical ones with get_fix?',
            },
            { kind: 'user', text: 'Fix the critical ones for Next.js.' },
            {
              kind: 'tool',
              name: 'get_fix',
              args: '{ "finding_ids": ["SEO-CANON-002", "SEO-H1-001"], "framework": "nextjs" }',
            },
            {
              kind: 'result',
              lines: [
                'patch: metadata.alternates.canonical in app/contact/page.tsx',
                'patch: promote section title to h1',
                'files touched: 1',
              ],
            },
            {
              kind: 'assistant',
              text: 'Patches applied. Re-auditing to confirm the findings are gone.',
            },
            {
              kind: 'dashboard',
              title: 'Verification — audit_page (comparison)',
              metrics: [
                { label: 'SEO score', value: '61 → 94', tone: 'good' },
                { label: 'SEO-CANON-002', value: 'Resolved', tone: 'good' },
                { label: 'SEO-H1-001', value: 'Resolved', tone: 'good' },
                { label: 'SEO-META-007', value: 'Open', tone: 'warn' },
              ],
            },
          ]}
        />

        <div className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground">
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Why agents need a measurement layer
            </h2>
            <p className="text-base leading-relaxed mb-6">
              Ask an AI agent to “improve this page for SEO” and it will rewrite text it can see. It
              cannot see the HTML actually served to crawlers, the HTTP chain, the render behaviour,
              or whether a generative engine cites you. An MCP audit server closes that gap: the
              agent stops guessing and starts measuring.
            </p>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Findings, not opinions</h3>
              <p className="text-base leading-relaxed">
                Every issue comes back as a structured unit: rule id, severity, evidence,
                explanation, and whether a fix exists for your framework. That structure is what
                makes it actionable by code.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">A verifiable loop</h3>
              <p className="text-base leading-relaxed">
                Audit, fix, re-audit. The finding id is stable, so its disappearance is the proof.
                No re-measurement means no proof, only a claim.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Root cause before symptoms</h3>
              <p className="text-base leading-relaxed">
                A page whose text only exists after JavaScript execution is reported as a rendering
                shell, not as thin content. Fixing the wrong layer wastes an entire sprint.
              </p>
            </article>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Tools exposed by the server
            </h2>
            <p className="text-base leading-relaxed mb-6">
              Tool availability depends on your plan and wallet. Long-running work is asynchronous:
              the agent starts a job, then reads the result.
            </p>
            <ul className="list-none p-0 grid gap-3">
              {TOOLS.map((tool) => (
                <li
                  key={tool.name}
                  className="rounded-lg border border-border bg-card/30 p-4 not-prose"
                >
                  <code className="font-semibold text-foreground">{tool.name}</code>
                  <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{tool.body}</p>
                </li>
              ))}
            </ul>
            <DataTable
              caption="Crawlers MCP tools: returned data, execution mode and billing class."
              columns={['Tool', 'Returns', 'Execution', 'Billing']}
              rows={[
                ['audit_page', 'HTTP status, canonical, headings, metadata, JSON-LD, extracted text, render-shell verdict', 'Synchronous', 'Metered'],
                ['audit_site', 'Site-wide technical and generative-visibility findings, grouped by severity', 'Asynchronous', 'Metered'],
                ['crawl_site', 'Job id, then crawled URLs with status and click depth', 'Asynchronous', 'Metered'],
                ['list_findings', 'Normalised findings: rule id, severity, evidence, fix availability', 'Synchronous', 'Free'],
                ['get_fix', 'Stack-specific patch: HTML, WordPress, Next.js, TanStack Start', 'Synchronous', 'Metered'],
                ['check_indexability', 'robots.txt, meta robots, canonical target, redirect chain', 'Synchronous', 'Metered'],
                ['analyze_schema', 'Mismatches between JSON-LD and visible content', 'Synchronous', 'Metered'],
                ['analyze_links', 'Inbound links, click depth, orphan pages, broken-link verdicts', 'Synchronous', 'Metered'],
                ['ai_visibility', 'Observed brand citations per engine across a generated question set', 'Asynchronous', 'Metered'],
                ['get_job', 'Status and payload of any asynchronous job', 'Synchronous', 'Free'],
              ]}
            />
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Anatomy of a finding
            </h2>
            <p className="text-base leading-relaxed mb-6">
              A finding is a stable unit, which is exactly what makes verification possible. Without
              a stable rule id, re-auditing compares nothing.
            </p>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Rule id</h3>
              <p className="text-base leading-relaxed">
                A code such as SEO-H1-001, invariant across audits. Its disappearance after a patch
                is the proof the fix worked.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Evidence</h3>
              <p className="text-base leading-relaxed">
                The measured value, the excerpt and the URL. A finding with no evidence is never
                handed to the agent.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Severity and fix availability</h3>
              <p className="text-base leading-relaxed">
                Severity reflects expected impact, not rule order. Fix availability lists the stacks
                a patch exists for, so the agent knows whether it can act.
              </p>
            </article>
            <DataTable
              caption="Sample normalised findings with severity, typical evidence and covered stacks."
              columns={['Finding id', 'Rule', 'Severity', 'Typical evidence', 'Covered stacks']}
              rows={[
                ['SEO-H1-001', 'Exactly one h1', 'Critical', 'No h1 in served HTML', 'HTML, WordPress, Next.js'],
                ['SEO-CANON-002', 'Canonical present and consistent', 'Critical', 'No canonical tag, duplicate on /?ref=', 'HTML, WordPress, Next.js'],
                ['SEO-META-007', 'Useful meta description', 'Medium', '62 characters, below display threshold', 'HTML, WordPress, Next.js'],
                ['SEO-RENDER-005', 'Content served without JavaScript', 'Critical', 'Extracted text under 200 characters before hydration', 'Next.js, TanStack Start'],
                ['GEO-ANSWER-001', 'Citable direct answer', 'Critical', 'No standalone 2-4 sentence passage', 'HTML, WordPress, Next.js'],
              ]}
            />
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              MCP client compatibility
            </h2>
            <p className="text-base leading-relaxed mb-6">
              The server implements the Model Context Protocol over Streamable HTTP with OAuth 2.1,
              so any conformant client can call it.
            </p>
            <DataTable
              caption="Compatibility of MCP clients with the Crawlers audit server."
              columns={['Client', 'Transport', 'Auth', 'Typical use']}
              rows={[
                ['Claude Code', 'Streamable HTTP', 'OAuth 2.1', 'Audit and fix inside the repository'],
                ['Claude Desktop', 'Streamable HTTP', 'OAuth 2.1', 'Conversational diagnosis'],
                ['Cursor', 'Streamable HTTP', 'OAuth 2.1', 'Audit while editing'],
                ['Any conformant client', 'Streamable HTTP', 'OAuth 2.1', 'Custom automation'],
              ]}
            />
          </section>


          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              A typical session in Claude Code
            </h2>
            <p className="text-base leading-relaxed mb-6">
              The developer asks for an optimisation. The agent orchestrates the loop without further
              instructions.
            </p>
            <ol className="text-base leading-relaxed space-y-2">
              <li>audit_page on the route being edited.</li>
              <li>list_findings returns a missing canonical, a short description, absent JSON-LD.</li>
              <li>get_fix for each finding, scoped to the detected framework.</li>
              <li>The agent edits the files in the repository.</li>
              <li>audit_page again: the resolved findings are gone, the remaining ones are listed.</li>
            </ol>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Connecting and billing
            </h2>
            <blockquote className="citable-passage border-l-2 border-border pl-4 text-base leading-relaxed">
              The server uses Streamable HTTP with OAuth 2.1. You add it to your MCP client,
              authorise your Crawlers.fr account, and the tools appear in the conversation. Free
              calls cover reads and job status; billed calls draw on your plan quota and then on your
              pay-as-you-go wallet, with a daily cap that protects you against runaway agent loops.
            </blockquote>
          </section>

          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
              Frequently asked questions
            </h2>
            <div className="space-y-4">
              {FAQS.map((f) => (
                <details key={f.q} className="group rounded-lg border border-border bg-card/30 p-4">
                  <summary className="cursor-pointer font-semibold list-none flex justify-between items-center">
                    <span>{f.q}</span>
                    <span className="text-foreground/50 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Related pages</h2>
            <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
              {[
                { label: 'Developer API and pay-as-you-go', to: '/developers' },
                { label: 'REST SEO API endpoints', to: '/api-seo' },
                { label: 'SEO avec Claude (français)', to: '/seo-avec-claude' },
                { label: 'Serveur MCP GEO (français)', to: '/geo-mcp-server' },
                { label: 'Generative Engine Optimization', to: '/generative-engine-optimization' },
              ].map((link) => (
                <li key={link.to}>
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

          <section className="mt-16 rounded-2xl border border-border bg-card/40 p-8 text-center">
            <div className="inline-flex items-center gap-2 mb-3 text-sm text-foreground/70">
              <CheckCircle2 className="h-4 w-4" />
              Free audit, no credit card, 90 seconds
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Try the audit engine first</h2>
            <p className="text-foreground/80 mb-6">
              Run the same engine your agent will call, on any URL.
            </p>
            <Link to="/">
              <Button variant="outline" size="lg" className="gap-2">
                Audit a URL
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </section>
        </div>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
