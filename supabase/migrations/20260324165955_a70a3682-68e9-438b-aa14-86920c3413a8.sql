
-- Table des sessions de matrice d'audit
CREATE TABLE public.audit_matrix_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  source_file_type TEXT NOT NULL CHECK (source_file_type IN ('xlsx', 'csv', 'docx')),
  detection_method TEXT CHECK (detection_method IN ('seo', 'geo', 'hybrid')),
  parsed_criteria JSONB DEFAULT '[]'::jsonb,
  audit_plan JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'parsing' CHECK (status IN ('parsing', 'routing', 'executing', 'completed', 'error')),
  error_message TEXT,
  total_criteria INTEGER DEFAULT 0,
  completed_criteria INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des résultats individuels par critère
CREATE TABLE public.audit_matrix_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.audit_matrix_sessions(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL,
  criterion_title TEXT NOT NULL,
  criterion_category TEXT,
  match_type TEXT NOT NULL DEFAULT 'exact' CHECK (match_type IN ('exact', 'partial', 'custom_only')),
  parsed_score NUMERIC,
  parsed_response TEXT,
  crawlers_score NUMERIC,
  crawlers_data JSONB,
  source_function TEXT,
  confidence_level NUMERIC DEFAULT 0.8,
  custom_prompt TEXT,
  target_provider TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_matrix_sessions_user ON public.audit_matrix_sessions(user_id);
CREATE INDEX idx_matrix_sessions_domain ON public.audit_matrix_sessions(domain);
CREATE INDEX idx_matrix_results_session ON public.audit_matrix_results(session_id);

-- RLS
ALTER TABLE public.audit_matrix_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_matrix_results ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
CREATE POLICY "Users manage own matrix sessions" ON public.audit_matrix_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own matrix results" ON public.audit_matrix_results
  FOR ALL TO authenticated
  USING (session_id IN (SELECT id FROM public.audit_matrix_sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM public.audit_matrix_sessions WHERE user_id = auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_audit_matrix_sessions_updated_at
  BEFORE UPDATE ON public.audit_matrix_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
