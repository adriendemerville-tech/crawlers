ALTER TABLE public.cocoon_auto_links
  ADD COLUMN IF NOT EXISTS anchor_variants TEXT[];

COMMENT ON COLUMN public.cocoon_auto_links.anchor_variants IS 'Top 3 ancres alternatives ordonnées par naturalité (anchor_text = anchor_variants[0])';