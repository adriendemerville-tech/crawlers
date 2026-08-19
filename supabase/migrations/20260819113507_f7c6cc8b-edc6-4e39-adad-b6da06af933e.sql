alter table public.marina_paid_passes
  add column if not exists stripe_session_id text,
  add column if not exists granted_at timestamptz;
create index if not exists idx_marina_passes_stripe_session on public.marina_paid_passes(stripe_session_id);