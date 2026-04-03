-- Add per-site team sharing flag
ALTER TABLE public.tracked_sites
ADD COLUMN shared_with_team BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient lookups
CREATE INDEX idx_tracked_sites_shared_team 
ON public.tracked_sites (user_id, shared_with_team) 
WHERE shared_with_team = true;

-- Helper function: get all accessible site IDs for a user (own + shared by owner)
CREATE OR REPLACE FUNCTION public.get_team_accessible_sites(p_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_result uuid[];
BEGIN
  -- Always include user's own sites
  SELECT array_agg(id) INTO v_result
  FROM tracked_sites WHERE user_id = p_user_id;

  -- Check if user is a team member
  SELECT owner_user_id INTO v_owner_id
  FROM agency_team_members
  WHERE member_user_id = p_user_id
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    -- Add owner's shared sites
    v_result := v_result || (
      SELECT COALESCE(array_agg(id), '{}')
      FROM tracked_sites
      WHERE user_id = v_owner_id AND shared_with_team = true
    );
  END IF;

  -- If user is an owner, also add shared sites from their own account (already included above)
  -- But also check if they want to see collaborator sites that are shared
  -- (collaborators sharing back to owner - bidirectional)

  RETURN COALESCE(v_result, '{}');
END;
$$;