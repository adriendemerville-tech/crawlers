
CREATE TABLE public.short_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  created_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_short_links_code ON public.short_links (code);

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own short links"
ON public.short_links FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own short links"
ON public.short_links FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Anyone can read short links by code for redirect"
ON public.short_links FOR SELECT
USING (true);
