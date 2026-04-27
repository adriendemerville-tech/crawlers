# Lexique SAV — Connexion CMS & Clés API
Updated: 2026-04-27

## Termes

### CMS branché (statut vert)
Le bouton « CMS branché » (vert émeraude) sur **Mes Sites** signifie que `tracked_sites.current_config` contient une configuration CMS valide (logique `isSiteSynced()` dans `MyTracking.tsx`). Pour un CMS REST custom, ce statut n'est positionné qu'après upsert réussi dans `cms_connections` via `cms-register-api-key`.

### custom_rest (plateforme)
Famille de CMS exposant une API REST avec authentification **Bearer token**. Aujourd'hui : **Dictadevi** (`dk_*`). Le wizard `SmartCmsConnectModal` détecte le domaine et bascule directement sur l'étape `custom_rest` (pas de scan WordPress).

### Clé `dk_…`
Préfixe des clés API Dictadevi. Saisie par l'utilisateur dans le wizard, validée côté edge via `GET /health` + `GET /posts?limit=1`, puis stockée en clair dans `cms_connections.api_key` (RLS `auth.uid() = user_id`).

### Mode `reuse_admin`
Bouton « Utiliser la clé existante (admin) » disponible uniquement pour les administrateurs ayant déjà seedé une clé dans `parmenion_targets` (autopilot). Évite la ressaisie : la clé est copiée dans le `cms_connections` du compte courant.

### Probe `/health` + `/posts`
Validation backend systématique avant upsert : la clé doit retourner 200 sur les deux endpoints. Sinon, l'enregistrement est refusé et l'utilisateur reste sur l'étape `custom_rest`.

## Diagnostic rapide

| Symptôme | Cause probable | Action |
|---|---|---|
| Bouton CMS reste gris/orange | `current_config` vide ou pas d'entrée `cms_connections` active | Relancer le wizard et compléter l'étape `custom_rest` |
| « Clé invalide » au test | Préfixe incorrect ou key révoquée côté Dictadevi | Régénérer une clé `dk_…` dans Dictadevi |
| Probe `/health` 200 mais `/posts` 401 | Clé sans scope écriture | Vérifier les permissions de la clé |
| Admin : clé existe mais n'apparaît pas | Pas de `parmenion_targets.api_key` pour ce domaine | Seeder via Parménion ou utiliser le mode `manual` |

## Liens
- Doc technique : `knowledge/features/cms/custom-rest-api-key-registration-fr.md`
- Mémoire : `mem://features/cms/custom-rest-api-key-registration-fr`
- Edge : `supabase/functions/cms-register-api-key/index.ts`
