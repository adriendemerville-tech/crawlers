GRANT SELECT ON public.netlinking_orders TO authenticated;
GRANT ALL ON public.netlinking_orders TO service_role;
GRANT SELECT ON public.netlinking_providers TO authenticated, anon;
GRANT ALL ON public.netlinking_providers TO service_role;
GRANT SELECT ON public.netlinking_catalog_cache TO authenticated;
GRANT ALL ON public.netlinking_catalog_cache TO service_role;

-- Vérité affichée : seuls les providers réellement câblés restent actifs
UPDATE public.netlinking_providers
SET status = 'unavailable', supports_search = false, supports_order = false
WHERE slug IN ('rocketlinks', 'getfluence');

CREATE INDEX IF NOT EXISTS idx_netlinking_orders_user_status ON public.netlinking_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_netlinking_cache_expires ON public.netlinking_catalog_cache(expires_at);