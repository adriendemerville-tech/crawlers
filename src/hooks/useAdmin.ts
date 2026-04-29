import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const AUDITOR_DEADLINE_KEY = 'auditor_session_deadline';
const ADMIN_SESSION_KEY = 'admin_session_start';
const AUDITOR_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [isViewerLevel2, setIsViewerLevel2] = useState(false);
  const [isAuditor, setIsAuditor] = useState(false);
  const [auditorExpired, setAuditorExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAuditorSession = useCallback(() => {
    localStorage.removeItem(AUDITOR_DEADLINE_KEY);
    setIsAuditor(false);
    setAuditorExpired(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    toast.error('Session auditeur expirée (2h). Accès révoqué.', { duration: 8000 });
  }, []);

  // Check auditor deadline from cache (works offline)
  const checkAuditorDeadline = useCallback(() => {
    const deadline = localStorage.getItem(AUDITOR_DEADLINE_KEY);
    if (deadline && Date.now() >= parseInt(deadline, 10)) {
      clearAuditorSession();
      return true;
    }
    return false;
  }, [clearAuditorSession]);

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsViewer(false);
        setIsViewerLevel2(false);
        setIsAuditor(false);
        setAuditorExpired(false);
        localStorage.removeItem(AUDITOR_DEADLINE_KEY);
        setLoading(false);
        return;
      }

      // Check cached deadline first (works offline)
      if (checkAuditorDeadline()) {
        // Auditor expired — still fetch other roles
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role, expires_at')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error checking roles:', error);
          setIsAdmin(false);
          setIsViewer(false);
          setIsViewerLevel2(false);
          setIsAuditor(false);
        } else {
          const now = new Date();
          const activeRoles = (data || [])
            .filter((r: any) => !r.expires_at || new Date(r.expires_at) > now)
            .map((r: any) => r.role);

          const adminActive = activeRoles.includes('admin');
          setIsAdmin(adminActive);

          // Admin 12h session tracking
          if (adminActive) {
            const sessionStart = localStorage.getItem(ADMIN_SESSION_KEY);
            if (!sessionStart) {
              localStorage.setItem(ADMIN_SESSION_KEY, Date.now().toString());
            }
          } else {
            localStorage.removeItem(ADMIN_SESSION_KEY);
          }

          setIsViewer(activeRoles.includes('viewer'));
          setIsViewerLevel2(activeRoles.includes('viewer_level2'));

          const serverAuditorActive = activeRoles.includes('auditor');
          
          if (serverAuditorActive && !auditorExpired) {
            setIsAuditor(true);
            // Store deadline in localStorage if not already set
            const existingDeadline = localStorage.getItem(AUDITOR_DEADLINE_KEY);
            if (!existingDeadline) {
              // Find the auditor role's expires_at from server
              const auditorRole = (data || []).find((r: any) => r.role === 'auditor');
              const serverExpiry = auditorRole?.expires_at 
                ? new Date(auditorRole.expires_at).getTime()
                : Date.now() + AUDITOR_TTL_MS;
              localStorage.setItem(AUDITOR_DEADLINE_KEY, serverExpiry.toString());
            }
          } else {
            setIsAuditor(false);
            if (!serverAuditorActive) {
              localStorage.removeItem(AUDITOR_DEADLINE_KEY);
              setAuditorExpired(false);
            }
          }
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

  // Hard timer: check every 10s if auditor deadline passed (works offline)
  useEffect(() => {
    const deadline = localStorage.getItem(AUDITOR_DEADLINE_KEY);
    if (!deadline || auditorExpired) return;

    timerRef.current = setInterval(() => {
      checkAuditorDeadline();
    }, 10_000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAuditor, auditorExpired, checkAuditorDeadline]);

  // Admin auto-logout after 12h
  useEffect(() => {
    if (!isAdmin) return;

    const checkAdminSession = () => {
      const start = localStorage.getItem(ADMIN_SESSION_KEY);
      if (start && Date.now() - parseInt(start, 10) >= ADMIN_TTL_MS) {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        toast.error('Session admin expirée (12h). Déconnexion automatique.', { duration: 8000 });
        supabase.auth.signOut();
      }
    };

    checkAdminSession();
    const interval = setInterval(checkAdminSession, 30_000); // check every 30s
    return () => clearInterval(interval);
  }, [isAdmin]);

  const hasAdminAccess = isAdmin || isViewer || isViewerLevel2 || isAuditor;
  const isReadOnly = (isViewer || isViewerLevel2 || isAuditor) && !isAdmin;
  // viewers (L1 & L2) see finances, users & usage stats in read-only; auditor excluded from finances/users
  const canSeeDocs = isAdmin || isViewer;
  const canSeeAlgos = isAdmin || isViewer;
  const canSeeFinances = isAdmin || isViewer || isViewerLevel2;
  const canSeeUsers = isAdmin || isViewer || isViewerLevel2;
  const canSeeIntelligence = isAdmin || isViewer || isViewerLevel2; // auditor excluded

  return { 
    isAdmin, 
    isViewer, 
    isViewerLevel2, 
    isAuditor,
    auditorExpired,
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
