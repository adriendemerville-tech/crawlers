
-- Table to track batch maillage operations (deploy/rollback across clusters)
CREATE TABLE public.cocoon_batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  cluster_id TEXT,
  operation_type TEXT NOT NULL DEFAULT 'batch_deploy',
  mode TEXT NOT NULL DEFAULT 'dry_run',
  status TEXT NOT NULL DEFAULT 'pending',
  total_pages INTEGER NOT NULL DEFAULT 0,
  processed_pages INTEGER NOT NULL DEFAULT 0,
  failed_pages INTEGER NOT NULL DEFAULT 0,
  recommendations JSON NOT NULL DEFAULT '[]'::json,
  pages_backup JSON,
  deploy_results JSON,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cocoon_batch_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own batch operations"
  ON public.cocoon_batch_operations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own batch operations"
  ON public.cocoon_batch_operations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own batch operations"
  ON public.cocoon_batch_operations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_cocoon_batch_ops_user ON public.cocoon_batch_operations(user_id);
CREATE INDEX idx_cocoon_batch_ops_site ON public.cocoon_batch_operations(tracked_site_id);
CREATE INDEX idx_cocoon_batch_ops_status ON public.cocoon_batch_operations(status);

-- Auto-update updated_at
CREATE TRIGGER cocoon_batch_operations_updated_at
  BEFORE UPDATE ON public.cocoon_batch_operations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
