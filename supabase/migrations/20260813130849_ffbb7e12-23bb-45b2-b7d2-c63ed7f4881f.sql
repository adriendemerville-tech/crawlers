
create or replace function public.get_ai_citation_domains(_days int default 90, _limit int default 25)
returns table(domain text, citations bigint, share numeric)
language sql
stable
security definer
set search_path = public
as $$
  with urls as (
    select lower((regexp_matches(response_text, 'https?://([A-Za-z0-9._-]+)', 'g'))[1]) as host
    from public.llm_test_executions
    where created_at > now() - make_interval(days => greatest(_days, 1))
      and response_text is not null
  ), norm as (
    select regexp_replace(host, '^www\.', '') as domain
    from urls
    where host like '%.%'
  ), agg as (
    select domain, count(*)::bigint as citations
    from norm
    group by domain
  )
  select a.domain, a.citations,
         round(100.0 * a.citations / nullif(sum(a.citations) over (), 0), 2) as share
  from agg a
  order by a.citations desc, a.domain
  limit greatest(_limit, 1);
$$;

create or replace function public.get_ai_citation_content_types(_days int default 90)
returns table(content_type text, citations bigint, share numeric)
language sql
stable
security definer
set search_path = public
as $$
  with urls as (
    select lower((regexp_matches(response_text, 'https?://[A-Za-z0-9._-]+(/[^\s)"\]''>]*)?', 'g'))[1]) as path
    from public.llm_test_executions
    where created_at > now() - make_interval(days => greatest(_days, 1))
      and response_text is not null
  ), typed as (
    select case
      when path is null or path in ('', '/') then 'Page d''accueil / marque'
      when path ~ '(comparatif|comparison|vs-|/vs/|alternative|best-|meilleur)' then 'Comparatifs et alternatives'
      when path ~ '(guide|tutorial|tutoriel|how-to|comment-|learn|cours)' then 'Guides et tutoriels'
      when path ~ '(forum|/r/|thread|question|discussion|community|answers)' then 'Forums et communautés'
      when path ~ '(docs?/|/api|reference|documentation|developer)' then 'Documentation technique'
      when path ~ '(news|actualite|actualites|presse|press|202[0-9]/)' then 'Actualités et presse'
      when path ~ '(blog|article|post)' then 'Articles de blog'
      when path ~ '(pricing|tarif|produit|product|service|solution)' then 'Pages produit et tarifs'
      else 'Autres pages'
    end as content_type
    from urls
  ), agg as (
    select content_type, count(*)::bigint as citations
    from typed
    group by content_type
  )
  select a.content_type, a.citations,
         round(100.0 * a.citations / nullif(sum(a.citations) over (), 0), 2) as share
  from agg a
  order by a.citations desc;
$$;

grant execute on function public.get_ai_citation_domains(int, int) to anon, authenticated, service_role;
grant execute on function public.get_ai_citation_content_types(int) to anon, authenticated, service_role;
