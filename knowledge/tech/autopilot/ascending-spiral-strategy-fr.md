# Memory: tech/autopilot/ascending-spiral-strategy-fr
Updated: 2026-04-12

## Stratégie de Spirale Ascendante — Architecture complète

### Objectif
Remplacer la croissance horizontale (doublons, contenu non vérifié) par une priorisation dynamique de la profondeur thématique via le `spiral_score`. Ce score composite (0-100) remplace `total_score` et arbitre toutes les tâches du workbench.

### Infrastructure DB
- `cluster_definitions` : table de clusters thématiques (cluster_name, ring 1/2/3, keywords[], maturity_pct)
- `keyword_universe.semantic_ring` : classification Ring 1 (cœur), Ring 2 (adjacent), Ring 3 (autorité)
- `architect_workbench` : colonnes spiral_score, velocity_decay_score, competitor_momentum_score, cluster_maturity_pct, conversion_weight, gmb_urgency_score, cooldown_until, cluster_id

### Classification des anneaux
Le helper `_shared/spiralClassifier.ts` classifie automatiquement les keywords en rings basé sur l'identity_card du site (market_sector, products_services → Ring 1 ; target_audience → Ring 2 ; reste → Ring 3). Intégré dans `expert-audit` et `process-crawl-queue` post-upsert keyword_universe.

### Formule spiral_score
```
spiral_score = 
  (ring_proximity × 0.18) + (cluster_maturity_gap × 0.18) + (severity × 0.12)
+ (anomaly_urgency × 0.12) + (seasonal_boost × 0.10) + (velocity_decay × 0.08)
+ (keyword_coverage × 0.08) + (competitor_momentum × 0.07) + (gate_technique × 0.07)
× conversion_weight - cooldown_malus + gmb_urgency_bonus
```

### Signaux dynamiques (compute-spiral-signals, cron 6h)
1. **Velocity Decay** : perte ≥3 positions sur 3 semaines (gsc_daily_positions)
2. **Competitor Momentum** : concurrent gagne ≥5 positions (keyword_universe.competitors_data)
3. **Cluster Maturity** : % items deployed/done par cluster
4. **GMB Urgency** : chute ranking local ou perte d'avis
5. **Conversion Weight** : coefficient basé sur ga4_behavioral_metrics.conversion_rate

### Garde-fous
- **Cooldown post-déploiement** : 7 jours de malus (-30 pts) pour laisser GSC se stabiliser
- **Verrouillage agent** : `assigned_to = 'parmenion'` empêche les collisions entre agents
- **Invalidation Stratège** : plans marqués `needs_refresh` si >30% de l'ordre change
- **Auto-génération** : velocity_decay crée automatiquement des items `content_upgrade` pour le contenu qui décline
- **Seuil Ring 1** : maturité > 70% requise avant expansion vers Ring 2

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
