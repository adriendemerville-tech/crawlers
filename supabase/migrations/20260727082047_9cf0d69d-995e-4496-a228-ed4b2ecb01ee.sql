DROP POLICY IF EXISTS "Team members view owner social accounts" ON public.social_accounts;

CREATE OR REPLACE VIEW public.social_accounts_team_view
WITH (security_invoker = true)
AS
SELECT
  sa.id,
  sa.user_id,
  sa.tracked_site_id,
  sa.platform,
  sa.account_name,
  sa.account_id,
  sa.page_id,
  sa.token_expires_at,
  sa.scopes,
  sa.status,
  sa.metadata,
  sa.created_at,
  sa.updated_at
FROM public.social_accounts sa
WHERE
  sa.user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.agency_team_members atm
    WHERE atm.member_user_id = auth.uid()
      AND atm.owner_user_id = sa.user_id
  );

GRANT SELECT ON public.social_accounts_team_view TO authenticated;