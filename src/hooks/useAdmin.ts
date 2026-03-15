import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsViewer(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error checking roles:', error);
          setIsAdmin(false);
          setIsViewer(false);
        } else {
          const roles = (data || []).map((r: any) => r.role);
          setIsAdmin(roles.includes('admin'));
          setIsViewer(roles.includes('viewer'));
        }
      } catch (err) {
        console.error('Error checking roles:', err);
        setIsAdmin(false);
        setIsViewer(false);
      } finally {
        setLoading(false);
      }
    };

    checkRoles();
  }, [user]);

  // A viewer can see the admin dashboard but in read-only mode
  const hasAdminAccess = isAdmin || isViewer;
  const isReadOnly = isViewer && !isAdmin;

  return { isAdmin, isViewer, hasAdminAccess, isReadOnly, loading };
}
