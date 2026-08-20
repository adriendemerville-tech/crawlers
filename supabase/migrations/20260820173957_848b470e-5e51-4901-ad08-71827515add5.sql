delete from public.architect_workbench
where source_function = 'content-pruning'
  and domain = 'iktracker.fr'
  and status = 'pending';