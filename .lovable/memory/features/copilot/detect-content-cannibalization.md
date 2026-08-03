---
name: Skill detect_content_cannibalization
description: Skill Copilot déterministe (0 LLM) qui clusterise les pages cannibalisantes au niveau slug/titre, désigne le pilier et liste les doublons à 301
type: feature
---

## Principe
Skill lecture seule, disponible en `auto` pour Félix et le Stratège Cocoon.
Aucun appel LLM : clustering 100% déterministe → coût nul.

## Algorithme
1. Dernier `site_crawls` `completed` du domaine (RLS user).
2. `crawl_pages` indexables, filtrables par `path_prefix` (ex. `/blog`).
3. Tokenisation slug + title + h1 : NFD sans accents, stopwords FR + bruit SEO
   (`guide`, `complet`, années, `vs`…), tokens ≥ 3 car, dé-pluralisation grossière.
4. Clustering glouton : ancre = page au vocabulaire le plus riche, membres si
   Jaccard ≥ `threshold` (défaut 0.45, bornes 0.3–0.8).
5. Pilier = score `seo_score + min(40, word_count/50) + inbound_links*3 - depth*2`.
6. Sortie : clusters (thème, pilier, doublons), `redundant_pages`,
   `report_markdown`, et suggestion d'enchaîner sur `plan_editorial`.

## Contraintes
- Jamais de service role : tout passe par `ctx.supabase`.
- Nécessite un crawl terminé ; sinon message d'erreur explicite.
