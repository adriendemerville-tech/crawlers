-- Create table for saved action plans
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('technical', 'strategic')),
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own action plans" 
ON public.action_plans 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own action plans" 
ON public.action_plans 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own action plans" 
ON public.action_plans 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own action plans" 
ON public.action_plans 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_action_plans_updated_at
BEFORE UPDATE ON public.action_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();