ALTER TABLE public.predictions ADD COLUMN domain text DEFAULT NULL;

-- Backfill domain from linked pdf_audits where possible
UPDATE public.predictions p
SET domain = (pa.extracted_data->>'domain')
FROM public.pdf_audits pa
WHERE p.audit_id = pa.id
  AND pa.extracted_data->>'domain' IS NOT NULL
  AND p.domain IS NULL;

-- Index for fast same-domain lookups
CREATE INDEX idx_predictions_domain_client ON public.predictions (domain, client_id, created_at);