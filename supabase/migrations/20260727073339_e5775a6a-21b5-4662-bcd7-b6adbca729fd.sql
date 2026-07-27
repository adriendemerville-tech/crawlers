
CREATE TABLE public.doc_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  label text,
  sections jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  max_views integer,
  view_count integer NOT NULL DEFAULT 0,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_share_links TO authenticated;
GRANT ALL ON public.doc_share_links TO service_role;

ALTER TABLE public.doc_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage doc share links"
  ON public.doc_share_links
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_doc_share_links_token ON public.doc_share_links(token);
CREATE INDEX idx_doc_share_links_created_by ON public.doc_share_links(created_by);
