
ALTER TABLE public.saved_reports ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.report_folders ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
