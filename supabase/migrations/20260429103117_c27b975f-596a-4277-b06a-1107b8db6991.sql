UPDATE public.profiles
SET subscription_status = 'active'
WHERE email = 'sphaeraglobal@gmail.com'
  AND plan_type = 'agency_premium'
  AND (subscription_status IS NULL OR subscription_status = '');