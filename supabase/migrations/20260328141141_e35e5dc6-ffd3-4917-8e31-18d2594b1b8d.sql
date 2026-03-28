
CREATE TABLE public.image_style_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  target_url text,
  style_key text NOT NULL,
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_image_style_pref_unique ON public.image_style_preferences (user_id, COALESCE(tracked_site_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(target_url, ''), style_key);

ALTER TABLE public.image_style_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own style preferences"
ON public.image_style_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
