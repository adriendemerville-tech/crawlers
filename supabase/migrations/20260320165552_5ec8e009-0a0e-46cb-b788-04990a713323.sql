-- Google Ads connections table for future integration
CREATE TABLE IF NOT EXISTS public.google_ads_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  customer_id text NOT NULL,
  account_name text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  status text NOT NULL DEFAULT 'pending',
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_ads_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own Google Ads connections"
  ON public.google_ads_connections
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add 4 new voice-enrichment fields to tracked_sites
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS short_term_goal text,
  ADD COLUMN IF NOT EXISTS mid_term_goal text,
  ADD COLUMN IF NOT EXISTS main_serp_competitor text,
  ADD COLUMN IF NOT EXISTS confusion_risk text;