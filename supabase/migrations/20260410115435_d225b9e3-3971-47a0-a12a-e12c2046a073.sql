
-- Table de contexte saisonnier/temporel partagée
CREATE TABLE public.seasonal_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'calendar' CHECK (event_type IN ('calendar', 'seasonal', 'sectorial', 'trend')),
  description TEXT,
  sectors TEXT[] DEFAULT '{}',
  geo_zones TEXT[] DEFAULT '{FR}',
  start_month INTEGER CHECK (start_month BETWEEN 1 AND 12),
  start_day INTEGER CHECK (start_day BETWEEN 1 AND 31),
  end_month INTEGER CHECK (end_month BETWEEN 1 AND 12),
  end_day INTEGER CHECK (end_day BETWEEN 1 AND 31),
  prep_weeks_before INTEGER DEFAULT 6,
  peak_keywords TEXT[] DEFAULT '{}',
  impact_level TEXT DEFAULT 'medium' CHECK (impact_level IN ('high', 'medium', 'low')),
  is_recurring BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'api', 'ai')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seasonal_context ENABLE ROW LEVEL SECURITY;

-- Lecture publique (utilisé par toutes les edge functions via service role)
CREATE POLICY "seasonal_context_select_all"
  ON public.seasonal_context FOR SELECT
  USING (true);

-- Modification admin uniquement
CREATE POLICY "seasonal_context_admin_insert"
  ON public.seasonal_context FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "seasonal_context_admin_update"
  ON public.seasonal_context FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "seasonal_context_admin_delete"
  ON public.seasonal_context FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index pour les requêtes par mois
CREATE INDEX idx_seasonal_context_months ON public.seasonal_context (start_month, end_month);
CREATE INDEX idx_seasonal_context_type ON public.seasonal_context (event_type);
CREATE INDEX idx_seasonal_context_sectors ON public.seasonal_context USING GIN (sectors);

-- Trigger updated_at
CREATE TRIGGER update_seasonal_context_updated_at
  BEFORE UPDATE ON public.seasonal_context
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction utilitaire : récupérer le contexte actif pour un secteur donné
CREATE OR REPLACE FUNCTION public.get_active_seasonal_context(
  p_sector TEXT DEFAULT NULL,
  p_geo TEXT DEFAULT 'FR'
)
RETURNS TABLE(
  event_name TEXT,
  event_type TEXT,
  description TEXT,
  impact_level TEXT,
  peak_keywords TEXT[],
  prep_weeks_before INTEGER,
  is_in_prep BOOLEAN,
  is_in_peak BOOLEAN,
  days_until_start INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_now DATE := CURRENT_DATE;
  v_month INTEGER := EXTRACT(MONTH FROM v_now);
  v_day INTEGER := EXTRACT(DAY FROM v_now);
  v_doy INTEGER := EXTRACT(DOY FROM v_now);
BEGIN
  RETURN QUERY
  SELECT
    sc.event_name,
    sc.event_type,
    sc.description,
    sc.impact_level,
    sc.peak_keywords,
    sc.prep_weeks_before,
    -- Is in prep window?
    CASE WHEN (
      make_date(EXTRACT(YEAR FROM v_now)::int, sc.start_month, sc.start_day) - (sc.prep_weeks_before * 7)
    ) <= v_now AND v_now < make_date(EXTRACT(YEAR FROM v_now)::int, sc.start_month, sc.start_day)
    THEN true ELSE false END AS is_in_prep,
    -- Is in peak?
    CASE WHEN v_month BETWEEN sc.start_month AND COALESCE(sc.end_month, sc.start_month)
      AND (sc.start_month != v_month OR v_day >= sc.start_day)
      AND (COALESCE(sc.end_month, sc.start_month) != v_month OR v_day <= COALESCE(sc.end_day, 28))
    THEN true ELSE false END AS is_in_peak,
    -- Days until start
    (make_date(EXTRACT(YEAR FROM v_now)::int, sc.start_month, sc.start_day) - v_now)::integer AS days_until_start
  FROM seasonal_context sc
  WHERE sc.is_recurring = true
    AND (p_sector IS NULL OR p_sector = ANY(sc.sectors) OR sc.sectors = '{}')
    AND (p_geo = ANY(sc.geo_zones) OR sc.geo_zones = '{}')
    AND (
      -- Currently in peak or in prep window (±8 weeks around start)
      ABS(
        EXTRACT(DOY FROM make_date(EXTRACT(YEAR FROM v_now)::int, sc.start_month, sc.start_day)) - v_doy
      ) <= (sc.prep_weeks_before + 4) * 7
      OR (v_month BETWEEN sc.start_month AND COALESCE(sc.end_month, sc.start_month))
    )
  ORDER BY
    CASE sc.impact_level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
    ABS(EXTRACT(DOY FROM make_date(EXTRACT(YEAR FROM v_now)::int, sc.start_month, sc.start_day)) - v_doy);
END;
$$;
