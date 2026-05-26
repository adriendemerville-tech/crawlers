import { Link } from "react-router-dom";
import DevLayout from "./DevLayout";
import { SEOHead } from "@/components/SEOHead";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";

const DEVELOPERS_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://crawlers.fr/" },
      { "@type": "ListItem", position: 2, name: "Développeurs", item: "https://crawlers.fr/developers" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: "Crawlers API Platform",
    url: "https://crawlers.fr/developers",
    description:
      "3 APIs REST async pour automatiser SEO, GEO et visibilité IA : Crawlers API (18 modules), Marina API (audit B2B white-label), Parménion API (publication CMS autopilote).",
    documentation: "https://crawlers.fr/developers/docs",
    provider: { "@type": "Organization", name: "Crawlers.fr", url: "https://crawlers.fr" },
    termsOfService: "https://crawlers.fr/cgvu",
    audience: { "@type": "Audience", audienceType: "Développeurs, agences SEO, éditeurs SaaS" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Crawlers API Platform",
    description: "API REST async SEO/GEO pay-as-you-go avec 100 jobs gratuits par mois.",
    brand: { "@type": "Brand", name: "Crawlers.fr" },
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "EUR", description: "100 jobs cumulés / mois, sans carte bancaire." },
      { "@type": "Offer", name: "Pay-as-you-go", price: "0.05", priceCurrency: "EUR", description: "Tarif moyen par job, facturé au volume réel via Stripe." },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Combien coûte l'API Crawlers ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "100 jobs cumulés gratuits chaque mois, sans carte bancaire. Au-delà, pay-as-you-go à ~0,05 € par job en moyenne, facturé au volume réel via Stripe.",
        },
      },
      {
        "@type": "Question",
        name: "Quelles APIs sont disponibles ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Trois APIs REST async : Crawlers API (clé crw_live_, 18 modules SEO/GEO/IA), Marina API (clé mk_live_, audit prospects B2B white-label) et Parménion API (clé prm_live_, publication CMS autopilote).",
        },
      },
      {
        "@type": "Question",
        name: "Comment authentifier mes requêtes ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Par clé API en en-tête : Authorization: Bearer crw_live_... pour Crawlers et Parménion, x-marina-key: mk_live_... pour Marina.",
        },
      },
      {
        "@type": "Question",
        name: "Les APIs sont-elles synchrones ou asynchrones ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Toutes les APIs sont async : POST /v1/jobs renvoie un job_id, à poller jusqu'à statut completed. Pas de timeout sur les jobs longs (crawl, audit complet).",
        },
      },
    ],
  },
];

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
  useCanonicalHreflang('/developers');

  return (
    <DevLayout>
      <SEOHead
        title="API SEO & GEO pour développeurs — REST async, pay-as-you-go"
        description="3 APIs REST async (Crawlers, Marina, Parménion) pour automatiser SEO, GEO et visibilité IA. 100 jobs gratuits/mois, auth par clé, sans engagement."
        path="/developers"
      >
        {DEVELOPERS_JSON_LD.map((schema, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
        ))}
      </SEOHead>

      <section className="py-12 text-center">
        <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-6">
          L'API SEO &amp; GEO,<br />
          <span className="text-[hsl(48_95%_55%)]">en POST.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
          3 APIs REST async pour automatiser audit SEO, score GEO et visibilité IA. Auth par clé, pay-as-you-go, 100 jobs gratuits chaque mois.
        </p>
        <blockquote className="citable-passage max-w-2xl mx-auto mb-8 text-sm text-muted-foreground italic border-l-2 border-foreground/30 pl-4 text-left">
          Crawlers.fr expose sa plateforme SEO &amp; GEO via trois APIs REST asynchrones : Crawlers API (préfixe <code>crw_live_</code>, 18 modules dont audit expert, score GEO et visibilité LLM), Marina API (<code>mk_live_</code>, audit B2B white-label) et Parménion API (<code>prm_live_</code>, publication CMS pilotée par l'Autopilote).
        </blockquote>
        <div className="flex gap-3 justify-center">
          <Link to="/developers/signup" className="px-6 py-3 border border-foreground rounded text-sm font-medium hover:bg-foreground hover:text-background transition-colors">
            Créer un compte développeur
          </Link>
          <Link to="/developers/docs" className="px-6 py-3 border border-border rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
            Lire la documentation API
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
