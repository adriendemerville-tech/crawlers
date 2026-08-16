import { createServerFn } from '@tanstack/react-start';

/**
 * Rapport Marina de démonstration — vitrine publique.
 *
 * Périmètre volontairement figé : uniquement le dernier rapport Marina complet
 * du domaine crawlers.fr. Aucune donnée d'un autre client ne peut sortir d'ici,
 * et le HTML est relu à chaque appel (les URLs signées expirent).
 */
const SHOWCASE_DOMAIN = 'crawlers.fr';

export const getMarinaShowcaseReport = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ html: string | null; domain: string; generatedAt: string | null }> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // Toujours le rapport crawlers.fr le plus récent : filtre côté SQL sur le
    // domaine, donc chaque nouvel audit terminé devient automatiquement l'exemple.
    const { data: jobs } = await supabaseAdmin
      .from('async_jobs')
      .select('result_data, created_at, input_payload')
      .eq('function_name', 'marina')
      .in('status', ['completed', 'partial'])
      .ilike('input_payload->>url', `%${SHOWCASE_DOMAIN}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    let job = (jobs || []).find((j: any) => j?.result_data?.report_path) as any;

    // Filet de sécurité : anciens jobs dont l'URL n'est pas dans input_payload.
    if (!job) {
      const { data: legacy } = await supabaseAdmin
        .from('async_jobs')
        .select('result_data, created_at, input_payload')
        .eq('function_name', 'marina')
        .in('status', ['completed', 'partial'])
        .order('created_at', { ascending: false })
        .limit(60);
      job = (legacy || []).find((j: any) => {
        const target = String(j?.input_payload?.url || j?.result_data?.domain || '').toLowerCase();
        return target.includes(SHOWCASE_DOMAIN) && j?.result_data?.report_path;
      }) as any;
    }

    const path = job?.result_data?.report_path as string | undefined;
    if (!path) return { html: null, domain: SHOWCASE_DOMAIN, generatedAt: null };

    const { data: file } = await supabaseAdmin.storage.from('shared-reports').download(path);
    if (!file) return { html: null, domain: SHOWCASE_DOMAIN, generatedAt: null };


    return {
      html: await file.text(),
      domain: SHOWCASE_DOMAIN,
      generatedAt: (job?.result_data?.generated_at as string) || (job?.created_at as string) || null,
    };
  },
);
