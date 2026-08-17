# Lentilles de ciblage Parménion (localisation / persona / cluster)

Objectif : donner à Parménion une **orientation partielle** sur la création de nouvelles pages, sans réorienter le site. Les lentilles n'agissent que sur la fabrique de contenu neuf ; tout le reste du pipeline (tech, maillage, pruning, patchs) reste inchangé.

## 1. Où vivent les réglages

Une table dédiée `parmenion_targeting_lenses` (une ligne par cible Parménion), plutôt que des colonnes ajoutées à `autopilot_configs` — les lentilles sont multi-valeurs et évolutives.

Champs : `target_id`, `lens_type` ('location' | 'persona' | 'cluster'), `enabled`, `values` (jsonb, tableau de valeurs cochées), `share_pct` (part des créations orientées), `proof_level` (calculé, lecture seule).

Règle non négociable : `share_pct` par défaut 30, plafonné à 50. Une lentille ne peut jamais consommer tout le budget contenu.

## 2. Menus déroulants auto-générés

Nouvelle fonction `parmenion-lens-options` qui renvoie, pour un site, les options réellement disponibles :

| Lentille | Source | Vide si |
|---|---|---|
| Localisation | `commercial_area` de la fiche d'identité + villes/régions détectées dans le Keyword Universe (`geo_scope`) + requêtes géo GSC | aucun signal local → lentille désactivée |
| Persona | `decomposePersonas()` (11 profils, filtrés par `business_model`) | `target_audience` vide |
| Cluster | `cluster_definitions` du site | aucun cocon calculé |

Chaque option porte un compteur de preuve (`proof_signals`) affiché dans l'UI : nombre de mentions, requêtes GSC, volume Keyword Universe. Une option à 0 signal est proposée mais marquée « sans preuve » et exclue du mode création de page dédiée.

## 3. Interaction avec les fonctions Parménion existantes

C'est le cœur du plan : les lentilles se branchent en 4 points seulement, et sont **subordonnées** aux garde-fous déjà en place.

```text
audit ─ diagnose ─ prescribe ────────────── execute ─ validate
                      │                        │
                      │(2) quota de slots      │(3) ContentBrief enrichi
                      │(1) bonus de score      │(4) anti-cannibalisation géo
```

1. **`score_spiral_priority` (SQL)** — un `lens_bonus` (max +8) s'ajoute au `spiral_score` des items de type création dont le cluster/persona correspond aux valeurs cochées. Le cap existant de 2 items par cluster (`cluster_rank <= 2`) reste prioritaire : la lentille ne peut pas contourner la diversité thématique.
2. **`parmenion-orchestrator` / budget** — le `content_budget_pct` (30 % par défaut) est **sous-divisé** : sur les slots contenu du cycle, `share_pct` est réservé aux items orientés, le reste garde la trajectoire nationale. Sur 8 tâches avec 30 % contenu et 30 % de lentille, 1 tâche sort orientée. Si aucun item orienté n'est éligible, le slot retourne au pool général (jamais de création forcée).
3. **`personaEngine.ts`** — la rotation round-robin existante est filtrée par les personas cochées **uniquement pour les slots orientés** ; les slots non orientés continuent la rotation complète, donc aucune persona n'est jamais famélique.
4. **`buildContentBrief()` (`_shared/l.ts`)** — pour un slot orienté localisation : injection d'un bloc `LOCAL_CONTEXT` (zone, preuves disponibles, CTA `book-appointment` si `business_model = service_local`). Deux modes selon la preuve :
   - preuve forte (adresse + requêtes géo + mentions) → autorise une **page dédiée** ;
   - preuve faible → interdit la page dédiée, injecte seulement du **contexte local dans un article national**.
5. **`cocoon-strategist` / anti-cannibalisation** — nouvelle règle de hiérarchie géo : une page région est un pilier, une page ville une fille transactionnelle. Interdiction de créer une ville avant l'existence du pilier régional, et blocage si deux villes visent la même intention sans différenciation d'intention (Know/Do/Buy).
6. **`prescriptionWorkbench.ts`** — chaque item créé porte `lens_applied` (type + valeurs) pour traçabilité, et le backlog guard existant (pause > 5 décisions non exécutées) s'applique inchangé.

## 4. UI

Dans `ParmenionTargetPanel` (onglet du site), un bloc « Lentilles de ciblage » :
- 3 cases à cocher, chacune dépliant un multi-select des options auto-générées ;
- un curseur `share_pct` par lentille (0–50 %) avec aperçu textuel : « ~1 création orientée sur 8 tâches » ;
- badges de preuve par option, et message explicite quand une lentille est indisponible faute de signaux.

Boutons sans fond, bordure + texte, conformément au design système.

## 5. Sécurité et cohérence

- RLS sur `parmenion_targeting_lenses` via `auth.uid()` (+ GRANT `authenticated` / `service_role`).
- Aucune lentille n'autorise une action destructive : pruning et merge restent hors périmètre.
- `proof_level` recalculé à chaque cycle : si les signaux disparaissent, la lentille passe en mode « contexte injecté » automatiquement.

## 6. Découpage

- **Sprint 1** — table + RLS, `parmenion-lens-options`, UI de configuration (aucun effet moteur). Vérifiable immédiatement sur Dictadevi : la liste PACA se remplit ou non.
- **Sprint 2** — branchement scoring (`lens_bonus`) et quota de slots dans l'orchestrateur, avec log par cycle du nombre de slots orientés.
- **Sprint 3** — ContentBrief local/persona, hiérarchie région/ville et garde anti-cannibalisation géo.

## Détails techniques

Fichiers touchés : migration SQL (`parmenion_targeting_lenses`, refonte `score_spiral_priority`), `supabase/functions/parmenion-lens-options/index.ts` (nouveau), `supabase/functions/parmenion-orchestrator/index.ts`, `supabase/functions/_shared/parmenion/personaEngine.ts`, `supabase/functions/_shared/parmenion/prescriptionWorkbench.ts`, `supabase/functions/_shared/l.ts`, `supabase/functions/cocoon-strategist/index.ts`, `src/components/Admin/ParmenionTargetPanel.tsx`.

Coût LLM : nul en Sprint 1 (options 100 % déterministes), inchangé ensuite — les lentilles réorganisent des slots existants, elles n'ajoutent aucun appel.
