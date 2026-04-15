# Memory: tech/geo/geo-kpi-metrics-fr
Updated: 2026-04-15

## KPIs GEO mesurés dans l'Audit Stratégique

L'audit stratégique GEO (`audit-strategique-ia`) calcule 5 KPIs spécifiques pour les pages internes (non-homepage).

### 1. Quotability Index (0-100)
- **Méthode** : Analyse LLM du contenu — identifie jusqu'à 3 phrases "quotables" (auto-suffisantes, factuelles, concises)
- **Seuil** : >70 = bon, <30 = faible
- **Lexique** : `/lexique/quotability-index`

### 2. AEO Score (Answer Engine Optimization)
- **Méthode** : Analyse LLM évaluant la capacité du contenu à être sélectionné comme réponse directe par les moteurs IA
- **Composantes** : Structure (Schema.org, pyramide inversée), autorité (E-E-A-T), clarté des réponses
- **Lexique** : `/lexique/aeo-answer-engine-optimization`

### 3. Position Zéro (éligibilité)
- **Méthode** : Analyse croisée balisage Schema.org (FAQPage, HowTo) + structure du contenu (réponse directe en <60 mots) + volume de recherche des requêtes cibles
- **Lexique** : `/lexique/position-zero`

### 4. Fan-Out Score (0-100)
- **Méthode** : Déterministe, sans LLM. Croisement des top 15 keywords DataForSEO (marketData + rankingOverview) avec le contenu de la page. Un keyword est "couvert" si ≥60% de ses termes significatifs apparaissent dans le texte.
- **Workbench** : Findings `content_gap_fanout` créés pour les keywords manquants à volume ≥500/mois
- **Lexique** : `/lexique/query-fan-out`

### 5. Chunkability Score (0-100)
- **Méthode** : Déterministe, sans LLM. 4 signaux DOM : titres H2/H3 (30%), paragraphes distincts (25%), présence TOC (25%), longueur moyenne paragraphes (20%).
- **Workbench** : Finding `structure_rag` si score <50 (severity danger si <30)
- **Lexique** : `/lexique/chunkability-score`

### Persistance Workbench
Les scores Chunkability et Fan-Out génèrent automatiquement des findings dans `architect_workbench` avec `source_function='audit-strategique-ia'`, consommables par Parménion et le Code Architect.
