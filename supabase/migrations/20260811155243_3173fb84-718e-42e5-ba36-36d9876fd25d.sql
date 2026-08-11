CREATE OR REPLACE FUNCTION public.netlinking_reconciliation()
RETURNS TABLE(
  order_id uuid,
  user_id uuid,
  provider_slug text,
  publisher_domain text,
  status text,
  total_ht_cents integer,
  debited_cents integer,
  refunded_cents integer,
  net_cents integer,
  discrepancy_cents integer,
  age_hours numeric,
  flag text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tx AS (
    SELECT
      o.id AS order_id,
      COALESCE(SUM(CASE WHEN t.source_ref = 'netlinking:' || o.id::text THEN ABS(t.amount_cents) END), 0)::int AS debited,
      COALESCE(SUM(CASE WHEN t.source_ref = 'netlinking-refund:' || o.id::text THEN ABS(t.amount_cents) END), 0)::int AS refunded
    FROM public.netlinking_orders o
    LEFT JOIN public.dev_wallet_transactions t
      ON t.source_ref IN ('netlinking:' || o.id::text, 'netlinking-refund:' || o.id::text)
    GROUP BY o.id
  )
  SELECT
    o.id,
    o.user_id,
    o.provider_slug,
    o.publisher_domain,
    o.status,
    o.total_ht_cents,
    tx.debited,
    tx.refunded,
    (tx.debited - tx.refunded)::int AS net_cents,
    CASE
      WHEN o.status IN ('refunded', 'cancelled') THEN (tx.debited - tx.refunded)::int
      ELSE (tx.debited - tx.refunded - o.total_ht_cents)::int
    END AS discrepancy_cents,
    ROUND(EXTRACT(EPOCH FROM (now() - o.created_at)) / 3600.0, 1) AS age_hours,
    CASE
      WHEN o.status = 'draft' AND o.created_at < now() - interval '1 hour' THEN 'stale_draft'
      WHEN o.status IN ('pending', 'in_progress') AND o.created_at < now() - interval '7 days' THEN 'stuck_order'
      WHEN o.status IN ('refunded', 'cancelled') AND tx.debited > tx.refunded THEN 'missing_refund'
      WHEN o.status NOT IN ('refunded', 'cancelled') AND tx.debited - tx.refunded <> o.total_ht_cents THEN 'wallet_mismatch'
      ELSE 'ok'
    END AS flag
  FROM public.netlinking_orders o
  JOIN tx ON tx.order_id = o.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.netlinking_reconciliation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.netlinking_reconciliation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.netlinking_reconciliation() TO service_role;