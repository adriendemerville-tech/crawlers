---
name: Content Architect Markdown Cache
description: Cache persistant .md (TTL 30j) + recommandation Crawlers cross-user anonymisée pour content-architecture-advisor
type: feature
---
# Cache .md Content Architect

## Quoi
- Table `content_architect_cache` (user_id, cache_key sha256, markdown, payload jsonb, is_shareable, hit_count, expires_at default now()+30d, last_used_at).
- Module shared `supabase/functions/_shared/contentArchitectCache.ts` : `buildCacheKey`, `getUserCache`, `getCrawlersRecommendation`, `saveCache`, `payloadToMarkdown`.
- Branché dans `supabase/functions/content-architecture-advisor/index.ts` après le legacy cache et avant le `return` final.

## Clé de cache
sha256 normalisé de `keyword | page_type | length | lang | h1 | h2[] | secondary_keywords[]`.
Domain volontairement EXCLU de la clé pour permettre la mutualisation cross-tenant sur la même intention.

## Cross-user (Recommandation Crawlers)
- RPC `public.get_shared_architect_recommendation(_cache_key)` SECURITY DEFINER.
- Filtre `user_id <> auth.uid() AND is_shareable=true AND expires_at>now()`.
- Ne renvoie JAMAIS `user_id`. Réponse exposée côté client comme « Recommandation Crawlers ».
- GRANT EXECUTE TO authenticated, REVOKE FROM public.

## Invalidation
- TTL 30 jours auto (`expires_at`).
- Bouton « Régénérer » dans `ContentArchitectStructurePanel` qui passe `force_regenerate: true` au body advisor.

## UI
- `CocoonContentArchitectModal` : states `cacheInfo` + `crawlersReco`.
- `ContentArchitectStructurePanel` : badge "Depuis le cache · Nj" + bouton Régénérer + carte « Recommandation Crawlers » avec bouton "Utiliser" (parse markdown H1/H2 vers les champs).

## Réponse advisor enrichie
```ts
{ data, cached?: true, cache_source?: 'self', cache_age_days?, markdown?, crawlers_recommendation?: { markdown, created_at } | null }
```
