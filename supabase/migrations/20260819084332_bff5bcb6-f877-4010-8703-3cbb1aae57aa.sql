CREATE TABLE public.marina_free_trials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  email text NOT NULL,
  domain text,
  job_id uuid,
  lang text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_marina_free_trials_ip ON public.marina_free_trials (ip_hash, created_at DESC);
CREATE INDEX idx_marina_free_trials_email ON public.marina_free_trials (email, created_at DESC);

GRANT ALL ON public.marina_free_trials TO service_role;

ALTER TABLE public.marina_free_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read free trial leads"
  ON public.marina_free_trials
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.marina_free_trials TO authenticated;