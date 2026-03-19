INSERT INTO public.system_config (key, value)
VALUES 
  ('supervisor_enabled', '{"enabled": true}'::jsonb),
  ('cto_agent_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;