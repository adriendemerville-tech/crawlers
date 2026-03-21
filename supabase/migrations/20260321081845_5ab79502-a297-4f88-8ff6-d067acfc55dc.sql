-- Add assistant_type column to distinguish between crawlers and cocoon assistants
ALTER TABLE public.sav_conversations 
ADD COLUMN IF NOT EXISTS assistant_type text NOT NULL DEFAULT 'crawlers';

-- Add index for filtering by assistant type
CREATE INDEX IF NOT EXISTS idx_sav_conversations_assistant_type 
ON public.sav_conversations(assistant_type);

-- Add source context (domain, tracked_site_id) for cocoon conversations
ALTER TABLE public.sav_conversations 
ADD COLUMN IF NOT EXISTS source_domain text,
ADD COLUMN IF NOT EXISTS tracked_site_id uuid;