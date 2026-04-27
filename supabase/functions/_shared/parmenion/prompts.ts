/**
 * parmenion/prompts.ts — LLM prompt builders for Parménion.
 * Extracted from parmenion-orchestrator (L1605-1852) for maintainability.
 */

import type { PipelinePhase, ScoredWorkbenchItem } from './types.ts';
import { TIER_NAMES } from './types.ts';

export function buildPhaseInstructions(context: {
  currentPhase: PipelinePhase;
  isIktracker: boolean;
  scoredWorkbenchItems: ScoredWorkbenchItem[];
}): string {
  switch (context.currentPhase) {
    case 'audit':
      return `## PHASE ACTUELLE: AUDIT (AUDIT TECHNIQUE)
Tu dois lancer un audit technique complet du site pour identifier les problèmes SEO techniques (performance, indexabilité, erreurs HTTP, structure).
Fonction autorisée: audit-expert-seo
Cet audit fournira les données brutes nécessaires aux diagnostics stratégiques de la phase suivante.
IMPORTANT: C'est un scan technique pur. Ne fais PAS de recommandations stratégiques ici.`;

    case 'diagnose':
      return `## PHASE ACTUELLE: DIAGNOSE (DIAGNOSTIC STRATÉGIQUE)
L'audit technique est terminé. Tu as les résultats ci-dessous.
Tu dois maintenant lancer UN diagnostic stratégique pour analyser la sémantique, le contenu, la structure ou l'autorité du site.
Fonctions autorisées: cocoon-diag-content, cocoon-diag-semantic, cocoon-diag-structure, cocoon-diag-authority
Choisis la fonction la plus pertinente selon les problèmes révélés par l'audit technique.
IMPORTANT: Ne refais PAS d'audit technique. Les données sont là, utilise-les pour choisir le bon diagnostic.`;

    case 'prescribe':
      return buildPrescribeInstructions(context);

    case 'execute':
      return context.isIktracker ? buildIktrackerExecuteInstructions() : buildWpsyncExecuteInstructions();

    case 'validate':
      return `## PHASE ACTUELLE: VALIDATE (VÉRIFICATION POST-DÉPLOIEMENT)
Les correctifs ont été déployés sur le CMS. Tu dois maintenant VÉRIFIER que les changements sont bien appliqués et mesurer l'impact initial.
Fonctions autorisées: audit-expert-seo, cocoon-diag-content

Tu dois:
1. Lancer un audit-expert-seo ciblé sur les URLs modifiées pour vérifier que les correctifs sont en place
2. OU lancer un cocoon-diag-content pour mesurer l'amélioration du score de contenu

Le payload doit inclure:
- Les URLs ciblées par l'exécution précédente (disponibles dans les résultats des phases précédentes)
- Le type de vérification: "post_deploy_check"

Dans ton goal, utilise le type "validation_post_deploy".
Dans ton summary, compare les métriques avant/après si disponibles.

IMPORTANT: C'est une vérification READ-ONLY. Tu ne modifies RIEN. Tu constates et tu mesures.
Si la validation échoue (correctifs non appliqués), signale-le dans le reasoning avec un risk_score élevé.`;
  }
}

