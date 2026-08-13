---
name: Marina — carte d'identité éditable et verrouillable avant le crawl
description: Panneau /marina permettant d'éditer secteur/modèle d'affaires avant l'audit, avec Recalculer (déterministe) et Verrouiller (source user_manual prioritaire)
type: feature
---

## Interface (src/components/Marina/MarinaIdentityPanel.tsx)
- Placée sous la barre d'URL de `/marina`, au-dessus du panneau Multipages.
- Boutons : « Préparer la carte » / « Relire la carte », « Réinférer depuis le site » (désactivé si verrouillé), « Recalculer » (actif seulement si champs modifiés), « Verrouiller la carte ».
- Champs éditables : secteur (liste `SECTOR_OPTIONS`), modèle d'affaires (`COMMERCIAL_MODEL_OPTIONS`), type d'entité, zone commerciale, produits/services, cible, concurrents (6 max).

## Backend — actions ajoutées à la fonction `marina` (pas de nouvelle edge function)
- `identity_resolve` : `resolveIdentityCard` (réutilise la base, sinon inférence légère). `force: true` pour réinférer.
- `identity_recompute` : recalcul déterministe des axes + confiance depuis les champs édités. Aucun token, aucune écriture.
- `identity_lock` : crée le `tracked_sites` si absent, écrit via `writeIdentity` en source `user_manual` (`forceDirectWrite` + `forceOverwrite`), puis renvoie la carte relue.

## Règles
- `sectorTaxonomy.ts` expose `SECTOR_OPTIONS` avec `canonicalText` : le texte stocké dans `market_sector` doit se re-normaliser vers la clé choisie (overrides pour `media_edition` et `telecom_reseaux`).
- `identityResolver.ts` : une carte `identity_source = 'user_manual'` exploitable prime toujours — ni la fraîcheur (30 j) ni `forceRefresh` ne déclenchent de réinférence dessus.
