# Memory: tech/autopilot/parmenion-v2-fr
Updated: 2026-03-30

## Autopilote Parménion v2 — Architecture complète (Dual-Lane)

### Vue d'ensemble

L'Autopilote suit un double cycle avec **deux pipelines parallèles** (tech + contenu) :
- **Macro-cycle** : rotation à travers la Pyramide de priorité (11 tiers)
- **Micro-cycle** : pipeline de 6 phases par itération
- **Dual-Lane** : tech et contenu scorés et exécutés **indépendamment**

```
┌─ DUAL-LANE SCORING (tech ∥ contenu)
│  Lane TECH : tiers 0-4 (accessibility → meta_tags)
│  Lane CONTENT : tiers 5-10 (content → expansion)
│  Budget partagé : 70% tech / 30% contenu (configurable)
│
│  ┌─ MICRO-CYCLE (Parménion)
│  │
│  │  1. AUDIT      → audit-expert-seo
│  │
│  │  2. DIAGNOSE   → cocoon-diag-* (content, semantic, structure, authority)
│  │
│  │  3. PRESCRIBE  → 2 prompts LLM parallèles :
│  │                   • Lot TECHNIQUE (lane tech) → emit_code + emit_corrective_data
│  │                   • Lot CONTENU (lane content) → emit_corrective_content + emit_editorial_content
│  │                   (max 4 tool calls par prompt)
│  │                   Budget: techSlots + contentSlots = 8 items max
│  │
│  │  4. ROUTE      → inline, dispatch automatique par canal
│  │
│  │  5. EXECUTE    → iktracker-actions / cms-push-draft / cms-patch-content / generate-corrective-code
│  │                   Max 10 actions CMS par cycle
│  │
│  │  6. VALIDATE   → vérification post-déploiement
│  └─
└─

### Pyramide de priorité (11 tiers)

| Tier | Nom | Type | Lane |
|------|-----|------|------|
| 0 | Accessibilité | Technique | tech |
| 1 | Performance | Technique | tech |
| 2 | Crawl mineur | Technique | tech |
| 3 | Données GEO | Technique | tech |
| 4 | On-page mineur | Technique | tech |
| 5 | On-page majeur | Contenu | content |
| 6 | Maillage | Contenu | content |
| 7 | Cannibalisation | Contenu | content |
| 8 | Gap/Modification | Contenu | content |
| 9 | Gap/Création | Contenu | content |
| 10 | Expansion | Contenu | content |

### Gate progressif (v2)
- Tiers 5-6 : bloqués si score tech < `gate_threshold_low` (défaut: 50)
- Tiers 7+ : bloqués si score tech < `gate_threshold_high` (défaut: 70)
- Gate malus : -300 (tiers 5-6) ou -500 (tiers 7+)
- `force_content_cycle` = true → bypass total du gate (one-shot)
- Seuils configurables par site dans `autopilot_configs`

### Budget partagé (Option A)
- Chaque cycle alloue N slots tech + M slots contenu
- Par défaut : 70% tech / 30% contenu → sur 8 slots = 6 tech + 2 contenu
- Configurable via `content_budget_pct` (0-100) dans `autopilot_configs`
- Si `force_content_cycle` = true → 100% contenu (0 tech)

### Dual-Lane Scoring (Option B)
- `score_workbench_priority()` accepte un param `p_lane` ('tech', 'content', 'all')
- Chaque lane est scorée indépendamment avec son propre classement
- Le LLM reçoit les items des deux lanes en parallèle (2 prompts simultanés)
- Résultat : du contenu est toujours produit, même si le score tech est bas

### Forçage utilisateur (Option D)
- Colonne `force_content_cycle` (boolean) dans `autopilot_configs`
- Quand true : bypass du gate, 100% budget contenu, reset automatique après le cycle
- Permet à l'utilisateur de déclencher un cycle contenu à la demande

### Scoring déterministe (`score_workbench_priority`)
Formule : `base_score + severity_bonus + aging_bonus - gate_malus`
- `base_score` : 1000 (tier 0) → 50 (tier 10)
- `severity_bonus` : critical=200, high=100, medium=0, low=-50
- `aging_bonus` : +10 par jour depuis la création (max 100)
- `gate_malus` : -300 (tiers 5-6 si tech < gate_low) ou -500 (tiers 7+ si tech < gate_high)

### Colonnes ajoutées à `autopilot_configs`
| Colonne | Type | Défaut | Description |
|---------|------|--------|-------------|
| `force_content_cycle` | boolean | false | Forcer un cycle contenu (reset auto) |
| `content_budget_pct` | integer | 30 | % du budget alloué au contenu |
| `gate_threshold_low` | integer | 50 | Seuil gate pour tiers 5-6 |
| `gate_threshold_high` | integer | 70 | Seuil gate pour tiers 7+ |

### 4 canaux LLM (tool calls)
| Canal | Compatibilité | Destination |
|-------|--------------|-------------|
| `emit_code` | Lot technique | generate-corrective-code |
| `emit_corrective_data` | Lot technique | iktracker-actions (JSON, meta, structured data) |
| `emit_corrective_content` | Lot contenu | iktracker-actions (H1, H2, paragraphes existants) |
| `emit_editorial_content` | Lot contenu | iktracker-actions (nouveaux articles, nouvelles pages) |

### Limites
- Max 10 actions CMS par cycle
- Max 4 tool calls par prompt LLM
- 2 prompts LLM max par micro-cycle (technique + contenu)
- 8 items max scorés par cycle (répartis entre les 2 lanes)
