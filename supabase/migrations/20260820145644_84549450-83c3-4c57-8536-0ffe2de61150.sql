create table if not exists public.url_indexing_submissions (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  engine text not null default 'indexnow',
  success boolean not null default false,
  status_code integer,
  error text,
  source text not null default 'manual',
  submitted_at timestamptz not null default now()
);

grant select on public.url_indexing_submissions to authenticated;
grant all on public.url_indexing_submissions to service_role;

alter table public.url_indexing_submissions enable row level security;

drop policy if exists "Admins can read indexing submissions" on public.url_indexing_submissions;
create policy "Admins can read indexing submissions"
on public.url_indexing_submissions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create index if not exists idx_url_indexing_recent
  on public.url_indexing_submissions (engine, url, submitted_at desc);