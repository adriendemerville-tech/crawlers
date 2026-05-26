import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowRight, Terminal, Key, AlertCircle, Workflow, Layers, Clock } from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

const BASE = 'https://tutlimtasnjabdfhpewu.functions.supabase.co/crawlers-api/v1';

const Code = ({ children, lang = 'bash' }: { children: string; lang?: string }) => (
  <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed">
    <code data-lang={lang}>{children}</code>
  </pre>
);

const Endpoint = ({ method, path }: { method: string; path: string }) => (
  <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
    <Badge variant="outline" className="rounded-sm border-2 px-2 py-0.5 text-xs">{method}</Badge>
    <span className="break-all">{path}</span>
  </div>
);

// Catalogue (miroir du registry edge function)
const FEATURES: Array<{ id: string; title: string; desc: string; input: Record<string, string>; status: 'preview' | 'stable' | 'soon' }> = [
  { id: 'audit_expert',         title: 'Audit Expert (168 critères)',  desc: 'Audit technique, sémantique et E-E-A-T sur 168 critères.',                            input: { url: 'string (https)' }, status: 'preview' },
  { id: 'machine_layer',        title: 'Machine Layer Scanner',        desc: 'Lisibilité bots IA, JSON-LD, robots.txt, sitemap, fan-out.',                          input: { url: 'string' }, status: 'preview' },
  { id: 'eeat',                 title: 'Score E-E-A-T',                desc: 'Expertise, autorité, fiabilité (scoring v3).',                                        input: { url: 'string' }, status: 'preview' },
  { id: 'site_crawl',           title: 'Crawl de site',                desc: 'Crawl BFS d\'un domaine (3 niveaux de profondeur max).',                              input: { domain: 'string', depth: 'number?', limit: 'number?' }, status: 'preview' },
  { id: 'pagespeed',            title: 'PageSpeed Insights',           desc: 'Mobile + desktop, Core Web Vitals (LCP, CLS, INP).',                                  input: { url: 'string' }, status: 'preview' },
  { id: 'audit_matrix',         title: "Matrice d'audit",              desc: 'Multi-pages, export CSV-ready.',                                                      input: { domain: 'string', urls: 'string[]?' }, status: 'preview' },
  { id: 'semantic_audit',       title: 'Audit sémantique',             desc: 'Champ lexical, entités, alignement intention (Lexical Footprint v2).',                input: { url: 'string', keyword: 'string?' }, status: 'preview' },
  { id: 'cocoon',               title: 'Cocoon sémantique 3D',         desc: 'Clusters, cannibalisation, profondeur, liens internes.',                              input: { domain: 'string' }, status: 'preview' },
  { id: 'content_architect',    title: 'Content Architect',            desc: 'Recommandation éditoriale en 4 étages (brief / stratège / rédacteur / tonalisateur).', input: { domain: 'string', topic: 'string', target_audience: 'string?' }, status: 'preview' },
  { id: 'autopilot_status',     title: 'Autopilote (statut)',          desc: 'Lecture du statut Parménion pour un domaine.',                                        input: { domain: 'string' }, status: 'preview' },
  { id: 'conversion_optimizer', title: 'Conversion Optimizer',         desc: 'CTA, friction, GA4 behavioral metrics.',                                              input: { url: 'string' }, status: 'preview' },
  { id: 'social_hub',           title: 'Social Hub',                   desc: 'Génère des variations sociales depuis un article.',                                   input: { url: 'string', platforms: 'string[]?' }, status: 'preview' },
  { id: 'geo_score',            title: 'Score GEO',                    desc: 'Generative Engine Optimization (lisibilité par moteurs IA).',                          input: { url: 'string' }, status: 'preview' },
  { id: 'llm_visibility',       title: 'Visibilité LLM',               desc: 'Présence d\'une marque dans ChatGPT, Perplexity, Gemini, Claude.',                    input: { brand: 'string', queries: 'string[]' }, status: 'preview' },
  { id: 'ai_bots_analysis',     title: 'Analyse Bots IA',              desc: 'Hits bots IA (GPTBot, ClaudeBot, PerplexityBot, …) sur 30 jours.',                    input: { domain: 'string' }, status: 'preview' },
  { id: 'observatory',          title: 'Observatoire sectoriel',       desc: 'Benchmarks (positions moyennes, mix bots, IAS) par secteur.',                          input: { sector: 'string' }, status: 'preview' },
  { id: 'serp_ranking',         title: 'Ranking SERP',                 desc: 'Positions multi-providers (DataForSEO + SerpAPI + Serper + Bright Data).',            input: { keyword: 'string', domain: 'string?', location: 'string?' }, status: 'preview' },
  { id: 'competitors',          title: 'Concurrence',                  desc: 'Audit concurrentiel (SEO + GEO + SERP delta) sur 1 à 3 URLs.',                        input: { domain: 'string', competitors: 'string[]' }, status: 'preview' },
];

