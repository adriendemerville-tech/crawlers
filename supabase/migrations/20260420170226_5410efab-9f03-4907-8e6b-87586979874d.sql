ALTER TABLE public.log_entries
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS confidence_score smallint DEFAULT 0;

ALTER TABLE public.bot_hits
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS confidence_score smallint DEFAULT 0;

ALTER TABLE public.log_entries
  DROP CONSTRAINT IF EXISTS log_entries_verification_status_chk;
ALTER TABLE public.log_entries
  ADD CONSTRAINT log_entries_verification_status_chk
  CHECK (verification_status IN ('verified','suspect','stealth','unverified'));

ALTER TABLE public.bot_hits
  DROP CONSTRAINT IF EXISTS bot_hits_verification_status_chk;
ALTER TABLE public.bot_hits
  ADD CONSTRAINT bot_hits_verification_status_chk
  CHECK (verification_status IN ('verified','suspect','stealth','unverified'));

CREATE INDEX IF NOT EXISTS idx_log_entries_verification
  ON public.log_entries (tracked_site_id, verification_status, ts DESC);

CREATE INDEX IF NOT EXISTS idx_bot_hits_verification
  ON public.bot_hits (tracked_site_id, verification_status, hit_at DESC);

COMMENT ON COLUMN public.log_entries.verification_status IS
  'verified=rDNS/ASN officiel, suspect=UA bot non verifie, stealth=comportement bot sans UA, unverified=non analyse';
COMMENT ON COLUMN public.log_entries.verification_method IS
  'rdns_match | asn_range | ua_only | behavioral | none';
COMMENT ON COLUMN public.log_entries.confidence_score IS
  'Score 0-100 de confiance dans la detection';