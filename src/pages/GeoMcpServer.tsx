import { Header } from '@/components/Header';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { McpSessionAnimation } from '@/components/Mcp/McpSessionAnimation';
import { DataTable } from '@/components/seo/DataTable';


const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

const OUTILS: { name: string; body: string }[] = [
  {
    name: 'ai_visibility',
    body: 'Interroge les principaux moteurs génératifs sur un jeu de questions généré et rapporte les citations réellement observées de votre marque.',
  },
  {
    name: 'audit_page',
    body: 'Audite une URL : statut HTTP, canonical, titres, métadonnées, données structurées, détection de coquille JavaScript, texte extrait.',
  },
  {
    name: 'audit_site',
    body: 'Lance un audit technique et de visibilité générative complet sur un domaine crawlé.',
  },
  {
    name: 'crawl_site',
    body: 'Démarre un crawl asynchrone d’un domaine et renvoie un identifiant de job. Le résultat se lit ensuite avec get_job.',
  },
  {
    name: 'list_findings',
    body: 'Renvoie des constats normalisés : identifiant de règle stable, gravité, preuve, et disponibilité d’une correction.',
  },
  {
    name: 'get_fix',
    body: 'Renvoie la correction d’un constat, adaptée à votre stack : HTML, WordPress, Next.js ou TanStack Start.',
  },
  {
    name: 'analyze_schema',
    body: 'Valide le JSON-LD par rapport au contenu visible et signale les incohérences, pas seulement les erreurs de syntaxe.',
  },
  {
    name: 'check_indexability',
    body: 'Vérifie robots.txt, meta robots, cible canonical et chaîne HTTP d’une URL.',
  },
  {
    name: 'analyze_links',
    body: 'Graphe de liens internes d’une page ou d’un site : liens entrants, profondeur de clic, pages orphelines, verdicts sur les liens cassés.',
  },
  {
    name: 'get_job',
    body: 'Lit le statut et le résultat de tout job asynchrone. Gratuit.',
  },
];

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
    a: 'Tout client MCP parlant Streamable HTTP avec authentification OAuth 2.1, notamment Claude Desktop, Claude Code et Cursor.',
  },
  {
    q: 'Comment est-ce facturé ?',
    a: 'Les lectures et les statuts de jobs sont gratuits. Les outils qui déclenchent un crawl ou un calcul consomment d’abord le quota de votre plan, puis votre portefeuille développeur en paiement à l’usage, avec un plafond journalier.',
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
          Crawlers.fr expose son moteur de crawl, d’audit et de mesure GEO comme un serveur Model
          Context Protocol. Claude Code, Claude Desktop et Cursor peuvent vérifier si les moteurs
          génératifs citent vos pages, obtenir des constats normalisés, demander la correction
          adaptée à votre stack, puis re-mesurer pour prouver le résultat.
        </blockquote>

        <McpSessionAnimation
          windowTitle="Claude Code — serveur MCP Crawlers (GEO)"
          caption="Reproduction d’une session réelle : mesure des citations IA, correction, re-mesure."
          steps={[
            { kind: 'user', text: 'Connecte le MCP Crawlers.fr' },
            { kind: 'assistant', text: 'Je me connecte au serveur MCP Crawlers.' },
            {
              kind: 'connect',
              text: 'https://crawlers.fr/mcp · Streamable HTTP · OAuth 2.1 — connecté : 14 outils, 3 ressources',
            },
            { kind: 'user', text: 'Dis-moi si ChatGPT cite ma page tarifs.' },
            { kind: 'assistant', text: 'J’utilise l’outil ai_visibility pour mesurer tes citations dans les moteurs génératifs.' },
            {
              kind: 'tool',
              name: 'ai_visibility',
              args: '{ "url": "https://exemple.fr/tarifs", "engines": ["chatgpt", "gemini", "perplexity", "claude"] }',
            },
            {
              kind: 'dashboard',
              title: 'Résultats — ai_visibility (25 questions)',
              metrics: [
                { label: 'Taux de citation', value: '12%', tone: 'bad' },
                { label: 'ChatGPT', value: '0', tone: 'bad' },
                { label: 'Perplexity', value: '2', tone: 'warn' },
                { label: 'Concurrents cités', value: '3', tone: 'bad' },
              ],
              rows: [
                { id: 'GEO-ANSWER-001', severity: 'high', label: 'Aucune réponse directe citable' },
                { id: 'GEO-SCHEMA-014', severity: 'medium', label: 'Schema Offer/FAQPage absent' },
              ],
            },
            {
              kind: 'assistant',
              text: 'Veux-tu exporter ces données, ou que je corrige GEO-ANSWER-001 dans ton projet ?',
            },
            {
              kind: 'user',
              text: 'Corrige GEO-ANSWER-001.',
            },
            { kind: 'assistant', text: 'J’utilise l’outil get_fix pour générer le patch adapté à ta stack.' },
            {
              kind: 'tool',
              name: 'get_fix',
              args: '{ "finding_id": "GEO-ANSWER-001", "framework": "nextjs" }',
            },
            {
              kind: 'result',
              lines: [
                'patch: bloc réponse directe + 3 passages citables',
                'fichier: app/tarifs/page.tsx',
                'schema: Offer + FAQPage à ajouter',
              ],
            },
            {
              kind: 'assistant',
              text: 'Patch appliqué. Je relance ai_visibility pour vérifier que le constat disparaît.',
            },
            {
              kind: 'dashboard',
              title: 'Vérification — ai_visibility (comparaison)',
              metrics: [
                { label: 'Taux de citation', value: '12 → 34%', tone: 'good' },
                { label: 'GEO-ANSWER-001', value: 'Résolu', tone: 'good' },
                { label: 'GEO-SCHEMA-014', value: 'Ouvert', tone: 'warn' },
              ],
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
              <h3 className="text-xl font-semibold mt-6 mb-2">Des constats, pas des opinions</h3>
              <p className="text-base leading-relaxed">
                Chaque problème revient sous forme d’unité structurée : identifiant de règle,
                gravité, preuve, explication, et existence d’une correction pour votre framework.
                C’est cette structure qui le rend exploitable par du code.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Une boucle vérifiable</h3>
              <p className="text-base leading-relaxed">
                Auditer, corriger, re-auditer. L’identifiant du constat est stable : sa disparition
                est la preuve. Sans re-mesure, il n’y a pas de preuve, seulement une affirmation.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">
                Les citations IA mesurées, pas supposées
              </h3>
              <p className="text-base leading-relaxed">
                L’outil ai_visibility interroge ChatGPT, Gemini, Perplexity et Claude sur un jeu de
                questions représentatif de votre marché et rapporte les citations observées de votre
                marque, de vos concurrents et les sources citées.
              </p>
            </article>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Ce que le serveur mesure en GEO
            </h2>
            <p className="text-base leading-relaxed mb-6">
              La visibilité générative n’est pas un classement : c’est la capacité d’un moteur IA à
              vous citer quand votre marché pose une question. Le serveur la décompose en signaux
              mesurables.
            </p>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Citations observées par moteur</h3>
              <p className="text-base leading-relaxed">
                Pour chaque question du jeu de benchmark, le serveur rapporte si ChatGPT, Gemini,
                Perplexity et Claude citent votre marque, et à quelle position dans la réponse.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Sources citées et concurrents</h3>
              <p className="text-base leading-relaxed">
                Quand un moteur cite un concurrent ou un média à votre place, la source est
                enregistrée. Vous savez qui capte la citation et pourquoi il est préféré.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Détection du fan-out</h3>
              <p className="text-base leading-relaxed">
                Les moteurs génératifs décomposent une question en sous-requêtes. Le serveur détecte
                ce fan-out pour identifier les angles où votre contenu est absent, pas seulement la
                requête principale.
              </p>
            </article>
            <article className="mb-5">
              <h3 className="text-xl font-semibold mt-6 mb-2">Prérequis techniques GEO</h3>
              <p className="text-base leading-relaxed">
                Contenu servi sans JavaScript, passages citables, données structurées cohérentes,
                FAQ : les constats techniques qui bloquent la citation sont rattachés au même
                identifiant stable que le reste de l’audit.
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
            <DataTable
              caption="Indicateurs GEO mesurés par le serveur MCP et fréquence de mesure recommandée."
              columns={['Indicateur', 'Unité', 'Source de la mesure', 'Fréquence']}
              rows={[
                ['Taux de citation', '% des questions', 'Interrogation réelle des moteurs', 'Mensuelle'],
                ['Citations par moteur', 'Nombre', 'Interrogation réelle des moteurs', 'Mensuelle'],
                ['Concurrents cités', 'Nombre de domaines', 'Sources de la réponse', 'Mensuelle'],
                ['Couverture bots IA', '% du sitemap', 'Logs serveur vérifiés (rDNS, ASN)', 'Hebdomadaire'],
                ['Passages citables', 'Nombre par page', 'Analyse du HTML servi', 'À chaque audit'],
                ['Sous-questions couvertes', '% du fan-out', 'Décomposition des requêtes', 'Mensuelle'],
              ]}
            />
          </section>


          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Les outils exposés par le serveur
            </h2>
            <p className="text-base leading-relaxed mb-6">
              La disponibilité des outils dépend de votre plan et de votre portefeuille. Les
              traitements longs sont asynchrones : l’agent démarre un job, puis lit le résultat.
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
              caption="Outils du serveur MCP GEO : données renvoyées, mode d'exécution et facturation."
              columns={['Outil', 'Données renvoyées', 'Exécution', 'Facturation']}
              rows={[
                ['ai_visibility', 'Citations observées par moteur, concurrents cités, sources retenues', 'Asynchrone', 'Décompté'],
                ['audit_page', 'Statut HTTP, canonical, titres, JSON-LD, texte extrait, coquille JavaScript', 'Synchrone', 'Décompté'],
                ['audit_site', 'Constats techniques et GEO agrégés par gravité sur un domaine', 'Asynchrone', 'Décompté'],
                ['crawl_site', 'Identifiant de job, URL crawlées, statut et profondeur de clic', 'Asynchrone', 'Décompté'],
                ['list_findings', 'Constats normalisés : identifiant, gravité, preuve, correction', 'Synchrone', 'Gratuit'],
                ['get_fix', 'Patch adapté à la pile : HTML, WordPress, Next.js, TanStack Start', 'Synchrone', 'Décompté'],
                ['analyze_schema', 'Écarts entre JSON-LD et contenu visible', 'Synchrone', 'Décompté'],
                ['check_indexability', 'robots.txt, meta robots, canonical, chaîne de redirections', 'Synchrone', 'Décompté'],
                ['analyze_links', 'Liens entrants, profondeur, pages orphelines, liens cassés', 'Synchrone', 'Décompté'],
                ['get_job', 'Statut et résultat de tout job asynchrone', 'Synchrone', 'Gratuit'],
              ]}
            />
            <DataTable
              caption="Compatibilité des clients MCP avec le serveur GEO Crawlers.fr."
              columns={['Client', 'Transport', 'Authentification', 'Usage typique']}
              rows={[
                ['Claude Code', 'Streamable HTTP', 'OAuth 2.1', 'Mesure et correction dans le dépôt'],
                ['Claude Desktop', 'Streamable HTTP', 'OAuth 2.1', 'Diagnostic conversationnel'],
                ['Cursor', 'Streamable HTTP', 'OAuth 2.1', 'Correction pendant l’édition'],
                ['Client MCP conforme', 'Streamable HTTP', 'OAuth 2.1', 'Automatisation sur mesure'],
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
              <li>ai_visibility sur le domaine : quelles questions citent les concurrents ?</li>
              <li>audit_page sur la page à optimiser : structure, données structurées, texte servi.</li>
              <li>list_findings renvoie les constats : FAQ absente, contenu non citable, coquille JS.</li>
              <li>get_fix pour chaque constat, adapté au framework détecté.</li>
              <li>L’agent modifie les fichiers du dépôt.</li>
              <li>ai_visibility à nouveau : la citation apparaît ou les constats restants sont listés.</li>
            </ol>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Connexion et facturation
            </h2>
            <blockquote className="citable-passage border-l-2 border-border pl-4 text-base leading-relaxed">
              Le serveur utilise Streamable HTTP avec OAuth 2.1. Vous l’ajoutez à votre client MCP,
              vous autorisez votre compte Crawlers.fr, et les outils apparaissent dans la
              conversation. Les appels gratuits couvrent les lectures et les statuts ; les appels
              facturés puisent dans le quota de votre plan puis dans votre portefeuille à l’usage,
              avec un plafond journalier qui protège contre les boucles d’agent incontrôlées.
            </blockquote>
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
