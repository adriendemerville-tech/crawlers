import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { edgeFunctionUrl } from '@/utils/supabaseUrl';

const PLUGIN_URL = edgeFunctionUrl('download-plugin');

export type WPAction = 'download' | 'magic_link' | 'sync';

interface WPIntegrationOptions {
  siteId: string;
  domain: string;
  apiKey?: string;
  userId?: string;
  language?: string;
}

/**
 * Centralised handler for WordPress integration actions.
 * - download  → triggers plugin .zip download
 * - magic_link → generates a temp_token and redirects to the WP site
 * - sync → pushes current_config to the WP site via update-config
 */
export async function handleWPIntegration(
  action: WPAction,
  options: WPIntegrationOptions,
): Promise<{ success: boolean; error?: string }> {
  const { siteId, domain, apiKey, userId, language = 'fr' } = options;

  // ─── Download plugin ───
  if (action === 'download') {
    try {
      window.open(PLUGIN_URL, '_blank');
      toast.success(
        language === 'fr'
          ? 'Téléchargement du plugin lancé'
          : language === 'es'
            ? 'Descarga del plugin iniciada'
            : 'Plugin download started',
      );
      return { success: true };
    } catch (e: any) {
      toast.error(e?.message || 'Download failed');
      return { success: false, error: e?.message };
    }
  }

  // ─── Magic Link ───
  if (action === 'magic_link') {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error(language === 'fr' ? 'Session expirée, reconnectez-vous' : 'Session expired');
        return { success: false, error: 'No session' };
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'tutlimtasnjabdfhpewu';
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/wpsync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ site_id: siteId }),
        },
      );

      const data = await res.json();
      if (!res.ok || !data?.token) {
        throw new Error(data?.error || 'Magic link generation failed');
      }

      // Build redirect URL → WP auto-config endpoint
      const wpUrl = `https://${domain}/wp-json/crawlers/v1/connect?temp_token=${data.token}`;
      window.open(wpUrl, '_blank');
      toast.success(
        language === 'fr'
          ? 'Redirection vers votre site WordPress…'
          : 'Redirecting to your WordPress site…',
      );
      return { success: true };
    } catch (e: any) {
      toast.error(e?.message || 'Magic link failed');
      return { success: false, error: e?.message };
    }
  }

  // ─── Sync config ───
  if (action === 'sync') {
    try {
      const { data, error } = await supabase.functions.invoke('update-config', {
        body: { domain, force_sync: true },
      });
      if (error) throw error;
      toast.success(
        language === 'fr'
          ? 'Configuration synchronisée avec WordPress'
          : 'Configuration synced with WordPress',
      );
      return { success: true };
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed');
      return { success: false, error: e?.message };
    }
  }

  return { success: false, error: 'Unknown action' };
}

/**
 * Check if a site has ever been synchronized (has a non-empty current_config).
 */
export function isSiteSynced(currentConfig: Record<string, unknown> | null | undefined): boolean {
  if (!currentConfig) return false;
  return Object.keys(currentConfig).length > 0;
}
