-- Wallet développeurs (crédits pay-as-you-go Crawlers API)
create table public.dev_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents integer not null default 0,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (balance_cents >= 0)
);

create table public.dev_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('credit','debit','refund','adjustment')),
  amount_cents integer not null,
  balance_after_cents integer not null,
  source text not null check (source in ('paddle','job','admin','signup_bonus')),
  source_ref text,
  description text,
  created_at timestamptz not null default now()
);

create index idx_dev_wallet_tx_user on public.dev_wallet_transactions(user_id, created_at desc);
create unique index idx_dev_wallet_tx_paddle_idem on public.dev_wallet_transactions(source, source_ref) where source = 'paddle';

alter table public.dev_wallets enable row level security;
alter table public.dev_wallet_transactions enable row level security;

create policy "users read own wallet" on public.dev_wallets
  for select using (auth.uid() = user_id);
create policy "users read own tx" on public.dev_wallet_transactions
  for select using (auth.uid() = user_id);

-- RPC crédit (idempotent par source_ref Paddle)
create or replace function public.dev_wallet_credit(
  _user_id uuid,
  _amount_cents integer,
  _source text,
  _source_ref text,
  _description text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if _amount_cents <= 0 then raise exception 'amount must be positive'; end if;

  -- Idempotence Paddle
  if _source = 'paddle' and exists (
    select 1 from public.dev_wallet_transactions
    where source = 'paddle' and source_ref = _source_ref
  ) then
    select balance_cents into new_balance from public.dev_wallets where user_id = _user_id;
    return coalesce(new_balance, 0);
  end if;

  insert into public.dev_wallets (user_id, balance_cents)
  values (_user_id, _amount_cents)
  on conflict (user_id) do update
    set balance_cents = public.dev_wallets.balance_cents + excluded.balance_cents,
        updated_at = now()
  returning balance_cents into new_balance;

  insert into public.dev_wallet_transactions
    (user_id, type, amount_cents, balance_after_cents, source, source_ref, description)
  values (_user_id, 'credit', _amount_cents, new_balance, _source, _source_ref, _description);

  return new_balance;
end;
$$;

-- RPC débit atomique (renvoie nouveau solde ou raise si insuffisant)
create or replace function public.dev_wallet_debit(
  _user_id uuid,
  _amount_cents integer,
  _source_ref text,
  _description text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if _amount_cents <= 0 then raise exception 'amount must be positive'; end if;

  update public.dev_wallets
    set balance_cents = balance_cents - _amount_cents,
        updated_at = now()
    where user_id = _user_id and balance_cents >= _amount_cents
    returning balance_cents into new_balance;

  if new_balance is null then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  insert into public.dev_wallet_transactions
    (user_id, type, amount_cents, balance_after_cents, source, source_ref, description)
  values (_user_id, 'debit', _amount_cents, new_balance, 'job', _source_ref, _description);

  return new_balance;
end;
$$;

revoke all on function public.dev_wallet_credit(uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.dev_wallet_debit(uuid, integer, text, text) from public, anon, authenticated;