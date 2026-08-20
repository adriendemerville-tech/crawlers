ALTER TABLE public.architect_workbench
  ADD COLUMN IF NOT EXISTS priority_score numeric,
  ADD COLUMN IF NOT EXISTS roi_tier text,
  ADD COLUMN IF NOT EXISTS is_quick_win boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS architect_workbench_priority_idx
  ON public.architect_workbench (domain, status, is_quick_win DESC, priority_score DESC);

CREATE TABLE IF NOT EXISTS public.site_pruning_debt (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tracked_site_id uuid,
  domain text NOT NULL,
  debt numeric NOT NULL DEFAULT 0,
  regime text NOT NULL DEFAULT 'healthy',
  corpus_size integer NOT NULL DEFAULT 0,
  useful_pages integer NOT NULL DEFAULT 0,
  mute_ratio numeric NOT NULL DEFAULT 0,
  cannibal_ratio numeric NOT NULL DEFAULT 0,
  cannibal_clusters integer NOT NULL DEFAULT 0,
  prunable_ratio numeric NOT NULL DEFAULT 0,
  concentration numeric NOT NULL DEFAULT 0,
  metrics_available boolean NOT NULL DEFAULT false,
  insufficient_data boolean NOT NULL DEFAULT false,
  explanation text,
  items_scored integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_pruning_debt_user_domain_idx
  ON public.site_pruning_debt (user_id, domain);

GRANT SELECT ON public.site_pruning_debt TO authenticated;
GRANT ALL ON public.site_pruning_debt TO service_role;

ALTER TABLE public.site_pruning_debt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own pruning debt"
  ON public.site_pruning_debt FOR SELECT TO authenticated
  USING (auth.uid() = user_id);