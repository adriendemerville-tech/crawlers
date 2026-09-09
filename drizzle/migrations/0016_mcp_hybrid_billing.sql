-- 1. Micro-crédits (1 000 micro = 1 €, soit 0,001 €)
alter table public.dev_wallets add column if not exists balance_micro bigint not null default 0;
update public.dev_wallets set balance_micro = balance_cents::bigint * 10 where balance_micro = 0 and balance_cents <> 0;

alter table public.dev_wallet_transactions
  add column if not exists amount_micro bigint,
  add column if not exists balance_after_micro bigint,
  add column if not exists unit text not null default 'cents';
update public.dev_wallet_transactions
  set amount_micro = coalesce(amount_micro, amount_cents::bigint * 10),
      balance_after_micro = coalesce(balance_after_micro, balance_after_cents::bigint * 10);

-- balance_cents devient une projection de balance_micro (compat SDK / BillingTab / Paddle)
create or replace function public.dev_wallets_sync_cents()
returns trigger language plpgsql as $$
begin
  new.balance_cents := (new.balance_micro / 10)::int;
  return new;
end;
$$;

drop trigger if exists trg_dev_wallets_sync_cents on public.dev_wallets;
create trigger trg_dev_wallets_sync_cents
  before insert or update of balance_micro on public.dev_wallets
  for each row execute function public.dev_wallets_sync_cents();

