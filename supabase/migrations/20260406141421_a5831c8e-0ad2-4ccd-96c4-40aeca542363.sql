
-- Add execution columns to cocoon_tasks
ALTER TABLE public.cocoon_tasks
  ADD COLUMN IF NOT EXISTS action_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS action_payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS execution_result jsonb,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz;

-- Add constraint for valid action_type values
ALTER TABLE public.cocoon_tasks
  ADD CONSTRAINT cocoon_tasks_action_type_check 
  CHECK (action_type IN ('linking', 'content', 'code', 'manual'));

-- Add constraint for valid execution_status values
ALTER TABLE public.cocoon_tasks
  ADD CONSTRAINT cocoon_tasks_execution_status_check 
  CHECK (execution_status IN ('pending', 'running', 'completed', 'failed', 'skipped'));
