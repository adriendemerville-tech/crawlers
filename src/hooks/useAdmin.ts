import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [isViewerLevel2, setIsViewerLevel2] = useState(false);
  const [isAuditor, setIsAuditor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsViewer(false);
        setIsViewerLevel2(false);
        setIsAuditor(false);
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
          setIsViewerLevel2(false);
          setIsAuditor(false);
        } else {
          const roles = (data || []).map((r: any) => r.role);
          setIsAdmin(roles.includes('admin'));
          setIsViewer(roles.includes('viewer'));
          setIsViewerLevel2(roles.includes('viewer_level2'));
          setIsAuditor(roles.includes('auditor'));
        }
      } catch (err) {
        console.error('Error checking roles:', err);
        setIsAdmin(false);
        setIsViewer(false);
        setIsViewerLevel2(false);
        setIsAuditor(false);
      } finally {
        setLoading(false);
      }
    };

    checkRoles();
  }, [user]);

  // Hierarchy: admin (créateur) > viewer > auditor > viewer_level2
  const hasAdminAccess = isAdmin || isViewer || isViewerLevel2 || isAuditor;
  const isReadOnly = (isViewer || isViewerLevel2 || isAuditor) && !isAdmin;
  // viewer_level2 & auditor can't see docs; auditor can't see intelligence, finances, users
  const canSeeDocs = isAdmin || isViewer;
  const canSeeAlgos = isAdmin || isViewer;
  const canSeeFinances = isAdmin || isViewer;
  const canSeeUsers = isAdmin || isViewer;
  const canSeeIntelligence = isAdmin || isViewer || isViewerLevel2; // auditor excluded

  return { 
    isAdmin, 
    isViewer, 
    isViewerLevel2, 
    isAuditor,
    hasAdminAccess, 
    isReadOnly, 
    canSeeDocs, 
    canSeeAlgos, 
    canSeeFinances,
    canSeeUsers,
    canSeeIntelligence,
    loading 
  };
}
