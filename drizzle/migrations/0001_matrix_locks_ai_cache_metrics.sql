-- 1) Compteur d'essais pour détecter les jobs zombies repris en boucle par le cron
ALTER TABLE public.competitor_matrix_jobs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

-- 2) Cache mutualisé des réponses LLM de la matrice (borne les coûts)
CREATE TABLE IF NOT EXISTS public.matrix_ai_answer_cache (
  cache_key text PRIMARY KEY,
  model text NOT NULL,
  keyword text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.matrix_ai_answer_cache TO service_role;
ALTER TABLE public.matrix_ai_answer_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS matrix_ai_answer_cache_created_idx
  ON public.matrix_ai_answer_cache (created_at);

-- 3) Cache des métriques publiques (compteur de domaines audités)
CREATE TABLE IF NOT EXISTS public.public_metrics_cache (
  metric text PRIMARY KEY,
  value bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_metrics_cache TO anon, authenticated;
GRANT ALL ON public.public_metrics_cache TO service_role;
ALTER TABLE public.public_metrics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_metrics_cache_read" ON public.public_metrics_cache
  FOR SELECT TO anon, authenticated USING (true);