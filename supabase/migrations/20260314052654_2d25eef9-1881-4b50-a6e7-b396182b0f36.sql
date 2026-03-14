ALTER TABLE public.audit_impact_snapshots ADD COLUMN IF NOT EXISTS ga4_baseline jsonb DEFAULT null;
ALTER TABLE public.audit_impact_snapshots ADD COLUMN IF NOT EXISTS ga4_t30 jsonb DEFAULT null;
ALTER TABLE public.audit_impact_snapshots ADD COLUMN IF NOT EXISTS ga4_t60 jsonb DEFAULT null;
ALTER TABLE public.audit_impact_snapshots ADD COLUMN IF NOT EXISTS ga4_t90 jsonb DEFAULT null;