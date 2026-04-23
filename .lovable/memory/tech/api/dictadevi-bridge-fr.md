---
name: tech/api/dictadevi-bridge-fr
description: Pont API Crawlers ↔ Dictadevi (REST custom v1) — base /api/v1, auth Bearer dk_, posts CRUD + pages GET + health. Aucune injection code/redirect/event.
type: feature
---

# Pont Crawlers ↔ Dictadevi (Sprint 8.1)

Mise à jour de Sprint 8 après réception de la doc API officielle (`knowledge/tech/api/dictadevi-bridge-fr.md`).

## Différences vs IKtracker
- **Base URL** : `https://dictadevi.io/api/v1` (et non `/api`)
- **Auth** : `Authorization: Bearer dk_…` (et non `x-api-key`)
- **Surface API minimaliste** : uniquement `/health`, `/posts` (CRUD complet) et `/pages/:key` (GET).
- **PAS supportés** : `push-code-*`, `get-injection-*`, `redirects`, `robots.txt`, `push-event`, `list-pages`, `create/update/delete-page`. Le pont retourne **HTTP 501** + `_not_supported_by_dictadevi: true` pour ces actions, sans appeler l'API.

## Routing autopilot
- `autopilot-engine.resolveCmsBridge(domain)` → `dictadevi-actions` si `isDictadeviDomain(domain)`.
- Payload envoyé : `{ action, params: {...} }` (Dictadevi), vs flat (IKtracker).
- `pushIktrackerEvent` est gardé par `isIktrackerDomain` → jamais appelé pour Dictadevi.
- `cms-push-code` / `cms-push-redirect` sont des Edge Functions séparées (non routées via `dictadevi-actions`) — elles doivent gérer Dictadevi via leur propre logique CMS adapter.

## Auth fallback
`getDictadeviApiKey(supabase)` :
1. `Deno.env.get('DICTADEVI_API_KEY')` (prioritaire si défini)
2. Sinon RPC `get_parmenion_target_api_key('dictadevi.io')` → lit `parmenion_targets.api_key_name` en clair (toléré au Sprint 8 par décision utilisateur).

## Garde éditoriale
Cohérente avec `iktracker-actions` :
- Refus si auteur ∈ {parménion, parmenion, crawlers autopilot}
- Refus si `published_at` > 6 mois

## Ressources publiques (no auth)
Action `get-public-resources` retourne la liste statique des sitemaps + llms.txt + knowledge.json + RSS exposée par Dictadevi (utile pour le crawl GEO).

## Health check
`test-connection` appelle `GET /health` (public) puis sonde `GET /posts?limit=1` avec la clé pour vérifier `write_ready`.
