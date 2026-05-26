import { Link } from "react-router-dom";
import DevLayout from "./DevLayout";

const APIS = [
  {
    name: "Crawlers API",
    prefix: "crw_live_",
    desc: "18 modules SEO/GEO/IA (audit expert, machine layer, E-E-A-T, crawl, GEO score, visibilité LLM, concurrents…).",
    docs: "/docs/api/crawlers",
    sample: `curl -X POST https://api.crawlers.fr/v1/jobs \\
  -H "Authorization: Bearer crw_live_..." \\
  -d '{"feature":"geo_score","input":{"url":"https://exemple.fr"}}'`,
  },
  {
    name: "Marina API",
    prefix: "mk_live_",
    desc: "Audit prospects B2B (identité, digital, stratégie) — white-label, fan-out clusters, livraison HTML.",
    docs: "/docs/api/marina",
    sample: `curl -X POST https://api.crawlers.fr/marina/v1/audits \\
  -H "x-marina-key: mk_live_..." \\
  -d '{"domain":"prospect.com","services":["identity","digital","strategy"]}'`,
  },
  {
    name: "Parménion API",
    prefix: "prm_live_",
    desc: "Pull model : récupère les tâches de contenu pré-validées par l'Autopilote, publie côté CMS, renvoie l'URL.",
    docs: "/docs/api/parmenion",
    sample: `curl https://api.crawlers.fr/parmenion-api/v1/tasks/pending \\
  -H "Authorization: Bearer prm_live_..."`,
  },
];

export default function DevLanding() {
  return (
    <DevLayout title="API Platform" description="3 APIs REST async pour automatiser le SEO/GEO programmatiquement. Pay-as-you-go, 100 jobs/mois gratuits.">
      <section className="py-12 text-center">
        <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-6">
          Le SEO/GEO,<br />
          <span className="text-[hsl(48_95%_55%)]">en POST.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          3 APIs REST async. Auth par clé. Pay-as-you-go. 100 jobs gratuits chaque mois.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/developers/signup" className="px-6 py-3 border border-foreground rounded text-sm font-medium hover:bg-foreground hover:text-background transition-colors">
            Créer un compte
          </Link>
          <Link to="/developers/docs" className="px-6 py-3 border border-border rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
            Lire les docs
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6 mt-16">
        {APIS.map(api => (
          <div key={api.name} className="border border-border rounded-lg p-6 hover:border-foreground transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-medium">{api.name}</h2>
              <code className="text-xs text-[hsl(280_70%_60%)]">{api.prefix}…</code>
            </div>
            <p className="text-sm text-muted-foreground mb-4 min-h-[60px]">{api.desc}</p>
            <pre className="text-[10px] bg-muted/40 border border-border rounded p-3 overflow-x-auto mb-4 font-mono leading-relaxed">
              {api.sample}
            </pre>
            <Link to={api.docs} className="text-xs text-foreground border-b border-foreground hover:opacity-70">
              Documentation →
            </Link>
          </div>
        ))}
      </section>

      <section className="mt-20 border-t border-border pt-12">
        <h2 className="text-2xl font-light mb-8">Tarification</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div className="border border-border rounded p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Free</div>
            <div className="text-3xl font-light mb-1">0 €</div>
            <div className="text-muted-foreground text-xs mb-4">/ mois</div>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li>100 jobs cumulés / mois</li>
              <li>Sans carte bancaire</li>
              <li>Toutes les APIs</li>
            </ul>
          </div>
          <div className="border border-foreground rounded p-6">
            <div className="text-xs uppercase tracking-wider text-[hsl(48_95%_55%)] mb-2">Pay-as-you-go</div>
            <div className="text-3xl font-light mb-1">~0,05 €</div>
            <div className="text-muted-foreground text-xs mb-4">/ job moyen</div>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li>Facturé au volume réel</li>
              <li>Pas d'engagement</li>
              <li>Facture Stripe mensuelle</li>
            </ul>
          </div>
          <div className="border border-border rounded p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Packs</div>
            <div className="text-3xl font-light mb-1">Bientôt</div>
            <div className="text-muted-foreground text-xs mb-4">Crédits prépayés</div>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li>1k / 10k / 100k jobs</li>
              <li>Remise dégressive</li>
              <li>Roll-over 12 mois</li>
            </ul>
          </div>
        </div>
      </section>
    </DevLayout>
  );
}
