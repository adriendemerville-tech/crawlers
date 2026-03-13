
-- Create ias_settings table for brand name and category config per site
CREATE TABLE IF NOT EXISTS public.ias_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  brand_name text NOT NULL DEFAULT '',
  category_id integer NOT NULL DEFAULT 3,
  is_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id)
);

ALTER TABLE public.ias_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own IAS settings"
  ON public.ias_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage IAS settings"
  ON public.ias_settings FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add ias_score and brand_penetration_rate to ias_history if not exist
ALTER TABLE public.ias_history ADD COLUMN IF NOT EXISTS ias_score integer DEFAULT 0;
ALTER TABLE public.ias_history ADD COLUMN IF NOT EXISTS brand_penetration_rate numeric DEFAULT 0;
