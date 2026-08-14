# Idée : faire de Marina la phase 1 de Parménion et de la Breathing Spiral

Statut : **idée cadrée, non implémentée**. Date : 2026-08-14.
Ce document note l'intention et le plan détaillé ; aucune ligne de code n'a été écrite pour cette bascule.

## 1. Constat

Aujourd'hui les deux briques vivent côte à côte :

- **Marina** produit un diagnostic complet d'un domaine (crawl, SEO technique 200 points, GEO/AEO, cocon, archétypes de pages, near-duplicate/thin content, autorité, données propriétaires GSC/GA4 quand elles existent) et écrit dans `architect_workbench`.
- **Parménion** démarre sur son propre cycle (garde crawl-in-flight, `cocoon-strategist` → plan 8 tâches, phases de Breathing Spiral) et reconstitue une partie de ce diagnostic.

Conséquence : duplication d'efforts, deux vérités possibles sur l'état du site, et une Breathing Spiral qui choisit sa phase sans le diagnostic le plus riche disponible.

## 2. Cible

Marina devient la **phase 1 « État des lieux »** du cycle Parménion :

```text
Phase 0  Carte d'identité (existant, identityResolver)
Phase 1  Marina  ← diagnostic unique, source de vérité du cycle
Phase 2  Détermination de phase Breathing Spiral (à partir du diagnostic Marina)
Phase 3  cocoon-strategist / prescribe (plan de tâches)
Phase 4  Exécution CMS + validation post-déploiement
```

## 3. Plan détaillé

### Lot A — Contrat de sortie machine de Marina
1. Ajouter à Marina une sortie structurée `marina_diagnosis` (JSON, en plus du HTML) : scores par axe, archétypes et mix, findings normalisés (`severity`, `category`, `target_url`, `pages_affected`), pondération ROI (`impact`, `effort`, `tier`), maturité de domaine, présence de données propriétaires.
2. Persister ce JSON sur le job (`marina_jobs.diagnosis`) et un miroir par domaine (`site_diagnosis_snapshots`) avec `created_at`, `scan_mode`, `pages_analyzed`.
3. GRANT + RLS `auth.uid()` sur la nouvelle table, `service_role` pour les workers.

### Lot B — Fraîcheur et déclenchement
4. Règle de fraîcheur : un diagnostic Marina de moins de **15 jours** (aligné sur `site_crawl_schedule` full crawl) est réutilisé tel quel ; au-delà, Parménion déclenche un run Marina et attend le checkpoint.
5. Réutiliser le sémaphore Browserless et les modes de scan existants — pas de nouveau chemin de crawl.
6. Garde anti-boucle : un seul run Marina en vol par domaine, `backlog guard` inchangé.

### Lot C — Breathing Spiral alimentée par le diagnostic
7. `breathing-spiral` lit `marina_diagnosis` au lieu de recalculer : blocages critiques → phase corrective ; cocon incomplet → phase structurelle ; base saine → phase d'expansion.
8. Journaliser la raison de phase avec l'`id` du diagnostic source (traçabilité d'un cycle à l'autre).

### Lot D — Prescription pondérée
9. `cocoon-strategist` / `prescribe` consomment les findings **déjà pondérés ROI** : à gravité égale, les gains rapides passent devant, les pages `PROTECT_PILLAR` restent intouchables.
10. Conserver les gardes existantes : anti-cannibalisation, diversité de clusters, rotation de personas, seuils de confiance.

### Lot E — Boucle de mesure
11. Après exécution, relancer Marina en mode léger et calculer le delta par axe → alimente la récompense Breathing Spiral et le compteur de validation post-déploiement.
12. Exposer le delta dans /console (onglet Marina) et dans le rapport suivant (« ce qui a bougé depuis le dernier cycle »).

## 4. Risques et gardes

- **Coût** : un run Marina ≈ 0,11–0,14 $. Avec la règle de fraîcheur 15 j, le surcoût par cycle est nul la plupart du temps.
- **Latence** : Marina peut dépasser un cycle Parménion sur gros site → traiter le diagnostic en asynchrone avec checkpoint, jamais en attente bloquante.
- **Régression** : ne pas supprimer les chemins actuels de Parménion avant deux cycles verts en dry-run comparés au chemin historique.
- **Vérité unique** : interdire à Parménion de recalculer un score déjà présent dans `marina_diagnosis`.

## 5. Critères d'acceptation

- Un cycle Parménion cite l'`id` du diagnostic Marina utilisé.
- Zéro recalcul de score SEO/GEO côté Parménion.
- Phase de Breathing Spiral justifiée par des findings traçables.
- Delta par axe disponible entre deux cycles.
