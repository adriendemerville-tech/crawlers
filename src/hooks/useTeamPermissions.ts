import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TeamRole = 'owner' | 'editor' | 'auditor';

export interface TeamPermissions {
  role: TeamRole;
  permissions: Record<string, boolean>;
  loading: boolean;
  /** Check a specific permission key */
  can: (key: string) => boolean;
  /** Refresh permissions from DB */
  refresh: () => void;
}

/**
 * Returns the current user's team role and permission matrix.
 * If the user is the site owner, they get full access.
 * If they are a team member, their role-based permissions apply.
 */
export function useTeamPermissions(): TeamPermissions {
  const { user } = useAuth();
  const [role, setRole] = useState<TeamRole>('owner');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Check if user is a team member (not owner)
      const { data: membership } = await supabase
        .from('agency_team_members')
        .select('owner_user_id, team_role')
        .eq('member_user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membership && membership.team_role) {
        const detectedRole = membership.team_role as TeamRole;
        setRole(detectedRole);

        // Fetch permission matrix for this role
        const { data: perms } = await supabase
          .from('role_permissions')
          .select('permission_key, enabled')
          .eq('role', detectedRole);

        const permMap: Record<string, boolean> = {};
        for (const p of perms || []) {
          permMap[p.permission_key] = p.enabled;
        }
        setPermissions(permMap);
      } else {
        // User is an owner — full permissions
        setRole('owner');
        const { data: perms } = await supabase
          .from('role_permissions')
          .select('permission_key, enabled')
          .eq('role', 'owner' as any);

        const permMap: Record<string, boolean> = {};
        for (const p of perms || []) {
          permMap[p.permission_key] = true; // Owner always true
        }
        setPermissions(permMap);
      }
    } catch (err) {
      console.error('Failed to fetch team permissions:', err);
      // Fallback: owner with full access
      setRole('owner');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const can = useCallback(
    (key: string) => {
      if (role === 'owner') return true;
      return permissions[key] ?? false;
    },
    [role, permissions]
  );

  return { role, permissions, loading, can, refresh: fetchPermissions };
}
