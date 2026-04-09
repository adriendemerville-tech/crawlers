import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Check, X, ArrowRight, Brain, Bot, Zap, Shield, Globe,
  Database, Code, BarChart3, AlertTriangle, Cpu, Network,
  Target, Layers, Lock, Activity, Server, Wallet,
  CheckCircle2, XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { t3 } from '@/utils/i18n';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const SITE_URL = 'https://crawlers.fr';

/* ── Anthracite palette ── */
const A = {
  heading: 'text-[#2d2d2d] dark:text-neutral-100',
  body: 'text-[#4a4a4a] dark:text-neutral-300',
  muted: 'text-[#6b6b6b] dark:text-neutral-400',
  accent: 'text-[#3d3d3d] dark:text-neutral-200',
  cardBg: 'bg-[#fafafa] dark:bg-neutral-900 border-[#e5e5e5] dark:border-neutral-700',
  iconBg: 'bg-[#ededed] dark:bg-neutral-800',
  iconColor: 'text-[#3d3d3d] dark:text-neutral-300',
  sectionAlt: 'bg-[#f7f7f7] dark:bg-neutral-900/50',
  ctaBg: 'bg-[#2d2d2d] dark:bg-neutral-800 hover:bg-[#1a1a1a] dark:hover:bg-neutral-700 text-white',
  separator: 'border-[#e5e5e5] dark:border-neutral-700',
  badge: 'border-[#d1d1d1] dark:border-neutral-600 bg-[#f5f5f5] dark:bg-neutral-800 text-[#4a4a4a] dark:text-neutral-300',
  crawlers: 'text-[#2d2d2d] dark:text-white font-bold',
  claude: 'text-[#6b6b6b] dark:text-neutral-400',
};

/* ── Structured Data ── */
const articleSD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Claude Cowork + Code + MCP vs Crawlers.fr : Comparatif Complet 2026",
  "description": "Comparaison sans concession entre le stack Claude (Cowork, Code, MCP) et Crawlers.fr pour le SEO/GEO freelance. 29€/mois vs 20$/mois + hallucinations.",
  "author": { "@type": "Person", "name": "Adrien de Volontat", "url": `${SITE_URL}/a-propos` },
  "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": SITE_URL },
  "datePublished": "2026-04-09",
  "dateModified": "2026-04-09",
  "wordCount": 4200,
  "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/comparatif-claude-vs-crawlers` },
};

const breadcrumbSD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE_URL },
    { "@type": "ListItem", "position": 2, "name": "Comparatifs" },
    { "@type": "ListItem", "position": 3, "name": "Claude vs Crawlers", "item": `${SITE_URL}/comparatif-claude-vs-crawlers` },
  ],
};

