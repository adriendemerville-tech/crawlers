# Guide SAV — Brancher un CMS REST custom (Dictadevi & co.)
Updated: 2026-04-27

## Quand utiliser ce guide
L'utilisateur veut que le bouton « CMS branché » passe au **vert émeraude** dans **Mes Sites** pour un site qui n'est pas WordPress/Shopify (ex : `dictadevi.io`).

## Parcours utilisateur (3 clics)
1. **Mes Sites** → bouton CMS du site → ouvre `SmartCmsConnectModal`
2. Le wizard détecte le domaine (registry `CUSTOM_REST_PLATFORMS`) et affiche directement l'étape **`custom_rest`** (pas de scan WordPress)
3. L'utilisateur colle sa clé `dk_…` → bouton **« Tester & enregistrer »** → validation backend (`/health` + `/posts`) → upsert `cms_connections` → le bouton passe vert au prochain refresh

## Cas particulier admin
Si le compte courant est admin **et** une clé existe déjà dans `parmenion_targets` pour ce domaine (autopilot), un bandeau ambre propose **« Utiliser la clé existante (admin) »** (mode `reuse_admin`) — pas de ressaisie.

## Réponses Félix types

**Q : Comment activer Dictadevi ?**
> Va dans **Mes Sites**, clique sur le bouton CMS de `dictadevi.io`. Le wizard te demandera ta clé API (préfixe `dk_…`), tu peux la créer dans Dictadevi → Paramètres → API. Une fois testée, le bouton passe au vert.

**Q : J'ai collé ma clé mais ça refuse.**
> Vérifie : (1) le préfixe `dk_`, (2) la clé n'est pas révoquée côté Dictadevi, (3) elle a bien le scope écriture. Le test interroge `/health` puis `/posts` — si le second échoue en 401, c'est un souci de permissions.

**Q : Le bouton reste gris alors que j'ai validé.**
> Refresh la page. Si toujours gris, l'enregistrement dans `cms_connections` n'a pas eu lieu — relance le wizard et regarde le toast d'erreur.

## Diagnostic admin (depuis la console)

```sql
-- Voir si la connexion existe
SELECT platform, status, auth_method, managed_by, last_success_at
FROM cms_connections
WHERE tracked_site_id = '<uuid>';

-- Voir si current_config est rempli (déclenche le vert)
SELECT current_config FROM tracked_sites WHERE id = '<uuid>';
```

## Liens
- Doc technique : `knowledge/features/cms/custom-rest-api-key-registration-fr.md`
- Lexique : `knowledge/tech/sav/lexique/cms-connection-fr.md`
- Mémoire : `mem://features/cms/custom-rest-api-key-registration-fr`
