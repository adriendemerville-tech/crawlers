
-- GMB Power Score snapshots (historique hebdomadaire)
CREATE TABLE public.gmb_power_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  
  -- Score global
  total_score INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'F',
  
  -- 7 dimensions (0-100 chacune)
  completeness_score INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0,
  activity_score INTEGER DEFAULT 0,
  local_serp_score INTEGER DEFAULT 0,
  nap_consistency_score INTEGER DEFAULT 0,
  media_score INTEGER DEFAULT 0,
  trust_score INTEGER DEFAULT 0,
  
  -- Données brutes pour audit trail
  raw_data JSONB DEFAULT '{}',
  
  -- Timing
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  week_start_date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Un snapshot par site par semaine
  UNIQUE(tracked_site_id, week_start_date)
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_gmb_power_site_date ON public.gmb_power_snapshots(tracked_site_id, measured_at DESC);
CREATE INDEX idx_gmb_power_domain ON public.gmb_power_snapshots(domain);

-- RLS
ALTER TABLE public.gmb_power_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gmb power snapshots"
  ON public.gmb_power_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert gmb power snapshots"
  ON public.gmb_power_snapshots FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Realtime pour mise à jour live du dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.gmb_power_snapshots;
