# Constat : suivi de la visibilité IA dans l'onglet GEO (aucune modification)

## Confirmé dans le code et la base
- Composant : `src/components/Profile/GEOTab.tsx` → carte « Benchmark LLM » `src/components/Profile/LLMVisibilityDashboard.tsx`.
- Calcul : edge function `calculate-llm-visibility` interroge 5 IA : ChatGPT (gpt-5.4, sous-échantillonné), Gemini, Perplexity (sonar), Claude (haiku), Mistral.
- Planification (pg_cron, actif) : `refresh-llm-visibility-weekly`, `0 7 * * 1` (lundi 07h UTC) → `refresh-llm-visibility-all` (lots de 15 sites, auto-relance) → `calculate-llm-visibility` pour **tous les `tracked_sites`**, sans filtre d'offre.
- Autres crons GEO (via `cron-geo-pipeline`, sites avec Shield Cloudflare actif seulement) : KPIs `0 4 * * *`, CTR `0 5 * * *` + `compute-ai-referral-ctr-daily` `15 4 * * *`, snapshot `geo-pipeline-snapshot-weekly` `0 6 * * 1` (1 site par jour en rotation, donc pas chaque site chaque semaine).
- Historique : conservé dans `llm_visibility_scores` (clé `week_start_date`), affiché en heatmap des 12 dernières semaines (IA en lignes, semaines en colonnes), pas en courbe.
- À la demande : bouton Rafraîchir → même fonction, cache serveur 2h.

## Non confirmé
- Aucune restriction d'offre trouvée pour ce suivi : `isAgencyPremium` est lu dans la carte mais ne bloque ni l'affichage ni le cron ; la fonction ne vérifie pas d'offre.
- Aucune page publique ni `llms.txt` n'affirme un suivi hebdomadaire de la visibilité IA. Les seules mentions « hebdomadaire » de `llms.txt` concernent Google Business (l. 82) et l'IAS (l. 133 : « Historisation hebdomadaire : Suivi dans le temps pour détecter les dérives stratégiques. »).
