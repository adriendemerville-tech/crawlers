CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.parmenion_targets
  ADD COLUMN IF NOT EXISTS pull_token_hash text,
  ADD COLUMN IF NOT EXISTS pull_token_prefix text,
  ADD COLUMN IF NOT EXISTS pull_token_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_parmenion_targets_pull_token_hash
  ON public.parmenion_targets (pull_token_hash)
  WHERE pull_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.parmenion_verify_pull_token(_token text)
RETURNS TABLE(target_id uuid, domain text, is_active boolean, autopilot_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT id, domain, is_active, autopilot_enabled
  FROM public.parmenion_targets
  WHERE pull_token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.parmenion_rotate_pull_token(_target_id uuid)
RETURNS TABLE(token text, prefix text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _new_token text;
  _prefix text;
  _hash text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can rotate pull tokens';
  END IF;

  _new_token := 'prm_live_' || encode(extensions.gen_random_bytes(20), 'hex');
  _prefix := substring(_new_token, 1, 16);
  _hash := encode(extensions.digest(_new_token, 'sha256'), 'hex');

  UPDATE public.parmenion_targets
  SET pull_token_hash = _hash,
      pull_token_prefix = _prefix,
      pull_token_created_at = now(),
      updated_at = now()
  WHERE id = _target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target not found';
  END IF;

  RETURN QUERY SELECT _new_token, _prefix;
END;
$$;