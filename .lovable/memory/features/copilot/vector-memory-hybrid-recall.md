---
name: copilot-vector-memory-hybrid-recall
description: Vector + BM25 hybrid memory recall on copilot_actions, embed only _user_message (anti auto-renforcement), cron 5min worker, RPC search_copilot_turns_hybrid
type: feature
---
# Copilot Memory — Hybrid Vector + BM25 Recall

## Schema
- `copilot_actions.embedding vector(768)` — google/text-embedding-004 via Lovable AI Gateway
- `copilot_actions.tsv tsvector` — French full-text, auto-rempli par trigger sur INSERT/UPDATE
- Index HNSW partiel `WHERE skill = '_user_message' AND embedding IS NOT NULL`
- Index GIN partiel `WHERE skill = '_user_message'`
- Index BTREE partiel sur `created_at WHERE embedding IS NULL` (pending queue)

## Règle anti auto-renforcement (cf. note d'architecture §4.1)
**On embed UNIQUEMENT `_user_message`, JAMAIS `_assistant_reply`.**
Sinon : le contexte injecté contient les anciennes réponses du LLM qu'il re-cite, divergence garantie.

## Pipeline
1. **Worker `embed-copilot-turns`** : cron toutes les 5min (job `embed-copilot-turns-every-5min`), batch 50, parallélisme 5, embed via `_shared/embeddings.ts` (Lovable Gateway, model `google/text-embedding-004`, 768 dims). Messages < 3 chars = vecteur zéro pour ne pas re-traiter.
2. **RPC `search_copilot_turns_hybrid`** SECURITY DEFINER filtrée par `auth.uid()` : retourne top-K avec `hybrid_score = 0.6 * cosine + 0.4 * BM25`, exclut session courante, filtre persona.
3. **`recallMemoryContext` dans copilot-orchestrator** : appelle la RPC ; fallback JS cosine sur 50 derniers tours si service role bypass auth.uid(). Seuil min `MEMORY_MIN_SCORE=0.45`, top-K=4. Injecté comme `tool_result name="memory_recall"` wrappé via `wrapToolResult` (donc neutre vs prompt injection).

## Multi-tenant strict
- RPC filtre `WHERE user_id = auth.uid()` côté SQL.
- Fallback JS filtre `eq('user_id', userId)` explicite.
- Persona filter `eq('persona', personaId)` empêche Félix de voir la mémoire du Stratège et inversement.

## Coût
- Embedding : 1 appel Gateway / message user (~0.0001$ / 1k tokens).
- Recall : 1 embedding / tour + 1 select indexé.
