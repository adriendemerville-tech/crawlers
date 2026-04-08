# Memory: tech/autopilot/workbench-v2-fr
Updated: 2026-04-08

## Architect Workbench — Table centralisée des diagnostics

### Table `architect_workbench`
Centralise les diagnostics et données stratégiques pour les outils Content Architect, Code Architect et l'Autopilote Parménion.

### Colonnes clés
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | PK |
| `user_id` | uuid | Propriétaire |
| `domain` | text | Domaine cible |
| `tracked_site_id` | uuid | FK → tracked_sites |
| `title` | text | Titre du finding |
| `description` | text | Description détaillée |
| `finding_category` | text | Catégorie (meta, content, structure, etc.) |
| `severity` | text | critical / high / medium / low |
| `priority_tag` | enum | workbench_priority_tag — **priority** (🔴) / **recommended** (🟡) / **optional** (⚪) |
| `source_type` | enum | diagnostic_source_type (audit_expert, cocoon_diag, strategic, etc.) |
| `source_function` | text | Nom de la fonction source |
| `action_type` | enum | architect_action_type (code / content / both) |
| `status` | enum | workbench_item_status (pending / in_progress / done / dismissed) |
| `target_url` | text | URL de la page cible |
| `target_selector` | text | Champ CMS ou sélecteur CSS (h1, meta_description, schema_org, content, a[href]) |
| `target_operation` | text | Action : replace, insert_after, append, create, delete_element |
| `payload` | jsonb | Données additionnelles (keywords, snippets, etc.) |
| `consumed_by_code` | bool | Consommé par Code Architect |
| `consumed_by_content` | bool | Consommé par Content Architect |

### Priority Tag (auto-calculé)
Le trigger `trg_assign_priority_tag` calcule automatiquement `priority_tag` à l'insertion et à chaque modification de `severity` :
- severity `critical` ou `high` → `priority` (🔴 badge dans les rapports)
- severity `medium` → `recommended` (🟡)
- sinon → `optional` (⚪)

Ce tag est exposé dans les résultats de `score_workbench_priority` et guide :
- **Code Architect** : priorise les fixes prioritaires
- **Content Architect** : traite les contenus prioritaires en premier
- **Stratège Cocoon** : intègre la priorité dans ses recommandations
- **Rapports SEO/GEO** : affiche un badge visuel sur les métriques critiques

### Fonction de scoring : `score_workbench_priority`
```sql
score_workbench_priority(p_domain, p_user_id, p_limit, p_lane, p_force_content)
```
Retourne les items scorés avec :
- `tier` (0-10 selon la pyramide)
- `base_score`, `severity_bonus`, `aging_bonus`, `gate_malus`
- `total_score` = base + severity + aging - gate
- `target_selector`, `target_operation` (coordonnées de ciblage)
- `lane` (tech / content)
- `priority_tag` (priority / recommended / optional)

### Alimentation
- **Trigger `assign_workbench_action_type`** : assigne automatiquement `action_type` (code/content/both) à l'insertion
- **Fonction `populate_architect_workbench`** : remplit les items depuis les audits, avec inférence de `target_selector` et `target_operation` si non fournis par la source
- **Enrichissement direct** : les fonctions d'audit (audit-expert-seo, cocoon-diag-*) fournissent désormais `target_selector` et `target_operation` directement dans leurs recommandations

### Mapping target_selector par source

#### audit-expert-seo
| Finding | target_selector | target_operation |
|---------|----------------|-----------------|
| lcp-slow | performance_config | replace |
| tbt-high | render_blocking | replace |
| thin-content-ratio | content | append |
| no-title | title | create |
| no-h1 | h1 | create |
| broken-links | a[href] | replace |
| jsonld-errors | schema_org | replace |
| no-schema | schema_org | create |

#### cocoon-diag-content
| Finding | target_selector | target_operation |
|---------|----------------|-----------------|
| thin_content | content | replace |
| no_h1 | h1 | create |
| missing_meta | meta_description | create |

#### cocoon-diag-semantic
| Finding | target_selector | target_operation |
|---------|----------------|-----------------|
| keyword_stuffing | content | replace |
| missing_h2 | h2 | create |
| cannibalization | content | replace |

#### cocoon-diag-structure
| Finding | target_selector | target_operation |
|---------|----------------|-----------------|
| broken_links | a[href] | replace |
| canonical_issues | canonical_url | replace |
| missing_sitemap | sitemap_xml | create |

#### cocoon-diag-authority
| Finding | target_selector | target_operation |
|---------|----------------|-----------------|
| anchor_over_optimization | a[href] | replace |
| high_external_links | a[href] | delete_element |
| toxic_backlinks | backlink_profile | replace |
