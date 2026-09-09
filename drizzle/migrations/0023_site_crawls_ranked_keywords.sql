ALTER TABLE public.site_crawls
  ADD COLUMN IF NOT EXISTS ranked_keywords jsonb;

COMMENT ON COLUMN public.site_crawls.ranked_keywords IS
  'Instantané DataForSEO Labs des mots-clés positionnés du domaine (total, trafic estimé, top 10). Cache 24h côté edge function.';