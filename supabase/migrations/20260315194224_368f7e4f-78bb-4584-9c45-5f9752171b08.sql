
-- Cocoon theme settings: owner-level color customization for node types and particle types
CREATE TABLE public.cocoon_theme_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  node_colors JSONB NOT NULL DEFAULT '{
    "homepage": "#ffc83c",
    "blog": "#8c78ff",
    "produit": "#3cdca0",
    "catégorie": "#50aaff",
    "faq": "#ff9650",
    "contact": "#f078b4",
    "tarifs": "#ffc83c",
    "guide": "#b48cff",
    "légal": "#a0aab4",
    "à propos": "#50dce6",
    "page": "#8c64fa",
    "unknown": "#8c64fa"
  }'::jsonb,
  particle_colors JSONB NOT NULL DEFAULT '{
    "authority": "#ffc83c",
    "semantic": "#508cff",
    "traffic": "#3cdc8c",
    "hierarchy": "#b464ff"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id)
);

-- RLS
ALTER TABLE public.cocoon_theme_settings ENABLE ROW LEVEL SECURITY;

-- Owner can read/write their own settings
CREATE POLICY "Owner can manage their cocoon theme"
  ON public.cocoon_theme_settings
  FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Team members can read their owner's settings
CREATE POLICY "Team members can read owner cocoon theme"
  ON public.cocoon_theme_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_team_members
      WHERE agency_team_members.owner_user_id = cocoon_theme_settings.owner_user_id
        AND agency_team_members.member_user_id = auth.uid()
    )
  );

-- Admins can read all
CREATE POLICY "Admins can read all cocoon themes"
  ON public.cocoon_theme_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_cocoon_theme_settings_updated_at
  BEFORE UPDATE ON public.cocoon_theme_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
