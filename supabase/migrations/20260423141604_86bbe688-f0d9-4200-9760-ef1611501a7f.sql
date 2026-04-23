-- Add billing period tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS billing_period text DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'annual')),
ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;

-- Create churn feedback table
CREATE TABLE IF NOT EXISTS public.churn_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  plan_type text,
  billing_period text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.churn_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback"
ON public.churn_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
ON public.churn_feedback
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));