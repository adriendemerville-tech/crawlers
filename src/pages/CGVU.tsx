import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


const sections = [
  { id: 'objet', title: '1. Objet du Service' },
  { id: 'acceptation', title: '2. Acceptation des CGVU' },
  { id: 'description', title: '3. Description du Service' },
  { id: 'garantie', title: '4. Absence de Garantie de Résultat' },
  { id: 'code', title: '5. Responsabilité sur l\'Implémentation du Code' },
  { id: 'injection', title: '5 bis. Injection de Code — API CMS, Plugin WordPress, GTM' },
  { id: 'usage-malveillant', title: '5 ter. Interdiction des Usages Malveillants' },
  { id: 'credits', title: '6. Système de Crédits' },
  { id: 'abonnement', title: '7. Abonnement Pro Agency' },
  { id: 'whitelabel', title: '8. Offre Marque Blanche (White Label)' },
  { id: 'veille', title: '8 bis. Analyse Concurrentielle & Veille Stratégique' },
  { id: 'pi', title: '9. Propriété Intellectuelle' },
  { id: 'donnees', title: '10. Données de Crawl & Analyse' },
  { id: 'rgpd', title: '11. RGPD & Données Personnelles' },
  { id: 'disponibilite', title: '12. Disponibilité du Service' },
  { id: 'securite-auth', title: '12 ter. Sécurité de l\'Authentification' },
  { id: 'responsabilite', title: '12 bis. Limitation de Responsabilité' },
  { id: 'modification', title: '13. Modification des CGVU' },
  { id: 'social', title: '14. Social Content Hub — Publication & OAuth' },
  { id: 'litiges', title: '15. Droit Applicable & Litiges' },
];

