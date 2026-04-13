# Memory: tech/security/multi-tenant-isolation-fr
Updated: 2026-04-13

Le système garantit une isolation stricte des données par 'user_id' pour l'ensemble des modules. Les Edge Functions critiques (GSC, GA4, GTM, GBP) utilisent exclusivement l'identité validée via le jeton JWT (Supabase Auth). Pour prévenir les fuites de données, les tables de reporting brut (ga4_daily_metrics, ga4_top_pages, gsc_daily_positions) sont inaccessibles aux utilisateurs et restreintes au 'service_role'. La sécurité de l'authentification est renforcée par l'activation obligatoire du filtre HIBP (Have I Been Pwned) pour tous les comptes. Les liens courts et magiques sont protégés contre l'énumération par des politiques RLS restrictives et des fonctions de lookup sécurisées.

## Protection anti-énumération
L'endpoint `check-email-exists` retourne systématiquement `{exists: false}` pour empêcher l'énumération des comptes utilisateur. La vérification d'existence est gérée côté Supabase Auth uniquement.

## Sanitisation HTML
Le rendu HTML des articles de blog utilise **DOMPurify** (remplacement du sanitizer regex custom) pour une protection XSS complète couvrant : `javascript:` URIs, iframes, objets embed, SVG payloads, event handlers double-encodés, et CSS expressions.

## Realtime
La table `realtime.messages` (schéma réservé Supabase) ne peut pas recevoir de policies RLS personnalisées. La sécurité repose sur le fait que les tables sources publiées en Realtime sont toutes protégées par des policies RLS user_id-scoped.
