-- Table: semantic_nodes — Cocoon module data layer
CREATE TABLE public.semantic_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE CASCADE NOT NULL,
  crawl_page_id uuid REFERENCES public.crawl_pages(id) ON DELETE SET NULL,
  audit_report_id uuid,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  h1 text DEFAULT '',
  keywords jsonb NOT NULL DEFAULT '[]',
  word_count integer NOT NULL DEFAULT 0,
  intent text NOT NULL DEFAULT 'informational',
  cluster_id text,
  parent_node_id uuid REFERENCES public.semantic_nodes(id) ON DELETE SET NULL,
  depth integer NOT NULL DEFAULT 0,
  embedding jsonb,
  iab_score numeric NOT NULL DEFAULT 0,
  geo_score numeric NOT NULL DEFAULT 0,
  roi_predictive numeric NOT NULL DEFAULT 0,
  traffic_estimate integer NOT NULL DEFAULT 0,
  keyword_difficulty numeric NOT NULL DEFAULT 0,
  cpc_value numeric NOT NULL DEFAULT 0,
  search_volume integer NOT NULL DEFAULT 0,
  citability_score numeric NOT NULL DEFAULT 0,
  serp_position numeric,
  serp_competitors jsonb NOT NULL DEFAULT '[]',
  content_gap_score numeric NOT NULL DEFAULT 0,
  internal_links_in integer NOT NULL DEFAULT 0,
  internal_links_out integer NOT NULL DEFAULT 0,
  freshness_score numeric NOT NULL DEFAULT 0,
  eeat_score numeric NOT NULL DEFAULT 0,
  conversion_potential numeric NOT NULL DEFAULT 0,
  cannibalization_risk numeric NOT NULL DEFAULT 0,
  page_authority numeric NOT NULL DEFAULT 0,
  similarity_edges jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id, url)
);

CREATE INDEX idx_semantic_nodes_user ON public.semantic_nodes(user_id);
CREATE INDEX idx_semantic_nodes_site ON public.semantic_nodes(tracked_site_id);
CREATE INDEX idx_semantic_nodes_cluster ON public.semantic_nodes(cluster_id);
CREATE INDEX idx_semantic_nodes_status ON public.semantic_nodes(status);

ALTER TABLE public.semantic_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own semantic nodes"
  ON public.semantic_nodes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own semantic nodes"
  ON public.semantic_nodes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own semantic nodes"
  ON public.semantic_nodes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own semantic nodes"
  ON public.semantic_nodes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access semantic nodes"
  ON public.semantic_nodes FOR ALL TO authenticated
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE TRIGGER update_semantic_nodes_updated_at
  BEFORE UPDATE ON public.semantic_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();