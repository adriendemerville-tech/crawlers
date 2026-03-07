
-- PDF Audits table
CREATE TABLE public.pdf_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.pdf_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all pdf_audits" ON public.pdf_audits FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own pdf_audits" ON public.pdf_audits FOR SELECT USING (auth.uid() = client_id);

-- Predictions table
CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.pdf_audits(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  predicted_increase_pct numeric NOT NULL DEFAULT 0,
  predicted_traffic integer NOT NULL DEFAULT 0,
  baseline_traffic integer NOT NULL DEFAULT 0,
  baseline_data jsonb DEFAULT '{}'::jsonb,
  prediction_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all predictions" ON public.predictions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own predictions" ON public.predictions FOR SELECT USING (auth.uid() = client_id);

-- Actual results
CREATE TABLE public.actual_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  real_traffic_after_90_days integer NOT NULL,
  accuracy_gap numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.actual_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage actual_results" ON public.actual_results FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- System metrics singleton
CREATE TABLE public.system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_reliability_score numeric NOT NULL DEFAULT 0,
  total_audits_processed integer NOT NULL DEFAULT 0,
  total_predictions_made integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage system_metrics" ON public.system_metrics FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auth can read system_metrics" ON public.system_metrics FOR SELECT USING (auth.uid() IS NOT NULL);
INSERT INTO public.system_metrics (current_reliability_score, total_audits_processed, total_predictions_made) VALUES (0, 0, 0);

-- GSC columns on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gsc_access_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gsc_refresh_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gsc_token_expiry timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gsc_site_url text;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('pdf-audits', 'pdf-audits', false);
CREATE POLICY "Admins upload pdf-audits" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdf-audits' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read pdf-audits" ON storage.objects FOR SELECT USING (bucket_id = 'pdf-audits' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete pdf-audits" ON storage.objects FOR DELETE USING (bucket_id = 'pdf-audits' AND has_role(auth.uid(), 'admin'::app_role));

-- Reliability recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_reliability()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE system_metrics SET
    current_reliability_score = COALESCE((SELECT AVG(accuracy_gap) * 100 FROM actual_results), 0),
    total_audits_processed = (SELECT COUNT(*) FROM pdf_audits WHERE status = 'processed'),
    total_predictions_made = (SELECT COUNT(*) FROM predictions),
    updated_at = now();
END;
$$;

-- Auto-recalculate trigger
CREATE OR REPLACE FUNCTION public.trigger_recalculate_reliability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM recalculate_reliability(); RETURN NEW; END;
$$;
CREATE TRIGGER on_actual_result_insert AFTER INSERT ON public.actual_results FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_reliability();
