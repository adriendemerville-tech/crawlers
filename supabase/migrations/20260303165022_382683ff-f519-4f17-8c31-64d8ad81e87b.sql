
-- Team members table for Pro Agency accounts (max 3 per owner)
CREATE TABLE public.agency_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, member_user_id)
);

ALTER TABLE public.agency_team_members ENABLE ROW LEVEL SECURITY;

-- Owners can manage their team
CREATE POLICY "Owners can manage their team"
  ON public.agency_team_members FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Members can view their membership
CREATE POLICY "Members can view their membership"
  ON public.agency_team_members FOR SELECT
  USING (auth.uid() = member_user_id);

-- Invitation links table
CREATE TABLE public.agency_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  email text,
  role text NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (token)
);

ALTER TABLE public.agency_invitations ENABLE ROW LEVEL SECURITY;

-- Owners can manage their invitations
CREATE POLICY "Owners can manage invitations"
  ON public.agency_invitations FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Anyone authenticated can view invitation by token (for accepting)
CREATE POLICY "Authenticated users can view invitations by token"
  ON public.agency_invitations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Enable realtime for team members
ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_team_members;
