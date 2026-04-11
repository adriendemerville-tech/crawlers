# Memory: tech/autopilot/ascending-spiral-strategy-fr
Updated: 2026-04-11

## Stratégie de Spirale Ascendante — Contre-Audit et Cycle de Vie

### Objectif
Corriger les dérives de "conquête horizontale" (doublons, contenu non vérifié) en ajoutant un cycle de validation post-déploiement.

### Cycle de vie Workbench fiabilisé
```
pending → in_progress → deployed → done (ou failed)
```

- **POST-EXECUTE** (`autopilot-engine`) : après succès d'une action CMS/IKtracker, l'item passe à `deployed` avec `deployed_at = now()` et `validate_attempts = 0`
- **Contre-audit** (`autopilot-validate-deployed`, cron toutes les 2h) : vérifie les items `deployed` depuis >1h, max 10 par batch

### 4 couches de validation (contre-audit)
1. **Présence** : HTTP 200 + body > 500 caractères
2. **Mécanique** : au moins un H2, absence de placeholders (`[...]`, lorem ipsum)
3. **Sémantique** : titre publié ≈ titre prescrit (Jaccard ≥ 0.5)
4. **Qualité LLM** : `check-content-quality` score ≥ 40 (fallback mécanique si LLM indisponible)

### Gestion des échecs
- Max 3 tentatives (T+1h, T+3h, T+5h) avant verdict `failed`
- Si LLM indisponible : les couches 1+2+3 suffisent pour valider

### Colonnes ajoutées à `architect_workbench`
| Colonne | Type | Description |
|---------|------|-------------|
| `deployed_at` | timestamptz | Date de déploiement |
| `validate_attempts` | integer | Nombre de tentatives de validation (max 3) |

### POST-EXECUTE dual-lane
- **Items contenu** (missing_page, content_gap, content_upgrade, missing_terms) : marqués `deployed` + `consumed_by_content = true`
- **Items tech** (corrective code, injections) : marqués `deployed` + `consumed_by_code = true`