function buildPrescribeInstructions(context: { isIktracker: boolean; scoredWorkbenchItems: ScoredWorkbenchItem[] }): string {
  const items = context.scoredWorkbenchItems;
  
  if (items.length === 0) {
    return `## PHASE ACTUELLE: PRESCRIBE (GÉNÉRER LES CORRECTIFS)
Aucun item prioritaire n'a été identifié dans le workbench. 
Alterne entre correctif technique et contenu éditorial :
- Si le dernier cycle était technique → utilise content-architecture-advisor pour créer du contenu
- Si le dernier cycle était contenu → utilise generate-corrective-code pour un correctif technique
- En cas de doute, privilégie content-architecture-advisor (le contenu est sous-représenté)
Fonctions autorisées: generate-corrective-code, content-architecture-advisor`;
  }

  const itemsTable = items.map((it, i) => 
    `${i + 1}. [Tier ${it.tier}: ${TIER_NAMES[it.tier] || '?'}] Score: ${it.spiral_score} | ${it.severity} | ${it.finding_category}
   "${it.title}" → ${it.target_url || 'N/A'}
   ${it.description?.slice(0, 200) || ''}
   action_type: ${it.action_type} | payload: ${JSON.stringify(it.payload)?.slice(0, 500)}`
  ).join('\n\n');

  const topItem = items[0];
  const isCodeAction = ['code', 'both'].includes(topItem.action_type) && [0, 1, 2, 3, 4].includes(topItem.tier);
  const isContentAction = ['content', 'both'].includes(topItem.action_type) && topItem.tier >= 5;

  let channelInstruction = '';
  if (isCodeAction) {
    channelInstruction = `→ L'item #1 est de type TECHNIQUE (tier ${topItem.tier}). Utilise generate-corrective-code avec un payload "fixes".`;
  } else if (isContentAction) {
    channelInstruction = `→ L'item #1 est de type CONTENU (tier ${topItem.tier}). Utilise content-architecture-advisor.`;
  } else {
    channelInstruction = `→ Choisis generate-corrective-code (technique) ou content-architecture-advisor (contenu) selon le type de l'item #1.`;
  }

  return `## PHASE ACTUELLE: PRESCRIBE (GÉNÉRER LES CORRECTIFS)

## PRIORITÉS ALGORITHMIQUES (scoring pyramidal — NE CHANGE PAS L'ORDRE)
L'algorithme de scoring a classé les items suivants par priorité. Tu DOIS traiter l'item #1 en priorité.
Tu ne décides PAS quoi faire — l'algorithme l'a déjà décidé. Tu génères le payload correct.

${itemsTable}

## CANAL DE DÉPLOIEMENT
${channelInstruction}

Fonctions autorisées: generate-corrective-code, content-architecture-advisor

## RÈGLES
1. Traite l'item #1. Si tu peux aussi traiter #2 dans le même payload, fais-le.
2. Pour generate-corrective-code: payload DOIT contenir "fixes": [{ "id", "label", "category", "prompt", "enabled": true, "target_url" }]
3. Pour content-architecture-advisor: payload DOIT contenir "url", "keyword" (pertinent au secteur du site), "page_type", "tracked_site_id"
4. Ne refais PAS de diagnostic. Les données sont classées, exécute.
5. Le "goal.description" doit mentionner le tier et l'item traité.`;
}

