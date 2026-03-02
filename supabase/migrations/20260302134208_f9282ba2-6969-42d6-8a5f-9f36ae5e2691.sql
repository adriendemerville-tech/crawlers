
-- Table for temporary magic link tokens
CREATE TABLE public.magic_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- Enable RLS
ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;

-- Users can create their own magic links
CREATE POLICY "Users can create their own magic links"
ON public.magic_links
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own magic links
CREATE POLICY "Users can view their own magic links"
ON public.magic_links
FOR SELECT
USING (auth.uid() = user_id);

-- Users can delete their own magic links
CREATE POLICY "Users can delete their own magic links"
ON public.magic_links
FOR DELETE
USING (auth.uid() = user_id);

-- Service role can manage all (for edge function usage)
CREATE POLICY "Service role can manage magic links"
ON public.magic_links
FOR ALL
USING (true)
WITH CHECK (true);

-- Index for fast token lookup
CREATE INDEX idx_magic_links_token ON public.magic_links (token);
CREATE INDEX idx_magic_links_expires ON public.magic_links (expires_at);
