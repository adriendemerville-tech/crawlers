CREATE TABLE public.content_pruning_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tracked_site_id uuid,
  domain text NOT NULL,
  decision_id uuid,
  cluster_theme text,
  pilier_url text,
  pilier_slug text,
  pruned_url text NOT NULL,
  pruned_slug text,
  pruned_title text,
  pruned_html text,
  pruned_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  redirect_target text,
  redirect_status text NOT NULL DEFAULT 'pending',
  merge_status text NOT NULL DEFAULT 'pending',
  delete_status text NOT NULL DEFAULT 'pending',
  error_message text,
  dry_run boolean NOT NULL DEFAULT false,
  restored_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_pruning_log_domain_created ON public.content_pruning_log (domain, created_at DESC);
CREATE INDEX idx_content_pruning_log_user ON public.content_pruning_log (user_id);

GRANT SELECT ON public.content_pruning_log TO authenticated;
GRANT ALL ON public.content_pruning_log TO service_role;

ALTER TABLE public.content_pruning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pruning log"
ON public.content_pruning_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_content_pruning_log_updated_at
BEFORE UPDATE ON public.content_pruning_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();