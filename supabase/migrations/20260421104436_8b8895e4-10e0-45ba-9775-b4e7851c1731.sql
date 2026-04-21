
ALTER TABLE public.marina_api_keys
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT 'Default',
  ADD COLUMN IF NOT EXISTS selected_services TEXT[] NOT NULL DEFAULT ARRAY['identity', 'digital', 'strategy'],
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requests_count INTEGER NOT NULL DEFAULT 0;
