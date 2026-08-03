import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowRight, Terminal, Key, Webhook, Languages, AlertCircle, FileCode2 } from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

const BASE = 'https://tutlimtasnjabdfhpewu.functions.supabase.co/marina';

const Code = ({ children, lang = 'bash' }: { children: string; lang?: string }) => (
  <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed">
    <code data-lang={lang}>{children}</code>
  </pre>
);

const Endpoint = ({ method, path }: { method: string; path: string }) => (
  <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
    <Badge variant="outline" className="rounded-sm border-2 px-2 py-0.5 text-xs">
      {method}
    </Badge>
    <span className="break-all">{path}</span>
  </div>
);

export default function MarinaApiDoc() {
  useCanonicalHreflang('/docs/api/marina');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: 'API Marina — Documentation officielle (Crawlers.fr)',
        description:
          "Référence complète de l'API Marina : génération de rapports SEO/GEO en marque blanche via endpoint REST, authentification par clé, polling de job, webhook callback, multilingue (FR/EN/ES).",
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
        name: 'Marina API',
        description: 'API REST de génération de rapports d\'audit SEO + GEO + IA en marque blanche.',
        programmingModel: 'REST',
        targetPlatform: 'Web',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://crawlers.fr/' },
          { '@type': 'ListItem', position: 2, name: 'API & Intégrations', item: 'https://crawlers.fr/api-integrations' },
          { '@type': 'ListItem', position: 3, name: 'API Marina', item: 'https://crawlers.fr/docs/api/marina' },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>API Marina — Documentation REST | Crawlers.fr</title>
        <meta
          name="description"
          content="Documentation complète de l'API Marina : générez des rapports SEO/GEO en marque blanche depuis votre site. Endpoint REST, authentification par clé, webhook callback, multilingue."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="API Marina — Documentation REST | Crawlers.fr" />
        <meta property="og:description" content="Référence complète de l'API Marina pour intégrer un audit SEO/GEO automatisé dans votre produit." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/docs/api/marina" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Accueil</Link> /{' '}
          <Link to="/api-integrations" className="hover:text-foreground">API & Intégrations</Link> /{' '}
          <span className="text-foreground">API Marina</span>
        </nav>

        <header className="mb-12 border-b border-border pb-8">
          <Badge variant="outline" className="mb-3 border-2">v1 · stable</Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight">API Marina</h1>
          <p className="text-lg text-muted-foreground">
            Endpoint REST pour générer un rapport d'audit SEO + GEO + IA en marque blanche, depuis n'importe quel
            site, en ~3 minutes. Conçu pour être intégré en lead-magnet sur une landing page externe, depuis un agent
            IA, ou via un workflow no-code (Make, n8n, Zapier).
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline" className="border-2">
              <Link to="/marina">
                Voir Marina <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-2">
              <a href="#quickstart">Quickstart</a>
            </Button>
          </div>
        </header>

        {/* TOC */}
        <aside className="mb-12 rounded-md border border-border p-4 text-sm">
          <p className="mb-2 font-semibold">Sommaire</p>
          <ol className="grid grid-cols-1 gap-1 text-muted-foreground sm:grid-cols-2">
            <li><a href="#quickstart" className="hover:text-foreground">1. Quickstart</a></li>
            <li><a href="#auth" className="hover:text-foreground">2. Authentification</a></li>
            <li><a href="#create-job" className="hover:text-foreground">3. Créer un rapport</a></li>
            <li><a href="#poll-job" className="hover:text-foreground">4. Récupérer le résultat</a></li>
            <li><a href="#webhook" className="hover:text-foreground">5. Webhook callback</a></li>
            <li><a href="#lang" className="hover:text-foreground">6. Langues</a></li>
            <li><a href="#management" className="hover:text-foreground">7. Lister / annuler</a></li>
            <li><a href="#errors" className="hover:text-foreground">8. Codes d'erreur</a></li>
            <li><a href="#full-example" className="hover:text-foreground">9. Exemple complet</a></li>
            <li><a href="#lovable" className="hover:text-foreground">10. Intégration Lovable</a></li>
          </ol>
        </aside>

        {/* 1. Quickstart */}
        <section id="quickstart" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <Terminal className="h-5 w-5" /> 1. Quickstart
          </h2>
          <p className="mb-4 text-muted-foreground">
            Trois appels suffisent : (1) obtenir une clé depuis le dashboard, (2) POST avec une URL cible, (3)
            polling GET jusqu'à <code className="rounded bg-muted px-1">status: "completed"</code>.
          </p>
          <Code lang="bash">{`# 1. Récupérez votre clé depuis Console → API → Marina
export MARINA_KEY="mk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 2. Lancez un audit
JOB=$(curl -s -X POST ${BASE} \\
  -H "x-marina-key: $MARINA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com","lang":"fr"}' | jq -r .job_id)

# 3. Polling toutes les 5s jusqu'à completion
while true; do
  R=$(curl -s "${BASE}?job_id=$JOB" -H "x-marina-key: $MARINA_KEY")
  echo "$R" | jq .status
  echo "$R" | jq -e '.status == "completed"' >/dev/null && break
  sleep 5
done`}</Code>
        </section>

        {/* 2. Auth */}
        <section id="auth" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <Key className="h-5 w-5" /> 2. Authentification
          </h2>
          <p className="mb-4 text-muted-foreground">
            Toutes les requêtes externes utilisent le header <code className="rounded bg-muted px-1">x-marina-key</code>.
            La clé est liée à votre compte Crawlers et hérite de votre plan (quotas, branding, langues disponibles).
          </p>
          <Code lang="http">{`POST /functions/v1/marina HTTP/1.1
Host: tutlimtasnjabdfhpewu.functions.supabase.co
x-marina-key: mk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`}</Code>
          <p className="mt-4 text-sm text-muted-foreground">
            Générer / régénérer une clé : <strong>Console → API → Marina → Générer une clé</strong>. La régénération
            invalide immédiatement l'ancienne clé.
          </p>
        </section>

        {/* 3. Create job */}
        <section id="create-job" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">3. Créer un rapport</h2>
          <Endpoint method="POST" path={BASE} />

          <h3 className="mb-2 mt-6 text-lg font-semibold">Body</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold">Champ</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 pr-4 font-semibold">Requis</th>
                  <th className="py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">url</td>
                  <td className="py-2 pr-4">string</td>
                  <td className="py-2 pr-4">oui</td>
                  <td className="py-2">URL à auditer (http ou https, page d'accueil recommandée).</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">lang</td>
                  <td className="py-2 pr-4">"fr" | "en" | "es"</td>
                  <td className="py-2 pr-4">non</td>
                  <td className="py-2">Force la langue du rapport. Auto-détectée si absent.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">callback_url</td>
                  <td className="py-2 pr-4">string (URL)</td>
                  <td className="py-2 pr-4">non</td>
                  <td className="py-2">Webhook appelé en POST à la fin du job (voir §5).</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 mt-6 text-lg font-semibold">Réponse 200 — Job créé</h3>
          <Code lang="json">{`{
  "job_id": "8f3a9b2c-1234-5678-90ab-cdef01234567",
  "status": "pending"          // ou "queued" si un autre job est en cours
  // "queue_position": 2       // présent uniquement si status === "queued"
}`}</Code>
        </section>

        {/* 4. Poll */}
        <section id="poll-job" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">4. Récupérer le résultat</h2>
          <Endpoint method="GET" path={`${BASE}?job_id={JOB_ID}`} />

          <h3 className="mb-2 mt-6 text-lg font-semibold">Réponses possibles</h3>

          <p className="mb-2 mt-4 text-sm font-semibold">En cours</p>
          <Code lang="json">{`{
  "status": "pending" | "processing",
  "progress": 42,                // pourcentage 0-100
  "phase": "audit_seo" | "cocoon" | "geo" | "rendering"
}`}</Code>

          <p className="mb-2 mt-4 text-sm font-semibold">Terminé</p>
          <Code lang="json">{`{
  "success": true,
  "status": "completed",
  "data": {
    "report_url": "https://crawlers.fr/r/8f3a9b2c-...",   // rapport HTML public
    "report_html": "<!doctype html>...",                  // optionnel
    "scores": { "seo": 78, "geo": 64, "ai_visibility": 51 },
    "completed_at": "2026-05-26T14:32:11Z"
  }
}`}</Code>

          <p className="mb-2 mt-4 text-sm font-semibold">Échec</p>
          <Code lang="json">{`{
  "success": false,
  "status": "failed",
  "error": "Crawl timeout after 180s"
}`}</Code>

          <p className="mt-4 text-sm text-muted-foreground">
            Polling recommandé : toutes les <strong>5 à 10 secondes</strong>. Durée typique d'un job : 2 à 4 minutes.
            Au-delà de 10 min sans complétion, le job est marqué <code className="rounded bg-muted px-1">failed</code> automatiquement.
          </p>
        </section>

        {/* 5. Webhook */}
        <section id="webhook" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <Webhook className="h-5 w-5" /> 5. Webhook callback (optionnel)
          </h2>
          <p className="mb-4 text-muted-foreground">
            Plutôt que de poller, fournissez un <code className="rounded bg-muted px-1">callback_url</code> à la
            création du job. Marina enverra un POST JSON à cette URL dès la complétion (succès ou échec).
          </p>
          <Code lang="json">{`POST {callback_url}
Content-Type: application/json
x-marina-event: job.completed   // ou job.failed

{
  "job_id": "8f3a9b2c-...",
  "status": "completed",
  "url": "https://example.com",
  "report_url": "https://crawlers.fr/r/8f3a9b2c-...",
  "scores": { "seo": 78, "geo": 64, "ai_visibility": 51 },
  "completed_at": "2026-05-26T14:32:11Z"
}`}</Code>
          <p className="mt-4 text-sm text-muted-foreground">
            Le webhook est appelé <strong>une seule fois</strong>, sans retry. Votre endpoint doit répondre 2xx en
            moins de 10 secondes.
          </p>
        </section>

        {/* 6. Lang */}
        <section id="lang" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <Languages className="h-5 w-5" /> 6. Langues
          </h2>
          <p className="text-muted-foreground">
            Marina supporte FR, EN, ES. Si <code className="rounded bg-muted px-1">lang</code> n'est pas fourni,
            l'algorithme analyse <code className="rounded bg-muted px-1">&lt;title&gt;</code>,{' '}
            <code className="rounded bg-muted px-1">&lt;meta description&gt;</code>, H1/H2 puis l'attribut{' '}
            <code className="rounded bg-muted px-1">&lt;html lang&gt;</code> en dernier recours. Le fallback final est{' '}
            <strong>fr</strong>.
          </p>
        </section>

        {/* 7. Management */}
        <section id="management" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">7. Lister / annuler / supprimer un job</h2>

          <p className="mb-2 mt-4 text-sm font-semibold">Lister vos jobs récents</p>
          <Code lang="bash">{`curl -X POST ${BASE} \\
  -H "x-marina-key: $MARINA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"list_jobs","limit":50}'`}</Code>

          <p className="mb-2 mt-6 text-sm font-semibold">Annuler un job en cours</p>
          <Code lang="bash">{`curl -X POST ${BASE} \\
  -H "x-marina-key: $MARINA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"cancel_job","job_id":"8f3a9b2c-..."}'`}</Code>

          <p className="mb-2 mt-6 text-sm font-semibold">Supprimer un job terminé</p>
          <Code lang="bash">{`curl -X POST ${BASE} \\
  -H "x-marina-key: $MARINA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"delete_job","job_id":"8f3a9b2c-..."}'`}</Code>
        </section>

        {/* 8. Errors */}
        <section id="errors" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <AlertCircle className="h-5 w-5" /> 8. Codes d'erreur
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold">Code</th>
                  <th className="py-2 pr-4 font-semibold">Cas</th>
                  <th className="py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">400</td>
                  <td className="py-2 pr-4">url manquante ou callback_url invalide</td>
                  <td className="py-2">Corriger le body.</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">401</td>
                  <td className="py-2 pr-4">x-marina-key absent ou invalide</td>
                  <td className="py-2">Vérifier la clé dans Console → API.</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">404</td>
                  <td className="py-2 pr-4">job_id introuvable (poll)</td>
                  <td className="py-2">Vérifier l'ID retourné par le POST initial.</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">429</td>
                  <td className="py-2 pr-4">Quota plan dépassé</td>
                  <td className="py-2">Upgrade ou attendre le reset (mensuel).</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono">500</td>
                  <td className="py-2 pr-4">Erreur interne pipeline</td>
                  <td className="py-2">Réessayer ; si persistant, contacter le support.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 9. Full example */}
        <section id="full-example" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <FileCode2 className="h-5 w-5" /> 9. Exemple complet TypeScript
          </h2>
          <Code lang="typescript">{`// marina.ts — client minimal, zéro dépendance
const MARINA_KEY = process.env.MARINA_KEY!;
const BASE = "${BASE}";

export async function auditWithMarina(url: string, lang?: "fr" | "en" | "es") {
  // 1. Créer le job
  const create = await fetch(BASE, {
    method: "POST",
    headers: { "x-marina-key": MARINA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ url, lang }),
  });
  if (!create.ok) throw new Error(\`Create failed: \${create.status}\`);
  const { job_id } = await create.json();

  // 2. Poll toutes les 5s, timeout 10 min
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(\`\${BASE}?job_id=\${job_id}\`, {
      headers: { "x-marina-key": MARINA_KEY },
    });
    const json = await poll.json();
    if (json.status === "completed") return json.data;       // { report_url, scores, ... }
    if (json.status === "failed") throw new Error(json.error);
  }
  throw new Error("Timeout");
}

// Usage
const report = await auditWithMarina("https://example.com", "fr");
console.log(report.report_url);`}</Code>
        </section>

        {/* 10. Lovable */}
        <section id="lovable" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">10. Intégration depuis Lovable / Edge Function</h2>
          <p className="mb-4 text-muted-foreground">
            Stockez <code className="rounded bg-muted px-1">MARINA_KEY</code> en secret, puis appelez l'API depuis
            une edge function. Exemple Deno :
          </p>
          <Code lang="typescript">{`// supabase/functions/audit-prospect/index.ts
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { url } = await req.json();

  const res = await fetch("${BASE}", {
    method: "POST",
    headers: {
      "x-marina-key": Deno.env.get("MARINA_KEY")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      lang: "fr",
      callback_url: \`\${Deno.env.get("SUPABASE_URL")}/functions/v1/marina-webhook\`,
    }),
  });

  const { job_id } = await res.json();
  return new Response(JSON.stringify({ job_id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});`}</Code>
        </section>

        {/* Footer CTA */}
        <div className="rounded-md border border-border p-6">
          <p className="mb-3 text-sm text-muted-foreground">
            Besoin d'aller plus loin ? Consultez la liste de toutes les intégrations API ou contactez le support.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="border-2">
              <Link to="/api-integrations">Toutes les API <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-2">
              <Link to="/aide">Centre d'aide</Link>
            </Button>
          </div>
        </div>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
