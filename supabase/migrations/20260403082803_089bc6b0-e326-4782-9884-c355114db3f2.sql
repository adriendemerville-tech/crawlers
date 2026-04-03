-- Add missing GBP columns to google_connections
ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gmb_account_id text,
  ADD COLUMN IF NOT EXISTS gmb_location_id text;