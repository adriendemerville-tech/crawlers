alter table public.link_health_queue
  add column if not exists domain text not null default 'crawlers.fr',
  add column if not exists site_id uuid,
  add column if not exists soft_broken jsonb not null default '[]'::jsonb,
  add column if not exists blocked_links jsonb not null default '[]'::jsonb,
  add column if not exists hard_broken_count integer not null default 0,
  add column if not exists soft_broken_count integer not null default 0,
  add column if not exists blocked_count integer not null default 0,
  add column if not exists consecutive_failures integer not null default 0;

create index if not exists link_health_queue_domain_status_idx
  on public.link_health_queue (domain, status, priority_score desc);

comment on column public.link_health_queue.domain is
  'Domaine audite - la file est la table de verite unique pour crawlers.fr ET les sites suivis.';
comment on column public.link_health_queue.soft_broken is
  'Liens instables (5xx/429/timeout) non encore confirmes par un 2e constat consecutif.';
comment on column public.link_health_queue.blocked_links is
  'Liens non verifiables (401/403/405/999) : protection serveur, jamais un defaut du site.';