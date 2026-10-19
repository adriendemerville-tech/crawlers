import { Header } from '@/components/Header';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { McpSessionAnimation } from '@/components/Mcp/McpSessionAnimation';
import { DataTable } from '@/components/seo/DataTable';
import {
  MCP_OAUTH_TOOLS,
  MCP_SERVER_ACCESS_FR,
  MCP_SERVER_COUNT_FR,
  MCP_SERVER_ENDPOINT,
  MCP_SERVER_TOOLS,
} from '@/data/mcpPublicCatalog';


const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

const OUTILS = MCP_SERVER_TOOLS.map((tool) => ({
  name: tool.name,
  body: `${tool.summaryFr} Accès : ${MCP_SERVER_ACCESS_FR[tool.access]}.`,
}));

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Qu’est-ce qu’un serveur MCP pour le GEO ?',
    a: 'Un serveur Model Context Protocol qui expose la mesure de la visibilité IA sous forme d’outils appelables : un agent de développement peut vérifier si ChatGPT, Gemini, Perplexity ou Claude citent vos pages, puis demander les corrections et re-mesurer.',
  },
  {
    q: 'Quelle différence avec un audit GEO classique ?',
    a: 'L’audit classique produit un rapport ponctuel. Le serveur MCP rend la mesure appelable en boucle par un agent : mesurer, corriger, re-mesurer, avec un identifiant de constat stable dont la disparition prouve la résolution.',
  },
  {
    q: 'Quels clients MCP sont compatibles ?',
    a: 'Tout client MCP prenant en charge Streamable HTTP et des en-têtes d’authentification configurables, notamment Claude Desktop, Claude Code et Cursor. L’endpoint opérationnel accepte une clé Marina, pas un parcours OAuth.',
  },
  {
    q: 'Comment est-ce facturé ?',
    a: 'L’endpoint opérationnel enregistre 23 outils : 3 sans clé, 9 pour Pro Agency, 4 outils Marina, et 7 outils Search Console en lecture seule réservés aux administrateurs. Un rapport Marina coûte 5 crédits, ou est inclus avec Pro Agency actif. Un solde insuffisant renvoie JSON-RPC -32002 sans créer de job.',
  },
  {
    q: 'L’agent modifie-t-il mon site ?',
    a: 'Non. Crawlers renvoie des constats et des corrections proposées. Votre agent les applique dans votre dépôt de code ou via votre CMS connecté.',
  },
  {
    q: 'Pourquoi ne pas laisser le modèle auditer la page lui-même ?',
    a: 'Un modèle de langage ne peut pas mesurer le HTML réellement servi, le statut HTTP ni le comportement de rendu. Sans crawl, il produit des suppositions plausibles au lieu de constats vérifiables.',
  },
];

/**
 * Page française ciblant la requête « GEO MCP server » / serveur MCP pour la
 * visibilité IA. Complémentaire de la version anglaise /seo-mcp-server, avec
 * un accent sur la mesure des citations dans les moteurs génératifs.
 */
