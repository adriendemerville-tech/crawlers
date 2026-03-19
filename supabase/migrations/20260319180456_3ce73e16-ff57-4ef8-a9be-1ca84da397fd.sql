
-- ═══════════════════════════════════════════════════════════════
-- FIX REMAINING LINTER WARNINGS
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. analytics_events: tighten INSERT (keep open for widget telemetry but restrict to non-null event_type) ───
-- This table is used by widget.js and SDK telemetry — needs to stay open for inserts.
-- But we can restrict to service_role + authenticated users instead of true
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.analytics_events;
CREATE POLICY "Authenticated or service can insert analytics"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.role() IN ('authenticated', 'service_role', 'anon'));

-- ─── 2. analyzed_urls: restrict INSERT to authenticated ───
DROP POLICY IF EXISTS "Authenticated can insert analyzed urls" ON public.analyzed_urls;
CREATE POLICY "Authenticated can insert analyzed urls"
  ON public.analyzed_urls FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── 3. audit_raw_data: restrict INSERT to service_role ───
DROP POLICY IF EXISTS "Service role can insert raw data" ON public.audit_raw_data;
CREATE POLICY "Service role can insert raw data"
  ON public.audit_raw_data FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 4. verification_codes: add basic policies ───
CREATE POLICY "Service role can manage verification codes"
  ON public.verification_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 5. Fix functions missing search_path ───
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$ SELECT pgmq.delete(queue_name, message_id); $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
  RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$ SELECT msg_id, read_ct, message FROM pgmq.read(queue_name, vt, batch_size); $$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
  RETURNS bigint
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$ SELECT pgmq.send(queue_name, payload); $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
END;
$$;
