
-- 1. Table des prompts/KPIs importés (réutilisables entre audits)
CREATE TABLE public.prompt_matrix_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  poids NUMERIC NOT NULL DEFAULT 1,
  axe TEXT NOT NULL DEFAULT 'Général',
  seuil_bon NUMERIC NOT NULL DEFAULT 70,
  seuil_moyen NUMERIC NOT NULL DEFAULT 40,
  seuil_mauvais NUMERIC NOT NULL DEFAULT 0,
  llm_name TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  is_default_flags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table des sessions d'audit matrice (1 ligne = 1 URL analysée)
CREATE TABLE public.matrix_audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  crawlers_global_score NUMERIC,
  csv_weighted_score NUMERIC,
  total_prompts INTEGER NOT NULL DEFAULT 0,
  selected_prompts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table des résultats par KPI (enfant de matrix_audit_sessions)
CREATE TABLE public.matrix_audit_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.matrix_audit_sessions(id) ON DELETE CASCADE,
  prompt_item_id UUID REFERENCES public.prompt_matrix_items(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  axe TEXT NOT NULL,
  poids NUMERIC NOT NULL,
  crawlers_score NUMERIC,
  csv_weighted_score NUMERIC,
  seuil_bon NUMERIC NOT NULL DEFAULT 70,
  seuil_moyen NUMERIC NOT NULL DEFAULT 40,
  seuil_mauvais NUMERIC NOT NULL DEFAULT 0,
  llm_name TEXT,
  verdict TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.prompt_matrix_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_audit_results ENABLE ROW LEVEL SECURITY;

-- prompt_matrix_items: user can CRUD own rows, admin can read all
CREATE POLICY "Users manage own prompt items" ON public.prompt_matrix_items
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read all prompt items" ON public.prompt_matrix_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- matrix_audit_sessions: user can CRUD own, admin can read all
CREATE POLICY "Users manage own audit sessions" ON public.matrix_audit_sessions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read all audit sessions" ON public.matrix_audit_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- matrix_audit_results: user can CRUD own, admin can read all
CREATE POLICY "Users manage own audit results" ON public.matrix_audit_results
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read all audit results" ON public.matrix_audit_results
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_prompt_matrix_items_user ON public.prompt_matrix_items(user_id);
CREATE INDEX idx_matrix_audit_sessions_user ON public.matrix_audit_sessions(user_id);
CREATE INDEX idx_matrix_audit_results_session ON public.matrix_audit_results(session_id);
