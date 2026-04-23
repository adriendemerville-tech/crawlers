
-- Table to store Parménion autopilot targets
CREATE TABLE public.parmenion_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'cms_action:custom',
  api_key_name TEXT,
  platform TEXT NOT NULL DEFAULT 'custom',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parmenion_targets ENABLE ROW LEVEL SECURITY;

-- Admin-only policies using has_role
CREATE POLICY "Admins can view all targets"
ON public.parmenion_targets FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create targets"
ON public.parmenion_targets FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update targets"
ON public.parmenion_targets FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete targets"
ON public.parmenion_targets FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Timestamp trigger
CREATE TRIGGER update_parmenion_targets_updated_at
BEFORE UPDATE ON public.parmenion_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing targets
INSERT INTO public.parmenion_targets (domain, label, event_type, platform) VALUES
  ('iktracker.fr', 'IKTracker', 'cms_action:iktracker', 'iktracker'),
  ('crawlers.fr', 'CMS Crawlers', 'cms_action:crawlers', 'internal');