const CGVU = () => {
  useCanonicalHreflang('/cgvu');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <html lang="fr" />
        <title>Conditions Générales de Vente et d'Utilisation | Crawlers.fr</title>
        <meta name="description" content="CGVU de Crawlers.fr – Conditions générales de vente et d'utilisation de la plateforme d'audit SEO/GEO et de crédits d'analyse IA." />
        <link rel="canonical" href="https://crawlers.fr/cgvu" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Link>

          <article className="prose prose-gray dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Conditions Générales de Vente et d'Utilisation (CGVU)
            </h1>
            <p className="text-muted-foreground mb-8">
              Applicables à l'ensemble des services proposés sur <strong>crawlers.fr</strong>
            </p>

            {/* Sommaire */}
            <nav className="rounded-lg border border-border bg-muted/30 p-6 mb-10" aria-label="Sommaire">
              <h2 className="text-lg font-semibold text-foreground mt-0 mb-4">Sommaire</h2>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-primary hover:underline">
                      {s.title.replace(/^\d+\.\s/, '')}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Article 1 */}
            <section id="objet">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">1. Objet du Service</h2>
              <p>
                Le site <strong>crawlers.fr</strong> (ci-après « la Plateforme ») édité par <strong>Crawlers AI</strong> (ci-après « l'Éditeur »), propose un ensemble d'outils d'analyse et d'optimisation de la visibilité des sites web pour les moteurs de recherche classiques (SEO) et les moteurs de recherche génératifs (GEO — Generative Engine Optimization).
              </p>
              <p>Les services comprennent notamment :</p>
              <ul>
                <li>L'analyse de l'accessibilité du site aux robots IA (crawlability) ;</li>
                <li>Le calcul d'un score GEO (optimisation pour les moteurs génératifs) ;</li>
                <li>L'analyse de la visibilité auprès des LLM (ChatGPT, Perplexity, Claude, etc.) ;</li>
                <li>L'audit de performance technique (Core Web Vitals, PageSpeed) sur mobile et desktop, avec analyse des formats d'images (détection PNG/JPEG/BMP, recommandation de conversion WebP/AVIF) et estimation des gains de performance ;</li>
                <li>La <strong>conversion automatique d'images</strong> via Code Architect : réécriture JavaScript des balises <code>&lt;img&gt;</code> en <code>&lt;picture&gt;</code> avec sources WebP/AVIF, sans modification des fichiers originaux du site client (approche non-destructive et réversible) ;</li>
                <li>L'audit stratégique approfondi (EEAT, positionnement concurrentiel, analyse sémantique) ;</li>
                <li>L'analyse de mots-clés, requêtes cibles et contenu prioritaire ;</li>
                <li>Le <strong>crawl multi-pages</strong> : analyse récursive de l'ensemble des pages d'un site (jusqu'à 500 pages, structure, SEO par page, score global, synthèse IA) ;</li>
                <li>Le <strong>module Cocoon</strong> : graphe sémantique des pages d'un site (clustering TF-IDF, maillage interne, détection de cannibalisation, prédictions ROI) ;</li>
                <li>L'<strong>audit comparé</strong> : analyse concurrentielle de deux sites sur des critères SEO/GEO communs ;</li>
                <li>La génération de code correctif personnalisé (JSON-LD, balises meta, robots.txt, llms.txt) ;</li>
                <li>Le suivi de l'évolution technique via un tableau de bord et l'intégration Google Search Console ;</li>
                <li>La génération de rapports exportables (PDF) et de plans d'action ;</li>
                <li>Le <strong>module Marina</strong> : pipeline d'audit automatisé générant un rapport SEO & GEO de 15+ pages (audit technique, stratégique, visibilité IA, cocoon sémantique) consommant 5 crédits par rapport. Le rapport est généré dans la langue demandée par l'intégrateur (fr, en, es) ou auto-détectée depuis le site audité ;</li>
                <li>L'<strong>API Marina Embed</strong> : intégration du pipeline Marina sur un site tiers via une clé API dédiée, avec paramétrage de la langue du rapport (<code>lang</code>), webhook optionnel (<code>callback_url</code>) et branding personnalisable (intro, CTA, masquage du badge Crawlers.fr) depuis la console Pro Agency ;</li>
                <li>Les <strong>intégrations API tierces</strong> : Google Search Console (OAuth), Google Analytics 4 (OAuth), Google My Business (OAuth), Google Ads (OAuth), Matomo (token API), CMS REST API (WordPress, Shopify, Webflow, Drupal, Wix, Odoo, PrestaShop), Rank Math SEO. Les données importées via ces intégrations sont <strong>anonymisées et agrégées</strong> avant toute utilisation par les modèles IA pour les prédictions et recommandations. Chaque intégration est <strong>déconnectable en un clic</strong> depuis Console → API Externes. La page <a href="/api-integrations" className="text-primary underline">API & Intégrations</a> détaille l'ensemble des API disponibles et leur utilisation des données ;</li>
                <li>L'<strong>Conversion Optimizer</strong> : audit UX/CRO contextuel par IA combinant diagnostic visuel LLM et données comportementales GA4 (scroll, clics CTA, conversions, taux de sortie). Les suggestions apparaissent sous forme de bulles reliées aux éléments de la page. Analyse sur 7 axes : ton, CTAs, lisibilité, potentiel de conversion, expérience mobile, mots-clés, engagement utilisateur. Les suggestions critiques alimentent automatiquement le Workbench Architect. Réservé aux abonnés Pro Agency et Pro Agency+ ;</li>
                <li>Le <strong>Social Content Hub</strong> : génération, traduction et publication de contenus sociaux multi-plateformes via IA, avec génération de visuels. Limite de 5 contenus/mois en Freemium, illimité en Pro Agency ;</li>
                <li>Le <strong>serveur MCP</strong> (Model Context Protocol) : exposition de 12 outils Crawlers aux clients IA tiers (Claude Desktop, etc.) via des API keys persistantes. 3 outils gratuits pour l'acquisition, 9 réservés aux abonnés Pro Agency ;</li>
                <li>L'<strong>analyse de logs serveur</strong> : ingestion et analyse des fichiers de logs HTTP pour comprendre le comportement de Googlebot, Bingbot et des bots IA (GPTBot, ClaudeBot, PerplexityBot). Détection du budget crawl gaspillé, des pages orphelines et monitoring continu via connecteur Cloudflare ;</li>
                <li>Le <strong>diagnostic de chute</strong> : détection réactive et prédictive des baisses de trafic via régression linéaire sur 8 semaines, croisée avec les données GSC, les audits techniques et E-E-A-T ;</li>
                <li>Le <strong>Benchmark Rank SERP</strong> : outil gratuit de comparaison des positions Google via 3 providers SERP simultanés (DataForSEO, SerpApi, Serper.dev). Le classement croisé avec pénalité single-hit (+20 positions) élimine les faux positifs et produit un ranking fiable. Accessible à tous les utilisateurs, inscrits ou non (<a href="/app/ranking-serp" className="text-primary underline">/app/ranking-serp</a>) ;</li>
              </ul>
            </section>

            {/* Article 2 */}
            <section id="acceptation">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">2. Acceptation des CGVU</h2>
              <p>
                L'utilisation de la Plateforme implique l'acceptation pleine et entière des présentes Conditions Générales de Vente et d'Utilisation. Toute inscription ou tout achat de crédits ou d'abonnement vaut acceptation sans réserve des présentes CGVU.
              </p>
              <p>
                L'Éditeur se réserve le droit de modifier les présentes CGVU à tout moment. Les utilisateurs seront informés de toute modification substantielle par notification sur la Plateforme ou par email. La poursuite de l'utilisation du service après notification vaut acceptation des nouvelles conditions.
              </p>
            </section>

            {/* Article 3 */}
            <section id="description">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">3. Description du Service</h2>
              <p>
                Crawlers.fr fournit des <strong>outils d'analyse automatisée</strong> et des <strong>recommandations techniques</strong> générées par intelligence artificielle. Le service est accessible via un système de crédits à l'unité ou par abonnement mensuel ou annuel.
              </p>
              <p>L'offre se décline comme suit :</p>
              <ul>
                <li><strong>Audit Flash gratuit</strong> (0 €) : analyse de base SEO/GEO avec rapport synthétique ;</li>
                <li><strong>Pack Essentiel</strong> (5 €) : 10 crédits d'analyse ;</li>
                <li><strong>Pack Lite</strong> (19 €) : 50 crédits d'analyse ;</li>
                <li><strong>Pack Premium</strong> (45 €) : 150 crédits d'analyse ;</li>
                
                <li><strong>Abonnement Pro Agency</strong> (29 €/mois sans engagement, ou 26,10 €/mois avec engagement annuel soit 313,20 €/an — remise de 10%) : accès illimité, marque blanche, dashboard agence dédié, export de rapports personnalisés, Fair Use Policy de 5 000 pages de crawl/mois incluses, 80 créations de pages/mois (Content Architect), 2 comptes inclus (1 collaborateur) ;</li>
                <li><strong>Abonnement Pro Agency +</strong> (79 €/mois sans engagement, ou 71,10 €/mois avec engagement annuel soit 853,20 €/an — remise de 10%) : tout Pro Agency inclus + 50 000 pages de crawl/mois, Benchmark LLM & Profondeur LLM illimités (cache serveur de 2 heures), 150 créations de pages/mois (Content Architect), Google Business (GBP/GMB), 3 comptes inclus (2 collaborateurs).</li>
              </ul>
            </section>

            {/* Article 4 */}
            <section id="garantie">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">4. Absence de Garantie de Résultat</h2>
              <p>
                Crawlers.fr fournit des outils d'analyse et des recommandations techniques à caractère informatif. <strong>L'Éditeur ne peut en aucun cas garantir :</strong>
              </p>
              <ul>
                <li>Une position spécifique dans les résultats des moteurs de recherche classiques (Google, Bing, etc.) ;</li>
                <li>Une citation ou une mention par les intelligences artificielles génératives (ChatGPT, Perplexity, Claude, Gemini, etc.) ;</li>
                <li>Une augmentation du trafic organique ou de la visibilité en ligne.</li>
              </ul>
              <p>
                Les algorithmes de classement et de citation sont la propriété exclusive de tiers (Google LLC, OpenAI, Anthropic, etc.) et sont susceptibles de modifications unilatérales sans préavis. L'Éditeur ne saurait être tenu responsable des décisions algorithmiques de ces tiers.
              </p>
              <p>
                Les scores, indicateurs et recommandations fournis par la Plateforme constituent des <strong>estimations basées sur l'état de l'art</strong> au moment de l'analyse et ne constituent en aucun cas une obligation de résultat.
              </p>
            </section>

            {/* Article 5 */}
            <section id="code">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">5. Responsabilité sur l'Implémentation du Code</h2>
              <p>
                La Plateforme génère des <strong>scripts correctifs personnalisés</strong> (données structurées JSON-LD, balises meta, configuration robots.txt, llms.txt, etc.) destinés à être intégrés sur le site de l'utilisateur.
              </p>
              <p className="font-semibold">
                L'utilisateur est seul et unique responsable :
              </p>
              <ul>
                <li>De la décision d'intégrer ou non les correctifs proposés sur son propre site web ;</li>
                <li>De la bonne implémentation technique du code fourni ;</li>
                <li>De la vérification de la compatibilité du code avec son environnement technique (CMS, framework, hébergement) ;</li>
                <li>De la sauvegarde préalable de ses fichiers avant toute modification.</li>
              </ul>
              <p>
                <strong>Crawlers.fr ne saurait être tenu responsable</strong> des erreurs techniques, dysfonctionnements, bugs, baisses de performance, perte de données ou tout autre préjudice direct ou indirect résultant d'une mauvaise manipulation, d'une intégration incorrecte ou partielle du code fourni.
              </p>
              <p>
                Il est expressément recommandé à l'utilisateur de tester toute modification dans un environnement de staging avant mise en production.
              </p>
            </section>

            {/* Article 5 bis */}
            <section id="injection">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">5 bis. Injection de Code via API CMS, Plugin WordPress ou GTM/Script — Consentement de l'Utilisateur</h2>
              <p>
                Lorsque l'utilisateur choisit de <strong>brancher son site</strong> à Crawlers.fr — que ce soit via l'<strong>API CMS</strong> (connexion directe à l'API REST du CMS, notamment via le Lien Magique), le <strong>plugin WordPress</strong> (fichier .zip à installer manuellement), le <strong>widget GTM</strong> (Google Tag Manager) ou le <strong>snippet JavaScript direct</strong> — il autorise expressément la Plateforme à <strong>injecter du code côté client</strong> sur les pages de son site web.
              </p>
              <p className="font-semibold">
                L'utilisateur reconnaît et accepte que :
              </p>
              <ul>
                <li>L'injection de code est <strong>initiée exclusivement par l'utilisateur</strong> lui-même, qui en fait la demande explicite via l'interface de la Plateforme (bouton « Brancher mon site », choix de la méthode de connexion : API CMS, Plugin WordPress ou GTM/Script) ;</li>
                <li><strong>Trois méthodes de connexion</strong> sont proposées : (1) l'API CMS avec Lien Magique pour une connexion directe automatique, (2) le plugin WordPress .zip pour une installation classique avec synchronisation automatique toutes les 6 heures, (3) le snippet GTM/Script universel compatible avec tous les CMS ;</li>
                <li>Le code injecté est <strong>encapsulé et sandboxé</strong> : il s'exécute dans un périmètre isolé (sandboxing sémantique) et n'interagit qu'avec les éléments HTML ciblés par les correctifs (données structurées, balises meta, attributs Open Graph, etc.), sans pouvoir modifier d'autres composants du site ;</li>
                <li>Le code injecté <strong>ne collecte aucune donnée personnelle</strong> des visiteurs du site et ne dépose aucun cookie ;</li>
                <li>L'utilisateur peut <strong>débrancher son site à tout moment</strong>, en un clic, depuis son espace personnel (Console → Mes Sites). La déconnexion est immédiate et supprime tout code injecté, quelle que soit la méthode de connexion utilisée ;</li>
                <li>L'utilisateur dispose d'une <strong>fonction de Rollback (annulation)</strong> accessible depuis la page « Mes Sites », permettant de <strong>restaurer instantanément la configuration précédente</strong> et de retirer le dernier script injecté. Cette opération est immédiate et sans frais ;</li>
                <li>Crawlers.fr <strong>ne saurait être tenu responsable</strong> des éventuels conflits entre le code injecté et d'autres scripts tiers présents sur le site de l'utilisateur.</li>
              </ul>
              <p>
                Il est recommandé à l'utilisateur de <strong>tester les correctifs dans un environnement de staging</strong> avant de les déployer en production, et de vérifier la compatibilité avec son environnement technique. Le guide technique complet des méthodes de connexion est disponible sur la page <a href="/integration-gtm" className="text-primary underline">Brancher votre site</a>.
              </p>
            </section>

            {/* Article 5 ter */}
            <section id="usage-malveillant">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">5 ter. Interdiction des Usages Malveillants — Clause Anti-Abus</h2>
              <p className="font-semibold text-destructive">
                Il n'est pas permis d'utiliser les services de Crawlers.fr à des fins malveillantes, frauduleuses, ou portant atteinte aux droits de tiers.
              </p>
              <p className="mt-4 font-semibold">
                À titre non exhaustif, il est expressément interdit de :
              </p>
              <ul>
                <li>Utiliser les fonctionnalités d'injection de code (Architecte Génératif, API CMS, plugin WordPress, GTM, snippet direct) pour <strong>modifier, altérer ou nuire au fonctionnement d'un site web dont l'utilisateur n'est pas le propriétaire légitime</strong> ;</li>
                <li>Tenter d'injecter du code malveillant, des scripts de redirection, du contenu spam ou toute forme de <strong>backdoor</strong> via les outils de la Plateforme ;</li>
                <li>Usurper l'identité d'un autre utilisateur ou d'un autre propriétaire de site pour accéder aux fonctionnalités d'injection ;</li>
                <li>Utiliser les outils d'audit et de crawl de la Plateforme dans le but de <strong>dégrader, surcharger ou faire tomber le site d'un concurrent</strong> (attaque par déni de service, crawl abusif, etc.) ;</li>
                <li>Contourner les mécanismes de vérification de propriété mis en place par la Plateforme (vérification GTM, clé API, correspondance domaine/compte) ;</li>
                <li>Revendre, partager ou mettre à disposition de tiers les accès à la Plateforme dans le but de faciliter les usages interdits ci-dessus.</li>
              </ul>

              <h3 className="text-lg font-semibold mt-6 mb-2">Vérification de propriété</h3>
              <p>
                La Plateforme met en œuvre des <strong>mécanismes automatiques de vérification de propriété</strong> avant toute opération d'injection de code. Ces mécanismes incluent, sans s'y limiter :
              </p>
              <ul>
                <li>Le croisement de la clé API du compte utilisateur avec le conteneur GTM installé sur le site cible ;</li>
                <li>La vérification que le domaine cible est bien enregistré et rattaché au compte de l'utilisateur demandeur ;</li>
                <li>La traçabilité complète de toute tentative d'injection non autorisée (horodatage, identifiant utilisateur, domaine cible, type de script, profil propriétaire).</li>
              </ul>

              <h3 className="text-lg font-semibold mt-6 mb-2">Sanctions</h3>
              <p>
                Tout manquement aux interdictions ci-dessus pourra entraîner, sans préavis et sans indemnité :
              </p>
              <ul>
                <li>La <strong>suspension immédiate du compte</strong> de l'utilisateur contrevenant ;</li>
                <li>La <strong>suppression définitive du compte</strong> et de toutes les données associées ;</li>
                <li>La <strong>conservation des logs d'abus</strong> à des fins probatoires pendant une durée de 36 mois ;</li>
                <li>Le <strong>signalement aux autorités compétentes</strong> en cas d'infraction pénale avérée (accès frauduleux à un système de traitement automatisé de données — articles 323-1 et suivants du Code pénal) ;</li>
                <li>La <strong>facturation des frais</strong> engagés par l'Éditeur pour remédier aux conséquences de l'abus.</li>
              </ul>

              <h3 className="text-lg font-semibold mt-6 mb-2">Disclaimer — Limitation de responsabilité</h3>
              <p>
                L'Éditeur met en œuvre des mesures raisonnables pour prévenir les usages abusifs de la Plateforme. Toutefois, <strong>Crawlers.fr ne saurait être tenu responsable</strong> des actes malveillants commis par un utilisateur en violation des présentes CGVU. La responsabilité de tout dommage causé à un tiers par un utilisateur malveillant incombe exclusivement à ce dernier.
              </p>
              <p>
                L'utilisateur s'engage à <strong>indemniser et garantir l'Éditeur</strong> contre toute réclamation, action ou poursuite de tiers résultant directement ou indirectement de l'utilisation malveillante des services de la Plateforme.
              </p>
            </section>

            {/* Article 6 */}
            <section id="credits">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">6. Système de Crédits</h2>
              <h3 className="text-lg font-semibold mt-4 mb-2">6.1. Nature des crédits</h3>
              <p>
                Les crédits constituent des <strong>unités de consommation numérique</strong> permettant d'accéder aux fonctionnalités d'analyse avancée de la Plateforme. Chaque action d'audit (audit expert, génération de code, analyse LLM approfondie, crawl multi-pages, etc.) consomme un ou plusieurs crédits selon la complexité de l'opération.
              </p>

              <h3 className="text-lg font-semibold mt-4 mb-2">6.2. Achat et utilisation</h3>
              <p>
                L'achat de packs de crédits s'effectue par paiement sécurisé via Stripe. Les crédits sont crédités instantanément sur le compte de l'utilisateur après confirmation du paiement. Les crédits achetés n'ont pas de date d'expiration tant que le compte utilisateur reste actif.
              </p>

              <h3 className="text-lg font-semibold mt-4 mb-2">6.3. Droit de rétractation — Renonciation expresse</h3>
              <p>
                Conformément à l'<strong>article L.221-28, 13° du Code de la consommation</strong>, l'achat de crédits constitue la fourniture d'un contenu numérique non fourni sur un support matériel dont l'exécution a commencé avec l'accord préalable exprès du consommateur.
              </p>
              <p>
                <strong>En procédant à l'achat, l'utilisateur reconnaît et accepte expressément :</strong>
              </p>
              <ul>
                <li>Que l'exécution du service commence immédiatement après le paiement ;</li>
                <li>Qu'il renonce expressément à son droit de rétractation de 14 jours prévu à l'article L.221-18 du Code de la consommation ;</li>
                <li>Que cette renonciation prend effet dès la première utilisation d'un crédit ou la première consultation d'un rapport généré.</li>
              </ul>

              <h3 className="text-lg font-semibold mt-4 mb-2">6.4. Non-remboursabilité</h3>
              <p>
                Les crédits achetés et utilisés ne sont pas remboursables. En cas de dysfonctionnement technique avéré imputable à la Plateforme empêchant l'exécution normale du service, l'Éditeur s'engage à recréditer les crédits consommés à tort.
              </p>
            </section>

            {/* Article 7 */}
            <section id="abonnement">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">7. Abonnements Pro Agency et Pro Agency +</h2>
              <h3 className="text-lg font-semibold mt-4 mb-2">7.1. Modalités</h3>
              <p>
                Les abonnements Crawlers sont proposés selon deux formules de facturation :
              </p>
              <p className="font-semibold mt-2">Formule mensuelle (sans engagement) :</p>
              <ul>
                <li><strong>Pro Agency</strong> : 29 € TTC par mois, sans engagement, reconduction tacite mensuelle.</li>
                <li><strong>Pro Agency +</strong> : 79 € TTC par mois, sans engagement, reconduction tacite mensuelle.</li>
              </ul>
              <p className="font-semibold mt-4">Formule annuelle (engagement 12 mois, remise de 10%) :</p>
              <ul>
                <li><strong>Pro Agency</strong> : 313,20 € TTC par an (soit 26,10 €/mois), engagement de 12 mois, reconduction tacite annuelle.</li>
                <li><strong>Pro Agency +</strong> : 853,20 € TTC par an (soit 71,10 €/mois), engagement de 12 mois, reconduction tacite annuelle.</li>
              </ul>
              <p className="mt-2">
                Le paiement est prélevé automatiquement (mensuellement ou annuellement selon la formule choisie) via Stripe. L'utilisateur peut choisir sa formule de facturation lors de la souscription.
              </p>

              <h3 className="text-lg font-semibold mt-4 mb-2">7.2. Avantages inclus</h3>
              <p className="font-semibold mt-2">Pro Agency (29€/mois ou 26,10€/mois en annuel) :</p>
              <ul>
                <li>Accès illimité à l'ensemble des outils d'analyse et d'audit ;</li>
                <li><strong>Crawl multi-pages</strong> : Fair Use Policy de 5 000 pages/mois ;</li>
                <li><strong>Module Cocoon</strong> : graphe sémantique illimité ;</li>
                <li><strong>Content Architect</strong> : 80 contenus/mois (Fair Use) ;</li>
                <li><strong>Autopilote Parménion</strong> : maintenance prédictive IA (2-10 actions/cycle) ;</li>
                <li><strong>Connexion CMS directe</strong> : WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo ;</li>
                <li><strong>Google Search Console & GA4</strong> : intégration OAuth ;</li>
                <li><strong>Google My Business</strong> : gestion multi-fiches ;</li>
                <li>Dashboard agence dédié avec gestion multi-clients (2 comptes Pro Agency, 3 comptes Pro Agency+) ;</li>
                <li>Export de rapports personnalisés au format PDF ;</li>
                <li>Fonctionnalité Marque Blanche (White Label) — voir Article 8 ;</li>
                <li>Support prioritaire.</li>
              </ul>
              <p className="font-semibold mt-4">Pro Agency + (79€/mois ou 71,10€/mois en annuel) :</p>
              <ul>
                <li>Tout Pro Agency inclus ;</li>
                <li><strong>Crawl multi-pages</strong> : Fair Use Policy de 50 000 pages/mois ;</li>
                <li><strong>Content Architect</strong> : 150 contenus/mois (Fair Use) ;</li>
                <li><strong>Stratégie concurrentielle</strong> : priorisation dynamique par pression concurrentielle ;</li>
                <li>5 comptes inclus (owner + 4 invités) ;</li>
                <li>Support prioritaire renforcé.</li>
              </ul>

              <h3 className="text-lg font-semibold mt-4 mb-2">7.3. Résiliation</h3>
              <p>
                <strong>Formule mensuelle :</strong> L'utilisateur peut résilier son abonnement <strong>à tout moment, en un clic</strong>, depuis son espace personnel (Console &gt; Mon abonnement) ou via le portail de facturation Stripe. La résiliation prend effet à la fin de la période mensuelle en cours. Aucun remboursement prorata temporis n'est effectué pour le mois en cours.
              </p>
              <p className="mt-2">
                <strong>Formule annuelle :</strong> L'abonnement annuel engage l'utilisateur pour une durée de 12 mois. En cas de résiliation anticipée avant le terme de la période annuelle, <strong>aucun remboursement n'est effectué</strong> pour les mois restants. L'accès aux fonctionnalités est maintenu jusqu'à la fin de la période annuelle payée. Sans résiliation expresse, l'abonnement est reconduit tacitement pour une nouvelle période de 12 mois.
              </p>
            </section>

            {/* Article 8 */}
            <section id="whitelabel">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">8. Offre Marque Blanche (White Label)</h2>
              <h3 className="text-lg font-semibold mt-4 mb-2">8.1. Droits accordés</h3>
              <p>
                Dans le cadre de l'abonnement Pro Agency, l'utilisateur est autorisé à :
              </p>
              <ul>
                <li>Personnaliser les rapports générés avec son propre logo, ses couleurs et ses coordonnées ;</li>
                <li>Présenter les rapports à ses clients finaux sous sa propre identité commerciale ;</li>
                <li>Revendre les rapports d'audit dans le cadre de ses propres prestations de conseil SEO/GEO.</li>
              </ul>

              <h3 className="text-lg font-semibold mt-4 mb-2">8.2. Responsabilité envers les clients finaux</h3>
              <p>
                L'abonné Agency <strong>reste seul responsable</strong> de la relation commerciale avec ses propres clients finaux. Il s'engage à :
              </p>
              <ul>
                <li>Ne pas présenter les résultats comme une garantie de positionnement ou de citation IA ;</li>
                <li>Assumer l'entière responsabilité de la communication, de la facturation et du support envers ses clients finaux ;</li>
                <li>Ne pas engager la responsabilité de Crawlers.fr vis-à-vis de ses propres clients.</li>
              </ul>
            </section>

            {/* Article 8 bis */}
            <section id="veille">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">8 bis. Analyse Concurrentielle & Veille Stratégique</h2>
              <p>
                Les fonctionnalités d'analyse concurrentielle de la Plateforme (audit comparé, module Cocoon, analyse de mots-clés) permettent à l'utilisateur d'analyser des sites web tiers dans le cadre d'une <strong>veille stratégique licite</strong>.
              </p>
              <p className="font-semibold mt-4">
                L'utilisateur reconnaît et accepte que :
              </p>
              <ul>
                <li>Les analyses concurrentielles portent exclusivement sur des <strong>données publiquement accessibles</strong> (HTML, balises meta, structure de liens, fichiers robots.txt, données structurées) ;</li>
                <li>La Plateforme respecte les directives <code>robots.txt</code> des sites analysés. Si un site interdit le crawl, l'analyse sera limitée ou impossible ;</li>
                <li>L'utilisateur s'engage à n'utiliser les fonctions d'analyse concurrentielle qu'à des <strong>fins de veille stratégique licite</strong>, conformément aux pratiques admises en matière d'intelligence économique ;</li>
                <li>L'utilisateur s'interdit d'utiliser les données obtenues pour <strong>reproduire, plagier ou copier le contenu</strong> (textes, images, visuels) des sites tiers analysés ;</li>
                <li>L'utilisateur s'interdit d'utiliser les outils pour <strong>surcharger intentionnellement</strong> les serveurs d'un site concurrent (le crawl est mécaniquement limité à 500 pages maximum par session avec throttling automatique) ;</li>
                <li>L'utilisateur s'interdit de contourner une authentification ou un accès restreint pour accéder à du contenu non public d'un site tiers.</li>
              </ul>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mt-4">
                <p>
                  <strong className="text-amber-600 dark:text-amber-400">Exonération de responsabilité :</strong>{' '}
                  Crawlers AI ne saurait être tenu responsable de l'usage que l'utilisateur fait des données d'analyse concurrentielle obtenues via la Plateforme. L'utilisateur est seul responsable du respect de la législation applicable en matière de concurrence, de propriété intellectuelle et de protection des données dans sa juridiction.
                </p>
              </div>
            </section>

            {/* Article 9 */}
            <section id="pi">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">9. Propriété Intellectuelle</h2>
              <p>
                L'ensemble de la Plateforme — incluant mais non limité à son code source, ses algorithmes, ses interfaces, ses textes, ses visuels et son design — est la <strong>propriété exclusive de Crawlers AI</strong> et est protégé par le droit d'auteur et le droit des bases de données.
              </p>
              <p>
                Toute reproduction, représentation, modification, publication, transmission ou dénaturation, totale ou partielle, de la Plateforme ou de son contenu, par quelque procédé que ce soit, est interdite sans l'autorisation écrite préalable de l'Éditeur.
              </p>
              <p>
                Les rapports d'analyse générés par la Plateforme sont mis à la disposition de l'utilisateur pour son usage personnel ou professionnel (dans le cadre de l'offre Agency). L'utilisateur ne peut en aucun cas redistribuer, revendre ou rendre publiquement accessible le contenu des rapports en dehors du cadre prévu par les présentes CGVU.
              </p>
            </section>

            {/* Article 10 */}
            <section id="donnees">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">10. Données de Crawl & Analyse</h2>
              <p>
                Les données analysées par Crawlers.fr sont exclusivement des <strong>données publiquement accessibles</strong> sur Internet (contenu HTML, fichiers robots.txt, balises meta, données structurées, etc.). La Plateforme n'accède à aucune donnée privée, protégée ou nécessitant une authentification sur le site audité.
              </p>
              <p>
                Les résultats d'analyse et les rapports générés par l'intelligence artificielle de Crawlers.fr constituent des <strong>œuvres dérivées protégées</strong>. L'Éditeur se réserve le droit d'utiliser les données agrégées et anonymisées à des fins statistiques et d'amélioration du service.
              </p>
            </section>

            {/* Article 11 */}
            <section id="rgpd">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">11. RGPD & Données Personnelles</h2>
              <p>
                Les données personnelles collectées par la Plateforme (adresse email, nom, prénom, URLs auditées) le sont exclusivement pour le <strong>bon fonctionnement du service</strong>, la gestion des comptes utilisateurs et la communication relative au service.
              </p>
              <p>
                Conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) :
              </p>
              <ul>
                <li>Les données personnelles ne sont <strong>jamais revendues</strong> à des tiers ;</li>
                <li>L'utilisateur dispose d'un droit d'accès, de rectification, de suppression et de portabilité de ses données ;</li>
                <li>Les données sont hébergées au sein de l'Union Européenne ;</li>
                <li>L'utilisateur peut exercer ses droits en contactant <a href="mailto:contact@crawlers.fr" className="text-primary hover:underline">contact@crawlers.fr</a>.</li>
              </ul>
              <p>
                Pour plus de détails, veuillez consulter notre{' '}
                <Link to="/politique-confidentialite" className="text-primary hover:underline">
                  Politique de Confidentialité
                </Link>{' '}
                et notre page{' '}
                <Link to="/rgpd" className="text-primary hover:underline">
                  RGPD
                </Link>.
              </p>
            </section>

            {/* Article 12 */}
            <section id="disponibilite">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">12. Disponibilité du Service</h2>
              <p>
                L'Éditeur s'efforce d'assurer la disponibilité de la Plateforme 24 heures sur 24, 7 jours sur 7. Toutefois, l'Éditeur ne saurait être tenu responsable des interruptions de service dues à :
              </p>
              <ul>
                <li>Des opérations de maintenance programmées ou d'urgence ;</li>
                <li>Des défaillances des fournisseurs tiers (hébergement, APIs, services de paiement) ;</li>
                <li>Des cas de force majeure au sens de l'article 1218 du Code civil.</li>
              </ul>
            </section>

            {/* Article 12 ter */}
            <section id="securite-auth">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">12 ter. Sécurité de l'Authentification</h2>
              <p>
                Afin de protéger les comptes utilisateurs contre les tentatives d'accès non autorisées, la Plateforme met en œuvre un <strong>mécanisme de verrouillage progressif</strong> des tentatives de connexion échouées :
              </p>
              <ul>
                <li>Après <strong>5 échecs</strong> consécutifs : verrouillage temporaire de <strong>30 secondes</strong> ;</li>
                <li>Après <strong>8 échecs</strong> : verrouillage de <strong>60 secondes</strong> ;</li>
                <li>Après <strong>12 échecs</strong> : verrouillage de <strong>5 minutes</strong>.</li>
              </ul>
              <p>
                Ce dispositif complète la protection côté serveur (limitation par adresse IP). L'utilisateur est informé du verrouillage en cours via un compte à rebours affiché sur le bouton de connexion.
              </p>
              <p>
                L'Éditeur se réserve le droit de suspendre ou de bloquer tout compte faisant l'objet de tentatives d'accès suspectes, conformément à ses obligations de sécurité.
              </p>
            </section>

            {/* Article 12 bis */}
            <section id="responsabilite">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">12 bis. Limitation de Responsabilité</h2>
              <p>
                La Plateforme est fournie « <strong>en l'état</strong> » (<em>as is</em>). L'Éditeur ne garantit ni l'exactitude, ni l'exhaustivité, ni la pertinence des résultats d'analyse, scores, recommandations et codes correctifs générés par la Plateforme. Ces éléments sont fournis à titre <strong>indicatif et informatif</strong> uniquement.
              </p>
              <p className="font-semibold mt-4">En aucun cas l'Éditeur ne pourra être tenu responsable :</p>
              <ul>
                <li>Des décisions commerciales, techniques ou stratégiques prises par l'utilisateur sur la base des résultats fournis ;</li>
                <li>D'une perte de positionnement, de trafic, de chiffre d'affaires ou de toute autre perte économique consécutive à l'utilisation de la Plateforme ;</li>
                <li>Des dommages causés aux sites tiers analysés dans le cadre de la veille concurrentielle ;</li>
                <li>Des effets de l'injection de code correctif sur le site de l'utilisateur ou sur l'expérience de ses visiteurs ;</li>
                <li>Des dysfonctionnements résultant de l'incompatibilité entre les scripts générés et l'environnement technique de l'utilisateur.</li>
              </ul>
              <p className="mt-4">
                <strong>Plafond de responsabilité :</strong> En tout état de cause, la responsabilité totale de l'Éditeur, toutes causes confondues, est limitée au montant total effectivement payé par l'utilisateur au cours des <strong>douze (12) derniers mois</strong> précédant le fait générateur de responsabilité.
              </p>
            </section>

            {/* Article 13 */}
            <section id="modification">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">13. Modification des CGVU</h2>
              <p>
                L'Éditeur se réserve le droit de modifier les présentes CGVU à tout moment. Les modifications entreront en vigueur dès leur publication sur la Plateforme. Il est conseillé à l'utilisateur de consulter régulièrement les CGVU. La date de dernière mise à jour est indiquée en bas de la présente page.
              </p>
            </section>

            {/* Article 14 */}
            <section id="litiges">
              <section id="social">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">14. Social Content Hub — Publication & OAuth</h2>
              <p>
                Le module <strong>Social Content Hub</strong> permet la publication de contenus sur des plateformes tierces (LinkedIn, Facebook, Instagram) via les APIs officielles de ces plateformes (LinkedIn Marketing API, Meta Graph API).
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">14.1 Connexion OAuth</h3>
              <p>
                L'Utilisateur autorise Crawlers.fr à accéder à ses comptes sociaux via le protocole OAuth 2.0. Les tokens d'accès sont <strong>chiffrés au repos</strong> et ne sont utilisés que pour les actions de publication, de lecture des statistiques et de modération des commentaires explicitement déclenchées par l'Utilisateur.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">14.2 Responsabilité du contenu publié</h3>
              <p>
                L'Utilisateur est <strong>seul responsable</strong> du contenu publié via le Social Content Hub. Crawlers.fr agit en tant que prestataire technique et ne contrôle pas le fond des publications. L'Utilisateur s'engage à respecter les conditions d'utilisation de chaque plateforme cible.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">14.3 Quotas de publication</h3>
              <p>
                Le nombre de publications mensuelles est limité selon le plan souscrit : <strong>5 posts/mois</strong> (gratuit), <strong>30 posts/mois</strong> (Pro Agency), <strong>100 posts/mois</strong> (Pro Agency+). Le compteur est réinitialisé le 1er de chaque mois.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">14.4 Révocation d'accès</h3>
              <p>
                L'Utilisateur peut révoquer l'accès OAuth à tout moment depuis les paramètres de sécurité de chaque plateforme sociale. La révocation entraîne l'impossibilité de publier via le Social Hub jusqu'à une nouvelle autorisation.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">14.5 Données sociales</h3>
              <p>
                Les métriques d'engagement (impressions, clics, likes, partages) sont collectées uniquement à des fins d'affichage dans le tableau de bord de l'Utilisateur. Elles ne sont <strong>jamais partagées avec des tiers</strong> ni utilisées pour entraîner des modèles d'intelligence artificielle.
              </p>
              </section>

              <section id="litiges">
              <h2 className="text-xl font-bold text-foreground mt-10 mb-3">15. Droit Applicable & Litiges</h2>
              <p>
                Les présentes CGVU sont soumises au <strong>droit français</strong>. Tout litige relatif à l'interprétation, l'exécution ou la résiliation des présentes CGVU sera soumis à la compétence exclusive des tribunaux compétents du ressort du siège social de l'Éditeur, sauf disposition légale impérative contraire.
              </p>
              <p>
                Conformément aux articles L.611-1 et suivants du Code de la consommation, le consommateur est informé qu'il peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable de tout litige.
              </p>
              </section>
              <p>
                Conformément aux articles L.611-1 et suivants du Code de la consommation, le consommateur est informé qu'il peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable de tout litige.
              </p>
            </section>

            {/* Dernière mise à jour */}
            <div className="mt-12 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground italic">
                Dernière mise à jour : 10 avril 2026
              </p>
            </div>
          </article>
        </div>
      </main>
      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
};

export default CGVU;
