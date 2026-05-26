import { Link } from "react-router-dom";
import DevLayout from "./DevLayout";

const DOCS = [
  { name: "Crawlers API", desc: "18 modules SEO/GEO/IA — async polling.", to: "/docs/api/crawlers", prefix: "crw_live_" },
  { name: "Marina API", desc: "Audit prospects B2B white-label.", to: "/docs/api/marina", prefix: "mk_live_" },
  { name: "Parménion API", desc: "Pull model pour tâches de contenu Autopilote.", to: "/docs/api/parmenion", prefix: "prm_live_" },
];

export default function DevDocs() {
  return (
    <DevLayout title="Documentation API">
      <div className="mb-10">
        <h1 className="text-3xl font-light tracking-tight mb-2">Documentation</h1>
        <p className="text-sm text-muted-foreground">3 APIs, 3 préfixes, un seul compte.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {DOCS.map(d => (
          <Link
            key={d.name}
            to={d.to}
            className="border border-border rounded-lg p-6 hover:border-foreground transition-colors block"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-medium">{d.name}</h2>
              <code className="text-xs text-[hsl(280_70%_60%)]">{d.prefix}…</code>
            </div>
            <p className="text-sm text-muted-foreground">{d.desc}</p>
            <div className="mt-4 text-xs text-foreground border-b border-foreground inline-block">Lire la doc →</div>
          </Link>
        ))}
      </div>

      <section className="border-t border-border pt-8">
        <h2 className="text-xl font-light mb-4">Principes communs</h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>Toutes les APIs sont <strong className="text-foreground">async par polling</strong> : POST crée un job, GET récupère le résultat.</li>
          <li>Auth : header <code className="text-[hsl(280_70%_60%)]">Authorization: Bearer &lt;clé&gt;</code> (alternative <code>x-&lt;api&gt;-key</code>).</li>
          <li>Réponses JSON, codes HTTP standards (202 created, 200 ok, 401 auth, 404 not found, 429 rate limit).</li>
          <li>Free tier : 100 jobs/mois cumulés toutes APIs confondues.</li>
          <li>Webhook callback URL au lieu de polling : <strong className="text-foreground">Sprint 2</strong>.</li>
        </ul>
      </section>
    </DevLayout>
  );
}
