ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_fields_trigger;
UPDATE public.profiles SET subscription_status = 'active' WHERE email = 'sphaeraglobal@gmail.com';
ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_fields_trigger;