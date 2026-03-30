# Memory: tech/architect/code-content-routing-fr
Updated: 2026-03-30

## Routage intelligent Code / Contenu dans Code Architect

### Principe
Chaque recommandation issue de l'audit expert est classifiée en deux canaux de livraison :
- `code` : injection JS/CSS via `generate-corrective-code` (performance, schema.org, tracking, accessibilité)
- `content` : modification CMS native via Content Architect (H1, meta description, title, FAQ, blog, contenu sémantique)

### Classification (`classifyFixChannel`)
Définie dans `SmartConfigurator/types.ts`. Les fix IDs suivants sont `content` :
- `fix_title`, `fix_meta_desc`, `fix_h1` (meta/titres)
- `inject_faq`, `inject_blog_section` (sections contenu)
- `fix_missing_blog`, `fix_semantic_injection` (génératif contenu)

Tous les autres fix IDs sont `code`.

### UX — ContentDelegationSection
Un encart "Contenu via Content Architect" apparaît en bas de chaque onglet (Basique, Stratégie, Super) :
- Liste les fixes contenu activés avec leur statut (En attente / Préparation / Prêt / Déployé)
- Si CMS connecté : badge "CMS connecté", message "poussé directement dans votre CMS"
- Si CMS non connecté : badge "CMS requis", fallback JS mentionné

### Flux technique
1. L'utilisateur sélectionne ses fixes (code + contenu mélangés)
2. Au clic "Générer" :
   - Les fixes `code` sont envoyés à `generate-corrective-code` (comme avant)
   - Les fixes `content` sont envoyés en parallèle à `content-architecture-advisor` (si CMS connecté)
   - Sans CMS, les fixes `content` restent dans le lot `generate-corrective-code` (fallback JS)
3. Au clic "Injecter" :
   - Le code est poussé via `update-config` + `site_script_rules`
   - Le contenu (si prêt) est déployé en parallèle via le pipeline Content Architect → CMS

### Détection CMS
Vérification via `cms_connections` table, champ `tracked_site_id`. Résultat stocké dans `hasCmsConnectionForContent`.

### Fichiers modifiés
- `SmartConfigurator/types.ts` : ajout `FixDeliveryChannel`, `classifyFixChannel()`, `CONTENT_CHANNEL_FIX_IDS`
- `SmartConfigurator/index.tsx` : classification, CMS check, split generate/deploy, rendu ContentDelegationSection
- `SmartConfigurator/ContentDelegationSection.tsx` : nouveau composant UI
