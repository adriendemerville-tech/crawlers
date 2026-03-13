-- Add business_type column to tracked_sites
ALTER TABLE public.tracked_sites 
ADD COLUMN IF NOT EXISTS business_type text DEFAULT NULL;

-- Create ias_history table
CREATE TABLE public.ias_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  business_type text NOT NULL,
  target_ratio numeric NOT NULL,
  actual_ratio numeric NOT NULL,
  risk_score numeric NOT NULL,
  brand_clicks integer NOT NULL DEFAULT 0,
  generic_clicks integer NOT NULL DEFAULT 0,
  total_clicks integer NOT NULL DEFAULT 0,
  week_start_date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ias_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own IAS history"
  ON public.ias_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage IAS history"
  ON public.ias_history FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX idx_ias_history_site_week ON public.ias_history (tracked_site_id, week_start_date);