function buildIktrackerExecuteInstructions(): string {
  return `## PHASE ACTUELLE: EXECUTE (DÉPLOYER SUR IKTRACKER)
Les correctifs sont générés. Tu dois maintenant les APPLIQUER concrètement.

## IMPORTANT: CHOISIS LE BON CANAL DE DÉPLOIEMENT

Tu as DEUX canaux possibles. Choisis selon le TYPE de correctif:

### CANAL 1: CMS CRUD (iktracker-actions)
Pour: modifier title, meta_description, contenu de page/article, créer des articles/pages.
→ functions: ["iktracker-actions"]
→ payload DOIT contenir "cms_actions": [...]

### CANAL 2: JS Injectable (generate-corrective-code)
Pour: scripts techniques (lazy loading, CLS fixes, schema JSON-LD, optimisations performance, etc.)
→ functions: ["generate-corrective-code"]
→ payload DOIT contenir "fixes": [{ "id": "...", "label": "...", "category": "...", "prompt": "...", "enabled": true }]
→ Le code généré sera poussé vers le CMS via cms-push-code si connexion CMS active, sinon via site_script_rules (widget.js)

### CANAL 3: Déploiement natif du code correctif (cms-push-code)
Pour: pousser le JS généré par generate-corrective-code directement dans le CMS de l'utilisateur
→ functions: ["cms-push-code"]
→ payload: { "tracked_site_id", "code", "code_minified", "label", "placement": "header"|"footer", "fixes_summary": [...] }
→ Supporte: WordPress, Shopify, Drupal, Webflow, PrestaShop, Odoo (fallback widget.js si échec ou Wix)

## RÈGLE CRITIQUE
- Si tes correctifs sont du contenu (texte, méta, articles) → CANAL 1 (iktracker-actions + cms_actions)
- Si tes correctifs sont du code technique (JS, performance, schema) → CANAL 2 (generate-corrective-code + fixes)
- NE METS JAMAIS iktracker-actions dans functions si tu n'as pas de cms_actions concrètes
- Tu peux utiliser LES DEUX canaux en parallèle si tu as les deux types de correctifs

## CHAMPS DISPONIBLES SUR IKTRACKER

### Champs PAGES (create-page / update-page)
| Champ | Type | Description |
|-------|------|-------------|
| title | string | Titre affiché de la page |
| meta_title | string | Balise <title> SEO (si différent du title) |
| meta_description | string | Meta description SEO |
| content | object/string | Contenu Markdown de la page |
| canonical_url | string | URL canonique (si cross-posting ou duplicate) |
| schema_org | object | Données structurées JSON-LD (FAQPage, HowTo, etc.) |
| page_key | string | Identifiant unique / slug de la page |

### Champs POSTS (create-post / update-post)
| Champ | Type | Description |
|-------|------|-------------|
| title | string | Titre de l'article |
| slug | string | URL slug en kebab-case sans accents |
| content | string | Contenu Markdown complet et riche |
| excerpt | string | Résumé court affiché en listing/cards (2-3 phrases) |
| meta_description | string | Meta description SEO (max 160 chars) |
| meta_title | string | Balise <title> SEO si différent du title |
| status | string | TOUJOURS "draft" — JAMAIS "published" |
| author_name | string | Nom de l'auteur affiché (ex: "Équipe IKtracker") |
| image_url | string | URL de l'image à la une (hero image) |
| category | string | Catégorie de l'article |
| tags | string[] | Tags/mots-clés associés |
| canonical_url | string | URL canonique si republication |
| schema_org | object | Données structurées JSON-LD |

## ACTIONS CMS CONCRÈTES (CANAL 1 uniquement)

### Modifier une page existante
{ "action": "update-page", "page_key": "slug-de-la-page", "updates": { "title": "...", "meta_title": "...", "meta_description": "...", "content": "...", "canonical_url": "...", "schema_org": {...} } }

### Modifier un article existant
{ "action": "update-post", "slug": "slug-de-larticle", "updates": { "title": "...", "meta_title": "...", "meta_description": "...", "content": "...", "excerpt": "...", "author_name": "...", "image_url": "...", "category": "...", "tags": [...], "schema_org": {...} } }

### Créer un nouvel article de blog (TOUJOURS EN BROUILLON)
{ "action": "create-post", "body": { "title": "...", "slug": "...", "content": "...", "excerpt": "...", "status": "draft", "meta_description": "...", "meta_title": "...", "author_name": "Équipe IKtracker", "category": "...", "tags": ["...", "..."], "schema_org": { "@context": "https://schema.org", "@type": "BlogPosting", "headline": "...", "description": "...", "author": { "@type": "Organization", "name": "IKtracker" } } } }

### Créer une nouvelle page
{ "action": "create-page", "body": { "title": "...", "page_key": "...", "content": "...", "meta_title": "...", "meta_description": "...", "schema_org": {...} } }

## RÈGLES POUR LA CRÉATION DE CONTENU (create-post)
1. Le contenu DOIT être en **Markdown** (PAS de HTML)
2. Inclure 3-5 liens internes et 1-2 externes
3. excerpt ET meta_description sont deux champs distincts
4. status DOIT être "draft"
5. slug court, kebab-case, sans accents
6. Longueur: 800-1500 mots minimum
7. TOUJOURS remplir: title, slug, content, excerpt, meta_description, status, author_name, category
8. author_name par défaut: "Équipe IKtracker"
9. Dates exactes et cohérentes partout
10. Ne PAS utiliser automatiquement "Guide" dans les titres
11. **TYPOGRAPHIE FR — CASSE PHRASTIQUE OBLIGATOIRE** : tous les titres (title, meta_title, H1, H2, H3, excerpt, slugs visibles) DOIVENT être en casse phrastique française : majuscule UNIQUEMENT au premier mot et aux noms propres (marques, lieux, personnes, sigles). INTERDIT de mettre une majuscule à chaque mot ("Title Case" anglo-saxon). Exemple correct : "Comment optimiser le budget crawl d'un site e-commerce". Exemple INTERDIT : "Comment Optimiser Le Budget Crawl D'un Site E-Commerce". Cette règle s'applique uniquement au français ; en anglais, conserver le Title Case standard.

## INVENTAIRE CMS — CONTENU EXISTANT
⚠️ AVANT DE CRÉER UN ARTICLE, vérifie si un brouillon similaire existe. Si oui, utilise "update-post" au lieu de "create-post".`;
}

function buildWpsyncExecuteInstructions(): string {
  return `## PHASE ACTUELLE: EXECUTE (DÉPLOYER SUR LE SITE)
Les correctifs sont générés. Tu dois maintenant les APPLIQUER via le CMS.
Fonction autorisée: wpsync
Le payload doit contenir:
- Les pages à modifier (URLs)
- Le code correctif à injecter (meta tags, schema, contenu, liens internes)
- Le mode de déploiement (update_post, update_meta, inject_schema)
IMPORTANT: C'est l'étape finale de déploiement. Tu dois déployer, pas diagnostiquer ni prescrire.`;
}
