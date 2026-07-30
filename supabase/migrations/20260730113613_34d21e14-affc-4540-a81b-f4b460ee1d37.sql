ALTER TABLE public.cf_shield_configs
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'cloudflare';

ALTER TABLE public.cf_shield_configs
  DROP CONSTRAINT IF EXISTS cf_shield_configs_provider_chk;

ALTER TABLE public.cf_shield_configs
  ADD CONSTRAINT cf_shield_configs_provider_chk
  CHECK (provider IN ('cloudflare','senthor','custom'));

CREATE INDEX IF NOT EXISTS idx_cf_shield_configs_provider ON public.cf_shield_configs(provider);