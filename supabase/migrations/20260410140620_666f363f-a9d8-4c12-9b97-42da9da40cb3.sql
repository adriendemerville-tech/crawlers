
-- Table pour stocker les connexions Canva OAuth par utilisateur
CREATE TABLE public.canva_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  canva_user_id TEXT,
  canva_team_id TEXT,
  display_name TEXT,
  scopes TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tracked_site_id)
);

-- RLS
ALTER TABLE public.canva_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own canva connections"
  ON public.canva_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own canva connections"
  ON public.canva_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own canva connections"
  ON public.canva_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canva connections"
  ON public.canva_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_canva_connections_updated_at
  BEFORE UPDATE ON public.canva_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
