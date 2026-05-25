# Memory: tech/security/credential-protection-fr
Updated: 2026-05-25

La protection des identifiants sensibles repose sur un **REVOKE SELECT au niveau colonne** (pas vue, pas REVOKE table) sur les colonnes secrets/tokens, depuis les rôles `authenticated` et `anon`. Les RLS row-scope restent en place ; seules les colonnes sensibles ne sont jamais renvoyées via PostgREST. Les Edge Functions utilisent `service_role` et conservent un accès complet.

Colonnes révoquées (2026-05-25) :
- `cf_shield_configs` : `ingestion_secret`, `cf_token_encrypted`
- `google_connections` : `access_token`, `refresh_token`
- `cms_connections` : `oauth_access_token`, `oauth_refresh_token`, `api_key`, `basic_auth_pass`
- `canva_connections` : `access_token`, `refresh_token`
- `social_accounts` : `access_token`, `refresh_token`
- `firehose_taps` : `tap_token_encrypted`
- `tool_api_keys` : `api_key`

⚠️ Côté frontend : ne JAMAIS utiliser `.select('*')` sur ces tables — utiliser une liste explicite de colonnes non sensibles. Sinon PostgREST renverra une erreur permission denied.

Exception acceptée : `marina_api_keys.api_key` reste lisible par son propriétaire (UI de gestion clés, copie nécessaire). Risque scopé par RLS user_id, à migrer vers hash + display-once dans un sprint dédié.

## Tables de données analytiques restreintes
Les tables `ga4_daily_metrics`, `ga4_top_pages` et `gsc_daily_positions` sont accessibles uniquement via `service_role`. Aucune policy SELECT n'est accordée aux rôles `authenticated` ou `anon`. Les données sont servies aux utilisateurs exclusivement via les Edge Functions.

## Cache d'audit isolé
La table `audit_cache` est restreinte à `service_role` uniquement (plus aucune policy SELECT pour `authenticated`), empêchant toute fuite de données d'audit cross-utilisateur.

## Écriture analyzed_urls
Les opérations INSERT et UPDATE sur `analyzed_urls` sont réservées au `service_role`. La lecture reste publique pour l'affichage des compteurs SEO.

## Protection anti brute-force (Authentification)
Un hook client `useLoginRateLimiter` implémente un verrouillage progressif après tentatives de connexion échouées (5→30s, 8→60s, 12→5min). Persisté en localStorage, il complète le rate-limiting serveur GoTrue (par IP). Le bouton de connexion est désactivé avec un compte à rebours visible pendant le verrouillage. Voir `knowledge/tech/security/login-rate-limiting-fr.md` pour les détails complets.
