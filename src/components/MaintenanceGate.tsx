import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@/lib/router-compat';
import { useAdmin } from '@/hooks/useAdmin';
import {
  MAINTENANCE_ROUTE,
  getMaintenanceState,
  isMaintenancePath,
  type MaintenanceState,
} from '@/lib/config/maintenance';

/**
 * Redirige les visiteurs vers /maintenance quand le mode est actif pour la
 * page courante. Les administrateurs ne sont jamais redirigés : ils doivent
 * pouvoir vérifier le site pendant l'intervention.
 */
export function MaintenanceGate() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [state, setState] = useState<MaintenanceState | null>(null);

  useEffect(() => {
    let mounted = true;
    getMaintenanceState().then((s) => {
      if (mounted) setState(s);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!state || adminLoading || isAdmin) return;
    if (isMaintenancePath(pathname, state)) {
      navigate(MAINTENANCE_ROUTE, { replace: true });
    }
  }, [state, pathname, isAdmin, adminLoading, navigate]);

  return null;
}
