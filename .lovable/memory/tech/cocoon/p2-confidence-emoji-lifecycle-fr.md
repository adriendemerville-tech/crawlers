---
name: Cocoon P2 — fiabilité, design system, cycle de vie
description: Seuil 30 pages « inconclusive » dans cocoon-strategist, suppression des emoji Cocoon (marqueur d'axes »), expiration 30j des recommandations/tâches
type: feature
---
Correctifs P2 de l'audit Cocoon 2026-08-10 :

1. **Fiabilité** : `cocoon-strategist` calcule `sample_confidence { pages_analyzed, threshold: 30, inconclusive, reason }` à partir du dernier crawl `completed`. Sous 30 pages comparables (ou sans crawl), le plan est `inconclusive` — parité avec le Content Integrity.
2. **Design system** : plus aucun emoji dans `src/components/Cocoon/**` ni dans les prompts/sorties de `cocoon-chat`. Les 3 axes stratégiques sont préfixés du caractère `»` ; le parser de quick-replies (`extractQuickReplies`) reconnaît `[»▸]`. Ne jamais réintroduire d'emoji comme marqueur de parsing.
3. **Cycle de vie** : colonne `expired_at` sur `cocoon_recommendations` et `cocoon_tasks` + fonction `public.expire_stale_cocoon_items()` (service_role) planifiée par pg_cron `expire-stale-cocoon-items` à 03h20 : recommandations non appliquées > 30 j et tâches pending > 30 j passent en `expired`.
