# Memory: tech/autopilot/parmenion-v2-fr
Updated: 2026-03-28

## Autopilote Parménion v2 — Architecture complète

### Vue d'ensemble

L'Autopilote suit un double cycle :
- **Macro-cycle** : rotation à travers la Pyramide de priorité (11 tiers, 2 par 2)
- **Micro-cycle** : pipeline de 6 phases par itération

```
┌─ MACRO-CYCLE (pyramide 11 tiers, rotation 2 par 2)
│  Paire courante : tiers N et N+1
│  Quand la pyramide est terminée → retour à tiers 0+1
│
│  ┌─ MICRO-CYCLE (Parménion)
│  │
│  │  1. AUDIT      → fonctions existantes nourrissent architect_workbench
│  │                   (avec target_selector + target_operation)
│  │
│  │  2. DIAGNOSE   → score_workbench_priority()
│  │                   scoring déterministe, gate de qualité (tiers 5+ bloqués si score tech < 70)
│  │                   → PAS de LLM
│  │
│  │  3. PRESCRIBE  → 2 prompts LLM parallèles :
│  │                   • Lot TECHNIQUE (tiers 0-3) → emit_code + emit_corrective_data
│  │                   • Lot CONTENU (tiers 4-10)  → emit_corrective_content + emit_editorial_content
│  │                   (max 4 tool calls par prompt)
│  │
│  │  4. ROUTE      → inline, dispatch automatique par canal
│  │                   code/corrective_data → generate-corrective-code
│  │                   corrective_content/editorial_content → iktracker-actions
│  │
│  │  5. EXECUTE    → iktracker-actions (CMS CRUD) ou generate-corrective-code (JS injectable)
│  │                   Max 10 actions CMS par cycle
│  │
│  │  6. VALIDATE   → vérification post-déploiement
│  └─
└─ rotation vers les 2 tiers suivants
```

### Pyramide de priorité (11 tiers)

| Tier | Nom | Type |
|------|-----|------|
| 0 | Accessibilité | Technique |
| 1 | Performance | Technique |
| 2 | Crawl mineur | Technique |
| 3 | Données GEO | Technique |
| 4 | On-page mineur | Contenu |
| 5 | On-page majeur | Contenu |
| 6 | Maillage | Contenu |
| 7 | Cannibalisation | Contenu |
| 8 | Gap/Modification | Contenu |
| 9 | Gap/Création | Contenu |
| 10 | Expansion | Contenu |

### Gate de qualité
- Les tiers ≥ 5 sont bloqués tant que le score technique global est < 70
- Le scoring ajoute un malus (-50 points) aux items dont le gate n'est pas satisfait

### Scoring déterministe (`score_workbench_priority`)
Formule : `base_score + severity_bonus + aging_bonus - gate_malus`
- `base_score` : 100 - (tier × 10)
- `severity_bonus` : critical=30, high=20, medium=10, low=0
- `aging_bonus` : +1 par jour depuis la création (max 30)
- `gate_malus` : -50 si tier ≥ 5 et score tech < 70

### Sources de données (audit → workbench)
Les fonctions suivantes alimentent `architect_workbench` avec `target_selector` et `target_operation` :
- `audit-expert-seo` : title, meta_description, h1, schema_org, a[href], sitemap_xml, robots_txt, etc.
- `cocoon-diag-content` : content, h1, meta_description
- `cocoon-diag-semantic` : content, h1, h2, meta_description
- `cocoon-diag-structure` : canonical_url, sitemap_xml, robots_txt, a[href]
- `cocoon-diag-authority` : a[href], backlink_profile
- `strategic-synthesis` : inféré par `populate_architect_workbench`
- `audit-compare` : inféré par `populate_architect_workbench`

### 4 canaux LLM (tool calls)
| Canal | Compatibilité | Destination |
|-------|--------------|-------------|
| `emit_code` | Lot technique | generate-corrective-code |
| `emit_corrective_data` | Lot technique | iktracker-actions (JSON, meta, structured data) |
| `emit_corrective_content` | Lot contenu | iktracker-actions (H1, H2, paragraphes existants) |
| `emit_editorial_content` | Lot contenu | iktracker-actions (nouveaux articles, nouvelles pages) |

Règle : `emit_code` + `emit_corrective_data` dans le même prompt, `emit_corrective_content` + `emit_editorial_content` dans le même prompt. Le mélange technique/contenu est exclu.

### Coordonnées de ciblage
Chaque item du workbench porte :
- `target_url` : URL de la page cible
- `target_selector` : champ CMS ou sélecteur CSS (ex: `h1`, `meta_description`, `schema_org`, `content`, `a[href]`)
- `target_operation` : action à effectuer (`replace`, `insert_after`, `append`, `create`, `delete_element`)

### Fallback execute
Si aucune action explicite n'est prescrite par le LLM, un mécanisme de fallback injecte des actions concrètes (update-page, create-post) basées sur les recommandations prioritaires du workbench.

### Limites
- Max 10 actions CMS par cycle
- Max 4 tool calls par prompt LLM
- 2 prompts LLM max par micro-cycle (technique + contenu)
