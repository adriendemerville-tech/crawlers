-- Sprint 8 — Brancher Parménion à Dictadevi : préparer le multi-tenant
-- 1. Ajouter autopilot_enabled (off par défaut, on l'activera explicitement)
ALTER TABLE public.parmenion_targets
  ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Corriger la plateforme de la cible Dictadevi (était 'custom', doit être 'dictadevi')
UPDATE public.parmenion_targets
SET platform = 'dictadevi',
    updated_at = now()
WHERE domain = 'dictadevi.io' AND platform = 'custom';

-- 3. Activer l'autopilote sur les cibles déjà branchées (iktracker + crawlers)
UPDATE public.parmenion_targets
SET autopilot_enabled = true,
    updated_at = now()
WHERE platform IN ('iktracker', 'internal');

-- 4. Index pour le cron (recherche rapide des cibles actives)
CREATE INDEX IF NOT EXISTS idx_parmenion_targets_autopilot_active
  ON public.parmenion_targets (is_active, autopilot_enabled)
  WHERE is_active = true AND autopilot_enabled = true;

-- 5. Fonction RPC pour récupérer la clé API d'une cible (sécurisée, security definer)
CREATE OR REPLACE FUNCTION public.get_parmenion_target_api_key(p_domain TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT api_key_name
  FROM public.parmenion_targets
  WHERE domain = p_domain
    AND is_active = true
  LIMIT 1;
$$;

-- Restreindre l'exécution aux service_role uniquement
REVOKE EXECUTE ON FUNCTION public.get_parmenion_target_api_key(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parmenion_target_api_key(TEXT) TO service_role;