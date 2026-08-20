update public.architect_workbench
set status = 'skipped',
    description = coalesce(description, '') ||
      ' — PROTEGEE : position naissante (page 2) / contenu substantiel, depublication annulee (moteur de pruning corrige)'
where id in (
  'c91fbf92-a606-43ff-bd4a-feee3719d88f',
  '132e970e-6353-4bf9-a919-f57f49e15c06'
);