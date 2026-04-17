-- =====================================================
-- Sprint 2 GEO : Corrélation Bot IA ↔ Clic humain
-- =====================================================

-- 1. Table principale d'attribution
CREATE TABLE public.ai_attribution_events (
  id BIGSERIAL PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,

  -- Source IA détectée via referer
  ai_source TEXT NOT NULL CHECK (ai_source IN ('chatgpt','perplexity','claude','gemini','copilot','phind','other')),
  referer_full TEXT,

  -- Visite humaine
  visited_at TIMESTAMPTZ NOT NULL,
  session_fingerprint TEXT,        -- sha256(ua + ip_hash)  — déjà anonyme
  country TEXT,

  -- Paramètres d'attribution
  attribution_window_days INT NOT NULL DEFAULT 30,
  attribution_model TEXT NOT NULL DEFAULT 'multi_touch_weighted',

  -- Crawls bot IA attribués (multi-touch pondéré, demi-vie 15j)
  -- Forme : [{bot_hit_id, bot_name, crawled_at, days_before, weight}]
  attributed_bot_hits JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_weight NUMERIC(10,4) DEFAULT 0,
  top_attributed_bot TEXT,
  attributed_count INT DEFAULT 0,

  -- Lien direct vers le bot_hit humain d'origine (anti-doublon)
  source_bot_hit_id BIGINT REFERENCES public.bot_hits(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index de performance
CREATE INDEX idx_aae_site_visited
  ON public.ai_attribution_events(tracked_site_id, visited_at DESC);

CREATE INDEX idx_aae_user_visited
  ON public.ai_attribution_events(user_id, visited_at DESC);

CREATE INDEX idx_aae_path_visited
  ON public.ai_attribution_events(tracked_site_id, path, visited_at DESC);

CREATE INDEX idx_aae_source
  ON public.ai_attribution_events(tracked_site_id, ai_source, visited_at DESC);

-- Anti-doublon : un même bot_hit humain ne génère qu'une seule attribution
CREATE UNIQUE INDEX uq_aae_source_bot_hit
  ON public.ai_attribution_events(source_bot_hit_id)
  WHERE source_bot_hit_id IS NOT NULL;

-- 2. RLS
ALTER TABLE public.ai_attribution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own attribution events"
  ON public.ai_attribution_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts/updates uniquement via service role (edge functions)
-- => aucune policy INSERT/UPDATE/DELETE pour les utilisateurs

-- 3. Vue agrégée par URL (30j)
CREATE OR REPLACE VIEW public.v_ai_attribution_by_url AS
SELECT
  tracked_site_id,
  user_id,
  domain,
  path,
  COUNT(*) AS visits_30d,
  COUNT(DISTINCT ai_source) AS distinct_sources,
  SUM(attributed_count) AS attributed_crawls,
  MAX(visited_at) AS last_visit_at,
  -- top source IA pour cette URL
  (
    SELECT ai_source
    FROM public.ai_attribution_events e2
    WHERE e2.tracked_site_id = e1.tracked_site_id
      AND e2.path = e1.path
      AND e2.visited_at > now() - INTERVAL '30 days'
    GROUP BY ai_source
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS top_source,
  -- top bot attribué (le plus pondéré sur la fenêtre)
  (
    SELECT top_attributed_bot
    FROM public.ai_attribution_events e3
    WHERE e3.tracked_site_id = e1.tracked_site_id
      AND e3.path = e1.path
      AND e3.visited_at > now() - INTERVAL '30 days'
      AND e3.top_attributed_bot IS NOT NULL
    GROUP BY top_attributed_bot
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS top_bot
FROM public.ai_attribution_events e1
WHERE visited_at > now() - INTERVAL '30 days'
GROUP BY tracked_site_id, user_id, domain, path;

-- 4. Vue agrégée par source IA (30j)
CREATE OR REPLACE VIEW public.v_ai_attribution_by_source AS
SELECT
  tracked_site_id,
  user_id,
  domain,
  ai_source,
  COUNT(*) AS visits_30d,
  COUNT(DISTINCT path) AS distinct_pages,
  SUM(attributed_count) AS attributed_crawls,
  AVG(total_weight) AS avg_attribution_weight,
  MAX(visited_at) AS last_visit_at
FROM public.ai_attribution_events
WHERE visited_at > now() - INTERVAL '30 days'
GROUP BY tracked_site_id, user_id, domain, ai_source;

-- 5. Commentaires de documentation
COMMENT ON TABLE public.ai_attribution_events IS
  'Sprint 2 GEO — Corrélation visites humaines (referer IA) ↔ crawls bots IA. Fenêtre 30j, modèle multi-touch pondéré (demi-vie 15j).';

COMMENT ON COLUMN public.ai_attribution_events.attributed_bot_hits IS
  'Liste JSON des crawls bot IA attribués avec poids: [{bot_hit_id, bot_name, crawled_at, days_before, weight}]. Somme normalisée à 1.';

COMMENT ON COLUMN public.ai_attribution_events.session_fingerprint IS
  'Hash sha256(user_agent + ip_hash). Anonyme — ne permet pas de remonter à un individu.';

COMMENT ON VIEW public.v_ai_attribution_by_url IS
  'Agrégation 30j des visites IA par URL pour le dashboard Console > GEO.';

COMMENT ON VIEW public.v_ai_attribution_by_source IS
  'Agrégation 30j des visites IA par source (ChatGPT/Perplexity/Claude/Gemini/Copilot/Phind).';