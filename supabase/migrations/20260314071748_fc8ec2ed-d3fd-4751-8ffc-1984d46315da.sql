
-- Table for multi-page script routing rules
CREATE TABLE public.site_script_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url_pattern TEXT NOT NULL DEFAULT 'GLOBAL',
  payload_type TEXT NOT NULL DEFAULT 'GLOBAL_FIXES',
  payload_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  telemetry_last_ping TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_site_script_rules_domain ON public.site_script_rules(domain_id);
CREATE INDEX idx_site_script_rules_user ON public.site_script_rules(user_id);
CREATE INDEX idx_site_script_rules_active ON public.site_script_rules(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.site_script_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rules"
  ON public.site_script_rules FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all rules"
  ON public.site_script_rules FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Trigger for updated_at
CREATE TRIGGER update_site_script_rules_updated_at
  BEFORE UPDATE ON public.site_script_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for telemetry updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_script_rules;
