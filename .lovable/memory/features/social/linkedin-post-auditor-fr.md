---
name: LinkedIn post auditor (boucle 2)
description: Audit automatique 5 min après publication LinkedIn — score déterministe, correction LLM du hook, PARTIAL_UPDATE
type: feature
---
Seconde boucle d'automatisation LinkedIn : `supabase/functions/linkedin-post-auditor`.

- Déclenchée par cron pg_cron `linkedin-audit-published-5min` (*/5 * * * *, header `x-cron-secret`), ou manuellement depuis l'admin (bouton "Auditer maintenant", body `{ post_id }`).
- Lit le texte réellement publié via `GET /rest/posts/{urn}` (gateway LinkedIn, version 202510) + engagement via `/v2/socialActions`.
- Score déterministe 0–100 pondéré : longueur 1000–1500 hors hashtags (35), mention `@crawlers.fr` (15), zéro emoji (10), zéro tiret cadratin (5), hook 40–140 signes non générique et porteur de tension/chiffre (25), lisibilité paragraphes (5), CTA final (5).
- Seuil d'entrée 75 (ou hook faible) → boucle d'amélioration itérative. **Cible d'arrêt : 90 + hook fort.** Arrêt anticipé si gain < 3 points (plateau) ou candidat invalide. Max 3 itérations LLM par exécution, 5 cumulées par post. Un seul `PARTIAL_UPDATE` LinkedIn par run (meilleur candidat).
- Le cron relance un cycle sur les posts déjà audités dont `audit_score < 90` et `audit_attempts < 5` ; statut `patched` seulement si la cible est atteinte, sinon `needs_review`.
- Colonnes sur `linkedin_scheduled_posts` : `audit_status` (passed/patched/needs_review/failed), `audit_score`, `audit_report` (jsonb, avec `iterations`, `stop_reason`, `llm_calls`), `audited_at`, `audit_attempts`.

- UI : badge d'audit + bouton "Auditer maintenant" dans `src/components/Admin/LinkedInAutomationDashboard.tsx`.
