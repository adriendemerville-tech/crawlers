-- Add E-E-A-T score columns to tracked_sites (identity card)
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS eeat_score integer,
  ADD COLUMN IF NOT EXISTS eeat_details jsonb,
  ADD COLUMN IF NOT EXISTS eeat_last_audit_at timestamptz;

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_tracked_sites_eeat_score ON public.tracked_sites (eeat_score) WHERE eeat_score IS NOT NULL;