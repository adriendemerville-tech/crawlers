-- The partial unique index cannot be targeted by ON CONFLICT, so every
-- upsert from Marina / content-integrity silently failed.
DROP INDEX IF EXISTS public.idx_workbench_source_unique;

CREATE UNIQUE INDEX idx_workbench_source_unique
  ON public.architect_workbench (source_type, source_record_id);
