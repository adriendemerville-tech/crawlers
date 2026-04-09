ALTER TABLE public.ux_context_analyses
ADD COLUMN IF NOT EXISTS screenshot_url text,
ADD COLUMN IF NOT EXISTS screenshot_height integer,
ADD COLUMN IF NOT EXISTS annotations jsonb;