CREATE TABLE public.cocoon_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  url_crawled TEXT,
  is_crawled BOOLEAN DEFAULT true,
  problem_description TEXT NOT NULL,
  screenshot_url TEXT,
  user_question TEXT,
  ai_response TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.cocoon_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage cocoon errors"
ON public.cocoon_errors FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can insert their own cocoon errors"
ON public.cocoon_errors FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all cocoon errors"
ON public.cocoon_errors FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));