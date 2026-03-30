# Historisation GEO (Visibilité LLM)

## Architecture

La visibilité LLM est désormais historisée à chaque phase de mesure d'impact (T0 baseline, T+30, T+60, T+90), en parallèle des données GSC et GA4.

## Table : `geo_visibility_snapshots`

| Champ | Description |
|---|---|
| `overall_score` | Score agrégé 0-100 (citation + sentiment + recommandation) |
| `cited_count` / `total_models` | Nombre de LLMs citant la marque vs total interrogé |
| `citation_rate` | Pourcentage de citation |
| `provider_scores` | JSONB détaillé par provider (score, cited, sentiment, recommends) |
| `avg_sentiment_score` | Moyenne du sentiment (-1 à +1) |
| `recommendation_rate` | % de modèles recommandant |
| `delta_overall_score` | Delta vs baseline |
| `delta_citation_rate` | Delta taux de citation vs baseline |
| `measurement_phase` | baseline / t30 / t60 / t90 |
| `audit_impact_snapshot_id` | Lien optionnel vers le snapshot d'impact SEO |

## Edge Function : `snapshot-geo-visibility`

- Interroge 4 LLMs (GPT-4o, Claude 3.5, Gemini Flash, Perplexity) via OpenRouter
- Utilise des prompts naturels sans mention de marque (cohérent avec `naturalPrompts.ts`)
- Détecte citation, sentiment et recommandation en post-processing
- Calcule les deltas automatiquement par rapport au baseline

## Intégration dans `measure-audit-impact`

À chaque cycle de mesure (T0→T30→T60→T90), la fonction `measure-audit-impact` appelle automatiquement `snapshot-geo-visibility` pour capturer un snapshot GEO en parallèle des métriques GSC/GA4.

## Formule ROI complète disponible

Avec cette historisation, le calcul ROI consolidé peut croiser :
- **Δ GSC** (clics, CTR, positions) — déjà dans `audit_impact_snapshots`
- **Δ GA4** (sessions, engagement, conversions) — déjà dans `audit_impact_snapshots`  
- **Δ GEO** (visibilité LLM, taux de citation, sentiment) — **nouveau** dans `geo_visibility_snapshots`
- **Panier moyen** — dans `revenue_events`

## Fichiers modifiés
- `supabase/functions/snapshot-geo-visibility/index.ts` (nouveau)
- `supabase/functions/measure-audit-impact/index.ts` (ajout appel GEO)
- Migration : table `geo_visibility_snapshots` + RLS + index
