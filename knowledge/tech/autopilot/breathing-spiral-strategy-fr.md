# Memory: tech/autopilot/breathing-spiral-strategy-fr
Updated: 2026-04-12

## Breathing Spiral — Architecture complète

### Concept
La **Breathing Spiral** (Spirale Respiratoire) est un système homéostatique de pilotage SEO qui remplace la croissance horizontale (doublons, contenu non vérifié) par une priorisation dynamique de la profondeur thématique via le `spiral_score`. Ce score composite (0-100) remplace `total_score` et arbitre toutes les tâches du workbench. La spirale « respire » : elle se contracte (consolidation Ring 1) en réponse aux événements perturbateurs, et s'expand (Ring 2 → Ring 3) quand la fondation est solide.

### Infrastructure DB
- `cluster_definitions` : table de clusters thématiques (cluster_name, ring 1/2/3, keywords[], maturity_pct)
- `keyword_universe.semantic_ring` : classification Ring 1 (cœur), Ring 2 (adjacent), Ring 3 (autorité)
- `architect_workbench` : colonnes spiral_score, velocity_decay_score, competitor_momentum_score, cluster_maturity_pct, conversion_weight, gmb_urgency_score, cooldown_until, cluster_id

### Classification des anneaux
Le helper `_shared/spiralClassifier.ts` classifie automatiquement les keywords en rings basé sur l'identity_card du site (market_sector, products_services → Ring 1 ; target_audience → Ring 2 ; reste → Ring 3). Intégré dans `expert-audit` et `process-crawl-queue` post-upsert keyword_universe.

### Les 3 anneaux
| Ring | Nom | Contenu | Seuil |
|------|-----|---------|-------|
| 1 | Core | Mots-clés cœur de métier (produits, services, marque) | Maturité > 70% requise avant expansion |
| 2 | Adjacent | Thématiques connexes (audience cible, cas d'usage) | Accessible après Ring 1 mature |
| 3 | Autorité | Thought leadership, tendances sectorielles | Expansion de prestige |

### Formule spiral_score
```
spiral_score = 
  (ring_proximity × 0.18) + (cluster_maturity_gap × 0.18) + (severity × 0.12)
+ (anomaly_urgency × 0.12) + (seasonal_boost × 0.10) + (velocity_decay × 0.08)
+ (keyword_coverage × 0.08) + (competitor_momentum × 0.07) + (gmb_urgency × 0.07)
× conversion_weight - cooldown_malus + gmb_urgency_bonus
```

### Signaux dynamiques (compute-spiral-signals, cron 6h)
1. **Velocity Decay** : perte ≥3 positions sur 3 semaines (gsc_daily_positions)
2. **Competitor Momentum** : concurrent gagne ≥5 positions (keyword_universe.competitors_data)
3. **Cluster Maturity** : % items deployed/done par cluster
4. **GMB Urgency** : chute ranking local ou perte d'avis
5. **Conversion Weight** : coefficient basé sur ga4_behavioral_metrics.conversion_rate
6. **News Context** : détection d'événements perturbateurs via anomaly_alerts (sévérité, amplitude, source GSC) — déclenche la contraction défensive

### Respiration de la spirale
| Événement | Direction | Effet | Mécanisme |
|-----------|-----------|-------|-----------|
| Anomalie GSC/GA4 | ⟵ Contraction | Resserrement vers Ring 1 | `anomaly_urgency` booste les items R1 |
| Saisonnalité (Black Friday) | ⟵ Contraction | Repriorise les pages commerciales core | `seasonal_boost` |
| Concurrent gagne terrain | ⟵ Contraction | Ciblage du keyword menacé | `competitor_momentum` |
| Velocity decay | ⟵ Contraction | Auto-génère des `content_upgrade` | `velocity_decay_score` |
| Maturité Ring 1 > 70% | ⟶ Expansion | Progression vers Ring 2 | `cluster_maturity_gap` extérieur devient prioritaire |
| Stabilité confirmée | ⟶ Expansion | Progression vers Ring 3 | Aucune anomalie + couverture core solide |

### Garde-fous
- **Cooldown post-déploiement** : 7 jours de malus (-30 pts) pour laisser GSC se stabiliser
- **Verrouillage agent** : `assigned_to = 'parmenion'` empêche les collisions entre agents
- **Invalidation Stratège** : plans marqués `needs_refresh` si >30% de l'ordre change
- **Auto-génération** : velocity_decay crée automatiquement des items `content_upgrade` pour le contenu qui décline
- **Seuil Ring 1** : maturité > 70% requise avant expansion vers Ring 2
- **Trigger cluster_maturity** : recalcul automatique de la maturité du cluster quand un item passe `deployed`/`done`, cascade sur `spiral_score` des items frères
- **Backfill** : fonction `backfill_workbench_spiral_data()` pour rattacher les items existants aux clusters et recalculer leurs scores

### Consommation par agent (score_spiral_priority)
Tous les agents consomment désormais `score_spiral_priority` au lieu de `score_workbench_priority` :
- Le scoring retourne `spiral_score` (et non plus `total_score`)
- Parménion utilise directement `score_spiral_priority` avec dual-lane (tech/content)

### Boucle de rétroaction (Reward Signal)
- **`spiral_score_at_decision`** : capturé dans `parmenion_decision_log` à chaque cycle pour tracer la priorité attribuée
- **`reward_signal`** (-100 à +100) : calculé à T+30 par `parmenion-feedback` (cron quotidien 3h UTC)
  - Composantes : 40% Δclicks + 25% Δposition (inversé) + 20% ΔCTR + 15% Δimpressions
  - **Pénalité de sur-priorisation** : si `spiral_score_at_decision > 60` mais outcome négatif → malus supplémentaire
- Ce dataset (spiral_score ↔ reward_signal) permettra à terme une régression pour affiner les 9 poids du spiral_score
- **Phase actuelle** : collecte de données (bootstrapping empirique). Affinage automatique prévu Q4 2026

### Cycle de vie Workbench
```
pending → in_progress → deployed → done (ou failed)
```
- POST-EXECUTE : après succès CMS, `deployed` + `cooldown_until = now() + 7 days`
- Contre-audit : vérifie les items `deployed` (présence, mécanique, sémantique, qualité LLM)
- Max 3 tentatives de validation avant `failed`

### Consommation par agent
| Agent | Lecture spiral_score | Rôle |
|-------|---------------------|------|
| Autopilot | top N, toutes lanes | Exécute + cooldown |
| Parménion | lane=content | Génère contenu + verrouille |
| Content Architect | lane=content, non-verrouillé | Mode interactif |
| Stratège Cocoon | par cluster | Plans ordonnés + invalidation |
| Cocoon maillage | pondère cibles | Juice vers Ring 1 immature |

### Landing page
La page `/breathing-spiral` explique le concept avec une animation SVG interactive, le diagramme des 9 signaux, et un tableau des événements de respiration. Optimisée GEO (FAQPage, BreadcrumbList, Article schema).