-- 2. RPC legacy réécrites sur les micro-crédits (signatures inchangées)
create or replace function public.dev_wallet_credit(_user_id uuid, _amount_cents integer, _source text, _source_ref text, _description text default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare new_micro bigint;
begin
  if _amount_cents <= 0 then raise exception 'amount must be positive'; end if;

  if _source = 'paddle' and exists (
    select 1 from public.dev_wallet_transactions
    where source = 'paddle' and source_ref = _source_ref
  ) then
    select balance_cents into new_micro from public.dev_wallets where user_id = _user_id;
    return coalesce(new_micro, 0)::int;
  end if;

  insert into public.dev_wallets (user_id, balance_micro)
  values (_user_id, _amount_cents::bigint * 10)
  on conflict (user_id) do update
    set balance_micro = public.dev_wallets.balance_micro + excluded.balance_micro,
        updated_at = now()
  returning balance_micro into new_micro;

  insert into public.dev_wallet_transactions
    (user_id, type, amount_cents, balance_after_cents, amount_micro, balance_after_micro, unit, source, source_ref, description)
  values (_user_id, 'credit', _amount_cents, (new_micro/10)::int, _amount_cents::bigint*10, new_micro, 'cents', _source, _source_ref, _description);

  return (new_micro / 10)::int;
end;
$$;

create or replace function public.dev_wallet_debit(_user_id uuid, _amount_cents integer, _source_ref text, _description text default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare new_micro bigint;
begin
  if _amount_cents <= 0 then raise exception 'amount must be positive'; end if;

  update public.dev_wallets
    set balance_micro = balance_micro - (_amount_cents::bigint * 10),
        updated_at = now()
    where user_id = _user_id and balance_micro >= (_amount_cents::bigint * 10)
    returning balance_micro into new_micro;

  if new_micro is null then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  insert into public.dev_wallet_transactions
    (user_id, type, amount_cents, balance_after_cents, amount_micro, balance_after_micro, unit, source, source_ref, description)
  values (_user_id, 'debit', _amount_cents, (new_micro/10)::int, _amount_cents::bigint*10, new_micro, 'cents', 'job', _source_ref, _description);

  return (new_micro / 10)::int;
end;
$$;

-- 3. Grille tarifaire des outils MCP
create table if not exists public.mcp_tool_pricing (
  tool_name text primary key,
  class text not null check (class in ('free','plan_included','overflow','paid_only')),
  cost_micro bigint not null default 0 check (cost_micro >= 0),
  quota_key text,
  min_plan text,
  monthly_included int,
  label text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

grant select on public.mcp_tool_pricing to authenticated, anon;
grant all on public.mcp_tool_pricing to service_role;
alter table public.mcp_tool_pricing enable row level security;
drop policy if exists "Tarifs MCP lisibles par tous" on public.mcp_tool_pricing;
create policy "Tarifs MCP lisibles par tous" on public.mcp_tool_pricing for select using (true);
drop policy if exists "Admins gèrent les tarifs MCP" on public.mcp_tool_pricing;
create policy "Admins gèrent les tarifs MCP" on public.mcp_tool_pricing for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Réglages globaux (plafond journalier par défaut)
create table if not exists public.mcp_billing_settings (
  id boolean primary key default true check (id),
  default_daily_cap_micro bigint not null default 5000, -- 5 € / jour
  updated_at timestamptz not null default now()
);
insert into public.mcp_billing_settings (id) values (true) on conflict (id) do nothing;
grant select on public.mcp_billing_settings to authenticated;
grant all on public.mcp_billing_settings to service_role;
alter table public.mcp_billing_settings enable row level security;
drop policy if exists "Réglages MCP lisibles" on public.mcp_billing_settings;
create policy "Réglages MCP lisibles" on public.mcp_billing_settings for select to authenticated using (true);
drop policy if exists "Admins gèrent les réglages MCP" on public.mcp_billing_settings;
create policy "Admins gèrent les réglages MCP" on public.mcp_billing_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Override de plafond par utilisateur
create table if not exists public.mcp_user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_cap_micro bigint not null check (daily_cap_micro >= 0),
  updated_at timestamptz not null default now()
);
grant select on public.mcp_user_limits to authenticated;
grant all on public.mcp_user_limits to service_role;
alter table public.mcp_user_limits enable row level security;
drop policy if exists "Chacun voit son plafond MCP" on public.mcp_user_limits;
create policy "Chacun voit son plafond MCP" on public.mcp_user_limits for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Admins gèrent les plafonds MCP" on public.mcp_user_limits;
create policy "Admins gèrent les plafonds MCP" on public.mcp_user_limits for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Consommation journalière
create table if not exists public.mcp_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  spent_micro bigint not null default 0,
  calls int not null default 0,
  primary key (user_id, day)
);
grant select on public.mcp_daily_usage to authenticated;
grant all on public.mcp_daily_usage to service_role;
alter table public.mcp_daily_usage enable row level security;
drop policy if exists "Chacun voit sa consommation MCP" on public.mcp_daily_usage;
create policy "Chacun voit sa consommation MCP" on public.mcp_daily_usage for select to authenticated using (auth.uid() = user_id);

-- Journal des appels MCP (idempotent)
create table if not exists public.mcp_call_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  idempotency_key text not null,
  billed_source text not null check (billed_source in ('free','plan','wallet')),
  cost_micro bigint not null default 0,
  client_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists idx_mcp_call_log_user_created on public.mcp_call_log(user_id, created_at desc);
create index if not exists idx_mcp_call_log_user_tool_month on public.mcp_call_log(user_id, tool_name, created_at desc);
grant select on public.mcp_call_log to authenticated;
grant all on public.mcp_call_log to service_role;
alter table public.mcp_call_log enable row level security;
drop policy if exists "Chacun voit ses appels MCP" on public.mcp_call_log;
create policy "Chacun voit ses appels MCP" on public.mcp_call_log for select to authenticated using (auth.uid() = user_id);

-- 4. Juge unique de facturation
create or replace function public.mcp_plan_rank(_plan text)
returns int language sql immutable as $$
  select case coalesce(_plan,'free')
    when 'agency_premium' then 40
    when 'agency_pro' then 30
    when 'pro' then 20
    when 'starter' then 10
    else 0 end;
$$;

create or replace function public.mcp_authorize_call(
  _user_id uuid,
  _tool_name text,
  _idempotency_key text,
  _client_id text default null,
  _metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  p record;
  existing record;
  cap bigint;
  spent bigint;
  used_month int;
  user_plan text;
  src text;
  cost bigint;
  new_micro bigint;
begin
  if _user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  -- Idempotence : un retry d'agent ne facture jamais deux fois
  select * into existing from public.mcp_call_log
    where user_id = _user_id and idempotency_key = _idempotency_key;
  if found then
    return jsonb_build_object('allowed', true, 'reason', 'replayed',
      'billed_source', existing.billed_source, 'cost_micro', existing.cost_micro);
  end if;

  select * into p from public.mcp_tool_pricing where tool_name = _tool_name;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'unknown_tool');
  end if;
  if not p.enabled then
    return jsonb_build_object('allowed', false, 'reason', 'tool_disabled');
  end if;

  cost := p.cost_micro;
  src := 'free';

  if p.class <> 'free' and cost > 0 then
    -- Plafond journalier anti-boucle
    cap := coalesce(
      (select daily_cap_micro from public.mcp_user_limits where user_id = _user_id),
      (select default_daily_cap_micro from public.mcp_billing_settings where id)
    );
    select coalesce(spent_micro, 0) into spent from public.mcp_daily_usage
      where user_id = _user_id and day = current_date;
    spent := coalesce(spent, 0);
    if spent + cost > cap then
      return jsonb_build_object('allowed', false, 'reason', 'daily_cap_reached',
        'daily_cap_micro', cap, 'spent_micro', spent);
    end if;

    select plan_type into user_plan from public.profiles where user_id = _user_id;

    if p.class in ('plan_included','overflow')
       and public.mcp_plan_rank(user_plan) >= public.mcp_plan_rank(p.min_plan) then
      select count(*) into used_month from public.mcp_call_log
        where user_id = _user_id and tool_name = _tool_name
          and billed_source = 'plan'
          and created_at >= date_trunc('month', now());
      if p.monthly_included is null or used_month < p.monthly_included then
        src := 'plan';
        cost := 0;
      end if;
    end if;

    if src = 'free' then
      if p.class = 'plan_included' then
        return jsonb_build_object('allowed', false, 'reason', 'plan_quota_exhausted');
      end if;
      -- Débit wallet atomique en micro-crédits
      update public.dev_wallets
        set balance_micro = balance_micro - cost, updated_at = now()
        where user_id = _user_id and balance_micro >= cost
        returning balance_micro into new_micro;
      if new_micro is null then
        insert into public.dev_wallets (user_id, balance_micro) values (_user_id, 0)
          on conflict (user_id) do nothing;
        return jsonb_build_object('allowed', false, 'reason', 'insufficient_balance',
          'cost_micro', cost,
          'topup_url', '/developers/profile?tab=facturation');
      end if;
      src := 'wallet';
      insert into public.dev_wallet_transactions
        (user_id, type, amount_cents, balance_after_cents, amount_micro, balance_after_micro, unit, source, source_ref, description)
      values (_user_id, 'debit', 0, (new_micro/10)::int, cost, new_micro, 'micro', 'mcp', _idempotency_key,
              'MCP ' || _tool_name);
    end if;
  else
    cost := 0;
  end if;

  insert into public.mcp_call_log (user_id, tool_name, idempotency_key, billed_source, cost_micro, client_id, metadata)
  values (_user_id, _tool_name, _idempotency_key, src, cost, _client_id, coalesce(_metadata,'{}'::jsonb));

  insert into public.mcp_daily_usage (user_id, day, spent_micro, calls)
  values (_user_id, current_date, cost, 1)
  on conflict (user_id, day) do update
    set spent_micro = public.mcp_daily_usage.spent_micro + excluded.spent_micro,
        calls = public.mcp_daily_usage.calls + 1;

  return jsonb_build_object('allowed', true, 'billed_source', src, 'cost_micro', cost);
end;
$$;

grant execute on function public.mcp_authorize_call(uuid, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.mcp_plan_rank(text) to authenticated, service_role;

-- 5. Seed de la grille tarifaire
insert into public.mcp_tool_pricing (tool_name, class, cost_micro, quota_key, min_plan, monthly_included, label) values
  ('whoami',                 'free',      0,   null,      null,          null, 'Identité du compte'),
  ('list_my_sites',          'free',      0,   null,      null,          null, 'Lister mes sites'),
  ('get_site_audit',         'free',      0,   null,      null,          null, 'Dernier audit d''un site'),
  ('get_job',                'free',      0,   null,      null,          null, 'Statut d''un job'),
  ('list_tools_pricing',     'free',      0,   null,      null,          null, 'Grille tarifaire MCP'),
  ('get_wallet_balance',     'free',      0,   null,      null,          null, 'Solde du wallet'),
  ('list_findings',          'free',      0,   null,      null,          null, 'Constats d''un audit'),
  ('audit_page',             'overflow',  20,  'audit',   'agency_pro',  200,  'Audit d''une page'),
  ('check_indexability',     'overflow',  10,  'audit',   'agency_pro',  200,  'Contrôle d''indexabilité'),
  ('analyze_schema',         'overflow',  10,  'audit',   'agency_pro',  200,  'Analyse des données structurées'),
  ('analyze_links',          'overflow',  10,  'audit',   'agency_pro',  200,  'Analyse des liens'),
  ('get_fix',                'overflow',  30,  'fix',     'agency_pro',  100,  'Correctif proposé'),
  ('start_site_crawl',       'overflow',  150, 'crawl',   'agency_pro',  20,   'Crawl de site'),
  ('start_geo_audit',        'overflow',  120, 'audit',   'agency_pro',  30,   'Audit GEO'),
  ('start_competitor_matrix','overflow',  200, 'audit',   'agency_premium', 10, 'Matrice de concurrence'),
  ('keyword_research',       'paid_only', 40,  null,      null,          null, 'Recherche de mots-clés'),
  ('serp_ranking',           'paid_only', 40,  null,      null,          null, 'Positions SERP'),
  ('backlink_snapshot',      'paid_only', 60,  null,      null,          null, 'Instantané de backlinks')
on conflict (tool_name) do update set
  class = excluded.class, cost_micro = excluded.cost_micro, quota_key = excluded.quota_key,
  min_plan = excluded.min_plan, monthly_included = excluded.monthly_included,
  label = excluded.label, updated_at = now();