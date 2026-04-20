# Memory: tech/autopilot/dedup-synonym-layer-fr
Updated: 2026-04-20

## Couche de déduplication par synonymes — iktracker-actions

### Problème résolu
Parménion créait des articles en double sur le même sujet (ex: "frais réels vs barème kilométrique" et "frais réels ou abattement forfaitaire") car la déduplication Jaccard ne détecte pas les synonymes thématiques (score 0.33 < seuil 0.45).

### Corrections appliquées

#### Layer E — Synonym-aware overlap (`iktracker-actions/index.ts`)
- Ajout de clusters de synonymes domaine (ex: frais/reels/bareme/kilometrique/abattement/forfaitaire = même concept)
- `synonymAwareOverlap()` : mappe les mots vers leurs clusters, puis calcule le Jaccard sur les cluster IDs + mots-clés restants
- Seuil : ≥0.55 → upsert vers l'article existant
- S'applique après les Layers A (Jaccard 0.45), B (core topic 0.80), et avant C (slug 0.70)

#### Layer D renforcée — Saturation topic abaissée
- Seuil de saturation abaissé de ≥3 à ≥2 articles sur même topic
- Utilise `Math.max(coreTopicOverlap, synonymAwareOverlap)` au seuil 0.50
- Bloque la création si ≥2 articles couvrent déjà le sujet

#### Blocklist de titres dans le prompt Parménion (`parmenion-orchestrator`)
- Injection des 30 derniers titres d'articles existants comme blocklist explicite dans le prompt contenu
- Le LLM reçoit la liste exacte des articles déjà publiés/en brouillon avec instruction de ne pas dupliquer

### Clusters de synonymes configurés
1. Frais/réels/barème/kilométrique/abattement/forfaitaire/forfait/indemnités/IK
2. Impôts/fiscal/déclaration/déduction/déductible
3. Voiture/véhicule/auto/déplacement/trajet/kilométrage/km

### Fichiers modifiés
- `supabase/functions/iktracker-actions/index.ts`
- `supabase/functions/parmenion-orchestrator/index.ts`
