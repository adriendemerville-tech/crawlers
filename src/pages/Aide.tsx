import { useState, useMemo, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { t3 } from '@/utils/i18n';
import { Search, BookOpen, BarChart3, Wrench, CreditCard, AlertTriangle, Shield, Code, Info, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

// ─── Documentation content ────────────────────────────────────
interface DocSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  subsections: { id: string; title: string; content: string }[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'demarrer',
    icon: <BookOpen className="h-4 w-4" />,
    title: '1. Démarrer avec Crawlers.fr',
    subsections: [
      {
        id: 'creer-compte',
        title: 'Créer son compte',
        content: `Rendez-vous sur <a href="https://crawlers.fr/signup" class="text-primary underline">crawlers.fr/signup</a>. L'inscription est gratuite et débloque :
<ul class="list-disc pl-6 mt-2 space-y-1">
<li>L'audit technique SEO 200 points (1 par jour)</li>
<li>25 crédits offerts dès l'inscription</li>
<li>L'accès au tableau de bord personnel</li>
</ul>
<p class="mt-2">Pour activer les fonctionnalités avancées (tracking GSC, GA4, historique SERP), connectez vos comptes Google via OAuth depuis votre tableau de bord.</p>`,
      },
      {
        id: 'premier-audit',
        title: 'Lancer son premier audit',
        content: `<ol class="list-decimal pl-6 space-y-1">
<li>Depuis la page d'accueil ou <a href="https://crawlers.fr/audit-expert" class="text-primary underline">/audit-expert</a>, entrez l'URL de votre site</li>
<li>Choisissez le type d'audit souhaité (Expert SEO gratuit ou Stratégique IA premium)</li>
<li>L'audit s'exécute en arrière-plan — vous recevez une notification à la fin</li>
<li>Consultez votre rapport depuis le tableau de bord</li>
</ol>
<p class="mt-2 text-muted-foreground text-sm">Durée moyenne : 45 à 90 secondes pour un audit expert, 2 à 5 minutes pour un audit stratégique IA.</p>`,
      },
      {
        id: 'connecter-gsc',
        title: 'Connecter Google Search Console',
        content: `<ol class="list-decimal pl-6 space-y-1">
<li>Depuis votre tableau de bord, cliquez sur "Connecter GSC"</li>
<li>Autorisez l'accès via votre compte Google</li>
<li>Sélectionnez la propriété GSC correspondant à votre site</li>
<li>Les données historiques (clics, impressions, CTR, positions) sont importées automatiquement</li>
</ol>
<p class="mt-2 text-sm text-muted-foreground">Prérequis : votre site doit être vérifié dans Google Search Console avant la connexion.</p>`,
      },
      {
        id: 'connecter-ga4',
        title: 'Connecter Google Analytics 4',
        content: `<ol class="list-decimal pl-6 space-y-1">
<li>Depuis votre tableau de bord, cliquez sur "Connecter GA4"</li>
<li>Autorisez l'accès via votre compte Google</li>
<li>Sélectionnez la propriété GA4 correspondant à votre site</li>
<li>Les données (sessions, engagement, bounce rate) alimentent le Triangle Prédictif et les rapports de tracking</li>
</ol>`,
      },
    ],
  },
  {
    id: 'scores',
    icon: <BarChart3 className="h-4 w-4" />,
    title: '2. Comprendre vos scores',
    subsections: [
      {
        id: 'geo-score',
        title: "Qu'est-ce que le GEO Score ?",
        content: `Le GEO Score mesure la capacité de votre site à être cité et recommandé par les moteurs de réponse IA (ChatGPT, Perplexity, Gemini, Claude).
<p class="mt-2">Un score élevé signifie que vos contenus sont :</p>
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Bien structurés pour être compris par les LLMs</li>
<li>Rédigés avec une autorité thématique claire</li>
<li>Balisés avec des données structurées (JSON-LD)</li>
<li>Exempts de signaux négatifs (contenu mince, duplication, hallucinations)</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Le GEO Score est calculé sans inscription, gratuitement, depuis la page d'accueil.</p>`,
      },
      {
        id: 'score-ias',
        title: "Qu'est-ce que le Score IAS ?",
        content: `L'Indice d'Alignement Stratégique (IAS) mesure la cohérence entre votre contenu, votre structure technique et les attentes combinées de Google et des moteurs IA.
<p class="mt-2">Il repose sur 23 variables réparties en 4 axes :</p>
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Alignement sémantique (contenu vs intention)</li>
<li>Alignement technique (structure vs standards)</li>
<li>Alignement autorité (E-E-A-T vs signaux perçus)</li>
<li>Alignement GEO (visibilité LLM vs potentiel)</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Un IAS > 70 indique un site bien aligné. En dessous de 40, des correctifs prioritaires sont nécessaires.</p>`,
      },
      {
        id: 'visibilite-llm',
        title: "Qu'est-ce que la Visibilité LLM ?",
        content: `La Visibilité LLM mesure le taux de citation de votre site ou marque dans les réponses générées par ChatGPT, Perplexity, Gemini et Claude sur vos mots-clés cibles.
<p class="mt-2">Elle est calculée via une interrogation parallèle multi-modèles — pas un seul LLM, mais quatre simultanément — pour donner un score représentatif et non biaisé.</p>`,
      },
      {
        id: 'part-de-voix',
        title: "Qu'est-ce que la Part de Voix SEO ?",
        content: `La Part de Voix est un score pondéré multi-canaux :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li><strong>40% LLM</strong> — visibilité dans les moteurs IA</li>
<li><strong>35% SERP</strong> — positions Google organique</li>
<li><strong>25% ETV</strong> — estimation du trafic potentiel</li>
</ul>
<p class="mt-2">C'est votre indicateur de présence globale sur un marché ou une thématique donnée.</p>`,
      },
      {
        id: 'triangle-predictif',
        title: "Qu'est-ce que le Triangle Prédictif ?",
        content: `Le Triangle Prédictif est un algorithme propriétaire qui corrèle vos données GSC et GA4 pour prédire votre trafic organique sur les 90 prochains jours.
<p class="mt-2">Précision mesurée : MAPE inférieure à 15%.</p>
<p class="text-sm text-muted-foreground">Disponible uniquement si GSC et GA4 sont connectés.</p>`,
      },
      {
        id: 'baisse-score',
        title: 'Pourquoi mon score a-t-il baissé ?',
        content: `Plusieurs raisons possibles :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Une mise à jour algorithmique Google récente</li>
<li>Une baisse de fréquence de publication</li>
<li>Des erreurs techniques apparues (404, noindex)</li>
<li>Une perte de backlinks autoritaires</li>
<li>Une évolution des réponses LLM sur vos mots-clés cibles</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Consultez l'historique de vos scores dans votre tableau de bord pour identifier la date de la baisse.</p>`,
      },
    ],
  },
  {
    id: 'features',
    icon: <Wrench className="h-4 w-4" />,
    title: '3. Les features en détail',
    subsections: [
      {
        id: 'audit-expert',
        title: 'Audit Expert SEO',
        content: `Analyse technique complète de votre site en 200 points couvrant :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li><strong>Technique</strong> : indexation, robots.txt, sitemap, redirections, erreurs HTTP</li>
<li><strong>Sémantique</strong> : balises title, meta, H1-H6, densité de mots-clés</li>
<li><strong>Performance</strong> : Core Web Vitals, PageSpeed, temps de chargement</li>
<li><strong>Sécurité</strong> : HTTPS, mixed content, vulnérabilités</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Disponible : 1 fois par jour en freemium inscrit. Illimité en Pro Agency.</p>`,
      },
      {
        id: 'audit-strategique',
        title: 'Audit Stratégique IA',
        content: `Analyse approfondie multi-axes avec scoring IA :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Score IAS (23 variables)</li>
<li>Analyse E-E-A-T</li>
<li>Recommandations prioritaires classées par impact</li>
<li>Génération de plan d'action</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Coût : 1 crédit.</p>`,
      },
      {
        id: 'audit-compare',
        title: 'Audit Comparé',
        content: `Benchmark de votre site vs jusqu'à 3 concurrents :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Radar Chart comparatif</li>
<li>Analyse différentielle feature par feature</li>
<li>Score IAS comparé</li>
<li>Identification des gaps et opportunités</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Coût : 4 crédits.</p>`,
      },
      {
        id: 'audit-local',
        title: 'Audit Local SEO',
        content: `Analyse de votre présence locale :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Audit Google My Business (fiche, avis, posts)</li>
<li>Positionnement Pack Local</li>
<li>Cohérence NAP (Nom, Adresse, Téléphone)</li>
<li>Recommandations de visibilité locale</li>
</ul>`,
      },
      {
        id: 'matrice-audit',
        title: 'Matrice d\'audit',
        content: `Moteur d'audit sur-mesure multi-critères :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Composez votre grille : balises HTML, données structurées, performance, sécurité, prompts LLM, métriques combinées</li>
<li>Import CSV / DOC / DOCX avec extraction IA automatique</li>
<li>Pondération par critère, seuils personnalisables (bon/moyen/mauvais), axes de classification</li>
<li>Score pondéré global /100, rapport exportable CSV/PDF, gestion de lots réutilisables</li>
</ul>`,
      },
      {
        id: 'cocon-semantique',
        title: 'Cocon Sémantique 3D',
        content: `Visualisation interactive de l'architecture sémantique de votre site en 3D (Three.js) :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Clusters thématiques calculés via TF-IDF</li>
<li>Liens internes visualisés et analysés</li>
<li>Recommandations de maillage automatiques</li>
<li>Chat IA intégré pour affiner la stratégie</li>
<li>Export et persistance des sessions</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Disponible en Pro Agency.</p>`,
      },
      {
        id: 'architecte-generatif',
        title: 'Architecte Génératif',
        content: `Génération automatique de codes correctifs multi-pages :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>JSON-LD (SoftwareApplication, Organization, FAQPage, BreadcrumbList...)</li>
<li>Balises meta optimisées</li>
<li>Attributs de maillage interne</li>
<li>Intégration directe : WordPress, GTM ou SDK</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Coût : 1 crédit.</p>`,
      },
      {
        id: 'crawl-multi',
        title: 'Crawl Multi-Pages',
        content: `Analyse récursive de votre site :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li><strong>Pro Agency</strong> : jusqu'à 5 000 pages/mois, slider jusqu'à 20 pages par crawl</li>
<li><strong>Pro Agency +</strong> : jusqu'à 50 000 pages/mois, slider jusqu'à 50 pages par crawl</li>
<li>Détection d'erreurs techniques page par page</li>
<li>Analyse du maillage interne</li>
<li>Graphique circulaire des codes HTTP</li>
<li>Quota dynamique vérifié avant chaque crawl</li>
<li>Rapport exportable</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Disponible en Pro Agency (inclus dans l'abonnement).</p>`,
      },
      {
        id: 'tracking-serp',
        title: 'Tracking SERP',
        content: `Suivi hebdomadaire de vos positions Google :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Mots-clés trackés et leurs évolutions</li>
<li>Historique des positions dans le temps</li>
<li>Détection des Quick Wins (positions 4-10)</li>
<li>Données via DataForSEO avec fallback SerpAPI</li>
</ul>`,
      },
      {
        id: 'agents-autonomes',
        title: 'Agents Autonomes',
        content: `<ul class="list-disc pl-6 space-y-1">
<li><strong>Agent SEO</strong> : optimisation automatique du contenu (blog : libre, landing pages : max 10% de modification)</li>
<li><strong>Agent CTO</strong> : maintenance algorithmique automatique, self-critique et proposition de patches</li>
</ul>`,
      },
    ],
  },
  {
    id: 'credits',
    icon: <CreditCard className="h-4 w-4" />,
    title: '4. Crédits & Abonnement',
    subsections: [
      {
        id: 'fonctionnement-credits',
        title: 'Comment fonctionnent les crédits ?',
        content: `Les crédits (CreditCoin) sont la monnaie interne de Crawlers.fr pour les fonctionnalités premium ponctuelles.
<p class="mt-2">À l'inscription : <strong>25 crédits offerts</strong>.</p>
<p class="mt-1">Coût des actions principales :</p>
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Audit Stratégique IA : 1 crédit</li>
<li>Audit Comparé : 4 crédits</li>
<li>Crawl (par tranche de 50 pages) : 1 crédit</li>
<li>Architecte Génératif : 1 crédit</li>
</ul>`,
      },
      {
        id: 'freemium-vs-pro',
        title: 'Freemium vs Pro Agency',
        content: `<div class="overflow-x-auto mt-2">
<table class="w-full text-sm border border-border rounded-lg">
<thead><tr class="bg-muted/50"><th class="p-2 text-left">Feature</th><th class="p-2 text-center">Freemium</th><th class="p-2 text-center">Pro Agency</th></tr></thead>
<tbody>
<tr class="border-t border-border"><td class="p-2">Bots IA, GEO Score, LLM, PageSpeed</td><td class="p-2 text-center">✅</td><td class="p-2 text-center">✅</td></tr>
<tr class="border-t border-border"><td class="p-2">Audit Expert SEO</td><td class="p-2 text-center">1/jour</td><td class="p-2 text-center">Illimité</td></tr>
<tr class="border-t border-border"><td class="p-2">Cocon Sémantique 3D</td><td class="p-2 text-center">❌</td><td class="p-2 text-center">✅</td></tr>
<tr class="border-t border-border"><td class="p-2">Crawl multi-pages</td><td class="p-2 text-center">❌</td><td class="p-2 text-center">✅</td></tr>
<tr class="border-t border-border"><td class="p-2">Tracking SERP/GSC/GA4</td><td class="p-2 text-center">❌</td><td class="p-2 text-center">✅</td></tr>
<tr class="border-t border-border"><td class="p-2">Sites simultanés</td><td class="p-2 text-center">1</td><td class="p-2 text-center">30</td></tr>
<tr class="border-t border-border"><td class="p-2">Prix</td><td class="p-2 text-center">Gratuit</td><td class="p-2 text-center font-semibold">59€/mois*</td></tr>
</tbody>
</table>
</div>
<p class="mt-2 text-xs text-muted-foreground">*Offre de lancement garantie à vie pour les 100 premiers abonnés. Prochain palier : 99€/mois.</p>`,
      },
      {
        id: 'early-adopter',
        title: "Comment fonctionne l'offre early adopter ?",
        content: `Les 100 premiers abonnés Pro Agency bénéficient du tarif <strong>59€/mois garanti à vie</strong> — même quand le prix public passera à 99€/mois.
<p class="mt-2">Ce tarif est nominatif, lié à votre compte, et non transférable.</p>`,
      },
      {
        id: 'acheter-credits',
        title: 'Comment acheter des crédits ?',
        content: `Depuis votre tableau de bord > section Crédits :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Pack ponctuel : à l'unité selon le barème</li>
<li>Pack Ultime : 500 crédits pour 99€ (one-shot)</li>
<li>Bundle APIs : accès APIs tierces selon volume</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Paiement sécurisé via Stripe. Facturation immédiate, crédits disponibles instantanément.</p>`,
      },
      {
        id: 'resilier',
        title: 'Comment résilier ?',
        content: `Depuis votre tableau de bord > Abonnement > Résilier. La résiliation prend effet à la fin de la période en cours. Vos données sont conservées 30 jours après résiliation.`,
      },
    ],
  },
  {
    id: 'problemes',
    icon: <AlertTriangle className="h-4 w-4" />,
    title: '5. Problèmes fréquents & solutions',
    subsections: [
      {
        id: 'audit-bloque',
        title: 'Mon audit est bloqué ou ne se termine pas',
        content: `<ul class="list-disc pl-6 space-y-1">
<li>Attendez 5 minutes — les audits complexes peuvent prendre jusqu'à 5 minutes</li>
<li>Rafraîchissez la page et consultez le tableau de bord</li>
<li>Si le problème persiste après 10 minutes, relancez un nouvel audit</li>
<li>Les sites avec JavaScript heavy ou protections anti-bot peuvent allonger le temps de traitement</li>
</ul>`,
      },
      {
        id: 'gsc-ga4-erreur',
        title: 'GSC ou GA4 ne se connectent pas',
        content: `<ul class="list-disc pl-6 space-y-1">
<li>Vérifiez que vous utilisez le bon compte Google</li>
<li>Acceptez tous les scopes OAuth demandés</li>
<li>Vérifiez que votre site est bien vérifié dans Google Search Console</li>
<li>Déconnectez et reconnectez le compte Google</li>
<li>Essayez avec un autre navigateur ou en navigation privée</li>
</ul>`,
      },
      {
        id: 'geo-score-bas',
        title: 'Mon score GEO est très bas, pourquoi ?',
        content: `Les causes les plus fréquentes :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Absence de données structurées JSON-LD</li>
<li>Contenu trop générique sans expertise thématique claire</li>
<li>Site bloqué pour les bots IA dans robots.txt</li>
<li>Absence de page À propos ou mentions légales (signaux E-E-A-T faibles)</li>
<li>Contenu trop court ou trop peu fréquent</li>
</ul>
<p class="mt-2">Utilisez l'<a href="https://crawlers.fr/architecte-generatif" class="text-primary underline">Architecte Génératif</a> pour générer les correctifs adaptés.</p>`,
      },
      {
        id: 'donnees-gsc-absentes',
        title: 'Je ne vois pas mes données GSC dans le tableau de bord',
        content: `<ul class="list-disc pl-6 space-y-1">
<li>Les données GSC sont importées après connexion — patientez 5 à 10 minutes</li>
<li>Google Search Console ne fournit des données qu'à partir de 28 jours d'historique minimum</li>
<li>Vérifiez que la propriété sélectionnée est la bonne (www vs non-www, http vs https)</li>
</ul>`,
      },
      {
        id: 'architecte-incorrect',
        title: "L'Architecte Génératif génère du code incorrect",
        content: `<ul class="list-disc pl-6 space-y-1">
<li>Vérifiez que l'URL analysée est bien accessible publiquement</li>
<li>Certains CMS propriétaires peuvent nécessiter des ajustements manuels</li>
<li>Testez le code généré avec le Rich Results Test de Google avant déploiement</li>
<li>En cas de doute, utilisez l'injection GTM plutôt que l'injection directe</li>
</ul>`,
      },
      {
        id: 'supprimer-compte',
        title: 'Je veux supprimer mon compte',
        content: `Tableau de bord > Paramètres > Supprimer mon compte. La suppression est définitive et conforme au RGPD. Vos données sont effacées sous 72 heures.`,
      },
    ],
  },
  {
    id: 'securite',
    icon: <Shield className="h-4 w-4" />,
    title: '6. Sécurité & Confidentialité',
    subsections: [
      {
        id: 'hebergement',
        title: 'Où sont hébergées mes données ?',
        content: `Crawlers.fr héberge toutes ses données en Europe. L'infrastructure repose sur un hébergement européen. Aucune donnée n'est stockée aux États-Unis.`,
      },
      {
        id: 'rgpd',
        title: 'Crawlers.fr est-il conforme au RGPD ?',
        content: `Oui. Crawlers.fr est RGPD natif :
<ul class="list-disc pl-6 mt-1 space-y-1">
<li>Droit à l'effacement : suppression de compte disponible depuis le tableau de bord</li>
<li>Droit à la portabilité : export de vos données disponible sur demande</li>
<li>Pas de revente de données à des tiers</li>
<li><a href="https://crawlers.fr/politique-confidentialite" class="text-primary underline">Politique de confidentialité complète</a></li>
</ul>`,
      },
      {
        id: 'tokens-google',
        title: 'Mes tokens Google sont-ils sécurisés ?',
        content: `Oui. Les tokens OAuth Google sont stockés de manière chiffrée avec Row-Level Security — ils ne sont jamais exposés côté client ni accessibles par d'autres utilisateurs.`,
      },
      {
        id: 'revente-donnees',
        title: 'Crawlers.fr vend-il mes données ?',
        content: `Non. Vos données (site, scores, historiques) sont strictement personnelles et ne sont jamais revendues ni partagées avec des tiers.`,
      },
    ],
  },
  {
    id: 'integration',
    icon: <Code className="h-4 w-4" />,
    title: '7. Brancher votre site',
    subsections: [
      {
        id: 'connection-methods',
        title: 'Comment brancher mon site à Crawlers.AI ?',
        content: `<p>Trois méthodes sont disponibles depuis Console → Mes Sites → icône 🔌 :</p>
<ol class="list-decimal pl-6 mt-2 space-y-2">
<li><strong>API CMS (recommandé)</strong> — Connexion directe via l'API REST de votre CMS. Cliquez sur « API CMS (WordPress) », entrez l'URL de votre site, puis utilisez le Lien Magique pour une connexion automatique en un clic. Compatible WordPress, Shopify, Webflow.</li>
<li><strong>Plugin WordPress</strong> — Téléchargez le fichier .zip depuis la modale, installez-le dans WordPress → Extensions → Ajouter → Téléverser. Le plugin se synchronise automatiquement toutes les 6h via WP Cron.</li>
<li><strong>GTM / Script universel</strong> — Copiez le snippet de 3 lignes pré-rempli avec votre clé API. Collez-le dans Google Tag Manager (balise HTML personnalisée, déclencheur All Pages) ou directement avant &lt;/head&gt;. Compatible tous CMS. Widget léger (~2 Ko), exécution asynchrone.</li>
</ol>
<p class="mt-2">Guide complet : <a href="/integration-gtm" class="text-primary underline">Brancher votre site — 3 méthodes</a></p>`,
      },
      {
        id: 'wordpress',
        title: 'Compatible avec WordPress ?',
        content: `Oui. Crawlers.fr propose trois niveaux d'intégration WordPress : (1) l'API CMS via Lien Magique pour une connexion directe automatique, (2) le plugin .zip classique avec synchronisation toutes les 6h, et (3) le snippet GTM/Script universel. Les codes correctifs générés par l'Architecte Génératif sont compatibles avec les principaux thèmes WordPress (Elementor, Divi, Astra, GeneratePress).`,
      },
    ],
  },
  {
    id: 'mcp',
    icon: <Code className="h-4 w-4" />,
    title: '8. Intégration MCP (Claude & IA)',
    subsections: [
      {
        id: 'mcp-definition',
        title: "Qu'est-ce que le serveur MCP Crawlers ?",
        content: `Crawlers.fr expose ses outils d'audit SEO/GEO comme un <strong>serveur MCP</strong> (Model Context Protocol) compatible avec Claude, et tout client MCP.
<p class="mt-2">Cela signifie que Claude peut directement appeler les outils Crawlers pour auditer un site, vérifier sa visibilité IA, générer du code correctif et mesurer l'impact — le tout en langage naturel.</p>
<p class="mt-2 text-sm text-muted-foreground">Endpoint : <code>POST /functions/v1/mcp-server</code></p>`,
      },
      {
        id: 'mcp-outils-gratuits',
        title: 'Outils MCP gratuits (sans authentification)',
        content: `<ul class="list-disc pl-6 space-y-1">
<li><strong>check_geo_score</strong> — Score GEO (0-100) pour l'optimisation moteurs IA</li>
<li><strong>check_llm_visibility</strong> — Visibilité sur ChatGPT, Gemini, Perplexity, Claude, Mistral, Llama</li>
<li><strong>check_ai_crawlers</strong> — Analyse des bots IA (GPTBot, ClaudeBot, Google-Extended)</li>
</ul>`,
      },
      {
        id: 'mcp-outils-pro',
        title: 'Outils MCP Pro Agency (token requis)',
        content: `<ul class="list-disc pl-6 space-y-1">
<li><strong>expert_seo_audit</strong> — Audit SEO 200 points</li>
<li><strong>strategic_ai_audit</strong> — Audit stratégique IA multi-axes</li>
<li><strong>generate_corrective_code</strong> — Génération de code correctif JS</li>
<li><strong>dry_run_script</strong> — Test sandbox avant déploiement</li>
<li><strong>calculate_cocoon_logic</strong> — Cocon sémantique TF-IDF</li>
<li><strong>measure_audit_impact</strong> — Mesure d'impact T+30/T+60/T+90</li>
<li><strong>wordpress_sync</strong> — Injection correctifs WordPress</li>
<li><strong>fetch_serp_kpis</strong> — KPIs SERP hebdomadaires</li>
<li><strong>calculate_ias</strong> — Indice d'Alignement Stratégique</li>
</ul>
<p class="mt-2 text-sm text-muted-foreground">Authentification via token Supabase d'un compte Pro Agency. Rate limit : 30 appels/heure.</p>`,
      },
      {
        id: 'mcp-usage',
        title: 'Comment utiliser le MCP avec Claude ?',
        content: `<ol class="list-decimal pl-6 space-y-1">
<li>Configurez le serveur MCP dans votre client Claude avec l'endpoint Crawlers</li>
<li>Claude découvre automatiquement les 12 outils disponibles</li>
<li>Demandez en langage naturel : « Audite le site example.com »</li>
<li>Claude appelle les outils Crawlers et synthétise les résultats</li>
</ol>
<p class="mt-2">Pour les outils Pro, votre token d'authentification Crawlers est transmis automatiquement.</p>`,
      },
    ],
  },
  {
    id: 'a-propos',
    icon: <Info className="h-4 w-4" />,
    title: '9. À propos de Crawlers.fr',
    subsections: [
      {
        id: 'quest-ce-que-crawlers',
        title: "Qu'est-ce que Crawlers.fr ?",
        content: `Crawlers.fr est la première plateforme européenne combinant audit SEO technique, GEO (Generative Engine Optimization), visibilité LLM et génération de correctifs actionnables dans un seul outil. Lancée en mars 2026, elle s'adresse aux agences SEO, freelances et PME.`,
      },
      {
        id: 'wrapper-gpt',
        title: 'Crawlers.fr est-il un wrapper GPT ?',
        content: `Non. Crawlers.fr est une infrastructure serverless de plus de 176 000 lignes de code, avec 14 algorithmes propriétaires, 124 Edge Functions, un système multi-fallback sur toutes les APIs critiques, et une architecture RGPD native. Ce n'est pas un wrapper IA.`,
      },
      {
        id: 'llms-interroges',
        title: 'Quels LLMs Crawlers.fr interroge-t-il ?',
        content: `6 LLMs interrogés en parallèle : ChatGPT (OpenAI), Gemini (Google), Perplexity, Claude (Anthropic), Mistral et Llama (Meta).`,
      },
      {
        id: 'support',
        title: 'Comment contacter le support ?',
        content: `Via le chat in-app disponible sur toutes les pages de l'interface (icône en bas à droite). L'agent IA répond 24h/24. Les questions complexes sont escaladées au fondateur sous 24h ouvrées.`,
      },
    ],
  },
];

export default function Aide() {
  const { language } = useLanguage();
  useCanonicalHreflang('/aide');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(DOC_SECTIONS.map(s => s.id)));

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return DOC_SECTIONS;
    const q = searchQuery.toLowerCase();
    return DOC_SECTIONS.map(section => ({
      ...section,
      subsections: section.subsections.filter(
        sub => sub.title.toLowerCase().includes(q) || sub.content.toLowerCase().includes(q)
      ),
    })).filter(s => s.subsections.length > 0);
  }, [searchQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <html lang={language} />
        <title>Centre d'aide Crawlers.fr — Documentation SEO, GEO & visibilité IA</title>
        <meta name="description" content="Trouvez toutes les réponses sur les audits SEO, le GEO Score, la visibilité LLM, les crédits et le plan Pro Agency. Documentation complète Crawlers.fr." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://crawlers.fr/aide" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/aide" />
        <meta property="og:title" content="Centre d'aide Crawlers.fr — Documentation SEO, GEO & visibilité IA" />
        <meta property="og:description" content="Trouvez toutes les réponses sur les audits SEO, le GEO Score, la visibilité LLM, les crédits et le plan Pro Agency." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Centre d'aide Crawlers.fr — Documentation SEO, GEO & visibilité IA" />
        <meta name="twitter:description" content="Trouvez toutes les réponses sur les audits SEO, le GEO Score, la visibilité LLM, les crédits et le plan Pro Agency." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TechArticle",
          "name": "Documentation Crawlers.fr",
          "description": "Base de connaissance complète de la plateforme Crawlers.fr — audits SEO, GEO Score, visibilité LLM, cocon sémantique, correctifs actionnables.",
          "url": "https://crawlers.fr/aide",
          "publisher": {
            "@type": "Organization",
            "name": "Crawlers.fr",
            "url": "https://crawlers.fr"
          }
        })}</script>
      </Helmet>
      <Header />
      <main className="flex-1 pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Hero */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Centre d'aide
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Documentation complète de la plateforme Crawlers.fr — audits SEO, GEO Score, visibilité IA, crédits et intégration technique.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-xl mx-auto mb-10">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Rechercher dans la documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category nav (horizontal pills) */}
          <nav className="flex flex-wrap gap-2 mb-8 justify-center" aria-label="Catégories">
            {DOC_SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  const el = document.getElementById(`section-${section.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card hover:bg-accent/50 transition-colors text-foreground"
              >
                {section.icon}
                <span className="hidden sm:inline">{section.title.replace(/^\d+\.\s*/, '')}</span>
                <span className="sm:hidden">{section.title.replace(/^\d+\.\s*/, '').split(' ')[0]}</span>
              </button>
            ))}
          </nav>

          {/* Sections */}
          <div className="space-y-6">
            {filteredSections.map(section => (
              <section key={section.id} id={`section-${section.id}`} className="scroll-mt-24">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center gap-2 w-full text-left group"
                >
                  {expandedSections.has(section.id) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                    {section.title}
                  </h2>
                </button>

                {expandedSections.has(section.id) && (
                  <div className="mt-4 space-y-5 pl-6 border-l-2 border-border">
                    {section.subsections.map(sub => (
                      <article key={sub.id} id={`article-${sub.id}`} className="scroll-mt-24">
                        <h3 className="text-base font-semibold text-foreground mb-2">{sub.title}</h3>
                        <div
                          className="text-sm text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_table]:text-foreground [&_th]:text-foreground [&_td]:text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: sub.content }}
                        />
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Footer metadata */}
          <div className="mt-16 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>Dernière mise à jour : mars 2026</p>
            <a
              href="/crawlers-sav-documentation.md"
              download
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger la documentation (Markdown)
            </a>
          </div>
        </div>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
