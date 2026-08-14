---
name: Marina — section « Données propriétaires » (GSC + GA4) conditionnelle
description: Section 3b du rapport Marina alimentée par la Search Console et GA4 de l'utilisateur, affichée seulement si une connexion Google vérifiée couvre le domaine audité
type: feature
---

## Module `_shared/marinaOwnerData.ts`
- `fetchOwnerPerformanceData(sb, userId, domain)` : `resolveGoogleToken` (lien `tracked_sites.google_connection_id`, puis auto-match `gsc_site_urls`, puis legacy profil) → propriété GSC **vérifiée** résolue via `GET /webmasters/v3/sites` (jamais devinée, préférence `sc-domain:`) → 4 requêtes `searchAnalytics/query` (28 j arrêtés à J-3, 28 j précédents, top 10 requêtes, top 10 pages) + `fetchGA4Engagement` si `ga4_property_id`.
- Retourne `null` si pas de token, pas de propriété correspondante, ou zéro impression/session → la section **n'apparaît pas du tout** (ni dans le sommaire).
- `renderOwnerPerformanceHTML(data, '3b')` : cartes clics/impressions/CTR/position avec deltas vs période précédente (position en delta inversé), tables top requêtes / top pages, bloc GA4, puis « Ce que ces données changent dans la lecture de l'audit » — lectures déterministes (CTR bas à bonne position = titres/métas, position > 15 = gains 8-20, chute clics ≥ 15 %, engagement < 45 %, session < 30 s). **0 token LLM.**

## Intégration
- `marina/index.ts` : calcul best-effort après le plan consolidé, clé `ownerPerformance` de `compileMarinaReport`, rendue en 3b juste après l'audit stratégique, `data-marina-scope="site"` (donc mutualisée dans les rapports multipages) + `data-pdf-section`.
- Charte respectée : violet #6d28d9 / or #d4af37, aucun emoji.
- Mention explicite du décalage GSC de ~2 jours et de l'omission des requêtes à faible volume (totaux = borne basse).
