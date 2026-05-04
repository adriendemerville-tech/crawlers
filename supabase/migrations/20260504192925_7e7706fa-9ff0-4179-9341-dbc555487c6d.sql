-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Colonnes
ALTER TABLE public.copilot_actions
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS tsv tsvector;

-- 3. Trigger pour remplir tsv automatiquement (uniquement pour les messages user)
CREATE OR REPLACE FUNCTION public.copilot_actions_tsv_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.skill = '_user_message' THEN
    NEW.tsv := to_tsvector('french', COALESCE(NEW.input->>'message', NEW.input->>'text', ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copilot_actions_tsv ON public.copilot_actions;
CREATE TRIGGER trg_copilot_actions_tsv
  BEFORE INSERT OR UPDATE OF input, skill ON public.copilot_actions
  FOR EACH ROW EXECUTE FUNCTION public.copilot_actions_tsv_trigger();

-- 4. Indexes (partiels — uniquement messages user)
CREATE INDEX IF NOT EXISTS idx_copilot_actions_embedding_hnsw
  ON public.copilot_actions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE skill = '_user_message' AND embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_actions_tsv
  ON public.copilot_actions
  USING gin (tsv)
  WHERE skill = '_user_message';

CREATE INDEX IF NOT EXISTS idx_copilot_actions_embedding_pending
  ON public.copilot_actions (created_at)
  WHERE skill = '_user_message' AND embedding IS NULL;

-- 5. RPC hybride (cosine + BM25), filtrée par auth.uid() — multi-tenant strict
CREATE OR REPLACE FUNCTION public.search_copilot_turns_hybrid(
  query_embedding vector(768),
  query_text text,
  p_persona text DEFAULT NULL,
  p_session_exclude uuid DEFAULT NULL,
  match_count int DEFAULT 5,
  cosine_weight float DEFAULT 0.6,
  bm25_weight float DEFAULT 0.4
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  persona text,
  message text,
  assistant_reply text,
  created_at timestamptz,
  cosine_sim float,
  bm25_rank float,
  hybrid_score float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_turns AS (
    SELECT
      ca.id,
      ca.session_id,
      ca.persona,
      COALESCE(ca.input->>'message', ca.input->>'text', '') AS message,
      ca.created_at,
      ca.embedding,
      ca.tsv
    FROM public.copilot_actions ca
    WHERE ca.user_id = auth.uid()
      AND ca.skill = '_user_message'
      AND ca.embedding IS NOT NULL
      AND (p_persona IS NULL OR ca.persona = p_persona)
      AND (p_session_exclude IS NULL OR ca.session_id <> p_session_exclude)
  ),
  scored AS (
    SELECT
      ut.id,
      ut.session_id,
      ut.persona,
      ut.message,
      ut.created_at,
      (1 - (ut.embedding <=> query_embedding))::float AS cosine_sim,
      COALESCE(ts_rank_cd(ut.tsv, plainto_tsquery('french', query_text)), 0)::float AS bm25_rank
    FROM user_turns ut
  ),
  ranked AS (
    SELECT
      s.*,
      (cosine_weight * s.cosine_sim + bm25_weight * LEAST(s.bm25_rank, 1.0))::float AS hybrid_score
    FROM scored s
    WHERE s.cosine_sim > 0.3 OR s.bm25_rank > 0
    ORDER BY hybrid_score DESC
    LIMIT match_count
  )
  SELECT
    r.id,
    r.session_id,
    r.persona,
    r.message,
    (
      SELECT COALESCE(ca2.output->>'reply', ca2.output->>'text', '')
      FROM public.copilot_actions ca2
      WHERE ca2.session_id = r.session_id
        AND ca2.skill = '_assistant_reply'
        AND ca2.created_at > r.created_at
        AND ca2.user_id = auth.uid()
      ORDER BY ca2.created_at ASC
      LIMIT 1
    ) AS assistant_reply,
    r.created_at,
    r.cosine_sim,
    r.bm25_rank,
    r.hybrid_score
  FROM ranked r;
$$;

GRANT EXECUTE ON FUNCTION public.search_copilot_turns_hybrid(vector, text, text, uuid, int, float, float) TO authenticated;