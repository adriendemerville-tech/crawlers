-- Orchestration serveur des audits Marina multipages.
-- Le lot ne vit plus dans l'onglet du navigateur : il est déclaré en base et
-- avancé par un moteur serveur (cron + lecture UI), le front n'exprime qu'un état.

create table if not exists public.marina_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  lang text not null default 'fr',
  status text not null default 'running',
  concurrency smallint not null default 2,
  item_count smallint not null default 0,
  lock_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marina_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.marina_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  position smallint not null,
  job_id uuid,
  status text not null default 'pending',
  progress smallint not null default 0,
  error text,
  launch_attempts smallint not null default 0,
  launched_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (batch_id, position)
);

create index if not exists idx_marina_batches_active
  on public.marina_batches (status, updated_at) where status = 'running';
create index if not exists idx_marina_batches_user on public.marina_batches (user_id, created_at desc);
create index if not exists idx_marina_batch_items_batch on public.marina_batch_items (batch_id, position);

grant select on public.marina_batches to authenticated;
grant all on public.marina_batches to service_role;
grant select on public.marina_batch_items to authenticated;
grant all on public.marina_batch_items to service_role;

alter table public.marina_batches enable row level security;
alter table public.marina_batch_items enable row level security;

-- Lecture de ses propres lots uniquement ; toute écriture reste au backend.
create policy "own batches readable" on public.marina_batches
  for select to authenticated using (user_id = auth.uid());
create policy "own batch items readable" on public.marina_batch_items
  for select to authenticated using (user_id = auth.uid());