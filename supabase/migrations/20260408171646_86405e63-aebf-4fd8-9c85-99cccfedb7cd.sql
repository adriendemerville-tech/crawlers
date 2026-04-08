
-- Centralized keyword SSOT table
CREATE TABLE public.keyword_universe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  keyword TEXT NOT NULL,
  search_volume INTEGER DEFAULT 0,
  difficulty INTEGER,
  current_position INTEGER,
  best_position INTEGER,
  intent TEXT DEFAULT 'default',
  sources TEXT[] NOT NULL DEFAULT '{}',
  source_details JSONB DEFAULT '{}',
  opportunity_score NUMERIC(5,2) DEFAULT 0,
  is_quick_win BOOLEAN DEFAULT false,
  quick_win_type TEXT,
  quick_win_action TEXT,
  target_url TEXT,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain, keyword, user_id)
);

ALTER TABLE public.keyword_universe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own keywords" ON public.keyword_universe FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own keywords" ON public.keyword_universe FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own keywords" ON public.keyword_universe FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own keywords" ON public.keyword_universe FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.keyword_universe FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_keyword_universe_domain_user ON public.keyword_universe(domain, user_id);
CREATE INDEX idx_keyword_universe_opportunity ON public.keyword_universe(opportunity_score DESC);
CREATE INDEX idx_keyword_universe_quick_wins ON public.keyword_universe(domain, user_id) WHERE is_quick_win = true;

CREATE TRIGGER update_keyword_universe_updated_at
  BEFORE UPDATE ON public.keyword_universe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Upsert function: merges sources, keeps best data
CREATE OR REPLACE FUNCTION public.upsert_keyword_universe(
  p_domain TEXT,
  p_user_id UUID,
  p_keywords JSONB,
  p_source TEXT,
  p_tracked_site_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  kw JSONB;
  v_opp_score NUMERIC;
BEGIN
  FOR kw IN SELECT * FROM jsonb_array_elements(p_keywords)
  LOOP
    -- Compute opportunity score: high volume + close to page 1 = high score
    v_opp_score := COALESCE(
      LEAST(100, (
        (LEAST(COALESCE((kw->>'search_volume')::int, 0), 10000)::numeric / 100.0) * 0.5
        + GREATEST(0, (100 - COALESCE((kw->>'position')::int, 100)))::numeric * 0.3
        + GREATEST(0, (100 - COALESCE((kw->>'difficulty')::int, 50)))::numeric * 0.2
      )), 0
    );

    INSERT INTO keyword_universe (
      domain, keyword, search_volume, difficulty, current_position, best_position,
      intent, sources, source_details, opportunity_score,
      is_quick_win, quick_win_type, quick_win_action, target_url,
      tracked_site_id, user_id
    ) VALUES (
      p_domain,
      LOWER(TRIM(kw->>'keyword')),
      COALESCE((kw->>'search_volume')::int, 0),
      (kw->>'difficulty')::int,
      (kw->>'position')::int,
      (kw->>'position')::int,
      COALESCE(kw->>'intent', 'default'),
      ARRAY[p_source],
      jsonb_build_object(p_source, jsonb_build_object('imported_at', now()::text, 'data', kw)),
      v_opp_score,
      COALESCE((kw->>'is_quick_win')::boolean, false),
      kw->>'quick_win_type',
      kw->>'quick_win_action',
      kw->>'target_url',
      p_tracked_site_id,
      p_user_id
    )
    ON CONFLICT (domain, keyword, user_id) DO UPDATE SET
      search_volume = GREATEST(keyword_universe.search_volume, COALESCE((kw->>'search_volume')::int, 0)),
      difficulty = COALESCE((kw->>'difficulty')::int, keyword_universe.difficulty),
      current_position = CASE
        WHEN (kw->>'position')::int IS NOT NULL THEN (kw->>'position')::int
        ELSE keyword_universe.current_position
      END,
      best_position = LEAST(
        COALESCE(keyword_universe.best_position, 999),
        COALESCE((kw->>'position')::int, 999)
      ),
      intent = COALESCE(NULLIF(kw->>'intent', 'default'), keyword_universe.intent),
      sources = CASE
        WHEN p_source = ANY(keyword_universe.sources) THEN keyword_universe.sources
        ELSE keyword_universe.sources || ARRAY[p_source]
      END,
      source_details = keyword_universe.source_details || jsonb_build_object(
        p_source, jsonb_build_object('imported_at', now()::text, 'data', kw)
      ),
      opportunity_score = GREATEST(keyword_universe.opportunity_score, v_opp_score),
      is_quick_win = keyword_universe.is_quick_win OR COALESCE((kw->>'is_quick_win')::boolean, false),
      quick_win_type = COALESCE(kw->>'quick_win_type', keyword_universe.quick_win_type),
      quick_win_action = COALESCE(kw->>'quick_win_action', keyword_universe.quick_win_action),
      target_url = COALESCE(kw->>'target_url', keyword_universe.target_url),
      tracked_site_id = COALESCE(p_tracked_site_id, keyword_universe.tracked_site_id),
      updated_at = now();

    IF FOUND THEN
      v_updated := v_updated + 1;
    ELSE
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'domain', p_domain,
    'source', p_source,
    'processed', v_inserted + v_updated
  );
END;
$$;
