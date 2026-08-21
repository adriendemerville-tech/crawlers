CREATE TABLE public.user_console_preferences (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sidebar_order TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_console_preferences TO authenticated;
GRANT ALL ON public.user_console_preferences TO service_role;

ALTER TABLE public.user_console_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own console preferences"
  ON public.user_console_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_console_preferences_updated_at
  BEFORE UPDATE ON public.user_console_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();