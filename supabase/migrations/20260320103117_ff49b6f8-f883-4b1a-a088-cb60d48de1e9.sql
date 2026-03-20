-- Table to archive deleted users with all their profile data
CREATE TABLE public.archived_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  email text NOT NULL,
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  credits_balance integer DEFAULT 0,
  plan_type text DEFAULT 'free',
  persona_type text,
  subscription_status text,
  referral_code text,
  affiliate_code_used text,
  original_created_at timestamptz,
  archived_at timestamptz DEFAULT now(),
  archived_by uuid,
  archive_reason text DEFAULT 'admin_deletion',
  profile_snapshot jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.archived_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage archived users"
ON public.archived_users
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));