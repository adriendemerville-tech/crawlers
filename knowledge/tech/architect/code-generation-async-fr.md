# Memory: tech/architect/code-generation-async-fr
Updated: 2026-04-25

## generate-corrective-code — Mode Async (Job Queue)

### Problème résolu
La génération de code correctif (Code Architect) dépassait le timeout edge (~60s) sur les sites avec beaucoup de fixes (≥15), provoquant un spinner infini côté UI car `setIsGenerating(false)` n'était jamais atteint si la passerelle coupait la connexion.

### Solution : self-invocation async via `async_jobs`
Même pattern que `content-architecture-advisor` et `audit-strategique-ia` :

1. **Appel initial** avec `async: true` → crée un job dans `async_jobs` (status `pending`, progress 0), self-invoke fire-and-forget vers la même fonction avec `_job_id`, retourne `{ job_id, status: 'pending', async: true }` (HTTP 202)
2. **Self-invocation** avec `_job_id` → exécute le pipeline complet (recherche bibliothèque, scan HTML, génération IA séquentielle/parallèle, minification, scoring), persiste le résultat dans `async_jobs.result_data` avec `status: 'completed'`. En cas d'erreur, status `failed` + `error_message`.
3. **Polling** via `GET ?job_id=xxx` → retourne `{ status, progress, data?, error? }`. Côté UI, intervalle 2.5s, timeout 5 minutes max, bouton "Annuler" qui set un flag local.

### UX
- Bouton "Générer" affiche `Génération X%` au lieu de `Génération...` (mis à jour dès qu'on a un progress depuis le poll).
- Bouton "Annuler" à côté pendant la génération (arrête le polling, n'arrête pas le job côté backend mais libère l'UI).

### Backward-compat
Si un appelant n'envoie pas `async: true`, la fonction conserve son ancien comportement synchrone (réponse complète en 1 fetch). Utile pour autopilot-engine et tests directs.

### Fichiers
- `supabase/functions/generate-corrective-code/index.ts` : ajout poll handler, async-create + self-invoke, persistance `_asyncJobId` en fin de pipeline et catch.
- `src/components/ExpertAudit/CorrectiveCodeEditor/SmartConfigurator/index.tsx` : appel `async: true`, polling boucle, état `generationProgress`, bouton Annuler via `generationAbortRef`.
