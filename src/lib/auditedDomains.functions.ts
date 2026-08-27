import { createServerFn } from '@tanstack/react-start';

// Compteur public de noms de domaine audités (preuve sociale).
// La valeur vient d'un agrégat SQL sur les audits réellement enregistrés :
// aucun chiffre n'est arrondi à la hausse ni saisi à la main.
export const getAuditedDomainsCount = createServerFn({ method: 'GET' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('get_audited_domains_count');
  if (error) {
    console.error('[audited-domains] count failed', error.message);
    return { count: null as number | null };
  }
  return { count: typeof data === 'number' ? data : null };
});
