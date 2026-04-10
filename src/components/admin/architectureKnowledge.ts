/**
 * Knowledge base for Félix contextual explanations on /architecture-map.
 * Each domain has a summary, detailed description, and relationship explanations.
 */

export interface DomainKnowledge {
  summary: string;
  detail: string;
  /** Map of connected domain name → explanation of the relationship */
  relationships: Record<string, string>;
}

export const architectureKnowledge: Record<string, DomainKnowledge> = {
  CORE: {
    summary: "Le hub central qui orchestre toute la plateforme : profils utilisateurs, sites suivis, workbench architecte et contexte saisonnier.",
    detail: `Le domaine CORE est le cœur de Crawlers. Il contient les 4 tables fondamentales (profiles, tracked_sites, architect_workbench, seasonal_context) et les fonctions d'orchestration clés (parmenion-orchestrator, supervisor-actions, dispatch-agent-directives, autopilot-engine, ensure-profile, session-heartbeat).

**Impact utilisateur :** Chaque action sur la plateforme passe par le CORE — c'est lui qui relie votre profil à vos sites, distribue les tâches aux agents IA, et maintient la cohérence de l'ensemble du système. Sans le CORE, aucun domaine ne peut fonctionner de manière autonome.

**Rôle technique :** Parménion (l'orchestrateur principal) décide quel agent activer, dans quel ordre, et avec quelles données. Le session-heartbeat maintient la connexion temps réel.`,
    relationships: {
      "AGENTS IA": "Les agents IA lisent les profils et sites depuis le CORE pour contextualiser leurs analyses et leurs directives.",
      AUDIT: "Les audits accèdent au CORE pour savoir quel site analyser et stocker les résultats dans le workbench architecte.",
      COCOON: "Le moteur Cocoon utilise tracked_sites pour identifier le site et architect_workbench pour ses recommandations de maillage.",
      CONTENT: "Le Content Architect récupère le contexte du site depuis le CORE pour générer du contenu pertinent et adapté à la saisonnalité.",
      "SERP & VISIBILITY": "Les données de visibilité SERP et LLM sont rattachées aux tracked_sites du CORE pour le suivi longitudinal.",
      "GSC & GA4": "Les connexions Google (Search Console, Analytics) sont liées aux tracked_sites pour associer les données à chaque site.",
      AUTOPILOT: "L'Autopilot lit la configuration depuis le CORE et utilise parmenion-orchestrator pour séquencer ses cycles automatiques.",
      "CMS & DEPLOY": "Le déploiement de code et contenu s'appuie sur les tracked_sites du CORE pour cibler le bon site.",
      PROFIL: "Le domaine Profil gère l'authentification et les sessions, directement lié aux profiles du CORE.",
      ABONNEMENT: "Les crédits et abonnements sont rattachés au profil CORE pour déterminer les fonctionnalités accessibles.",
      "GEO & LOCAL": "Le SEO local s'appuie sur les tracked_sites pour associer les fiches GMB aux bons sites.",
      SOCIAL: "Les comptes sociaux sont rattachés aux tracked_sites du CORE.",
      AGENCE: "Le module Agence étend le CORE en permettant à plusieurs membres d'accéder aux mêmes tracked_sites.",
      MARINA: "Marina utilise le CORE pour créer de nouveaux tracked_sites lors de l'onboarding de prospects.",
      PAIEMENT: "Les paiements Stripe sont liés aux profils du CORE pour valider les transactions.",
    },
  },

  COCOON: {
    summary: "Le moteur de maillage interne intelligent : graphe orienté, détection de cannibalisation, et recommandations d'auto-linking IA.",
    detail: `Le Cocoon est le moteur de maillage interne de Crawlers. Il analyse la structure de liens d'un site, détecte les problèmes de cannibalisation (priorité x9), et propose des optimisations via un graphe orienté et pondéré.

**Impact utilisateur :** Amélioration du PageRank interne, réduction de la cannibalisation, et meilleure distribution du "jus SEO" entre vos pages. Le Stratège Cocoon vous guide pas à pas avec des recommandations contextuelles.

**Fonctionnalités clés :** Vue 3D, vue radiale, auto-maillage IA (cocoon-bulk-auto-linking), déploiement via CMS, diagnostics (autorité, contenu, sémantique, structure, sous-domaines).`,
    relationships: {
      AUDIT: "Le Cocoon exploite les résultats d'audit pour croiser les scores SEO avec la qualité du maillage interne.",
      CRAWL: "Le Cocoon s'appuie exclusivement sur les données du dernier crawl (site_crawls, crawl_pages) pour construire son graphe de liens.",
      CORE: "Les recommandations Cocoon alimentent l'architect_workbench du CORE pour centraliser les actions à mener.",
      "SERP & VISIBILITY": "Les positions SERP aident le Cocoon à prioriser les pages stratégiques dans ses recommandations de maillage.",
      CONTENT: "Le Content Architect utilise les clusters Cocoon pour créer du contenu qui renforce le maillage thématique.",
      "CMS & DEPLOY": "Les liens recommandés par le Cocoon sont déployés automatiquement via les connexions CMS (WordPress, etc.).",
      "AGENTS IA": "Les agents IA peuvent enrichir les recommandations Cocoon avec des directives SEO spécifiques.",
      MARINA: "Marina utilise le diagnostic Cocoon dans ses rapports de prospection pour montrer les opportunités de maillage.",
    },
  },

  AUDIT: {
    summary: "Le système d'audit multi-dimensionnel : SEO expert, local, stratégique IA, matrice de conformité et mesure d'impact.",
    detail: `Le domaine AUDIT est le pilier diagnostique de Crawlers. Il regroupe les audits SEO expert, local, stratégique IA, les matrices de conformité, et le suivi d'impact post-audit.

**Impact utilisateur :** Vous obtenez un diagnostic complet de votre site avec des recommandations priorisées. Le système mesure automatiquement l'impact de vos corrections à J+30, J+60 et J+90 via les données GSC et GA4.

**Tables clés :** audits (rapports), audit_raw_data (données brutes), audit_recommendations_registry (recommandations), audit_impact_snapshots (mesure d'impact).`,
    relationships: {
      "SERP & VISIBILITY": "L'audit récupère les données SERP pour évaluer la visibilité actuelle et identifier les opportunités de positionnement.",
      CRAWL: "L'audit déclenche des crawls ciblés pour collecter les données techniques nécessaires à l'analyse.",
      CORE: "Les résultats d'audit alimentent l'architect_workbench du CORE pour centraliser les recommandations.",
      "GEO & LOCAL": "L'audit local utilise les données de géolocalisation pour évaluer la visibilité locale du site.",
      CONTENT: "Les audits de contenu identifient les lacunes et opportunités éditoriales exploitées par le Content Architect.",
      "AGENTS IA": "Les agents IA consultent les résultats d'audit pour calibrer leurs directives et recommandations.",
      COCOON: "Le Cocoon croise ses analyses de maillage avec les scores d'audit pour prioriser ses recommandations.",
      "CMS & DEPLOY": "Les correctifs générés par l'audit peuvent être déployés automatiquement via les connexions CMS.",
      AUTOPILOT: "L'Autopilot utilise les résultats d'audit comme base de décision pour ses cycles automatiques.",
      ABONNEMENT: "Certains types d'audit consomment des crédits, gérés par le domaine Abonnement.",
      PROFIL: "L'historique des audits est lié au profil utilisateur pour le suivi longitudinal.",
      MARINA: "Marina intègre les audits dans ses rapports de prospection.",
      PAIEMENT: "Les audits premium nécessitent un paiement validé par le domaine Paiement.",
    },
  },

  CRAWL: {
    summary: "Le moteur de crawl : exploration des sites, collecte de données techniques, et alimentation des modules d'analyse.",
    detail: `Le domaine CRAWL gère l'exploration technique des sites web. Il collecte la structure HTML, les liens, les métadonnées, et alimente tous les modules d'analyse (Cocoon, Audit, Content).

**Impact utilisateur :** Le crawl est la fondation de toute analyse — sans données fraîches, les diagnostics et recommandations ne seraient pas pertinents. Les crawls stratégiques ciblent les pages prioritaires pour optimiser les crédits.

**Fonctions clés :** crawl-site, process-crawl-queue (traitement asynchrone), strategic-crawl (crawl intelligent), check-crawlers (monitoring).`,
    relationships: {
      COCOON: "Le Cocoon consomme les données de crawl pour construire son graphe de maillage interne.",
      AUDIT: "Les audits utilisent les données de crawl pour leurs analyses techniques (balises, structure, vitesse).",
      "GSC & GA4": "Le crawl croise ses données avec la Search Console pour enrichir l'analyse (pages indexées, erreurs).",
      CORE: "Les jobs de crawl sont rattachés aux tracked_sites du CORE.",
      CONTENT: "Le Content Architect utilise les données de crawl pour identifier les pages à optimiser ou créer.",
      MARINA: "Marina déclenche des crawls pour générer ses rapports de prospection.",
      "SERP & VISIBILITY": "Les données de crawl sont croisées avec les positions SERP pour identifier les corrélations technique/positionnement.",
      PROFIL: "L'accès aux crawls est lié au profil utilisateur et à ses crédits.",
    },
  },

  "AGENTS IA": {
    summary: "Le système multi-agents : CTO, SEO, UX, Supervisor — piloté par Parménion l'orchestrateur et accessible via Félix.",
    detail: `Le domaine AGENTS IA regroupe les 4 agents spécialisés (CTO, SEO, UX, Supervisor) coordonnés par Parménion, l'orchestrateur stratégique. Chaque agent opère dans son domaine d'expertise et produit des directives actionnables.

**Impact utilisateur :** Les agents travaillent en arrière-plan pour optimiser votre site : l'agent CTO propose des corrections de code, l'agent SEO des optimisations de contenu, l'agent UX des améliorations d'interface, et le Supervisor coordonne l'ensemble. Les propositions sont soumises à validation avant déploiement.

**Sécurité :** Chaque proposition de code est isolée (flag agent_source), réversible (rollback), et soumise à un interrupteur de sécurité (kill-switch).`,
    relationships: {
      AUDIT: "Les agents consultent les résultats d'audit pour calibrer leurs analyses et recommandations.",
      CONTENT: "L'agent SEO et le Content Architect collaborent pour optimiser le contenu existant et en proposer de nouveau.",
      CORE: "Les agents lisent les profils et sites depuis le CORE et y stockent leurs directives.",
      "CMS & DEPLOY": "Les propositions de code des agents (surtout CTO) sont déployées via le système CMS & Deploy.",
      COCOON: "Les agents peuvent enrichir les recommandations Cocoon avec des directives SEO/UX spécifiques.",
      PROFIL: "Les logs et directives des agents sont associés au profil utilisateur.",
      BLOG: "L'agent SEO peut influencer la stratégie éditoriale du blog.",
      AUTOPILOT: "L'Autopilot active les agents selon ses cycles automatiques — c'est le lien le plus structurant du système.",
    },
  },

  CONTENT: {
    summary: "Le Content Architect : génération, optimisation, monitoring et déploiement de contenu SEO piloté par l'IA.",
    detail: `Le domaine CONTENT centralise tout le cycle de vie du contenu : analyse de gaps, génération IA, monitoring de fraîcheur, pruning, et corrélation avec les performances SEO.

**Impact utilisateur :** Vous identifiez les lacunes de contenu, générez du contenu optimisé SEO via l'IA, surveillez sa performance, et le déployez directement sur votre CMS. Le système détecte automatiquement le contenu obsolète à mettre à jour.

**Fonctions clés :** content-architecture-advisor, content-freshness, content-monitor, content-pruning, analyze-content-gap, smart-recommendations.`,
    relationships: {
      AUDIT: "Le Content Architect exploite les résultats d'audit pour identifier les pages à optimiser en priorité.",
      "SERP & VISIBILITY": "Les données SERP orientent la stratégie de contenu vers les requêtes à fort potentiel.",
      CORE: "Le contenu est rattaché aux tracked_sites et utilise le seasonal_context pour adapter la stratégie saisonnière.",
      COCOON: "Les clusters Cocoon guident la création de contenu pour renforcer le maillage thématique.",
      "CMS & DEPLOY": "Le contenu généré est déployé via les connexions CMS (WordPress, etc.).",
      ABONNEMENT: "La génération de contenu consomme des crédits gérés par le domaine Abonnement.",
      CRAWL: "Les données de crawl alimentent l'analyse de gaps et le monitoring de contenu.",
      "AGENTS IA": "L'agent SEO et le Content Architect collaborent pour l'optimisation éditoriale.",
    },
  },

  "SERP & VISIBILITY": {
    summary: "Le suivi de visibilité : positions SERP, visibilité LLM (ChatGPT, Perplexity), part de voix et diagnostics d'hallucination.",
    detail: `Le domaine SERP & VISIBILITY couvre le suivi de positionnement classique (Google SERP) et la visibilité dans les réponses des LLM (ChatGPT, Perplexity, Claude).

**Impact utilisateur :** Vous suivez vos positions Google en temps réel, mesurez votre visibilité dans les réponses IA (un enjeu croissant), calculez votre part de voix vs concurrents, et diagnostiquez les hallucinations des LLM qui pourraient nuire à votre marque.

**Fonctions clés :** fetch-serp-kpis, calculate-sov (Share of Voice), calculate-llm-visibility, diagnose-hallucination, check-direct-answer.`,
    relationships: {
      COCOON: "Les positions SERP aident le Cocoon à prioriser les pages stratégiques dans le maillage.",
      CORE: "Les snapshots de visibilité sont rattachés aux tracked_sites du CORE pour le suivi longitudinal.",
      CRAWL: "Les données de crawl sont croisées avec les positions pour identifier les corrélations technique/positionnement.",
      CONTENT: "Les données SERP orientent la stratégie de contenu vers les requêtes à fort potentiel.",
      PROFIL: "L'accès aux données de visibilité est lié au profil et à l'abonnement de l'utilisateur.",
      "GSC & GA4": "Les données SERP sont croisées avec la Search Console pour un suivi complet du positionnement.",
      AUDIT: "Les audits utilisent les données SERP pour évaluer la visibilité actuelle du site.",
    },
  },

  "GSC & GA4": {
    summary: "Les connexions Google officielles : Search Console, Analytics 4, et Google Ads pour des données de performance fiables.",
    detail: `Le domaine GSC & GA4 gère les connexions OAuth avec les APIs Google (Search Console, Google Analytics 4, Google Ads). Il collecte les données de performance réelles (clics, impressions, positions, trafic, comportement utilisateur).

**Impact utilisateur :** Ces données sont la source de vérité pour mesurer l'impact réel de vos optimisations SEO. Elles alimentent les tableaux de bord, les mesures d'impact post-audit, et les recommandations contextualisées.

**Tables clés :** google_connections (OAuth), gsc_daily_positions, ga4_daily_metrics, ga4_behavioral_metrics.`,
    relationships: {
      CORE: "Les connexions Google sont rattachées aux tracked_sites du CORE.",
      "SERP & VISIBILITY": "Les données GSC enrichissent le suivi de visibilité avec des métriques officielles Google.",
      ABONNEMENT: "Certaines fonctionnalités GSC/GA4 avancées nécessitent un abonnement Pro.",
      CRAWL: "Le crawl croise ses données avec GSC pour enrichir l'analyse (pages indexées, erreurs d'exploration).",
      "GEO & LOCAL": "Les données GA4 géolocalisées alimentent les analyses de SEO local.",
    },
  },

  AUTOPILOT: {
    summary: "Le pilote automatique : cycles d'optimisation autonomes combinant diagnostic, prescription et déploiement.",
    detail: `L'Autopilot est le mode autonome de Crawlers. Il exécute des cycles complets : diagnostic → prescription → déploiement, en coordonnant les agents IA, les audits et le CMS.

**Impact utilisateur :** Vous configurez vos préférences (types de diagnostics, seuils, pages exclues) et l'Autopilot optimise votre site en continu. Chaque modification est tracée et réversible. Un seuil de pause automatique protège contre les modifications excessives.

**Fonctions clés :** autopilot-engine (moteur principal), avec coordination via parmenion-orchestrator du CORE.`,
    relationships: {
      "AGENTS IA": "L'Autopilot active les agents IA selon ses cycles — c'est le lien le plus structurant : il décide quel agent intervient, quand et sur quoi.",
      CONTENT: "L'Autopilot peut déclencher la génération de contenu dans ses cycles de prescription.",
      "CMS & DEPLOY": "Les modifications prescrites par l'Autopilot sont déployées via le système CMS & Deploy.",
      CORE: "L'Autopilot utilise parmenion-orchestrator et les tracked_sites pour ses cycles.",
      AUDIT: "L'Autopilot utilise les résultats d'audit comme base de décision pour ses cycles.",
    },
  },

  "GEO & LOCAL": {
    summary: "Le SEO local : fiches Google Business Profile, visibilité géolocalisée, avis, posts et analyse concurrentielle locale.",
    detail: `Le domaine GEO & LOCAL couvre tout le SEO local : gestion des fiches Google Business Profile, suivi de la visibilité géolocalisée, analyse des avis clients, publication de posts, et benchmark concurrentiel local.

**Impact utilisateur :** Vous optimisez votre présence locale sur Google Maps, surveillez vos avis, publiez des posts GMB, et suivez votre visibilité par rapport aux concurrents locaux. Les snapshots géo mesurent votre visibilité dans un rayon défini autour de votre établissement.

**Fonctions clés :** check-geo, gmb-actions, gmb-optimization, gmb-local-competitors, snapshot-geo-visibility.`,
    relationships: {
      "GSC & GA4": "Les données GA4 géolocalisées enrichissent l'analyse de performance locale.",
      CORE: "Les fiches GMB sont rattachées aux tracked_sites du CORE.",
      AUDIT: "L'audit local utilise les données géo pour évaluer la visibilité locale du site.",
    },
  },

  "CMS & DEPLOY": {
    summary: "Le déploiement de code et contenu : connexions CMS (WordPress), injection de scripts, et monitoring des déploiements.",
    detail: `Le domaine CMS & DEPLOY gère toutes les interactions avec les CMS clients (principalement WordPress). Il déploie le contenu, les correctifs de code, les redirections, et surveille les injections de scripts.

**Impact utilisateur :** Vos optimisations sont déployées directement sur votre site sans intervention manuelle. Le système surveille les scripts injectés, détecte les anomalies, et maintient un historique complet pour le rollback si nécessaire.

**Fonctions clés :** cms-push-code, cms-push-draft, cms-push-redirect, wpsync, injection-monitor, watchdog-scripts.`,
    relationships: {
      BLOG: "Les articles de blog peuvent être publiés via les connexions CMS.",
      COCOON: "Les liens recommandés par le Cocoon sont déployés via CMS.",
      CONTENT: "Le contenu généré par le Content Architect est publié via CMS.",
      CORE: "Les connexions CMS sont rattachées aux tracked_sites du CORE.",
      AUDIT: "Les correctifs d'audit peuvent être déployés automatiquement via CMS.",
      "AGENTS IA": "Les propositions de code des agents sont déployées via le système CMS & Deploy.",
    },
  },

  MARINA: {
    summary: "Le module de prospection : génération de rapports prospects, pipeline commercial et formation IA des agents commerciaux.",
    detail: `Marina est le module de prospection B2B de Crawlers. Il génère des rapports d'audit automatiques pour les prospects, gère le pipeline commercial, et forme les agents commerciaux via des données d'entraînement IA.

**Impact utilisateur :** Les agences et freelances peuvent générer automatiquement des rapports de prospection personnalisés, suivre leur pipeline, et automatiser leur outreach avec des données SEO concrètes.

**Tables clés :** marina_prospects, marina_api_keys, marina_training_data, prospect_outreach_queue.`,
    relationships: {
      AUDIT: "Marina intègre les résultats d'audit dans ses rapports de prospection pour démontrer la valeur.",
      CRAWL: "Marina déclenche des crawls pour collecter les données des sites prospects.",
      CORE: "Les prospects peuvent être convertis en tracked_sites dans le CORE.",
      COCOON: "Marina utilise le diagnostic Cocoon dans ses rapports pour montrer les opportunités de maillage.",
    },
  },

  SOCIAL: {
    summary: "Le hub social : génération, traduction, publication et suivi des performances sur les réseaux sociaux.",
    detail: `Le domaine SOCIAL gère la présence sur les réseaux sociaux : génération de contenu social par IA, traduction, publication multi-plateformes, et suivi des métriques d'engagement.

**Impact utilisateur :** Vous créez du contenu social optimisé à partir de vos contenus SEO, le publiez sur plusieurs plateformes en un clic, et suivez les performances. L'IA génère aussi les visuels associés.

**Fonctions clés :** generate-social-content, generate-social-image, publish-to-social, fetch-social-stats.`,
    relationships: {
      CORE: "Les comptes sociaux sont rattachés aux tracked_sites du CORE.",
    },
  },

  PROFIL: {
    summary: "La gestion utilisateur : sessions, statistiques, bug reports et authentification.",
    detail: `Le domaine PROFIL gère tout ce qui concerne l'utilisateur : sessions actives, historique de statistiques, signalement de bugs, et codes de vérification.

**Impact utilisateur :** Votre profil est le point d'entrée de toute la plateforme. Il détermine vos droits d'accès, vos crédits disponibles, et votre historique d'utilisation.

**Fonctions clés :** ensure-profile (création automatique), session-heartbeat (maintien de connexion), auth-actions, delete-account.`,
    relationships: {
      AUDIT: "L'historique des audits est lié au profil pour le suivi longitudinal.",
      PAIEMENT: "Les paiements sont rattachés au profil pour valider les transactions.",
      BLOG: "L'accès aux quiz et contenus blog est lié au profil.",
      "CMS & DEPLOY": "Les connexions CMS sont rattachées au profil et au site de l'utilisateur.",
      COCOON: "L'accès au Cocoon est lié au profil et à l'abonnement.",
      "GEO & LOCAL": "Les fiches GMB sont associées au profil de l'utilisateur.",
      CORE: "Le profil est directement lié à la table profiles du CORE.",
      CONTENT: "L'accès aux fonctionnalités de contenu est déterminé par le profil.",
      ABONNEMENT: "Les crédits et abonnements sont rattachés au profil.",
      AGENCE: "Le profil détermine le rôle dans l'agence (owner, member).",
      CRAWL: "L'accès aux crawls est lié au profil et à ses crédits.",
      "GSC & GA4": "Les connexions Google sont associées au profil de l'utilisateur.",
      "SERP & VISIBILITY": "L'accès aux données de visibilité est lié au profil.",
    },
  },

  ABONNEMENT: {
    summary: "La gestion des crédits, codes affiliés, récompenses de parrainage et événements de revenus.",
    detail: `Le domaine ABONNEMENT gère le système de crédits, les codes affiliés, le parrainage, et le suivi des revenus.

**Impact utilisateur :** Vos crédits déterminent les fonctionnalités accessibles. Les codes affiliés offrent des réductions, et le parrainage vous récompense pour chaque nouvel utilisateur invité.

**Tables clés :** credit_transactions, affiliate_codes, referral_rewards, revenue_events.`,
    relationships: {
      CORE: "Les crédits sont rattachés au profil CORE pour déterminer les fonctionnalités accessibles.",
      AUDIT: "Certains audits consomment des crédits.",
      CONTENT: "La génération de contenu consomme des crédits.",
      "GSC & GA4": "Certaines fonctionnalités GSC/GA4 avancées nécessitent un abonnement Pro.",
      AGENCE: "Les plans agence déterminent le nombre de membres et de sites autorisés.",
      PAIEMENT: "Les paiements alimentent les crédits du domaine Abonnement.",
    },
  },

  BLOG: {
    summary: "Le blog de la plateforme : articles générés par IA, quiz SEO, et actualités du secteur.",
    detail: `Le domaine BLOG gère les articles de blog de Crawlers, la génération automatique à partir des actualités SEO, et les quiz éducatifs.

**Impact utilisateur :** Le blog éduque les utilisateurs avec des articles SEO actualisés et des quiz interactifs gérés par Félix.`,
    relationships: {
      "CMS & DEPLOY": "Les articles peuvent être publiés via les connexions CMS.",
      "AGENTS IA": "L'agent SEO peut influencer la stratégie éditoriale du blog.",
      PROFIL: "L'accès aux quiz et contenus est lié au profil utilisateur.",
    },
  },

  PAIEMENT: {
    summary: "L'intégration Stripe : paiements, factures, informations de facturation et webhooks.",
    detail: `Le domaine PAIEMENT gère toute l'intégration Stripe : traitement des paiements, webhooks, factures et informations de facturation.

**Impact utilisateur :** Les paiements sont sécurisés via Stripe. Chaque transaction est tracée et les factures sont disponibles dans votre espace.`,
    relationships: {
      AUDIT: "Les audits premium nécessitent un paiement validé.",
      CORE: "Les paiements sont liés aux profils du CORE.",
      ABONNEMENT: "Les paiements alimentent les crédits et activent les abonnements.",
    },
  },

  AGENCE: {
    summary: "Le module agence : gestion de clients, sites attribués, équipe et invitations.",
    detail: `Le domaine AGENCE permet aux agences SEO de gérer leurs clients, attribuer des sites, inviter des membres d'équipe et partager des rapports.

**Impact utilisateur :** Les agences peuvent centraliser la gestion de tous leurs clients, attribuer des rôles à leur équipe, et générer des rapports personnalisés pour chaque client.`,
    relationships: {
      CORE: "Les clients agence sont rattachés aux tracked_sites du CORE.",
      ABONNEMENT: "Le plan agence détermine le nombre de membres et sites autorisés.",
      PROFIL: "Les membres d'équipe sont liés aux profils utilisateurs.",
    },
  },
};

/**
 * Build a Félix-ready message for a domain click.
 * Returns both a short summary and a detailed explanation.
 */
export function buildDomainExplanation(domainName: string, connectedDomains: string[]): { summary: string; detail: string } {
  const knowledge = architectureKnowledge[domainName];
  if (!knowledge) {
    return {
      summary: `Le domaine **${domainName}** fait partie de l'architecture backend de Crawlers.`,
      detail: "",
    };
  }

  // Build relationship section
  const relLines = connectedDomains
    .filter(d => knowledge.relationships[d])
    .map(d => `• **${d}** → ${knowledge.relationships[d]}`);

  const summary = `🏗️ **${domainName}**\n\n${knowledge.summary}\n\n📡 **${relLines.length} connexions actives** — clique "En savoir plus" pour le détail.`;

  const detail = `🏗️ **${domainName}**\n\n${knowledge.detail}\n\n---\n\n🔗 **Relations avec les autres domaines :**\n\n${relLines.join("\n\n")}`;

  return { summary, detail };
}
