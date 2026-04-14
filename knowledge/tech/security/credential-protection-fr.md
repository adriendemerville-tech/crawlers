# Memory: tech/security/credential-protection-fr
Updated: 2026-04-13

La protection des identifiants sensibles (tokens OAuth Google, LinkedIn, Facebook, Canva, et clés API CMS ou Marina) repose sur une isolation totale du client. Les composants frontend interrogent exclusivement des vues publiques sécurisées qui masquent les colonnes critiques. L'accès aux tables de base (google_connections, cms_connections, etc.) est strictement interdit aux utilisateurs (SELECT révoqué) et réservé aux Edge Functions exécutées côté serveur avec le privilège 'service_role'. La récupération des clés API Marina s'effectue via une fonction RPC 'SECURITY DEFINER' sécurisée. Cette architecture garantit qu'aucun secret ne transite vers le navigateur.

## Tables de données analytiques restreintes
Les tables `ga4_daily_metrics`, `ga4_top_pages` et `gsc_daily_positions` sont accessibles uniquement via `service_role`. Aucune policy SELECT n'est accordée aux rôles `authenticated` ou `anon`. Les données sont servies aux utilisateurs exclusivement via les Edge Functions.

## Cache d'audit isolé
La table `audit_cache` est restreinte à `service_role` uniquement (plus aucune policy SELECT pour `authenticated`), empêchant toute fuite de données d'audit cross-utilisateur.

## Écriture analyzed_urls
Les opérations INSERT et UPDATE sur `analyzed_urls` sont réservées au `service_role`. La lecture reste publique pour l'affichage des compteurs SEO.

## Protection anti brute-force (Authentification)
Un hook client `useLoginRateLimiter` implémente un verrouillage progressif après tentatives de connexion échouées (5→30s, 8→60s, 12→5min). Persisté en localStorage, il complète le rate-limiting serveur GoTrue (par IP). Le bouton de connexion est désactivé avec un compte à rebours visible pendant le verrouillage. Voir `knowledge/tech/security/login-rate-limiting-fr.md` pour les détails complets.
