CREATE TABLE IF NOT EXISTS public.ai_routing_global_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  value JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT ON public.ai_routing_global_flags TO authenticated;
GRANT ALL    ON public.ai_routing_global_flags TO service_role;
ALTER TABLE public.ai_routing_global_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read ai global flags" ON public.ai_routing_global_flags;
CREATE POLICY "Read ai global flags" ON public.ai_routing_global_flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage ai global flags" ON public.ai_routing_global_flags;
CREATE POLICY "Admins manage ai global flags" ON public.ai_routing_global_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.ai_routing_global_flags (key, enabled, value)
VALUES ('disable_premium', false, '{"reason":"manual","auto_triggered_at":null}'::jsonb)
ON CONFLICT (key) DO NOTHING;