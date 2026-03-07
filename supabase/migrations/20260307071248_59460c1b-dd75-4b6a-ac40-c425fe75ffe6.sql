
-- Create the scan_results table for the Observatory
CREATE TABLE public.scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scan_type TEXT NOT NULL DEFAULT 'free',
  has_json_ld BOOLEAN NOT NULL DEFAULT false,
  load_time_ms INTEGER NOT NULL DEFAULT 0,
  error_404_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can SELECT aggregate stats)
CREATE POLICY "Public can read scan results"
  ON public.scan_results
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service role / edge functions can insert
CREATE POLICY "Service can insert scan results"
  ON public.scan_results
  FOR INSERT
  WITH CHECK (true);
