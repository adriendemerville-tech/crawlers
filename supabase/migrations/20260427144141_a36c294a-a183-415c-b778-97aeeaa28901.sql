-- Étendre le CHECK constraint sur iktracker_slug_memory pour accepter 'trashed'
ALTER TABLE public.iktracker_slug_memory
  DROP CONSTRAINT IF EXISTS iktracker_slug_memory_status_check;

ALTER TABLE public.iktracker_slug_memory
  ADD CONSTRAINT iktracker_slug_memory_status_check
  CHECK (status IN ('published','blacklisted','skipped','duplicate','error','trashed'));

COMMENT ON COLUMN public.iktracker_slug_memory.status IS
  'published | blacklisted (admin reject) | skipped (cooldown 7d) | duplicate (editorial guard) | error (5xx) | trashed (409 slug_in_trash, soft-delete IKtracker — restauration admin uniquement)';