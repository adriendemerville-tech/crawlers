# Memory: tech/architect/content-advisor-async-fr
Updated: 2026-03-31

## content-architecture-advisor — Mode Async (Queue)

### Problème résolu
La function `content-architecture-advisor` dépassait le timeout des edge functions (~60s) à cause de :
- DataForSEO (2 appels, 15s timeout chacun)
- Firecrawl scraping (3 URLs, 20s timeout chacun)  
- Gemini 2.5 Pro avec un prompt massif + tool calling (~30-60s)

### Solution : Self-invocation async via `async_jobs`
Même pattern que `audit-strategique-ia` et `marina` :

1. **Appel initial** avec `async: true` → crée un job dans `async_jobs`, self-invoke fire-and-forget, retourne `{ job_id, status: 'pending' }` (HTTP 202)
2. **Self-invocation** avec `_job_id` → exécute le pipeline complet, met à jour le progress (5→10→20→35→50→65→100), sauvegarde le résultat dans `async_jobs.result_data`
3. **Polling** via `GET ?job_id=xxx` → retourne le status/progress/résultat

### Intégration Parménion (autopilot-engine)
L'autopilot-engine utilise `async: true` et poll le résultat toutes les 10s pendant max 5 minutes.

### Appels directs (utilisateur connecté)
Les appels sans `async: true` fonctionnent comme avant (synchrone). Le mode async est activé uniquement quand le caller le demande explicitement.