const comparisonRows: Array<{
  criterion: string;
  crawlers: string;
  claude: string;
  crawlersOk: boolean;
  claudeOk: boolean;
}> = [
  { criterion: "Crawl propriétaire des pages", crawlers: "Oui — crawl réel HTTP + parsing DOM", claude: "Non — s'appuie sur ce que le LLM « sait »", crawlersOk: true, claudeOk: false },
  { criterion: "Connexion GSC / GA4 / Ads / GTM", crawlers: "Native, données en temps réel", claude: "Aucune intégration Google", crawlersOk: true, claudeOk: false },
  { criterion: "Analyse des logs serveur", crawlers: "Détection réelle des bots IA", claude: "Impossible — pas d'accès aux logs", crawlersOk: true, claudeOk: false },
  { criterion: "Génération de code correctif", crawlers: "JSON-LD, robots.txt, meta tags prêts à déployer", claude: "Code générique, souvent hallucinations", crawlersOk: true, claudeOk: false },
  { criterion: "Audit GEO (visibilité IA)", crawlers: "Score 0-100, 4 LLMs testés en parallèle", claude: "Estimations sans vérification", crawlersOk: true, claudeOk: false },
  { criterion: "Cocon sémantique 3D", crawlers: "Visualisation + déploiement automatique", claude: "Suggestions textuelles uniquement", crawlersOk: true, claudeOk: false },
  { criterion: "Plafonnement des requêtes", crawlers: "Quotas transparents, jamais de coupure surprise", claude: "Plafonds silencieux, coupures sans prévenir", crawlersOk: true, claudeOk: false },
  { criterion: "Intégrations CMS (WordPress, Shopify)", crawlers: "Push one-click vers le CMS", claude: "Copier-coller manuel", crawlersOk: true, claudeOk: false },
  { criterion: "Rapports clients marque blanche", crawlers: "PDF + lien partageable brandé", claude: "Aucun — tout est à construire", crawlersOk: true, claudeOk: false },
  { criterion: "Tarif mensuel freelance", crawlers: "29€/mois tout inclus", claude: "20$/mois Pro + API + temps perdu", crawlersOk: true, claudeOk: false },
  { criterion: "Temps de setup", crawlers: "0 — connectez l'URL, c'est parti", claude: "Heures de prompting et d'automation", crawlersOk: true, claudeOk: false },
  { criterion: "Compréhension du contexte métier", crawlers: "Données réelles GSC + secteur détecté", claude: "Contexte limité à la fenêtre de chat", crawlersOk: true, claudeOk: false },
  { criterion: "Suivi dans le temps (monitoring)", crawlers: "Historique, anomalies, alertes automatiques", claude: "Aucune mémoire entre sessions", crawlersOk: true, claudeOk: false },
  { criterion: "Conformité RGPD", crawlers: "Hébergement EU, RLS, données chiffrées", claude: "Données envoyées à Anthropic (US)", crawlersOk: true, claudeOk: false },
];

function CompRow({ row, index }: { row: typeof comparisonRows[0]; index: number }) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.03 }}
      className={`border-b ${A.separator} ${index % 2 === 0 ? '' : A.sectionAlt}`}
    >
      <td className={`py-3 px-4 text-sm font-medium ${A.heading}`}>{row.criterion}</td>
      <td className="py-3 px-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span className={`text-sm ${A.body}`}>{row.crawlers}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-400 dark:text-red-500 shrink-0 mt-0.5" />
          <span className={`text-sm ${A.muted}`}>{row.claude}</span>
        </div>
      </td>
    </motion.tr>
  );
}

