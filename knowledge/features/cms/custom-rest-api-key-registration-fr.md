# Enregistrement de clé API custom_rest (Bearer)

## Vue d'ensemble

Pour les CMS REST custom (Dictadevi aujourd'hui, extensible), le branchement passe par l'edge function **`cms-register-api-key`** au lieu du flux WordPress (Application Password / plugin).

## Edge Function : `cms-register-api-key`

**Auth** : `auth.uid()` requis. Refuse `service-role` et user non-propriétaire du `tracked_site_id`.

**Body** :
```json
{
  "tracked_site_id": "uuid",
  "platform": "dictadevi",      // optionnel, inféré par domaine
  "mode": "manual" | "reuse_admin",
  "api_key": "dk_…"             // requis si mode=manual
}
```

**Workflow** :
1. Vérifie ownership : `tracked_sites.user_id = auth.uid()`
2. Résout la plateforme via `PLATFORM_REGISTRY` (registry interne, par domaine ou paramètre explicite)
3. Vérifie le préfixe (`dk_` pour Dictadevi)
4. Probe : `GET /health` (200) + `GET /posts?limit=1` avec `Authorization: Bearer <key>` (200)
5. Upsert dans `cms_connections` `(user_id, tracked_site_id, platform)` :
   - `auth_method='bearer'`, `api_key=<clef en clair>`, `status='active'`
   - `capabilities` : bridge + dernier probe (status, timestamp)
   - `managed_by` : `'user'` (manual) ou `'admin'` (reuse_admin)
6. Miroir signature dans `tracked_sites.current_config` → le bouton « CMS branché » de Mes Sites passe vert (logique `isSiteSynced(current_config)`)

**Mode `reuse_admin`** (admin uniquement) : récupère la clé déjà stockée dans `parmenion_targets` via la RPC `get_parmenion_target_api_key(p_domain)` et l'enregistre dans `cms_connections` du compte courant — évite la ressaisie pour les admins qui ont déjà seedé la clé côté autopilot.

## Wizard `SmartCmsConnectModal`

- À l'ouverture : si `cms_connections` actives existent → step `already_connected`. Sinon, si le domaine matche `CUSTOM_REST_PLATFORMS` → step `custom_rest` (saute la détection WP).
- Étape `custom_rest` : champ password masqué, validation préfixe, bouton « Tester & enregistrer » qui appelle `cms-register-api-key` (mode `manual`). Pour les admins avec clé `parmenion_targets`, bandeau ambre + bouton « Utiliser la clé existante (admin) » (mode `reuse_admin`).
- Bouton « Autres méthodes » → repli vers le wizard standard (`idle`).

## Extension à un nouveau CMS REST

1. **Edge** : ajouter une entrée dans `PLATFORM_REGISTRY` (`baseUrl`, `healthPath`, `writeProbePath`, `apiKeyPrefix`, `domainHints`)
2. **Front** : ajouter une entrée dans `CUSTOM_REST_PLATFORMS` (`match`, `platform`, `label`, `keyPrefix`, `keyHelpUrl?`)
3. Vérifier que `cms_platform` enum supporte la nouvelle valeur (sinon migration)

## Sécurité

- Clés stockées en clair dans `cms_connections.api_key` (cohérent avec `basic_auth_pass`, `oauth_access_token`). RLS `auth.uid() = user_id` empêche l'accès cross-tenant.
- Voir `mem://tech/security/credential-protection-fr` pour la stratégie globale (vues secure pour SELECT côté client).

## Liens

- Edge : `supabase/functions/cms-register-api-key/index.ts`
- Front : `src/components/Profile/SmartCmsConnectModal.tsx` (step `custom_rest`)
- Bridge associé : `dictadevi-actions` (`mem://tech/api/dictadevi-bridge-fr`)
