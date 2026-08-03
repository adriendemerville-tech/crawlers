import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowRight, Terminal, Key, RefreshCw, AlertCircle, FileCode2, Workflow } from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

const BASE = 'https://tutlimtasnjabdfhpewu.functions.supabase.co/parmenion-api/v1';

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

export default function ParmenionApiDoc() {
  useCanonicalHreflang('/docs/api/parmenion');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: 'API Parménion — Documentation officielle (Crawlers.fr)',
        description:
          "Référence complète de l'API Parménion : modèle pull où le site client poll les tâches de contenu planifiées par Parménion (Crawlers), les publie sur son CMS, et notifie le résultat. Auth par token, polling, ack, published, failed.",
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
        name: 'Parménion Pull API',
        description:
          "API REST en mode pull pour récupérer les tâches de contenu planifiées par l'agent SEO Parménion et confirmer leur publication.",
        programmingModel: 'REST (pull/polling)',
        targetPlatform: 'Web, CMS, Workers',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://crawlers.fr/' },
          { '@type': 'ListItem', position: 2, name: 'API & Intégrations', item: 'https://crawlers.fr/api-integrations' },
          { '@type': 'ListItem', position: 3, name: 'API Parménion', item: 'https://crawlers.fr/docs/api/parmenion' },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>API Parménion — Documentation REST (mode pull) | Crawlers.fr</title>
        <meta
          name="description"
          content="Documentation complète de l'API Parménion : votre site poll les tâches de contenu SEO planifiées, les publie sur votre CMS, et notifie le résultat. Endpoint REST, auth Bearer, codes d'erreur, exemples PHP/Node/Python."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="API Parménion — Documentation REST (pull) | Crawlers.fr" />
        <meta property="og:description" content="Référence complète de l'API Parménion pour intégrer la publication automatique de contenu SEO depuis votre propre CMS, sans donner d'accès sortants." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/docs/api/parmenion" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Accueil</Link> /{' '}
          <Link to="/api-integrations" className="hover:text-foreground">API & Intégrations</Link> /{' '}
          <span className="text-foreground">API Parménion</span>
        </nav>

        <header className="mb-12 border-b border-border pb-8">
          <Badge variant="outline" className="mb-3 border-2">v1 · stable · pull model</Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight">API Parménion</h1>
          <p className="text-lg text-muted-foreground">
            Modèle <strong>pull</strong> : votre site interroge Parménion pour récupérer les tâches de contenu SEO
            planifiées (titre, brief, HTML prêt à publier), les pousse sur votre CMS interne, puis confirme la
            publication. Vous ne donnez <strong>aucun</strong> accès sortant à Crawlers — votre site reste en
            contrôle total.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline" className="border-2">
              <Link to="/api-integrations">
                Voir toutes les API <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-2">
              <a href="#quickstart">Quickstart</a>
            </Button>
          </div>
        </header>

        {/* Architecture */}
        <section id="architecture" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <Workflow className="h-5 w-5" /> Architecture pull
          </h2>
          <p className="mb-4 text-muted-foreground">
            Contrairement au mode push (où Crawlers se connecte à votre CMS via une App Password ou clé REST),
            le mode pull inverse la relation : <strong>votre serveur appelle Crawlers</strong>, lit ses tâches,
            les exécute en local, puis renvoie le résultat. Idéal si votre infra interdit les accès sortants ou
            si vous avez un WAF/ModSecurity strict.
          </p>
          <Code lang="text">{`┌─────────────┐     1. GET /tasks/pending           ┌────────────────┐
│ Votre CMS / │ ─────────────────────────────────►  │   Parménion    │
│   Cron      │                                     │  (Crawlers.fr) │
│             │ ◄──── { tasks: [{ id, payload }] }  │                │
│             │                                     │                │
│             │     2. POST /tasks/{id}/ack         │                │
│             │ ──────────────────────────────────► │                │
│             │     3. POST /tasks/{id}/published   │                │
│             │ ──────────────────────────────────► │                │
└─────────────┘                                     └────────────────┘`}</Code>
          <p className="mt-4 text-sm text-muted-foreground">
            Cadence recommandée : <strong>1 poll toutes les 5 minutes</strong> (cron) ou{' '}
            <strong>toutes les 60 secondes</strong> (worker continu). Aucune limite côté Crawlers tant que vous
            restez sous 60 requêtes/minute.
          </p>
        </section>

        {/* TOC */}
        <aside className="mb-12 rounded-md border border-border p-4 text-sm">
          <p className="mb-2 font-semibold">Sommaire</p>
          <ol className="grid grid-cols-1 gap-1 text-muted-foreground sm:grid-cols-2">
            <li><a href="#quickstart" className="hover:text-foreground">1. Quickstart</a></li>
            <li><a href="#auth" className="hover:text-foreground">2. Authentification</a></li>
            <li><a href="#pending" className="hover:text-foreground">3. Lister les tâches en attente</a></li>
            <li><a href="#ack" className="hover:text-foreground">4. Accuser réception (ack)</a></li>
            <li><a href="#published" className="hover:text-foreground">5. Confirmer la publication</a></li>
            <li><a href="#failed" className="hover:text-foreground">6. Signaler un échec</a></li>
            <li><a href="#payload" className="hover:text-foreground">7. Structure du payload</a></li>
            <li><a href="#errors" className="hover:text-foreground">8. Codes d'erreur</a></li>
            <li><a href="#examples" className="hover:text-foreground">9. Exemples PHP / Node / Python</a></li>
            <li><a href="#wp-plugin" className="hover:text-foreground">10. Cron WordPress prêt à coller</a></li>
          </ol>
        </aside>

        {/* 1. Quickstart */}
        <section id="quickstart" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <Terminal className="h-5 w-5" /> 1. Quickstart
          </h2>
          <p className="mb-4 text-muted-foreground">
            Quatre appels suffisent : (1) récupérer votre token Parménion, (2) GET les tâches, (3) publier en
            local, (4) POST le résultat.
          </p>
          <Code lang="bash">{`# 1. Token fourni par Crawlers (admin → Mes Sites → Parménion → Générer un token)
export PRM_TOKEN="prm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 2. Récupérer les tâches en attente
curl -s "${BASE}/tasks/pending?limit=5" \\
  -H "Authorization: Bearer $PRM_TOKEN"

# 3. Pour chaque tâche : ack avant traitement
curl -s -X POST "${BASE}/tasks/<TASK_ID>/ack" \\
  -H "Authorization: Bearer $PRM_TOKEN"

# 4. Confirmer publication (ou échec)
curl -s -X POST "${BASE}/tasks/<TASK_ID>/published" \\
  -H "Authorization: Bearer $PRM_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://votresite.com/blog/nouvel-article","cms_post_id":1234}'`}</Code>
        </section>

        {/* 2. Auth */}
        <section id="auth" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <Key className="h-5 w-5" /> 2. Authentification
          </h2>
          <p className="mb-4 text-muted-foreground">
            Chaque site (domaine) a son propre token au format{' '}
            <code className="rounded bg-muted px-1">prm_live_</code> + 40 caractères hex. Deux entêtes acceptés
            (équivalents) :
          </p>
          <Code lang="http">{`# Option A (recommandée)
Authorization: Bearer prm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Option B
x-parmenion-key: prm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          <p className="mt-4 text-sm text-muted-foreground">
            Le token est lié à un <strong>domaine unique</strong>. Il ne donne accès qu'aux tâches de ce
            domaine. Régénération via le dashboard Crawlers : <strong>Console → Mes Sites → Parménion → Rotate
            token</strong>. La rotation invalide instantanément l'ancien token.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Stockage :</strong> seul le hash SHA-256 du token est gardé côté Crawlers. Si vous le
            perdez, il faut le régénérer.
          </p>
        </section>

        {/* 3. Pending */}
        <section id="pending" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">3. Lister les tâches en attente</h2>
          <Endpoint method="GET" path={`${BASE}/tasks/pending?limit=10`} />

          <h3 className="mb-2 mt-6 text-lg font-semibold">Query params</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold">Param</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 font-semibold">Défaut</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">limit</td>
                  <td className="py-2 pr-4">int 1-50</td>
                  <td className="py-2">10</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 mt-6 text-lg font-semibold">Réponse 200</h3>
          <Code lang="json">{`{
  "target": {
    "id": "f1a2b3c4-...",
    "domain": "votresite.com"
  },
  "count": 2,
  "tasks": [
    {
      "id": "8f3a9b2c-1234-5678-90ab-cdef01234567",
      "action_type": "publish_post",
      "goal": "Publier l'article pilier sur 'maintenance toiture'",
      "goal_type": "content_creation",
      "phase": "execute",
      "cycle": 12,
      "created_at": "2026-05-26T08:14:02Z",
      "payload": {
        "title": "Maintenance toiture : guide complet 2026",
        "slug": "maintenance-toiture-guide-2026",
        "html": "<h2>Pourquoi entretenir...</h2><p>...</p>",
        "excerpt": "Tout savoir sur l'entretien de votre toiture.",
        "category": "Conseils",
        "tags": ["toiture", "entretien", "maintenance"],
        "meta_title": "Maintenance toiture 2026 — Guide complet",
        "meta_description": "Guide expert pour entretenir...",
        "featured_image_url": "https://...",
        "internal_links": [{"anchor": "couverture zinc", "url": "/services/zinc"}]
      }
    }
  ]
}`}</Code>
          <p className="mt-4 text-sm text-muted-foreground">
            Les tâches sont renvoyées en FIFO (plus anciennes d'abord). Une tâche reste{' '}
            <code className="rounded bg-muted px-1">planned</code> tant qu'aucun ack n'est reçu — elle
            apparaîtra donc à chaque poll. Faites un ack dès réception pour éviter les doublons si plusieurs
            workers polls en parallèle.
          </p>
        </section>

        {/* 4. Ack */}
        <section id="ack" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">4. Accuser réception</h2>
          <Endpoint method="POST" path={`${BASE}/tasks/{id}/ack`} />
          <p className="mt-4 text-muted-foreground">
            Marque la tâche en <code className="rounded bg-muted px-1">in_progress</code> et enregistre{' '}
            <code className="rounded bg-muted px-1">execution_started_at</code>. À appeler{' '}
            <strong>immédiatement après le GET</strong> pour verrouiller la tâche.
          </p>
          <Code lang="json">{`POST ${BASE}/tasks/8f3a9b2c-.../ack
Authorization: Bearer prm_live_...

→ 200 OK
{ "ok": true, "id": "8f3a9b2c-...", "status": "in_progress" }`}</Code>
        </section>

        {/* 5. Published */}
        <section id="published" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">5. Confirmer la publication</h2>
          <Endpoint method="POST" path={`${BASE}/tasks/{id}/published`} />

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
                  <td className="py-2">URL publique finale de l'article publié.</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">cms_post_id</td>
                  <td className="py-2 pr-4">string | number</td>
                  <td className="py-2 pr-4">non</td>
                  <td className="py-2">ID du post côté CMS (utile pour update/delete ultérieurs).</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">notes</td>
                  <td className="py-2 pr-4">string</td>
                  <td className="py-2 pr-4">non</td>
                  <td className="py-2">Toute info libre (ex : "publié en brouillon, à valider").</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Code lang="json">{`POST ${BASE}/tasks/8f3a9b2c-.../published
Authorization: Bearer prm_live_...
Content-Type: application/json

{
  "url": "https://votresite.com/blog/maintenance-toiture-guide-2026",
  "cms_post_id": 1234
}

→ 200 OK
{
  "ok": true,
  "id": "8f3a9b2c-...",
  "status": "completed",
  "published_url": "https://votresite.com/..."
}`}</Code>
          <p className="mt-4 text-sm text-muted-foreground">
            Parménion utilise l'URL retournée pour vérifier l'indexation, mesurer l'impact GSC/GA4 à J+30 et
            recalibrer son scoring d'urgence. Mettez la <strong>vraie URL publique</strong>, pas l'URL admin.
          </p>
        </section>

        {/* 6. Failed */}
        <section id="failed" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">6. Signaler un échec</h2>
          <Endpoint method="POST" path={`${BASE}/tasks/{id}/failed`} />
          <Code lang="json">{`POST ${BASE}/tasks/8f3a9b2c-.../failed
Authorization: Bearer prm_live_...
Content-Type: application/json

{
  "error_message": "WordPress REST returned 403 — App Password expired",
  "error_category": "auth_failed"
}

→ 200 OK
{ "ok": true, "id": "8f3a9b2c-...", "status": "error" }`}</Code>
          <p className="mt-4 text-sm text-muted-foreground">
            Catégories suggérées : <code className="rounded bg-muted px-1">auth_failed</code>,{' '}
            <code className="rounded bg-muted px-1">cms_unavailable</code>,{' '}
            <code className="rounded bg-muted px-1">validation_failed</code>,{' '}
            <code className="rounded bg-muted px-1">duplicate_slug</code>,{' '}
            <code className="rounded bg-muted px-1">client_failure</code> (défaut).
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Trois échecs successifs sur le même domaine déclenchent le <strong>backlog guard</strong> côté
            Parménion : les cycles suivants sont mis en pause jusqu'à intervention manuelle dans la console.
          </p>
        </section>

        {/* 7. Payload */}
        <section id="payload" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">7. Structure du payload</h2>
          <p className="mb-4 text-muted-foreground">
            Le champ <code className="rounded bg-muted px-1">payload</code> est un objet JSON libre dont les
            clés varient selon <code className="rounded bg-muted px-1">action_type</code>. Voici la convention
            pour les actions de contenu :
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold">action_type</th>
                  <th className="py-2 font-semibold">Clés du payload</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">publish_post</td>
                  <td className="py-2">title, slug, html, excerpt, category, tags[], meta_title, meta_description, featured_image_url, internal_links[]</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">update_post</td>
                  <td className="py-2">cms_post_id, html, meta_title?, meta_description?, change_summary</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">create_seo_page</td>
                  <td className="py-2">title, slug, html, meta_title, meta_description, schema_jsonld, page_type</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">add_internal_links</td>
                  <td className="py-2">cms_post_id, links[]: {`{ anchor, target_url, insert_after_paragraph }`}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Le HTML fourni est <strong>déjà sanitisé</strong> (DOMPurify côté Crawlers), prêt à insérer dans le
            corps de l'article sans transformation. Conservez la structure des
            <code className="rounded bg-muted px-1">&lt;h2&gt;</code>/
            <code className="rounded bg-muted px-1">&lt;h3&gt;</code> : elle conditionne le scoring SEO.
          </p>
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
                  <th className="py-2 pr-4 font-semibold">error</th>
                  <th className="py-2 font-semibold">Cas</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">400</td>
                  <td className="py-2 pr-4 font-mono">invalid_body</td>
                  <td className="py-2">JSON malformé ou champ requis manquant (ex : `url` sur /published).</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">401</td>
                  <td className="py-2 pr-4 font-mono">missing_token</td>
                  <td className="py-2">Aucun header Authorization ni x-parmenion-key.</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">401</td>
                  <td className="py-2 pr-4 font-mono">invalid_token</td>
                  <td className="py-2">Token inconnu, révoqué, ou cible désactivée.</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">404</td>
                  <td className="py-2 pr-4 font-mono">not_found</td>
                  <td className="py-2">Task ID inconnu ou n'appartient pas au domaine du token.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono">500</td>
                  <td className="py-2 pr-4 font-mono">db_error</td>
                  <td className="py-2">Erreur interne — réessayer ; si persistant, contacter le support.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 9. Examples */}
        <section id="examples" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <FileCode2 className="h-5 w-5" /> 9. Exemples
          </h2>

          <p className="mb-2 mt-4 text-sm font-semibold">Node.js (zéro dépendance)</p>
          <Code lang="typescript">{`// parmenion-pull.ts — à exécuter en cron toutes les 5 min
const TOKEN = process.env.PRM_TOKEN!;
const BASE = "${BASE}";
const h = { Authorization: \`Bearer \${TOKEN}\`, "Content-Type": "application/json" };

async function publishToMyCms(payload: any): Promise<{ url: string; id: number }> {
  // → votre logique CMS interne ici
  return { url: "https://votresite.com/blog/" + payload.slug, id: Date.now() };
}

const { tasks } = await fetch(\`\${BASE}/tasks/pending?limit=5\`, { headers: h }).then((r) => r.json());

for (const task of tasks) {
  await fetch(\`\${BASE}/tasks/\${task.id}/ack\`, { method: "POST", headers: h });
  try {
    const { url, id } = await publishToMyCms(task.payload);
    await fetch(\`\${BASE}/tasks/\${task.id}/published\`, {
      method: "POST", headers: h,
      body: JSON.stringify({ url, cms_post_id: id }),
    });
  } catch (e: any) {
    await fetch(\`\${BASE}/tasks/\${task.id}/failed\`, {
      method: "POST", headers: h,
      body: JSON.stringify({ error_message: e.message, error_category: "client_failure" }),
    });
  }
}`}</Code>

          <p className="mb-2 mt-6 text-sm font-semibold">PHP (compatible Laravel / WordPress)</p>
          <Code lang="php">{`<?php
$token = getenv('PRM_TOKEN');
$base  = '${BASE}';
$opts  = ['http' => ['header' => "Authorization: Bearer $token\\r\\nContent-Type: application/json\\r\\n"]];

$res = json_decode(file_get_contents("$base/tasks/pending?limit=5", false, stream_context_create($opts)), true);

foreach ($res['tasks'] as $task) {
  // 1. ack
  file_get_contents("$base/tasks/{$task['id']}/ack", false, stream_context_create([
    'http' => ['method' => 'POST'] + $opts['http']
  ]));

  // 2. publier localement (wp_insert_post, Eloquent, etc.)
  $url = my_cms_publish($task['payload']);   // ← votre fonction

  // 3. confirmer
  $body = json_encode(['url' => $url]);
  file_get_contents("$base/tasks/{$task['id']}/published", false, stream_context_create([
    'http' => ['method' => 'POST', 'content' => $body] + $opts['http']
  ]));
}`}</Code>

          <p className="mb-2 mt-6 text-sm font-semibold">Python (requests)</p>
          <Code lang="python">{`import os, requests
TOKEN = os.environ["PRM_TOKEN"]
BASE = "${BASE}"
H = {"Authorization": f"Bearer {TOKEN}"}

tasks = requests.get(f"{BASE}/tasks/pending?limit=5", headers=H).json()["tasks"]

for t in tasks:
    requests.post(f"{BASE}/tasks/{t['id']}/ack", headers=H)
    try:
        url, post_id = my_cms_publish(t["payload"])  # ← votre fonction
        requests.post(f"{BASE}/tasks/{t['id']}/published",
                      headers=H, json={"url": url, "cms_post_id": post_id})
    except Exception as e:
        requests.post(f"{BASE}/tasks/{t['id']}/failed",
                      headers=H, json={"error_message": str(e), "error_category": "client_failure"})`}</Code>
        </section>

        {/* 10. WP plugin */}
        <section id="wp-plugin" className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <RefreshCw className="h-5 w-5" /> 10. Cron WordPress prêt à coller
          </h2>
          <p className="mb-4 text-muted-foreground">
            Coller dans <code className="rounded bg-muted px-1">wp-content/mu-plugins/parmenion-pull.php</code> —
            aucun plugin externe requis. Tourne toutes les 5 min via WP-Cron.
          </p>
          <Code lang="php">{`<?php
/**
 * Plugin Name: Parménion Pull (Crawlers)
 * Description: Poll Parménion toutes les 5 min et publie les articles planifiés.
 */
define('PRM_TOKEN', 'prm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
define('PRM_BASE',  '${BASE}');

add_filter('cron_schedules', fn($s) => $s + ['every_5min' => ['interval' => 300, 'display' => '5 min']]);

register_activation_hook(__FILE__, fn() =>
  wp_next_scheduled('prm_pull_cron') || wp_schedule_event(time(), 'every_5min', 'prm_pull_cron'));

add_action('prm_pull_cron', function () {
  $h = ['headers' => ['Authorization' => 'Bearer ' . PRM_TOKEN, 'Content-Type' => 'application/json']];
  $r = wp_remote_get(PRM_BASE . '/tasks/pending?limit=5', $h);
  if (is_wp_error($r)) return;
  $tasks = json_decode(wp_remote_retrieve_body($r), true)['tasks'] ?? [];

  foreach ($tasks as $t) {
    wp_remote_post(PRM_BASE . "/tasks/{$t['id']}/ack", $h);
    $p = $t['payload'];
    $post_id = wp_insert_post([
      'post_title'    => $p['title'],
      'post_name'     => $p['slug'],
      'post_content'  => $p['html'],
      'post_excerpt'  => $p['excerpt'] ?? '',
      'post_status'   => 'publish',
      'post_type'     => 'post',
      'tags_input'    => $p['tags'] ?? [],
    ], true);

    if (is_wp_error($post_id)) {
      wp_remote_post(PRM_BASE . "/tasks/{$t['id']}/failed", $h + [
        'body' => json_encode(['error_message' => $post_id->get_error_message(), 'error_category' => 'cms_unavailable']),
      ]);
      continue;
    }

    if (!empty($p['meta_title']))       update_post_meta($post_id, '_yoast_wpseo_title', $p['meta_title']);
    if (!empty($p['meta_description'])) update_post_meta($post_id, '_yoast_wpseo_metadesc', $p['meta_description']);

    wp_remote_post(PRM_BASE . "/tasks/{$t['id']}/published", $h + [
      'body' => json_encode(['url' => get_permalink($post_id), 'cms_post_id' => $post_id]),
    ]);
  }
});`}</Code>
        </section>

        <div className="rounded-md border border-border p-6">
          <p className="mb-3 text-sm text-muted-foreground">
            Besoin d'un autre modèle ? Crawlers supporte aussi le mode <strong>push</strong> (Parménion se
            connecte directement à votre CMS via App Password WordPress, REST custom, Webflow, Shopify…) — voir
            la liste complète des intégrations.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="border-2">
              <Link to="/api-integrations">Toutes les API <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-2">
              <Link to="/docs/api/marina">API Marina</Link>
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
