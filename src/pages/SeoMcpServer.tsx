import { Header } from '@/components/Header';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { McpSessionAnimation } from '@/components/Mcp/McpSessionAnimation';
import { DataTable } from '@/components/seo/DataTable';
import {
  MCP_OAUTH_TOOLS,
  MCP_SERVER_ACCESS_EN,
  MCP_SERVER_COUNT_EN,
  MCP_SERVER_ENDPOINT,
  MCP_SERVER_TOOLS,
} from '@/data/mcpPublicCatalog';


const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

const TOOLS = MCP_SERVER_TOOLS.map((tool) => ({
  name: tool.name,
  body: `${tool.summaryEn} Access: ${MCP_SERVER_ACCESS_EN[tool.access]}.`,
}));

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is an SEO MCP server?',
    a: 'A Model Context Protocol server that exposes SEO measurement as callable tools, so an AI coding agent can audit a page, read structured findings, apply a fix and re-audit to verify the result.',
  },
  {
    q: 'Which clients are supported?',
    a: 'Any MCP client supporting Streamable HTTP and configurable authentication headers, including Claude Desktop, Claude Code and Cursor. The live endpoint accepts a Marina key, not an OAuth connection flow.',
  },
  {
    q: 'How is it billed?',
    a: 'The live endpoint registers 23 tools: 3 with no key, 9 for Pro Agency, 4 Marina tools, and 7 read-only Search Console tools reserved for admins. Marina reports cost 5 credits, or are included with active Pro Agency. Insufficient credits return JSON-RPC -32002 and no job is created.',
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
          Crawlers.fr exposes its audit engine as a Model Context Protocol server. Claude Code,
          Claude Desktop and Cursor call the tools registered on mcp-server: a GEO score, LLM
          visibility, an SEO audit, corrective JavaScript, and Marina reports. The names below
          are the ones in the server code.
        </blockquote>

        <McpSessionAnimation
          windowTitle="Claude Code — Crawlers MCP server"
          caption="Example dialogue using tools that are actually registered. No sample score is shown."
          steps={[
            { kind: 'user', text: 'Connect the Crawlers.fr MCP server' },
            { kind: 'assistant', text: 'Connecting to the Crawlers MCP server.' },
            {
              kind: 'connect',
              text: `${MCP_SERVER_ENDPOINT} · Streamable HTTP · x-marina-key or Authorization: Bearer — ${MCP_SERVER_COUNT_EN}`,
            },
            { kind: 'user', text: 'Audit the SEO of this URL.' },
            { kind: 'assistant', text: 'I’ll call expert_seo_audit. It is a registered Pro Agency tool and expects a url.' },
            {
              kind: 'tool',
              name: 'expert_seo_audit',
              args: '{ "url": "https://example.com/contact" }',
            },
            {
              kind: 'result',
              lines: [
                'The tool returns the JSON produced by the audit function.',
                'This panel is an example of the call, not a measurement of example.com.',
              ],
            },
            {
              kind: 'assistant',
              text: 'To generate corrective JavaScript, the registered tool is generate_corrective_code (url, optional audit_id).',
            },
            {
              kind: 'tool',
              name: 'generate_corrective_code',
              args: '{ "url": "https://example.com/contact" }',
            },
            {
              kind: 'result',
              lines: [
                'Returns JavaScript corrective code for SEO/GEO fixes.',
                'Applying it in the repository is done by the agent, not by this tool.',
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
              <h3 className="text-xl font-semibold mt-6 mb-2">JSON, not an opinion</h3>
              <p className="text-base leading-relaxed">
                expert_seo_audit and the other registered tools return the JSON of the function
                they call. The registration does not define rule ids, a severity scale, or a
                per-framework patch format.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">A verifiable loop</h3>
              <p className="text-base leading-relaxed">
                Call expert_seo_audit, then generate_corrective_code, then expert_seo_audit again.
                The comparison is between the two JSON payloads.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Then a corrective script</h3>
              <p className="text-base leading-relaxed">
                generate_corrective_code returns JavaScript. dry_run_script tests a generated
                script (a site_script_rules id) on the live page: JS errors, CLS and JSON-LD
                validity. wordpress_sync injects a fix into a connected WordPress site and
                requires a session JWT.
              </p>
            </article>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Tools exposed by the server
            </h2>
            <p className="text-base leading-relaxed mb-6">
              {MCP_SERVER_COUNT_EN} Descriptions follow the text registered with each tool.
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
              caption="Tools registered on mcp-server: description and access, taken from the server code."
              columns={['Tool', 'What the registration says', 'Access']}
              rows={MCP_SERVER_TOOLS.map((tool) => [
                tool.name,
                tool.summaryEn,
                MCP_SERVER_ACCESS_EN[tool.access],
              ])}
            />
            <h3 className="text-xl font-semibold mt-8 mb-2">Second server, different tools</h3>
            <p className="text-base leading-relaxed mb-4">
              A second server, <code>supabase/functions/mcp</code>, uses OAuth 2.1. It is not the
              endpoint above. Its registered tools are listed here, except one whose public
              announcement is deferred.
            </p>
            <DataTable
              caption="Tools registered on the OAuth server mcp. One tool on that server is not announced here."
              columns={['Tool', 'What the registration says']}
              rows={MCP_OAUTH_TOOLS.map((tool) => [tool.name, tool.summaryEn])}
            />
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              What a tool returns
            </h2>
            <p className="text-base leading-relaxed">
              Each registered tool returns the JSON of the function it calls. This page does not
              publish rule identifiers, severity scales or stack-specific patch formats: that
              contract is not in the MCP registration. To compare two passes, call the same tool
              again and read the two payloads.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              MCP client compatibility
            </h2>
            <p className="text-base leading-relaxed mb-6">
              The live server implements the Model Context Protocol over Streamable HTTP.
              Use a client that lets you configure x-marina-key or Authorization headers.
            </p>
            <DataTable
              caption="Compatibility of MCP clients with the Crawlers audit server."
              columns={['Client', 'Transport', 'Auth', 'Typical use']}
              rows={[
                ['Claude Code', 'Streamable HTTP', 'Marina key / Bearer', 'Audit and fix inside the repository'],
                ['Claude Desktop', 'Streamable HTTP', 'Marina key / Bearer', 'Conversational diagnosis'],
                ['Cursor', 'Streamable HTTP', 'Marina key / Bearer', 'Audit while editing'],
                ['Any conformant client', 'Streamable HTTP', 'Marina key / Bearer', 'Custom automation'],
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
              <li>expert_seo_audit on the URL being edited (Pro Agency).</li>
              <li>The agent reads the JSON the tool returns.</li>
              <li>generate_corrective_code asks for corrective JavaScript for that URL.</li>
              <li>The agent edits the files in the repository. The tool itself does not commit them.</li>
              <li>expert_seo_audit again, to compare the new JSON with the previous one.</li>
            </ol>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Connecting and billing
            </h2>
            <blockquote className="citable-passage border-l-2 border-border pl-4 text-base leading-relaxed">
              The operational endpoint is <code>POST https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/mcp-server</code> over Streamable HTTP.
              Get your Marina key (prefix <code>marina_</code> or <code>mk_live_</code>) from Console crawlers.fr → API → Marina.
              Set <code>x-marina-key: &lt;key&gt;</code> or <code>Authorization: Bearer &lt;key&gt;</code>.
              {MCP_SERVER_COUNT_EN} A key belonging to an active Pro Agency account unlocks Pro access;
              calculate_cocoon_logic, wordpress_sync and measure_audit_impact still require a session JWT.
              Marina costs 5 credits per report, or is included with active Pro Agency.
            </blockquote>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Marina tools over MCP
            </h2>
            <p className="text-base leading-relaxed mb-3">
              Endpoint: <code>https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/mcp-server</code>.
              Header: <code>x-marina-key: &lt;key&gt;</code> or <code>Authorization: Bearer &lt;key&gt;</code> (Console crawlers.fr → API → Marina; prefixes <code>marina_</code> and <code>mk_live_</code>).
            </p>
            <ul className="list-disc pl-6 space-y-1 text-base">
              <li>marina_create_report: starts an SEO and GEO report, returns a job_id.</li>
              <li>marina_get_report: progress, then the report link.</li>
              <li>marina_list_jobs: your recent reports.</li>
              <li>marina_export_pdf: report PDF, link valid for 7 days.</li>
            </ul>
            <p className="text-base leading-relaxed mt-3">
              5 credits per report, or included with an active Pro Agency subscription. Without enough credits: JSON-RPC -32002, no job created.
              Without a key, only check_geo_score, check_llm_visibility and check_ai_crawlers are free; Marina returns JSON-RPC -32001.
              The future proxy <code>https://crawlers.fr/functions/v1/mcp-server</code> is not live: coming via Cloudflare (not deployed).
            </p>
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
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
              Sources and references
            </h2>
            <ul className="space-y-3 list-none p-0">
              {[
                { label: 'Model Context Protocol specification', href: 'https://modelcontextprotocol.io/specification', note: 'Streamable HTTP transport, tools, resources and prompts.' },
                { label: 'Anthropic MCP documentation', href: 'https://docs.anthropic.com/en/docs/mcp', note: 'Adding an MCP server to Claude Desktop and Claude Code.' },
                { label: 'Google Search Central', href: 'https://developers.google.com/search/docs', note: 'Official guidance on canonicals, indexing and rendering.' },
                { label: 'Schema.org', href: 'https://schema.org/docs/schemas.html', note: 'Structured-data vocabulary. On the OAuth server, analyze_schema reads the machine layer of a page.' },
                { label: 'Web Vitals', href: 'https://web.dev/articles/vitals', note: 'Definitions of LCP, INP and CLS. dry_run_script reports CLS for a tested script.' },
                { label: 'Robots Exclusion Protocol (RFC 9309)', href: 'https://www.rfc-editor.org/rfc/rfc9309.html', note: 'robots.txt standard. On the OAuth server, check_indexability reads robot access.' },
              ].map((ref) => (
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
