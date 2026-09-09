-- 1. Remboursement MCP — juge unique symétrique de mcp_authorize_call
alter table public.mcp_call_log
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text;

create or replace function public.mcp_refund_call(
  _user_id uuid,
  _idempotency_key text,
  _reason text default 'job_failed'
)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  c record;
  new_micro bigint;
begin
  if _user_id is null or _idempotency_key is null then
    return jsonb_build_object('refunded', false, 'reason', 'invalid_args');
  end if;

  select * into c from public.mcp_call_log
    where user_id = _user_id and idempotency_key = _idempotency_key
    for update;
  if not found then
    return jsonb_build_object('refunded', false, 'reason', 'call_not_found');
  end if;
  if c.refunded_at is not null then
    return jsonb_build_object('refunded', true, 'reason', 'already_refunded', 'cost_micro', c.cost_micro);
  end if;

  update public.mcp_call_log
    set refunded_at = now(), refund_reason = _reason
    where id = c.id;

  if coalesce(c.cost_micro, 0) = 0 then
    return jsonb_build_object('refunded', true, 'cost_micro', 0, 'billed_source', c.billed_source);
  end if;

  update public.mcp_daily_usage
    set spent_micro = greatest(0, spent_micro - c.cost_micro)
    where user_id = _user_id and day = c.created_at::date;

  if c.billed_source = 'wallet' then
    update public.dev_wallets
      set balance_micro = balance_micro + c.cost_micro, updated_at = now()
      where user_id = _user_id
      returning balance_micro into new_micro;

    if new_micro is null then
      insert into public.dev_wallets (user_id, balance_micro)
      values (_user_id, c.cost_micro)
      returning balance_micro into new_micro;
    end if;

    insert into public.dev_wallet_transactions
      (user_id, type, amount_cents, balance_after_cents, amount_micro, balance_after_micro, unit, source, source_ref, description)
    values (_user_id, 'credit', 0, (new_micro/10)::int, c.cost_micro, new_micro, 'micro', 'mcp_refund',
            _idempotency_key, 'Remboursement MCP ' || c.tool_name || ' (' || coalesce(_reason,'job_failed') || ')');
  end if;

  return jsonb_build_object('refunded', true, 'cost_micro', c.cost_micro, 'billed_source', c.billed_source);
end;
$$;

grant execute on function public.mcp_refund_call(uuid, text, text) to service_role;

-- 2. Plafond journalier atomique + les appels remboursés ne consomment plus le quota de plan
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
    cap := coalesce(
      (select daily_cap_micro from public.mcp_user_limits where user_id = _user_id),
      (select default_daily_cap_micro from public.mcp_billing_settings where id)
    );

    insert into public.mcp_daily_usage (user_id, day, spent_micro, calls)
    values (_user_id, current_date, 0, 0)
    on conflict (user_id, day) do nothing;

    select spent_micro into spent from public.mcp_daily_usage
      where user_id = _user_id and day = current_date
      for update;
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
          and refunded_at is null
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

-- 3. Remboursements et paiements échoués du passe 59 €
alter table public.passe_orders
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_amount_cents integer,
  add column if not exists refund_reason text,
  add column if not exists payment_failed_at timestamptz;

alter table public.passe_passes
  add column if not exists revoked_at timestamptz,
  add column if not exists revoke_reason text;

alter table public.passe_orders drop constraint if exists passe_orders_site_deploy_status_check;
alter table public.passe_orders add constraint passe_orders_site_deploy_status_check
  check (site_deploy_status is null or site_deploy_status in ('pending','skipped','deployed','failed'));
alter table public.passe_orders drop constraint if exists passe_orders_gmb_deploy_status_check;
alter table public.passe_orders add constraint passe_orders_gmb_deploy_status_check
  check (gmb_deploy_status is null or gmb_deploy_status in ('pending','skipped','deployed','failed'));

create index if not exists idx_passe_orders_refunded on public.passe_orders (refunded_at)
  where refunded_at is not null;

-- 4. Reprise après pause automatique Périclès
alter table public.autopilot_configs
  add column if not exists resumed_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_reason text;

-- La santé de récompense ne regarde que les décisions mesurées après la dernière reprise
create or replace function public.pericles_reward_health(p_domain text, p_since timestamptz)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with last_measured as (
    select reward_signal
    from pericles_decision_log
    where domain = p_domain
      and measured_at is not null
      and reward_signal is not null
      and (p_since is null or measured_at >= p_since)
    order by measured_at desc
    limit 10
  )
  select jsonb_build_object(
    'measured', coalesce(count(*), 0),
    'avg_reward', coalesce(round(avg(reward_signal)::numeric, 2), 0),
    'negative_share', case when count(*) = 0 then 0
      else round((count(*) filter (where reward_signal < 0))::numeric * 100 / count(*), 1) end
  )
  from last_measured;
$$;

grant execute on function public.pericles_reward_health(text, timestamptz) to authenticated, service_role;

create or replace function public.pericles_resume_config(_config_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c record;
begin
  select id, user_id into c from public.autopilot_configs where id = _config_id;
  if not found then
    return jsonb_build_object('resumed', false, 'reason', 'not_found');
  end if;
  if c.user_id <> auth.uid() and not public.has_role(auth.uid(), 'admin') then
    return jsonb_build_object('resumed', false, 'reason', 'forbidden');
  end if;

  update public.autopilot_configs
    set is_active = true,
        status = 'running',
        resumed_at = now(),
        paused_at = null,
        paused_reason = null,
        updated_at = now()
    where id = _config_id;

  return jsonb_build_object('resumed', true);
end;
$$;

grant execute on function public.pericles_resume_config(uuid) to authenticated, service_role;