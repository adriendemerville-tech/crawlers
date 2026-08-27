CREATE TABLE public.competitor_matrix_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  share_token TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'fr',
  status TEXT NOT NULL DEFAULT 'pending',
  step TEXT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  identity JSONB NULL,
  competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  matrix JSONB NULL,
  ai_overviews JSONB NULL,
  summary JSONB NULL,
  error TEXT NULL,
  ip_hash TEXT NULL,
  email TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cmj_domain_created ON public.competitor_matrix_jobs (domain, created_at DESC);
CREATE INDEX idx_cmj_ip_created ON public.competitor_matrix_jobs (ip_hash, created_at DESC);
CREATE INDEX idx_cmj_status ON public.competitor_matrix_jobs (status, created_at DESC);

GRANT SELECT ON public.competitor_matrix_jobs TO authenticated;
GRANT ALL ON public.competitor_matrix_jobs TO service_role;

ALTER TABLE public.competitor_matrix_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own competitor matrices"
ON public.competitor_matrix_jobs FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TABLE public.competitor_matrix_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NULL REFERENCES public.competitor_matrix_jobs(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  domain TEXT NULL,
  consent BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cml_email ON public.competitor_matrix_leads (email);

GRANT ALL ON public.competitor_matrix_leads TO service_role;

ALTER TABLE public.competitor_matrix_leads ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_competitor_matrix_jobs_updated_at
BEFORE UPDATE ON public.competitor_matrix_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();