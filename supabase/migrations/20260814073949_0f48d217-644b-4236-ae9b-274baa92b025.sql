CREATE TABLE public.browserless_render_slots (
  slot_id integer PRIMARY KEY CHECK (slot_id BETWEEN 1 AND 7),
  lease_id uuid,
  leased_until timestamptz,
  leased_for text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.browserless_render_slots TO service_role;

ALTER TABLE public.browserless_render_slots ENABLE ROW LEVEL SECURITY;

INSERT INTO public.browserless_render_slots (slot_id)
SELECT generate_series(1, 7)
ON CONFLICT (slot_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.acquire_browserless_slot(
  p_lease_id uuid,
  p_label text DEFAULT NULL,
  p_lease_seconds integer DEFAULT 60
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_slot integer;
BEGIN
  WITH candidate AS (
    SELECT slot_id
    FROM public.browserless_render_slots
    WHERE leased_until IS NULL OR leased_until < now()
    ORDER BY slot_id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.browserless_render_slots slots
  SET lease_id = p_lease_id,
      leased_until = now() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 10), 120)),
      leased_for = left(p_label, 500),
      updated_at = now()
  FROM candidate
  WHERE slots.slot_id = candidate.slot_id
  RETURNING slots.slot_id INTO claimed_slot;

  RETURN claimed_slot;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_browserless_slot(p_lease_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer;
BEGIN
  UPDATE public.browserless_render_slots
  SET lease_id = NULL,
      leased_until = NULL,
      leased_for = NULL,
      updated_at = now()
  WHERE lease_id = p_lease_id;

  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_browserless_slot(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_browserless_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_browserless_slot(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_browserless_slot(uuid) TO service_role;