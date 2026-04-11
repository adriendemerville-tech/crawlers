ALTER TABLE public.keyword_universe ADD COLUMN IF NOT EXISTS parent_query_id uuid REFERENCES public.keyword_universe(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.keyword_universe.parent_query_id IS 'Links fan-out sub-queries to their parent query';