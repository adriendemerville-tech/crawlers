-- audit_raw_data
DROP POLICY IF EXISTS "Service role can insert raw data" ON public.audit_raw_data;
CREATE POLICY "Service role can insert raw data"
  ON public.audit_raw_data FOR INSERT TO service_role WITH CHECK (true);

-- audit_recommendations_registry
DROP POLICY IF EXISTS "Users can create their own recommendations" ON public.audit_recommendations_registry;
DROP POLICY IF EXISTS "Users can update their own recommendations" ON public.audit_recommendations_registry;
DROP POLICY IF EXISTS "Users can delete their own recommendations" ON public.audit_recommendations_registry;
DROP POLICY IF EXISTS "Users can view their own recommendations" ON public.audit_recommendations_registry;
CREATE POLICY "Users can create their own recommendations"
  ON public.audit_recommendations_registry FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recommendations"
  ON public.audit_recommendations_registry FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recommendations"
  ON public.audit_recommendations_registry FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own recommendations"
  ON public.audit_recommendations_registry FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- matrix_audits
DROP POLICY IF EXISTS "Users can create their own matrix audits" ON public.matrix_audits;
DROP POLICY IF EXISTS "Users can update their own matrix audits" ON public.matrix_audits;
DROP POLICY IF EXISTS "Users can delete their own matrix audits" ON public.matrix_audits;
DROP POLICY IF EXISTS "Users can view their own matrix audits" ON public.matrix_audits;
CREATE POLICY "Users can create their own matrix audits"
  ON public.matrix_audits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own matrix audits"
  ON public.matrix_audits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own matrix audits"
  ON public.matrix_audits FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own matrix audits"
  ON public.matrix_audits FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- pdf_audits
DROP POLICY IF EXISTS "Admins can manage all pdf_audits" ON public.pdf_audits;
DROP POLICY IF EXISTS "Users can view own pdf_audits" ON public.pdf_audits;
CREATE POLICY "Admins can manage all pdf_audits"
  ON public.pdf_audits FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own pdf_audits"
  ON public.pdf_audits FOR SELECT TO authenticated USING (auth.uid() = client_id);

-- actual_results
DROP POLICY IF EXISTS "Admins can manage actual_results" ON public.actual_results;
CREATE POLICY "Admins can manage actual_results"
  ON public.actual_results FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Retirer les privilèges inutiles de anon
REVOKE ALL ON public.audits FROM anon;
REVOKE ALL ON public.audit_cache FROM anon;
REVOKE ALL ON public.audit_raw_data FROM anon;
REVOKE ALL ON public.audit_impact_snapshots FROM anon;
REVOKE ALL ON public.audit_matrix_results FROM anon;
REVOKE ALL ON public.audit_matrix_sessions FROM anon;
REVOKE ALL ON public.audit_recommendations_registry FROM anon;
REVOKE ALL ON public.pdf_audits FROM anon;
REVOKE ALL ON public.external_audits FROM anon;
REVOKE ALL ON public.matrix_audits FROM anon;
REVOKE ALL ON public.matrix_audit_results FROM anon;
REVOKE ALL ON public.matrix_audit_sessions FROM anon;
REVOKE ALL ON public.matrix_errors FROM anon;
REVOKE ALL ON public.actual_results FROM anon;

-- audit_cache reste strictement service_role
REVOKE ALL ON public.audit_cache FROM authenticated;

-- GRANT explicites
GRANT SELECT, INSERT, UPDATE ON public.audits TO authenticated;
GRANT SELECT ON public.audit_raw_data TO authenticated;
GRANT SELECT ON public.audit_impact_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_matrix_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_matrix_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_recommendations_registry TO authenticated;
GRANT SELECT ON public.pdf_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matrix_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matrix_audit_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matrix_audit_sessions TO authenticated;
GRANT SELECT, INSERT ON public.matrix_errors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actual_results TO authenticated;

GRANT ALL ON public.audits TO service_role;
GRANT ALL ON public.audit_cache TO service_role;
GRANT ALL ON public.audit_raw_data TO service_role;
GRANT ALL ON public.audit_impact_snapshots TO service_role;
GRANT ALL ON public.audit_matrix_results TO service_role;
GRANT ALL ON public.audit_matrix_sessions TO service_role;
GRANT ALL ON public.audit_recommendations_registry TO service_role;
GRANT ALL ON public.pdf_audits TO service_role;
GRANT ALL ON public.external_audits TO service_role;
GRANT ALL ON public.matrix_audits TO service_role;
GRANT ALL ON public.matrix_audit_results TO service_role;
GRANT ALL ON public.matrix_audit_sessions TO service_role;
GRANT ALL ON public.matrix_errors TO service_role;
GRANT ALL ON public.actual_results TO service_role;