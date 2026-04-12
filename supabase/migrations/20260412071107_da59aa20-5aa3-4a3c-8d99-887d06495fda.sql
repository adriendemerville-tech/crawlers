-- Recycle stuck in_progress items that were never deployed (deployed_at IS NULL)
-- and have been stuck for more than 48 hours
UPDATE architect_workbench
SET 
  status = 'pending',
  consumed_by_code = false,
  consumed_by_content = false,
  consumed_at = NULL,
  updated_at = now()
WHERE status = 'in_progress'
  AND deployed_at IS NULL
  AND updated_at < now() - interval '48 hours';