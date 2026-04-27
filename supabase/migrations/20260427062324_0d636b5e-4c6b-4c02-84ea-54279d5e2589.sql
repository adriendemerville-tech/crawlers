-- Table principale des scans Machine Layer
CREATE TABLE public.machine_layer_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  ip_hash TEXT,
  score_global INTEGER NOT NULL DEFAULT 0,
  scores_by_family JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  rendered_via TEXT NOT NULL DEFAULT 'static',
  http_status INTEGER,
  fetch_duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_machine_layer_scans_user ON public.machine_layer_scans(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_machine_layer_scans_domain ON public.machine_layer_scans(domain);
CREATE INDEX idx_machine_layer_scans_created ON public.machine_layer_scans(created_at DESC);
CREATE INDEX idx_machine_layer_scans_url ON public.machine_layer_scans(url);

ALTER TABLE public.machine_layer_scans ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut insérer (anonyme + connecté). user_id doit matcher auth.uid() s'il est fourni.
CREATE POLICY "Anyone can create machine layer scans"
ON public.machine_layer_scans
FOR INSERT
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

-- Lecture : ses propres scans + scans anonymes (pour le listing public) + admin voit tout
CREATE POLICY "Users see own scans, anon scans public, admin sees all"
ON public.machine_layer_scans
FOR SELECT
USING (
  user_id IS NULL
  OR user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Update : owner ou admin uniquement
CREATE POLICY "Owners and admins can update scans"
ON public.machine_layer_scans
FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Delete : admin seulement
CREATE POLICY "Admins can delete scans"
ON public.machine_layer_scans
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger updated_at
CREATE TRIGGER update_machine_layer_scans_updated_at
BEFORE UPDATE ON public.machine_layer_scans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();