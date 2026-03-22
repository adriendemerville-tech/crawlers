import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';

/**
 * Returns whether Content Architect workflow is visible to the current user.
 * When hidden via admin toggle, only admins can still see it.
 * Non-admin users see no trace of Content Architect anywhere.
 */
export function useContentArchitectVisibility() {
  const { isAdmin } = useAdmin();
  const [isHiddenGlobally, setIsHiddenGlobally] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'content_architect_hidden')
          .maybeSingle();
        setIsHiddenGlobally(data?.value === true);
      } catch {
        setIsHiddenGlobally(false);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Visible if: not hidden globally, OR user is admin
  const isContentArchitectVisible = !isHiddenGlobally || isAdmin;

  return { isContentArchitectVisible, isHiddenGlobally, loading };
}