export default function CrawlersApiDoc() {
  useCanonicalHreflang('/docs/api/crawlers');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: 'API Crawlers — Documentation officielle',
        description:
          "Référence complète de l'API Crawlers : une seule clé pour interroger toutes les fonctionnalités (audit, crawl, cocoon, GEO, LLM visibility, SERP, observatoire, concurrence). Modèle asynchrone par polling, auth Bearer, codes d'erreur, exemples Node/PHP/Python.",
        author: { '@type': 'Organization', name: 'Crawlers.fr' },
        publisher: { '@type': 'Organization', name: 'Crawlers.fr' },
        datePublished: '2026-05-26',
        dateModified: '2026-05-26',
        proficiencyLevel: 'Expert',
        dependencies: 'HTTPS, JSON',
        articleSection: 'API Reference',
      },
      {
        '@type': 'APIReference',
        name: 'Crawlers API',
        description:
          "API REST unifiée donnant accès aux 18 modules d'analyse SEO, GEO et IA de Crawlers : un endpoint POST /v1/jobs, un GET /v1/jobs/{id} pour le résultat.",
        programmingModel: 'REST (async / polling)',
        targetPlatform: 'Web, CMS, Workers, CI/CD',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://crawlers.fr/' },
          { '@type': 'ListItem', position: 2, name: 'API & Intégrations', item: 'https://crawlers.fr/api-integrations' },
          { '@type': 'ListItem', position: 3, name: 'API Crawlers', item: 'https://crawlers.fr/docs/api/crawlers' },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>API Crawlers — Documentation REST unifiée (18 modules) | Crawlers.fr</title>
        <meta
          name="description"
          content="Documentation complète de l'API Crawlers : une seule clé crw_live_ pour 18 modules (audit, crawl, cocoon, GEO, LLM, SERP, observatoire). REST asynchrone par polling. Exemples Node, PHP, Python."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="API Crawlers — Documentation REST unifiée | Crawlers.fr" />
        <meta property="og:description" content="Une seule clé, 18 modules : audit, crawl, cocoon, GEO, LLM visibility, SERP, observatoire, concurrence. Modèle asynchrone par polling." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/docs/api/crawlers" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
        {/* Hero */}
        <header className="mb-12">
          <Badge variant="outline" className="mb-4">API Reference · v1</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            API Crawlers
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Une seule clé <code className="font-mono text-sm">crw_live_…</code> pour interroger les 18 modules
            d'analyse SEO, GEO et IA de Crawlers. Modèle <strong>asynchrone par polling</strong> : vous créez
            un job, vous interrogez son statut, vous récupérez le résultat structuré en JSON.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link to="/api-integrations">Toutes les APIs <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline"><Link to="/docs/api/marina">API Marina</Link></Button>
            <Button asChild variant="outline"><Link to="/docs/api/parmenion">API Parménion</Link></Button>
          </div>
        </header>

        {/* TOC */}
        <nav aria-label="Sommaire" className="mb-12 rounded-lg border border-border p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Sommaire</h2>
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            <li><a href="#overview" className="hover:underline">1. Vue d'ensemble</a></li>
            <li><a href="#authentication" className="hover:underline">2. Authentification</a></li>
            <li><a href="#lifecycle" className="hover:underline">3. Cycle de vie d'un job</a></li>
            <li><a href="#endpoints" className="hover:underline">4. Endpoints</a></li>
            <li><a href="#features" className="hover:underline">5. Catalogue des 18 modules</a></li>
            <li><a href="#errors" className="hover:underline">6. Codes d'erreur</a></li>
            <li><a href="#examples" className="hover:underline">7. Exemples Node / PHP / Python</a></li>
            <li><a href="#limits" className="hover:underline">8. Quotas &amp; limites</a></li>
          </ul>
        </nav>

        {/* Overview */}
        <section id="overview" className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Layers className="h-5 w-5" /> 1. Vue d'ensemble</h2>
          <p className="mb-4 text-muted-foreground">
            L'API Crawlers expose <strong>chaque fonctionnalité de la plateforme en endpoint individuel</strong>,
            via un dispatcher unique. Vous postez <code>{`{ feature, input }`}</code> sur <code>/v1/jobs</code>, vous récupérez
            un <code>job_id</code>, puis vous interrogez <code>/v1/jobs/{`{id}`}</code> jusqu'à <code>status = "succeeded"</code>.
          </p>
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
            <p className="mb-2"><strong>Base URL</strong></p>
            <code className="block break-all font-mono text-xs">{BASE}</code>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Pour le pipeline éditorial complet (publication CMS), voir <Link className="underline" to="/docs/api/parmenion">l'API Parménion</Link>.
            Pour la génération de rapports B2B en marque blanche, voir <Link className="underline" to="/docs/api/marina">l'API Marina</Link>.
          </p>
        </section>

        {/* Auth */}
        <section id="authentication" className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Key className="h-5 w-5" /> 2. Authentification</h2>
          <p className="mb-4 text-muted-foreground">
            Toutes les requêtes (sauf <code>/v1/features</code> et <code>/health</code>) requièrent une clé API
            personnelle au format <code className="font-mono">crw_live_…</code>. La clé est stockée côté Crawlers
            sous forme de hash SHA-256 ; elle n'est affichée <strong>qu'une seule fois</strong> à sa création.
          </p>
          <p className="mb-4 text-muted-foreground">
            Deux modes équivalents :
          </p>
          <Code lang="http">{`Authorization: Bearer crw_live_xxxxxxxxxxxxxxxxxxxxxxxx
# ou
x-crawlers-key: crw_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          <p className="mt-4 text-sm text-muted-foreground">
            Création depuis <Link className="underline" to="/account">votre compte</Link> → onglet API. La clé peut être révoquée à tout moment.
          </p>
        </section>

        {/* Lifecycle */}
        <section id="lifecycle" className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Workflow className="h-5 w-5" /> 3. Cycle de vie d'un job</h2>
          <ol className="space-y-3 text-sm">
            <li><strong>POST /v1/jobs</strong> → <code>202 Accepted</code>, statut <code>queued</code>.</li>
            <li>Le worker passe le job en <code>running</code> dans la seconde qui suit.</li>
            <li>Vous polliez <strong>GET /v1/jobs/{`{id}`}</strong> toutes les 2–10 s (selon module).</li>
            <li>Statut final : <code>succeeded</code> (champ <code>result</code> rempli) ou <code>failed</code> (champ <code>error</code>).</li>
            <li>Un job peut être annulé avec <strong>POST /v1/jobs/{`{id}`}/cancel</strong> tant qu'il n'est pas terminé.</li>
          </ol>
          <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Durées typiques : <code>pagespeed</code> 10–30 s, <code>geo_score</code> 20–60 s, <code>audit_expert</code> 1–3 min,
              <code> site_crawl</code> 2–15 min selon la taille.
            </p>
          </div>
        </section>

        {/* Endpoints */}
        <section id="endpoints" className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Terminal className="h-5 w-5" /> 4. Endpoints</h2>

          <div className="space-y-8">
            <article>
              <Endpoint method="GET" path="/v1/features" />
              <p className="mt-2 text-sm text-muted-foreground">Liste les modules disponibles (public, sans clé).</p>
              <Code>{`curl ${BASE}/features`}</Code>
            </article>

            <article>
              <Endpoint method="POST" path="/v1/jobs" />
              <p className="mt-2 text-sm text-muted-foreground">Crée un job pour le module choisi. Renvoie <code>202</code> + <code>id</code> + <code>poll_url</code>.</p>
              <Code lang="bash">{`curl -X POST ${BASE}/jobs \\
  -H "Authorization: Bearer crw_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "feature": "geo_score",
    "input": { "url": "https://example.com/blog/article" }
  }'`}</Code>
              <p className="mt-3 text-xs text-muted-foreground">Réponse :</p>
              <Code lang="json">{`{
  "id": "5d6e7f12-...-9a0b",
  "feature": "geo_score",
  "status": "queued",
  "created_at": "2026-05-26T10:00:00Z",
  "poll_url": "/v1/jobs/5d6e7f12-...-9a0b"
}`}</Code>
            </article>

            <article>
              <Endpoint method="GET" path="/v1/jobs/{id}" />
              <p className="mt-2 text-sm text-muted-foreground">Récupère l'état d'un job et son résultat si <code>status = "succeeded"</code>.</p>
              <Code lang="json">{`{
  "id": "5d6e7f12-...-9a0b",
  "feature": "geo_score",
  "status": "succeeded",
  "input": { "url": "https://example.com/blog/article" },
  "result": {
    "score": 78,
    "breakdown": { "machine_readability": 82, "fan_out": 71, "citation": 80 }
  },
  "error": null,
  "created_at": "2026-05-26T10:00:00Z",
  "started_at": "2026-05-26T10:00:01Z",
  "completed_at": "2026-05-26T10:00:42Z"
}`}</Code>
            </article>

            <article>
              <Endpoint method="GET" path="/v1/jobs" />
              <p className="mt-2 text-sm text-muted-foreground">Liste vos derniers jobs (paramètre <code>?limit=20</code>, max 100).</p>
            </article>

            <article>
              <Endpoint method="POST" path="/v1/jobs/{id}/cancel" />
              <p className="mt-2 text-sm text-muted-foreground">Annule un job <code>queued</code> ou <code>running</code>. Renvoie <code>409</code> si le job est déjà terminé.</p>
            </article>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mb-16">
          <h2 className="text-2xl font-bold mb-2">5. Catalogue des 18 modules</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Chaque module est appelé via <code>{`{ "feature": "<id>", "input": { … } }`}</code>.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Module</th>
                  <th className="px-4 py-3 font-medium">Input attendu</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f) => (
                  <tr key={f.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-mono text-xs">{f.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{f.title}</div>
                      <div className="text-xs text-muted-foreground">{f.desc}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {Object.entries(f.input).map(([k, v]) => (
                        <div key={k}>{k}: <span className="text-muted-foreground">{v}</span></div>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{f.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Errors */}
        <section id="errors" className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> 6. Codes d'erreur</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-medium">HTTP</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                <tr className="border-t border-border"><td className="px-4 py-3">400</td><td className="px-4 py-3">missing_field</td><td className="px-4 py-3 font-sans">Champ obligatoire manquant (souvent <code>feature</code>).</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">400</td><td className="px-4 py-3">unknown_feature</td><td className="px-4 py-3 font-sans">L'ID de module n'existe pas. Voir <code>GET /v1/features</code>.</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">400</td><td className="px-4 py-3">invalid_input</td><td className="px-4 py-3 font-sans">Le champ <code>input</code> doit être un objet JSON.</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">400</td><td className="px-4 py-3">invalid_json</td><td className="px-4 py-3 font-sans">Le corps de la requête n'est pas du JSON valide.</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">401</td><td className="px-4 py-3">missing_api_key</td><td className="px-4 py-3 font-sans">Aucune clé fournie dans <code>Authorization</code> ou <code>x-crawlers-key</code>.</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">401</td><td className="px-4 py-3">invalid_api_key</td><td className="px-4 py-3 font-sans">Clé inconnue, mal formée ou révoquée.</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">404</td><td className="px-4 py-3">job_not_found</td><td className="px-4 py-3 font-sans">Le job n'existe pas, ou ne vous appartient pas.</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">409</td><td className="px-4 py-3">not_cancellable</td><td className="px-4 py-3 font-sans">Le job est déjà terminé (succeeded/failed/cancelled).</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">429</td><td className="px-4 py-3">rate_limited</td><td className="px-4 py-3 font-sans">Quota dépassé. Voir l'en-tête <code>Retry-After</code>.</td></tr>
                <tr className="border-t border-border"><td className="px-4 py-3">500</td><td className="px-4 py-3">internal_error</td><td className="px-4 py-3 font-sans">Erreur côté Crawlers. Réessayez avec backoff exponentiel.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Examples */}
        <section id="examples" className="mb-16">
          <h2 className="text-2xl font-bold mb-6">7. Exemples</h2>

          <h3 className="mb-2 mt-6 font-semibold">Node.js (fetch natif)</h3>
          <Code lang="javascript">{`const KEY = process.env.CRAWLERS_API_KEY;
const BASE = "${BASE}";

async function run(feature, input) {
  // 1. créer le job
  const r = await fetch(\`\${BASE}/jobs\`, {
    method: "POST",
    headers: { "Authorization": \`Bearer \${KEY}\`, "Content-Type": "application/json" },
    body: JSON.stringify({ feature, input }),
  });
  const { id } = await r.json();

  // 2. polling
  while (true) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await fetch(\`\${BASE}/jobs/\${id}\`, { headers: { "Authorization": \`Bearer \${KEY}\` } });
    const job = await s.json();
    if (job.status === "succeeded") return job.result;
    if (job.status === "failed")    throw new Error(JSON.stringify(job.error));
  }
}

const score = await run("geo_score", { url: "https://example.com/blog/article" });
console.log(score);`}</Code>

          <h3 className="mb-2 mt-8 font-semibold">PHP (cURL)</h3>
          <Code lang="php">{`<?php
$KEY = getenv('CRAWLERS_API_KEY');
$BASE = '${BASE}';

function crawlers_run($feature, $input) {
  global $KEY, $BASE;
  $ch = curl_init("$BASE/jobs");
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $KEY", "Content-Type: application/json"],
    CURLOPT_POSTFIELDS => json_encode(["feature" => $feature, "input" => $input]),
  ]);
  $job = json_decode(curl_exec($ch), true); curl_close($ch);

  while (true) {
    sleep(3);
    $ch = curl_init("$BASE/jobs/{$job['id']}");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ["Authorization: Bearer $KEY"]]);
    $r = json_decode(curl_exec($ch), true); curl_close($ch);
    if ($r['status'] === 'succeeded') return $r['result'];
    if ($r['status'] === 'failed')    throw new RuntimeException(json_encode($r['error']));
  }
}`}</Code>

          <h3 className="mb-2 mt-8 font-semibold">Python (requests)</h3>
          <Code lang="python">{`import os, time, requests

KEY = os.environ["CRAWLERS_API_KEY"]
BASE = "${BASE}"
H = {"Authorization": f"Bearer {KEY}"}

def run(feature, input):
    r = requests.post(f"{BASE}/jobs", headers={**H, "Content-Type": "application/json"},
                      json={"feature": feature, "input": input})
    job_id = r.json()["id"]
    while True:
        time.sleep(3)
        job = requests.get(f"{BASE}/jobs/{job_id}", headers=H).json()
        if job["status"] == "succeeded": return job["result"]
        if job["status"] == "failed":    raise RuntimeError(job["error"])

print(run("geo_score", {"url": "https://example.com/blog/article"}))`}</Code>
        </section>

        {/* Limits */}
        <section id="limits" className="mb-16">
          <h2 className="text-2xl font-bold mb-4">8. Quotas &amp; limites</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li><strong>Free</strong> : 20 jobs / jour, 1 job concurrent.</li>
            <li><strong>Premium</strong> : 500 jobs / jour, 3 jobs concurrents.</li>
            <li><strong>Pro Agency</strong> : 5 000 jobs / jour, 10 jobs concurrents.</li>
            <li><strong>Pro Agency Premium</strong> : 25 000 jobs / jour, 30 jobs concurrents.</li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Les dépassements renvoient <code>429</code> avec un en-tête <code>Retry-After</code> (secondes).
          </p>
        </section>

        <footer className="mt-16 rounded-lg border border-border p-6 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Besoin d'aide pour intégrer ? Notre équipe peut vous accompagner sur les schémas d'input et le pipeline asynchrone.
          </p>
          <Button asChild variant="outline"><Link to="/contact">Nous contacter</Link></Button>
        </footer>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}
