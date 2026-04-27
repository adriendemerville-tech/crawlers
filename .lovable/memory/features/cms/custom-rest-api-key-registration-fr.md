---
name: features/cms/custom-rest-api-key-registration-fr
description: Wizard CMS auto-bascule sur étape custom_rest pour Dictadevi avec edge cms-register-api-key (probe Bearer + upsert cms_connections + miroir current_config).
type: feature
---

# Enregistrement de clé API Bearer (custom_rest)

Pour les CMS REST custom (Dictadevi, extensible), le wizard `SmartCmsConnectModal` saute la détection WordPress et propose une étape **custom_rest** :

- **Détection domaine** : tableau `CUSTOM_REST_PLATFORMS` (préfixe clé, label, URL d'aide).
- **Probe + persistance** : edge function **`cms-register-api-key`**
  1. Auth obligatoire (`auth.uid()`), vérifie ownership de `tracked_site_id`
  2. Probe `GET /health` (200) puis `GET /posts?limit=1` avec `Authorization: Bearer <key>` (200)
  3. Upsert `cms_connections` `(user_id, tracked_site_id, platform)` : `auth_method='bearer'`, `api_key=…` (en clair), `status='active'`, `capabilities` = bridge + last_probe
  4. Miroir dans `tracked_sites.current_config` (signature `custom_rest`) → bouton « CMS branché » vert dans Mes Sites

- **Mode `reuse_admin`** : si admin et que `parmenion_targets.api_key_name` existe pour le domaine, bouton « Utiliser la clé existante (admin) » sans ressaisie.
- **Préfixe garde-fou** : la clé doit commencer par le préfixe attendu (`dk_` pour Dictadevi).

Plateforme actuellement câblée : `dictadevi` (base `https://dictadevi.io/api/v1`, bridge `dictadevi-actions`). Ajout d'une nouvelle plateforme = entrée dans `PLATFORM_REGISTRY` (edge) + `CUSTOM_REST_PLATFORMS` (front).
