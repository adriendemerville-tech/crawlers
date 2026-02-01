-- Add adriendemerville@gmail.com as admin
-- First we need to find the user_id from auth.users
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the user_id for adriendemerville@gmail.com
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'adriendemerville@gmail.com'
  LIMIT 1;
  
  -- If user exists, add admin role
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;