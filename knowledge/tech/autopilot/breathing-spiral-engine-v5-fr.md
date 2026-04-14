# Memory: tech/autopilot/breathing-spiral-engine-v5-fr
Updated: 2026-04-14

## Breathing Spiral Engine v5 — Signaux & Anti-Saturation

Le moteur de la 'Breathing Spiral' (v5) agrège **6 signaux pondérés** pour calculer le 'spiral_score' (0-100) via `compute-spiral-signals` (cron 6h) :

### Signaux positifs (boost)
1. **Velocity Decay** (×1.6, max 40 pts) — pages en déclin de position
2. **Competitor Momentum** (×0.8, max 20 pts) — pression concurrentielle
3. **Cluster Maturity** (inversé, max 15 pts) — clusters immatures prioritaires
4. **GMB Urgency** (×0.6, max 15 pts) — déclin local SEO
5. **Conversion Weight** (×10, max 10 pts) — pages à fort taux de conversion

### Signal négatif (malus) — NOUVEAU
6. **Topic Saturation** (0 à -20 pts) — pénalise les items `create_content` / `gap_create` dans les clusters **déjà surchargés** en articles (≥5 articles = -5, ≥7 = -10, ≥10 = -15, +5 si les titres du cluster sont redondants entre eux). Ce malus ne s'applique PAS aux items de consolidation (rewrite, fix, enrich).

### Phases de respiration
- **Contraction** (score moyen ≥ 50) : le Stratège Cocoon booste consolidation ×1.3, freine création ×0.7
- **Expansion** (score moyen < 25) : booste création ×1.3, réduit maintenance ×0.9
- **Neutre** (25-49) : aucune modification

### Garde-fou éditorial (anti-redondance)
- La distribution d'articles (`computeArticleDistribution`) inclut désormais les **brouillons** (published + draft)
- Le prompt `buildDiversityPromptBlock` injecte la **liste des titres de brouillons existants** pour interdire au LLM de recréer un sujet déjà couvert
- `iktracker-actions` ajoute un **Layer D "Topic Saturation Guard"** : si ≥3 articles existants (y compris drafts) partagent ≥60% de core keywords, la création est **bloquée** (HTTP 409) avec suggestion d'utiliser `update-post`
- La taxonomie impose 5 angles éditoriaux (Persona, News, Niche, Comparatif, Tuto) avec un plafond de 5% pour les guides complets
