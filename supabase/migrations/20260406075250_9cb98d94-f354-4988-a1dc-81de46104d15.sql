
CREATE TABLE public.seo_page_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'article',
  template_id UUID REFERENCES public.content_prompt_templates(id),
  domain TEXT,
  target_keyword TEXT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  content TEXT NOT NULL,
  generation_context JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_page_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view drafts"
  ON public.seo_page_drafts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update drafts"
  ON public.seo_page_drafts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert drafts"
  ON public.seo_page_drafts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete drafts"
  ON public.seo_page_drafts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_seo_page_drafts_status ON public.seo_page_drafts(status);
CREATE INDEX idx_seo_page_drafts_type ON public.seo_page_drafts(page_type);

CREATE TRIGGER update_seo_page_drafts_updated_at
  BEFORE UPDATE ON public.seo_page_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