export default function GeoMcpServer() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 md:py-20" lang="fr">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">
            Accueil
          </Link>
          <span className="mx-2">/</span>
          <span aria-current="page">Serveur MCP GEO</span>
        </nav>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Serveur MCP GEO : mesurez votre visibilité IA depuis votre agent
        </h1>

        <blockquote className="citable-passage border-l-2 border-border pl-4 text-lg text-foreground/85 leading-relaxed mb-10">
          Crawlers.fr expose son moteur d’audit comme un serveur Model Context Protocol. Claude
          Code, Claude Desktop et Cursor appellent les outils enregistrés sur mcp-server : score
          GEO, visibilité LLM, audit SEO, JavaScript correctif et rapports Marina. Les noms
          ci-dessous sont ceux du code du serveur.
        </blockquote>

        <McpSessionAnimation
          windowTitle="Claude Code — serveur MCP Crawlers (GEO)"
          caption="Exemple de dialogue avec les outils réellement enregistrés. Aucun score d’exemple n’est affiché."
          steps={[
            { kind: 'user', text: 'Connecte le MCP Crawlers.fr' },
            { kind: 'assistant', text: 'Je me connecte au serveur MCP Crawlers.' },
            {
              kind: 'connect',
              text: `${MCP_SERVER_ENDPOINT} · Streamable HTTP · x-marina-key ou Authorization: Bearer — ${MCP_SERVER_COUNT_FR}`,
            },
            { kind: 'user', text: 'Dis-moi si les modèles citent ce domaine.' },
            { kind: 'assistant', text: 'J’appelle check_llm_visibility. L’outil est gratuit et attend un domain.' },
            {
              kind: 'tool',
              name: 'check_llm_visibility',
              args: '{ "domain": "exemple.fr" }',
            },
            {
              kind: 'result',
              lines: [
                'Visibilité du domaine sur ChatGPT, Gemini, Perplexity et Claude.',
                'Ce panneau illustre l’appel. Il n’affiche pas une mesure d’exemple.fr.',
              ],
            },
            { kind: 'assistant', text: 'Pour le score GEO du même domaine, l’outil enregistré est check_geo_score.' },
            {
              kind: 'tool',
              name: 'check_geo_score',
              args: '{ "domain": "exemple.fr" }',
            },
            {
              kind: 'result',
              lines: ['Score GEO de 0 à 100, renvoyé par la fonction check-geo.'],
            },
          ]}
        />

        <div className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground">
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Pourquoi un agent a besoin d’une couche de mesure GEO
            </h2>
            <p className="text-base leading-relaxed mb-6">
              Demandez à un agent IA d’« améliorer la visibilité de cette page dans ChatGPT » et il
              réécrira le texte qu’il voit. Il ne voit ni le HTML servi aux crawleurs, ni la chaîne
              HTTP, ni si un moteur génératif vous cite réellement. Un serveur MCP GEO comble ce
              fossé : l’agent cesse de deviner et commence à mesurer.
            </p>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Du JSON, pas un avis</h3>
              <p className="text-base leading-relaxed">
                Chaque outil renvoie le JSON de la fonction qu’il appelle. L’enregistrement MCP
                ne publie pas d’identifiant de règle, d’échelle de gravité ni de patch par
                framework.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Une boucle vérifiable</h3>
              <p className="text-base leading-relaxed">
                Auditer, corriger, re-auditer. On relance le même outil et on compare les JSON.
                L’enregistrement MCP ne publie pas d’identifiant de règle stable.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">
                Les citations IA mesurées, pas supposées
              </h3>
              <p className="text-base leading-relaxed">
                L’outil enregistré s’appelle check_llm_visibility. Sa description indique la
                visibilité du domaine sur ChatGPT, Gemini, Perplexity et Claude. Le score GEO
                séparé est check_geo_score (0 à 100). Les bots lus par check_ai_crawlers sont
                GPTBot, ClaudeBot et Google-Extended.
              </p>
            </article>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Ce que les outils GEO enregistrés mesurent
            </h2>
            <p className="text-base leading-relaxed mb-6">
              Trois outils gratuits portent la mesure GEO sur ce serveur. Leur contrat est celui
              de leur description enregistrée, pas un catalogue d’indicateurs supplémentaire.
            </p>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">check_geo_score</h3>
              <p className="text-base leading-relaxed">
                Score GEO de 0 à 100 pour un domaine. Aucun sous-indicateur n’est promis par
                l’enregistrement de l’outil.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">check_llm_visibility</h3>
              <p className="text-base leading-relaxed">
                Visibilité du domaine sur ChatGPT, Gemini, Perplexity et Claude. L’outil ne
                publie pas, dans son contrat, un nombre de questions ni un taux.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">check_ai_crawlers</h3>
              <p className="text-base leading-relaxed">
                Analyse des bots GPTBot, ClaudeBot et Google-Extended pour le domaine.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Audits réservés à Pro Agency</h3>
              <p className="text-base leading-relaxed">
                strategic_ai_audit couvre SEO, GEO et concurrence à partir d’une URL.
                expert_seo_audit est l’audit SEO décrit comme 200 points.
                generate_corrective_code produit du JavaScript correctif.
              </p>
            </article>
            <DataTable
              caption="Comportement des principaux moteurs génératifs vis-à-vis des sources citées."
              columns={['Moteur', 'Robot', 'Liens visibles', 'Ce qui déclenche la citation']}
              rows={[
                ['ChatGPT', 'GPTBot, OAI-SearchBot', 'Souvent', 'Passage autonome, entité claire, page servie sans JavaScript'],
                ['Perplexity', 'PerplexityBot', 'Oui', 'Correspondance directe question / passage, fraîcheur'],
                ['Gemini', 'Google-Extended', 'Parfois', 'Autorité du domaine, données structurées cohérentes'],
                ['Claude', 'ClaudeBot', 'Parfois', 'Contenu factuel daté et attribuable'],
                ['Mistral', 'MistralAI-User', 'Parfois', 'Sources francophones structurées'],
              ]}
            />
            <p className="text-sm text-foreground/70 mt-3">
              Le tableau des robots ci-dessus décrit des crawlers publics. Il ne liste pas des
              champs renvoyés par le serveur MCP.
            </p>
          </section>


          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Les outils exposés par le serveur
            </h2>
            <p className="text-base leading-relaxed mb-6">
              {MCP_SERVER_COUNT_FR} Les descriptions suivent le texte enregistré avec chaque outil.
            </p>
            <ul className="list-none p-0 grid gap-3">
              {OUTILS.map((outil) => (
                <li
                  key={outil.name}
                  className="rounded-lg border border-border bg-card/30 p-4 not-prose"
                >
                  <code className="font-semibold text-foreground">{outil.name}</code>
                  <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{outil.body}</p>
                </li>
              ))}
            </ul>
            <DataTable
              caption="Outils enregistrés sur mcp-server : description et accès, repris du code du serveur."
              columns={['Outil', 'Ce que dit l’enregistrement', 'Accès']}
              rows={MCP_SERVER_TOOLS.map((tool) => [
                tool.name,
                tool.summaryFr,
                MCP_SERVER_ACCESS_FR[tool.access],
              ])}
            />
            <h3 className="text-xl font-semibold mt-8 mb-2">Second serveur, autres outils</h3>
            <p className="text-base leading-relaxed mb-4">
              Un second serveur, <code>supabase/functions/mcp</code>, s’authentifie en OAuth 2.1.
              Ce n’est pas l’endpoint ci-dessus. Le tableau omet un outil de ce serveur dont
              l’annonce publique est reportée.
            </p>
            <DataTable
              caption="Outils enregistrés sur le serveur OAuth mcp. Un outil de ce serveur n’est pas annoncé ici."
              columns={['Outil', 'Ce que dit l’enregistrement']}
              rows={MCP_OAUTH_TOOLS.map((tool) => [tool.name, tool.summaryFr])}
            />
            <DataTable
              caption="Compatibilité des clients MCP avec le serveur GEO Crawlers.fr."
              columns={['Client', 'Transport', 'Authentification', 'Usage typique']}
              rows={[
                ['Claude Code', 'Streamable HTTP', 'Clé Marina / Bearer', 'Mesure et correction dans le dépôt'],
                ['Claude Desktop', 'Streamable HTTP', 'Clé Marina / Bearer', 'Diagnostic conversationnel'],
                ['Cursor', 'Streamable HTTP', 'Clé Marina / Bearer', 'Correction pendant l’édition'],
                ['Client MCP conforme', 'Streamable HTTP', 'Clé Marina / Bearer', 'Automatisation sur mesure'],
              ]}
            />

          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Une session typique dans Claude Code
            </h2>
            <p className="text-base leading-relaxed mb-6">
              Le développeur demande une optimisation de la visibilité IA. L’agent orchestre la
              boucle sans instruction supplémentaire.
            </p>
            <ol className="text-base leading-relaxed space-y-2">
              <li>check_llm_visibility sur le domaine (sans clé).</li>
              <li>check_geo_score sur le même domaine.</li>
              <li>expert_seo_audit sur l’URL à revoir, si le compte est Pro Agency.</li>
              <li>generate_corrective_code pour obtenir le JavaScript correctif.</li>
              <li>L’agent modifie les fichiers du dépôt. L’outil ne les déploie pas tout seul.</li>
              <li>Nouvel appel de check_llm_visibility pour comparer les JSON.</li>
            </ol>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Connexion et facturation
            </h2>
            <blockquote className="citable-passage border-l-2 border-border pl-4 text-base leading-relaxed">
              L’endpoint opérationnel est <code>POST https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/mcp-server</code>, en Streamable HTTP.
              Récupérez votre clé Marina (préfixe <code>marina_</code> ou <code>mk_live_</code>) dans Console crawlers.fr → API → Marina.
              Configurez <code>x-marina-key: &lt;clé&gt;</code> ou <code>Authorization: Bearer &lt;clé&gt;</code>.
              {MCP_SERVER_COUNT_FR} Une clé rattachée à un compte Pro Agency actif ouvre l’accès Pro ;
              calculate_cocoon_logic, wordpress_sync et measure_audit_impact exigent toujours un JWT de session.
              Marina coûte 5 crédits par rapport, ou est inclus avec Pro Agency actif.
            </blockquote>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Outils Marina via MCP
            </h2>
            <p className="text-base leading-relaxed mb-3">
              Endpoint : <code>https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/mcp-server</code>.
              En-tête : <code>x-marina-key: &lt;clé&gt;</code> ou <code>Authorization: Bearer &lt;clé&gt;</code> (Console crawlers.fr → API → Marina ; préfixes <code>marina_</code> et <code>mk_live_</code>).
            </p>
            <ul className="list-disc pl-6 space-y-1 text-base">
              <li>marina_create_report : lance un rapport SEO et GEO, renvoie un job_id.</li>
              <li>marina_get_report : avancement puis lien du rapport.</li>
              <li>marina_list_jobs : vos rapports récents.</li>
              <li>marina_export_pdf : PDF du rapport, lien valable 7 jours.</li>
            </ul>
            <p className="text-base leading-relaxed mt-3">
              5 crédits par rapport, ou inclus avec un abonnement Pro Agency actif. Sans crédits suffisants : JSON-RPC -32002, aucun job créé.
              Sans clé, seuls check_geo_score, check_llm_visibility et check_ai_crawlers sont gratuits ; Marina renvoie JSON-RPC -32001.
              Le futur proxy <code>https://crawlers.fr/functions/v1/mcp-server</code> n’est pas live : prochainement via Cloudflare (non déployé).
            </p>
          </section>

          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
              Questions fréquentes
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
              Sources et références
            </h2>
            <ul className="space-y-3 list-none p-0">
              {[
                { label: 'Spécification du Model Context Protocol', href: 'https://modelcontextprotocol.io/specification', note: 'Transport Streamable HTTP, outils, ressources et prompts.' },
                { label: 'Documentation MCP d’Anthropic', href: 'https://docs.anthropic.com/en/docs/mcp', note: 'Ajout d’un serveur MCP dans Claude Desktop et Claude Code.' },
                { label: 'OpenAI — GPTBot et robots.txt', href: 'https://platform.openai.com/docs/bots', note: 'Robots officiels d’OpenAI et règles d’accès.' },
                { label: 'Perplexity — PerplexityBot', href: 'https://docs.perplexity.ai/guides/bots', note: 'Identification et vérification du robot Perplexity.' },
                { label: 'Google — robots d’exploration', href: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers', note: 'Google-Extended et contrôle de l’usage par les modèles.' },
                { label: 'Schema.org FAQPage', href: 'https://schema.org/FAQPage', note: 'Balisage des questions-réponses reprises par les moteurs.' },
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

            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Pages liées</h2>
            <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
              {[
                { label: 'SEO avec Claude : le guide', to: '/seo-avec-claude' },
                { label: 'Visibilité IA : mesurer ses citations', to: '/visibilite-ia' },
                { label: 'API développeurs et paiement à l’usage', to: '/developers' },
                { label: 'SEO MCP Server (English)', to: '/seo-mcp-server' },
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
              Audit gratuit, sans carte bancaire, en 90 secondes
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Testez d’abord le moteur d’audit
            </h2>
            <p className="text-foreground/80 mb-6">
              Lancez sur n’importe quelle URL le même moteur que celui que votre agent appellera.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/audit-geo-seo">
                <Button variant="outline" size="lg" className="gap-2">
                  Auditer une URL
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
