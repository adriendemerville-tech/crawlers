
CREATE TABLE public.agent_supervisor_directives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  directive_text TEXT NOT NULL,
  target_function TEXT,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_supervisor_directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own supervisor directives"
ON public.agent_supervisor_directives FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own supervisor directives"
ON public.agent_supervisor_directives FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supervisor directives"
ON public.agent_supervisor_directives FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_agent_supervisor_directives_updated_at
BEFORE UPDATE ON public.agent_supervisor_directives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
