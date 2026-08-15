CREATE OR REPLACE FUNCTION public.normalize_serp_query(q text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(translate(coalesce(q, ''), '‘’“”', '''''''')),
        '[^[:alnum:]''\-:._/[:space:]]+', ' ', 'g'
      ),
      '[[:space:]]+', ' ', 'g'
    )
  )
$$;

ALTER TABLE public.keyword_universe
  ADD COLUMN IF NOT EXISTS keyword_normalized text
  GENERATED ALWAYS AS (public.normalize_serp_query(keyword)) STORED;

CREATE INDEX IF NOT EXISTS idx_keyword_universe_keyword_normalized
  ON public.keyword_universe (keyword_normalized);