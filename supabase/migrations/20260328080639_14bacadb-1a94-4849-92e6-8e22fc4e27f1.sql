
CREATE TABLE public.content_prompt_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL CHECK (page_type IN ('landing', 'product', 'article')),
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_prompt_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own presets" ON public.content_prompt_presets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_content_prompt_presets_updated_at
  BEFORE UPDATE ON public.content_prompt_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_content_prompt_presets_user_site ON public.content_prompt_presets(user_id, tracked_site_id, page_type);
