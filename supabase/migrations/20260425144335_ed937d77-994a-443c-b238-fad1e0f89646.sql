
-- P2 #12 — Catégorisation des actions copilot pour analytics + UI
ALTER TABLE public.copilot_actions
  ADD COLUMN IF NOT EXISTS action_category text;

-- Backfill des actions existantes selon le préfixe du skill
UPDATE public.copilot_actions
SET action_category = CASE
  WHEN skill LIKE '\_%' ESCAPE '\' THEN 'system'
  WHEN skill LIKE 'read\_%' ESCAPE '\' THEN 'read'
  WHEN skill IN ('navigate_to', 'open_audit_panel') THEN 'navigate'
  WHEN skill IN ('cms_publish_draft', 'cms_patch_content', 'deploy_cocoon_plan') THEN 'write'
  WHEN skill IN ('delete_site', 'delete_user', 'rotate_keys', 'mass_delete') THEN 'destructive'
  WHEN skill = 'trigger_audit' THEN 'write'
  ELSE 'other'
END
WHERE action_category IS NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_actions_category
  ON public.copilot_actions(action_category, created_at DESC)
  WHERE action_category IS NOT NULL;
