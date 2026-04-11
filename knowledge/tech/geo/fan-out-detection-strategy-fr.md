# Memory: tech/geo/fan-out-detection-strategy-fr
Updated: 2026-04-11

La stratégie de détection des requêtes 'fan-out' (décomposition d'une requête principale par les moteurs RAG) repose sur une approche hybride à haute précision (~75-80% thématique).

## Architecture
1. **Edge function `detect-fan-out`** : Approche hybride combinant simulation LLM (Gemini Flash via OpenRouter) et rétro-ingénierie des citations (Perplexity Sonar via OpenRouter). Déduplication des axes sémantiques par normalisation.
2. **Sélection intelligente des requêtes** : Triangulation Identity Card × keyword_universe × DataForSEO. 3 profils : Cash cow (vol élevé + pos 4-15), Territoire stratégique (aligné ID + absent), Fan-out magnet (info + AI Overview + vol >500).
3. **Persistance** : `keyword_universe` avec `sources = ['fan_out']` et `parent_query_id` (FK auto-référente) pour tracer la requête mère.

## Points d'injection UI
1. **Audit GEO** (`FanOutCard`) : Card brève sous Profondeur LLM dans `StrategicInsights`, bouton de déclenchement, affiche les 5 axes avec source (simulation/citation) et confiance.
2. **Content Architect** (`FanOutSuggestions`) : Bloc dans le PromptPanel montrant les axes à couvrir avec checklist et % de couverture calculé par matching simple dans le contenu.
3. **Dashboard /app** (`FanOutRadarWidget`) : Widget dans MyTracking (onglet KPIs) après LLM Depth, vision longitudinale groupée par requête parente, confiance moyenne, légende sources.

## Précision estimée
- Thématique (grands axes) : ~75-80%
- Exacte (requêtes mot pour mot) : ~30-40%
- Actionnable (quoi optimiser) : ~80-85%
