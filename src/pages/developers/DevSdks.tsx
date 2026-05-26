import { Link } from "react-router-dom";
import DevLayout from "./DevLayout";

const SDKS = [
  {
    name: "@crawlers/sdk",
    prefix: "crw_live_",
    desc: "Client TypeScript pour la Crawlers API — 18 audits SEO/GEO/IA, polling auto, erreurs typées.",
    install: "npm install @crawlers/sdk",
    quickstart: `import { CrawlersClient } from '@crawlers/sdk';

const crawlers = new CrawlersClient({
  apiKey: process.env.CRAWLERS_API_KEY!,
});

const job = await crawlers.jobs.run({
  feature: 'geo_score',
  input: { url: 'https://example.com' },
});

console.log(job.result);

// Solde wallet
const { balance_cents, estimated_jobs_remaining } = await crawlers.wallet.balance();`,
    errors: `import {
  InsufficientBalanceError,
  RateLimitError,
  AuthenticationError,
} from '@crawlers/sdk';

try {
  await crawlers.jobs.run({ feature: 'audit_expert', input: { url } });
} catch (err) {
  if (err instanceof InsufficientBalanceError) {
    console.error('Recharger :', err.topupUrl);
  } else if (err instanceof RateLimitError) {
    console.error('Retry dans', err.retryAfterSec, 's');
  } else if (err instanceof AuthenticationError) {
    console.error('Clé API invalide');
  }
}`,
    docsLink: "/docs/api/crawlers",
  },
  {
    name: "@parmenion/sdk",
    prefix: "prm_live_",
    desc: "Worker pull-model pour l'Autopilote : récupère, ack, publie et reporte les tâches de contenu.",
    install: "npm install @parmenion/sdk",
    quickstart: `import { ParmenionClient } from '@parmenion/sdk';

const parmenion = new ParmenionClient({
  apiKey: process.env.PARMENION_API_KEY!,
});

// Worker prêt à l'emploi : poll → ack → handler → published/failed
await parmenion.runWorker(async (task) => {
  const url = await publishToYourCms(task.payload);
  return { url, cms_post_id: 'wp_42' };
});`,
    errors: `// API bas-niveau
const tasks = await parmenion.pending(10);
await parmenion.ack(tasks[0].id);

await parmenion.published(tasks[0].id, {
  url: 'https://...',
  cms_post_id: '42',
});

// ou en cas d'échec
await parmenion.failed(tasks[0].id, {
  error_message: 'CMS down',
  error_category: 'cms_unreachable',
});`,
    docsLink: "/docs/api/parmenion",
  },
];

export default function DevSdks() {
  return (
    <DevLayout
      title="SDKs TypeScript"
      description="SDKs officiels TypeScript pour les APIs Crawlers et Parménion."
    >
      <div className="mb-10">
        <h1 className="text-3xl font-light tracking-tight mb-2">SDKs TypeScript</h1>
        <p className="text-sm text-muted-foreground">
          Clients officiels typés. Zéro dépendance runtime. Node 18+, Bun, Deno, edge runtimes.
        </p>
      </div>

      <div className="space-y-12">
        {SDKS.map((sdk) => (
          <section key={sdk.name} className="border border-border rounded-lg overflow-hidden">
            <header className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-mono text-lg">{sdk.name}</h2>
                <code className="text-xs text-[hsl(280_70%_60%)]">{sdk.prefix}…</code>
              </div>
              <p className="text-sm text-muted-foreground">{sdk.desc}</p>
            </header>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Installation</h3>
                <pre className="bg-muted/30 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
                  <code>{sdk.install}</code>
                </pre>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Quickstart</h3>
                <pre className="bg-muted/30 border border-border rounded p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{sdk.quickstart}</code>
                </pre>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {sdk.name === "@crawlers/sdk" ? "Gestion des erreurs" : "API bas-niveau"}
                </h3>
                <pre className="bg-muted/30 border border-border rounded p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{sdk.errors}</code>
                </pre>
              </div>

              <div className="pt-2">
                <Link
                  to={sdk.docsLink}
                  className="text-xs border-b border-foreground hover:opacity-70 transition-opacity"
                >
                  Référence REST complète →
                </Link>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="border-t border-border mt-12 pt-8">
        <h2 className="text-xl font-light mb-4">Bonnes pratiques</h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>Stocker la clé API en variable d'environnement, jamais en clair côté client.</li>
          <li><code className="text-foreground">jobs.run()</code> = create + polling auto jusqu'à l'état terminal.</li>
          <li>Timeout par défaut : 30 s par requête, 5 min par job. Configurables via <code>timeoutMs</code> / <code>WaitOptions</code>.</li>
          <li>Pour un arrêt propre du worker Parménion : passer un <code>AbortSignal</code> via <code>runWorker(handler, &#123; signal &#125;)</code>.</li>
        </ul>
      </section>
    </DevLayout>
  );
}
