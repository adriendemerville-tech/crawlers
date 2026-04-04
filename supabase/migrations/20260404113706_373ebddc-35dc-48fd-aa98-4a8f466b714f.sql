
-- Prospects LinkedIn table
CREATE TABLE public.marina_prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  linkedin_url TEXT,
  job_title TEXT,
  company TEXT,
  industry TEXT,
  website_url TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  source TEXT DEFAULT 'manual',
  last_post_date TIMESTAMPTZ,
  last_interaction_date TIMESTAMPTZ,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_details JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  marina_audit_id TEXT,
  marina_report_url TEXT,
  notes TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marina_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prospects"
  ON public.marina_prospects FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_marina_prospects_status ON public.marina_prospects(status);
CREATE INDEX idx_marina_prospects_score ON public.marina_prospects(score DESC);

-- Outreach queue table
CREATE TABLE public.prospect_outreach_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.marina_prospects(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'audit_ready',
  message_content TEXT,
  message_language TEXT NOT NULL DEFAULT 'fr',
  report_share_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_outreach_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage outreach queue"
  ON public.prospect_outreach_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_outreach_queue_status ON public.prospect_outreach_queue(status);
CREATE INDEX idx_outreach_queue_prospect ON public.prospect_outreach_queue(prospect_id);

-- Trigger for updated_at
CREATE TRIGGER update_marina_prospects_updated_at
  BEFORE UPDATE ON public.marina_prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outreach_queue_updated_at
  BEFORE UPDATE ON public.prospect_outreach_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
