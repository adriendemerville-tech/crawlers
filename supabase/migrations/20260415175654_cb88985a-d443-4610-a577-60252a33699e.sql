
-- 1. Create team role enum
CREATE TYPE public.team_role AS ENUM ('owner', 'editor', 'auditor');

-- 2. Add team_role column to agency_team_members
ALTER TABLE public.agency_team_members
  ADD COLUMN team_role public.team_role NOT NULL DEFAULT 'auditor';

-- Update existing rows: set role based on current 'role' text column
UPDATE public.agency_team_members SET team_role = 'editor' WHERE role = 'editor';
UPDATE public.agency_team_members SET team_role = 'owner' WHERE role = 'admin' OR role = 'owner';

-- 3. Security definer function to get a member's team role
CREATE OR REPLACE FUNCTION public.get_team_role(_owner_id uuid, _member_id uuid)
RETURNS public.team_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_role
  FROM public.agency_team_members
  WHERE owner_user_id = _owner_id
    AND member_user_id = _member_id
  LIMIT 1;
$$;

-- 4. Permission matrix table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.team_role NOT NULL,
  permission_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read permissions (they're global config)
CREATE POLICY "Authenticated users can read permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Only admins (has_role) can modify permissions - but for now we seed defaults
-- No INSERT/UPDATE/DELETE policies for regular users

-- 5. Seed default permissions
INSERT INTO public.role_permissions (role, permission_key, enabled) VALUES
  -- Owner: everything
  ('owner', 'audit.run', true),
  ('owner', 'audit.view', true),
  ('owner', 'action_plan.edit', true),
  ('owner', 'content.inject', true),
  ('owner', 'content.edit', true),
  ('owner', 'cocoon.manage', true),
  ('owner', 'cms.publish', true),
  ('owner', 'team.manage_roles', true),
  ('owner', 'crawl.run', true),
  ('owner', 'autopilot.manage', true),
  -- Editor: audit + inject content
  ('editor', 'audit.run', true),
  ('editor', 'audit.view', true),
  ('editor', 'action_plan.edit', true),
  ('editor', 'content.inject', true),
  ('editor', 'content.edit', true),
  ('editor', 'cocoon.manage', true),
  ('editor', 'cms.publish', true),
  ('editor', 'team.manage_roles', false),
  ('editor', 'crawl.run', true),
  ('editor', 'autopilot.manage', false),
  -- Auditor: audit + action plan reorder, NO content injection
  ('auditor', 'audit.run', true),
  ('auditor', 'audit.view', true),
  ('auditor', 'action_plan.edit', true),
  ('auditor', 'content.inject', false),
  ('auditor', 'content.edit', false),
  ('auditor', 'cocoon.manage', false),
  ('auditor', 'cms.publish', false),
  ('auditor', 'team.manage_roles', false),
  ('auditor', 'crawl.run', true),
  ('auditor', 'autopilot.manage', false);

-- 6. Helper function to check permission
CREATE OR REPLACE FUNCTION public.has_team_permission(
  _owner_id uuid,
  _member_id uuid,
  _permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT rp.enabled
      FROM public.agency_team_members atm
      JOIN public.role_permissions rp ON rp.role = atm.team_role AND rp.permission_key = _permission
      WHERE atm.owner_user_id = _owner_id
        AND atm.member_user_id = _member_id
      LIMIT 1
    ),
    -- If user IS the owner, grant everything
    CASE WHEN _owner_id = _member_id THEN true ELSE false END
  );
$$;
