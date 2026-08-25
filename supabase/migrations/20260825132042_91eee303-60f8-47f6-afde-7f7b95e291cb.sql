CREATE TABLE public.site_maintenance (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  active boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all','paths')),
  paths text[] NOT NULL DEFAULT '{}',
  message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_maintenance TO anon;
GRANT SELECT ON public.site_maintenance TO authenticated;
GRANT ALL ON public.site_maintenance TO service_role;

ALTER TABLE public.site_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read maintenance state"
ON public.site_maintenance FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage maintenance state"
ON public.site_maintenance FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_maintenance (id, active, scope, paths) VALUES (true, false, 'all', '{}');