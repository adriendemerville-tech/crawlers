ALTER TABLE public.user_console_preferences
  ADD COLUMN IF NOT EXISTS sidebar_collapsed BOOLEAN NOT NULL DEFAULT false;
