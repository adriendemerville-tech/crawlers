---
name: LinkedIn post auditor (boucle 2)
description: Audit automatique 5 min après publication LinkedIn — score déterministe, correction LLM du hook, PARTIAL_UPDATE
type: feature
---
Seconde boucle d'automatisation LinkedIn : `supabase/functions/linkedin-post-auditor`.

- Déclenchée par cron pg_cron `linkedin-audit-published-5min` (*/5 * * * *, header `x-cron-secret`), ou manuellement depuis l'admin (bouton "Auditer maintenant", body `{ post_id }`).
- Lit le texte réellement publié via `GET /rest/posts/{urn}` (gateway LinkedIn, version 202510) + engagement via `/v2/socialActions`.
- Score déterministe 0–100 (longueur 1000–1500 hors hashtags, mention `@crawlers.fr`, aucun emoji, qualité/longueur du hook). Seuil de correction : 75, ou hook faible.
- Si sous le seuil : réécriture par LLM (mistral-large) focalisée hook + impressions, revérifiée par le même auditeur, puis `PARTIAL_UPDATE` du `commentary` avec échappement Little Text. Max 2 tentatives par post.
- Colonnes sur `linkedin_scheduled_posts` : `audit_status` (passed/patched/needs_review/failed), `audit_score`, `audit_report` (jsonb), `audited_at`, `audit_attempts`.
- UI : badge d'audit + bouton "Auditer maintenant" dans `src/components/Admin/LinkedInAutomationDashboard.tsx`.