export default function ComparatifClaudeVsCrawlers() {
  const { language } = useLanguage();
  useCanonicalHreflang('/comparatif-claude-vs-crawlers');

  return (
    <>
      <Helmet>
        <title>Claude Cowork + Code vs Crawlers.fr — Comparatif SEO/GEO 2026</title>
        <meta name="description" content="Claude Cowork, Claude Code et MCP vs Crawlers.fr : comparatif détaillé pour freelances SEO. 14 critères, tarifs, limites, intégrations. Pourquoi 29€/mois de Crawlers remplace votre stack Claude." />
        <link rel="canonical" href={`${SITE_URL}/comparatif-claude-vs-crawlers`} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:title" content="Claude vs Crawlers.fr — Le vrai comparatif SEO/GEO 2026" />
        <meta property="og:description" content="14 critères passés au crible. Pourquoi le stack Claude ne remplace pas un outil qui crawle, connecte Google et audite vraiment." />
        <meta property="og:url" content={`${SITE_URL}/comparatif-claude-vs-crawlers`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Claude vs Crawlers.fr — Le vrai comparatif SEO/GEO 2026" />
        <meta name="twitter:description" content="14 critères passés au crible. Pourquoi 29€/mois de Crawlers remplacent votre stack Claude." />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="author" content="Adrien de Volontat" />
        <script type="application/ld+json">{JSON.stringify(articleSD)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSD)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main>
          {/* ── Hero ── */}
          <section className="pt-20 pb-16 px-4">
            <div className="mx-auto max-w-4xl text-center">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm mb-6 ${A.badge}`}>
                  <Target className="h-4 w-4" />
                  <span>Comparatif 2026</span>
                </div>
                <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6 ${A.heading}`}>
                  Stack Claude <span className={A.muted}>(Cowork + Code + MCP)</span>
                  <br />
                  <span className={A.muted}>vs</span> Crawlers.fr
                </h1>
                <p className={`text-lg max-w-2xl mx-auto mb-4 ${A.body}`}>
                  Claude est un cerveau brillant. Mais un cerveau sans jambes pour parcourir le web, sans mains pour saisir les données, et sans doigts pour décortiquer le code — c'est un <strong className={A.accent}>cerveau hors sol</strong>, peu digne de confiance pour auditer votre SEO.
                </p>
                <p className={`text-base max-w-xl mx-auto mb-8 ${A.muted}`}>
                  Pour 29€/mois, Crawlers remplace votre abonnement Claude Pro, vos heures de prompting et vos copier-coller. Voici pourquoi.
                </p>
              </motion.div>
            </div>
          </section>

          {/* ── Le problème Claude ── */}
          <section className={`py-16 px-4 ${A.sectionAlt}`}>
            <div className="mx-auto max-w-3xl">
              <h2 className={`text-2xl sm:text-3xl font-bold mb-8 ${A.heading}`}>
                Le problème avec la « vibe SEO » à la Claude
              </h2>
              
              <div className="space-y-6">
                <Card className={A.cardBg}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${A.iconBg} shrink-0`}>
                        <AlertTriangle className={`h-5 w-5 ${A.iconColor}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold mb-2 ${A.heading}`}>Claude plafonne vos requêtes sans prévenir</h3>
                        <p className={`text-sm ${A.body}`}>
                          En plein audit client, Claude décide que vous avez trop parlé. Rate limit. Session perdue. Contexte oublié.
                          Crawlers ne vous coupe jamais en plein travail — vos quotas sont transparents et réinitialisés le 1er du mois.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={A.cardBg}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${A.iconBg} shrink-0`}>
                        <Brain className={`h-5 w-5 ${A.iconColor}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold mb-2 ${A.heading}`}>Claude nécessite de comprendre les automations</h3>
                        <p className={`text-sm ${A.body}`}>
                          MCP, prompts système, chaînes d'outils… Vous passez des heures à construire ce que Crawlers a déjà intégré.
                          207 Edge Functions, 13 agents autonomes, zéro configuration de votre côté.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={A.cardBg}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${A.iconBg} shrink-0`}>
                        <Database className={`h-5 w-5 ${A.iconColor}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold mb-2 ${A.heading}`}>L'IA juge de l'IA qui juge de l'IA</h3>
                        <p className={`text-sm ${A.body}`}>
                          Claude n'interroge jamais les micro-données brutes : celles du code, celles des audiences, celles des utilisateurs.
                          Il <em>déduit</em>. Il <em>suppose</em>. Il ne <em>vérifie</em> rien. Crawlers crawle, connecte, mesure — puis fait appel à l'IA pour analyser des <strong>données réelles</strong>.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={A.cardBg}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${A.iconBg} shrink-0`}>
                        <Wallet className={`h-5 w-5 ${A.iconColor}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold mb-2 ${A.heading}`}>Le vrai coût du stack Claude pour un freelance</h3>
                        <p className={`text-sm ${A.body}`}>
                          Claude Pro : 20$/mois. Claude Code API : variable. Temps de prompting : 2-4h par audit. Temps de vérification des hallucinations : incalculable.
                          <br /><strong className={A.accent}>Crawlers Pro Agency : 29€/mois. Temps d'audit : 30 secondes. Hallucinations : 0.</strong>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* ── Tableau comparatif ── */}
          <section className="py-16 px-4">
            <div className="mx-auto max-w-5xl">
              <h2 className={`text-2xl sm:text-3xl font-bold mb-3 text-center ${A.heading}`}>
                14 critères passés au crible
              </h2>
              <p className={`text-center mb-10 ${A.muted}`}>
                Ce que Claude Cowork + Code + MCP ne peut pas faire — et que Crawlers fait nativement.
              </p>

              <div className="overflow-x-auto rounded-lg border border-[#e5e5e5] dark:border-neutral-700">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#f0f0f0] dark:bg-neutral-800">
                      <th className={`py-3 px-4 text-sm font-semibold ${A.heading}`}>Critère</th>
                      <th className={`py-3 px-4 text-sm font-semibold ${A.heading}`}>
                        <span className="flex items-center gap-1.5">
                          <Bot className="h-4 w-4" /> Crawlers.fr
                        </span>
                      </th>
                      <th className={`py-3 px-4 text-sm font-semibold ${A.muted}`}>
                        <span className="flex items-center gap-1.5">
                          <Brain className="h-4 w-4" /> Claude Stack
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row, i) => (
                      <CompRow key={row.criterion} row={row} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Cerveau sans membres ── */}
          <section className={`py-16 px-4 ${A.sectionAlt}`}>
            <div className="mx-auto max-w-3xl">
              <h2 className={`text-2xl sm:text-3xl font-bold mb-6 ${A.heading}`}>
                Un cerveau sans membres ne fait pas un audit
              </h2>
              <div className={`space-y-4 ${A.body}`}>
                <p>
                  La plupart des nouveaux outils SEO/GEO ne sont pas fiables parce qu'ils ne crawlent pas les sites. Ils s'appuient uniquement sur la réponse des LLMs, sans pouvoir mesurer la profondeur du crawl du LLM en question.
                </p>
                <p>
                  <strong className={A.accent}>Crawlers crawle lui-même les pages</strong> pour s'assurer concrètement que les audits n'oublient rien. L'IA est une couche d'intelligence ultra sophistiquée — mais un cerveau sans jambes pour voyager, sans mains pour saisir les données, et sans doigts pour décortiquer le code et la data, c'est un cerveau hors sol.
                </p>
                <p>
                  Quel est véritablement le gain si, in fine, il faut autant de temps pour auditer la méthode que de temps gagné en audit et en recommandations ?
                </p>
                <p>
                  De même, les benchmarks de visibilité qui ne croisent pas avec les logs ne détectent pas vraiment les crawls des bots de ChatGPT, Gemini et de leurs concurrents. Ils essaient de les <em>déduire</em>.
                </p>
                <p className={`border-l-2 border-[#c4c4c4] dark:border-neutral-600 pl-4 italic ${A.muted}`}>
                  À l'ère de l'explosion du contenu, la précision de la méthode et de la stratégie fait la différence entre les experts qui traitent du volume et ceux qui créent de la valeur pour leurs clients — en leur permettant de s'élever au-dessus de la mêlée.
                </p>
              </div>
            </div>
          </section>

          {/* ── Les données de Dieu le Père ── */}
          <section className="py-16 px-4">
            <div className="mx-auto max-w-3xl">
              <h2 className={`text-2xl sm:text-3xl font-bold mb-6 ${A.heading}`}>
                Tout outil qui ne se connecte pas à Google se prive de l'essentiel
              </h2>
              <div className={`space-y-4 ${A.body}`}>
                <p>
                  La vraie différence de Crawlers, c'est qu'il va chercher les données de la source primaire : <strong className={A.accent}>Google</strong>. Tout outil qui ne demande pas à se connecter à GSC, GA4, GTM et Ads est un outil qui se prive des meilleures données en temps réel — celles des utilisateurs finaux, et de la conversion.
                </p>
                <p>
                  Claude Cowork ne se connecte à rien. Claude Code peut lancer des scripts — mais il ne sait pas quoi mesurer, parce qu'il n'a pas accès à vos données Google. Claude MCP ouvre des portes, certes — mais combien d'heures pour configurer ce que Crawlers offre clé en main ?
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
                  {[
                    { name: 'GSC', desc: 'Clics, impressions, positions réelles' },
                    { name: 'GA4', desc: 'Audiences, conversions, parcours' },
                    { name: 'GTM', desc: 'Tags, déclencheurs, conformité' },
                    { name: 'Ads', desc: 'CPC, qualité, budget SEA→SEO' },
                  ].map(g => (
                    <Card key={g.name} className={A.cardBg}>
                      <CardContent className="p-4 text-center">
                        <div className={`text-lg font-bold mb-1 ${A.heading}`}>{g.name}</div>
                        <p className={`text-xs ${A.muted}`}>{g.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p className={A.muted}>
                  Claude est un surhomme. Crawlers est une armée de plusieurs légions. Ceux qui confient leur SEO/GEO à un assistant IA gagnent de la vitesse sur les tâches, mais perdent en précision partout ailleurs.
                </p>
              </div>
            </div>
          </section>

          {/* ── Sources & Liens ── */}
          <section className={`py-12 px-4 ${A.sectionAlt}`}>
            <div className="mx-auto max-w-3xl">
              <h2 className={`text-xl font-bold mb-6 ${A.heading}`}>Sources & Ressources</h2>
              <div className="grid gap-3 sm:grid-cols-2 mb-8">
                {[
                  { title: 'Anthropic — Claude Pricing', url: 'https://www.anthropic.com/pricing' },
                  { title: 'Anthropic — Claude Code Documentation', url: 'https://docs.anthropic.com/en/docs/claude-code' },
                  { title: 'Model Context Protocol (MCP)', url: 'https://modelcontextprotocol.io/' },
                  { title: 'Google Search Central — Crawling', url: 'https://developers.google.com/search/docs/crawling-indexing' },
                  { title: 'Schema.org — Structured Data', url: 'https://schema.org/docs/gs.html' },
                  { title: 'Google — Core Web Vitals', url: 'https://web.dev/articles/vitals' },
                ].map(s => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${A.separator} hover:bg-[#f0f0f0] dark:hover:bg-neutral-800 transition-colors`}>
                    <Globe className="h-4 w-4 text-[#6b6b6b] shrink-0 mt-0.5" />
                    <span className={A.body}>{s.title}</span>
                  </a>
                ))}
              </div>
              <h3 className={`text-lg font-semibold mb-4 ${A.heading}`}>Pages associées</h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { to: '/methodologie', label: 'Méthodologie' },
                  { to: '/audit-expert', label: 'Audit Expert' },
                  { to: '/score-geo', label: 'Score GEO' },
                  { to: '/tarifs', label: 'Tarifs' },
                  { to: '/blog/claude-cowork-code-vs-crawlers-seo-geo', label: 'Article blog détaillé' },
                  { to: '/analyse-bots-ia', label: 'Analyse Bots IA' },
                ].map(l => (
                  <Link key={l.to} to={l.to} className={`text-sm px-3 py-1.5 rounded-full border ${A.badge} hover:bg-[#e8e8e8] dark:hover:bg-neutral-700 transition-colors`}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA Final ── */}
          <section className={`py-16 px-4 border-t ${A.separator}`}>
            <div className="mx-auto max-w-3xl text-center">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className={`text-2xl sm:text-3xl font-bold mb-4 ${A.heading}`}>
                  29€/mois. Zéro prompting. Zéro hallucination.
                </h2>
                <p className={`mb-8 max-w-lg mx-auto ${A.muted}`}>
                  Arrêtez de payer pour configurer un cerveau sans membres. Passez à l'outil qui crawle, connecte et audite pour vous.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to="/inscription" className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors ${A.ctaBg}`}>
                    Essayer Crawlers gratuitement
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/tarifs" className={`inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-colors border-[#c4c4c4] dark:border-neutral-600 ${A.body} hover:bg-[#f0f0f0] dark:hover:bg-neutral-800`}>
                    Voir les tarifs
                  </Link>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    </>
  );
}
