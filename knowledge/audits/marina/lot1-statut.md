# Lot 1 — Preuve sociale déterministe : statut final (2026-08-17)

## Périmètre livré

| Brique | Fichier | État |
|---|---|---|
| Module 3 couches (JSON-LD/DOM, Places 24 h, LLM qualification only) | `supabase/functions/_shared/socialProof.ts` | fait |
| Audit stratégique GEO | `audit-strategique-ia/index.ts` + `_shared/strategicPrompts.ts` + `_shared/strategicSplitPrompts.ts` | fait |
| Analyseur de page | `_shared/strategicAudit/pageAnalyzer.ts` | fait |
| **Audit technique SEO** | `audit-expert-seo/index.ts` | fait — couche 1 (HTML rendu) + couche 2 (Places), bloc factuel injecté dans le prompt narratif, champ `social_proof_verified` dans la réponse |
| **E-E-A-T unifié** | `check-eeat/index.ts` | fait — couche 1 sur le contexte multi-pages, couche 2 via fiche GBP connectée sinon Places, bloc injecté dans le prompt, champ `signals.socialProofVerified` |
| **Score GEO « données structurées »** | `_shared/citationScorer.ts` | fait — lit les types réellement détectés au crawl (`structuredData.schemaTypes`, `htmlAnalysis.schemaTypes`, `scores.aiReady.schemaTypes`) ; renvoie `null` (non mesuré) au lieu de 10/100 quand aucune information n'existe |

## Règles dures désormais garanties

1. Une couche supérieure ne peut jamais infirmer une couche inférieure : si le HTML ou une API expose des avis, aucun LLM ne peut écrire « aucune preuve sociale » (`enforceSocialProofOnLlm`).
2. Statut `inconclusive` quand le contenu analysé est vide/non rendu : ni présence ni absence affirmée.
3. Le score de citabilité ne contredit plus l'audit technique sur la présence de Schema.org.

## Consommateurs

Marina, Workbench, Parménion et les rapports PDF lisent `social_proof_verified` / `signals.socialProofVerified`, donc plus de « 0 avis » face à des avis constatés.

## Reste du plan

Lots 3 (normalisation boilerplate), 4 (réconciliation des compteurs et clamp des scores), 5 (déduplication + ROI), 6 (éditorialisation), puis re-notation avec la grille consolidée.
