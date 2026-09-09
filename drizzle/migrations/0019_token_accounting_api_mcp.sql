-- Comptabilité des tokens LLM par job API et par appel MCP.
alter table public.crawlers_api_jobs
  add column if not exists input_tokens integer not null default 0,
  add column if not exists output_tokens integer not null default 0,
  add column if not exists total_tokens integer not null default 0;

alter table public.mcp_call_log
  add column if not exists input_tokens integer not null default 0,
  add column if not exists output_tokens integer not null default 0,
  add column if not exists total_tokens integer not null default 0;

-- Chaque ligne de coût LLM ne peut être rattachée qu'à un seul job : garde anti-double-comptage.
alter table public.ai_gateway_usage
  add column if not exists attributed_job_id uuid;

create index if not exists idx_ai_usage_unattributed
  on public.ai_gateway_usage(edge_function, created_at desc)
  where attributed_job_id is null;

create index if not exists idx_ai_usage_attributed_job
  on public.ai_gateway_usage(attributed_job_id)
  where attributed_job_id is not null;

-- Juge unique du rattachement : réclame les lignes de coût non attribuées produites par
-- l'edge function exécutant le job depuis son démarrage, puis reporte les totaux sur le job
-- et, le cas échéant, sur la ligne mcp_call_log correspondante.
create or replace function public.attribute_ai_tokens(
  _job_id uuid,
  _edge_function text,
  _since timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pt bigint := 0;
  ct bigint := 0;
begin
  if _job_id is null or _edge_function is null or _since is null then
    return jsonb_build_object('input_tokens', 0, 'output_tokens', 0, 'total_tokens', 0);
  end if;

  with claimed as (
    update public.ai_gateway_usage u
       set attributed_job_id = _job_id
     where u.id in (
       select id from public.ai_gateway_usage
        where attributed_job_id is null
          and edge_function = _edge_function
          and created_at >= _since - interval '5 seconds'
        order by created_at
        for update skip locked
     )
    returning u.prompt_tokens, u.completion_tokens
  )
  select coalesce(sum(prompt_tokens), 0), coalesce(sum(completion_tokens), 0)
    into pt, ct
    from claimed;

  update public.crawlers_api_jobs
     set input_tokens = pt,
         output_tokens = ct,
         total_tokens = pt + ct
   where id = _job_id;

  update public.mcp_call_log
     set input_tokens = pt,
         output_tokens = ct,
         total_tokens = pt + ct
   where (metadata ->> 'job_id') = _job_id::text;

  return jsonb_build_object('input_tokens', pt, 'output_tokens', ct, 'total_tokens', pt + ct);
end;
$$;

grant execute on function public.attribute_ai_tokens(uuid, text, timestamptz) to service_role;
