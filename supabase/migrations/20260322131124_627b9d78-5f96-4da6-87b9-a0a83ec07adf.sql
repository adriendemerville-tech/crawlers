
-- Add workflow state tracking to cocoon_chat_histories
ALTER TABLE public.cocoon_chat_histories 
  ADD COLUMN IF NOT EXISTS workflow_state jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS last_strategy_id uuid,
  ADD COLUMN IF NOT EXISTS summary text;

-- Add index for fast lookup by user + site
CREATE INDEX IF NOT EXISTS idx_cocoon_chat_histories_user_site 
  ON public.cocoon_chat_histories(user_id, tracked_site_id, updated_at DESC);
