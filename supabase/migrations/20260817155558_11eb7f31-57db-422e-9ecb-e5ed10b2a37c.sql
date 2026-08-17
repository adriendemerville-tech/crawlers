CREATE TABLE public.parmenion_targeting_lenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_id UUID NOT NULL REFERENCES public.parmenion_targets(id) ON DELETE CASCADE,
  lens_type TEXT NOT NULL CHECK (lens_type IN ('location','persona','cluster')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  values JSONB NOT NULL DEFAULT '[]'::jsonb,
  share_pct INTEGER NOT NULL DEFAULT 30 CHECK (share_pct >= 0 AND share_pct <= 50),
  publish_directory TEXT,
  conversion_target JSONB NOT NULL DEFAULT '{"mode":"free"}'::jsonb,
  proof_level TEXT NOT NULL DEFAULT 'unknown' CHECK (proof_level IN ('unknown','none','weak','strong')),
  proof_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (target_id, lens_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parmenion_targeting_lenses TO authenticated;
GRANT ALL ON public.parmenion_targeting_lenses TO service_role;

ALTER TABLE public.parmenion_targeting_lenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view lenses" ON public.parmenion_targeting_lenses
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create lenses" ON public.parmenion_targeting_lenses
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update lenses" ON public.parmenion_targeting_lenses
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete lenses" ON public.parmenion_targeting_lenses
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_parmenion_targeting_lenses_updated_at
  BEFORE UPDATE ON public.parmenion_targeting_lenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_targeting_lenses_target ON public.parmenion_targeting_lenses(target_id) WHERE enabled = true;