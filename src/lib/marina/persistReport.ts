import { supabase } from '@/integrations/supabase/client';

/**
 * Archive un rapport Marina terminé dans `saved_reports` pour l'utilisateur
 * connecté, afin qu'il apparaisse dans /app/console?tab=marina.
 * Idempotent : on ne réécrit pas si le job est déjà enregistré.
 */
export async function persistMarinaReport(
  userId: string,
  jobId: string,
  url: string,
  reportData: any,
  language = 'fr',
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('saved_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('report_type', 'marina' as any)
      .contains('report_data', { job_id: jobId } as any)
      .limit(1);
    if (existing && existing.length > 0) return;

    let domain = url;
    try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); } catch { /* noop */ }

    const dateLabel = new Date().toLocaleDateString(
      language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR',
    );

    await supabase.from('saved_reports').insert({
      user_id: userId,
      report_type: 'marina' as any,
      title: `Rapport Marina — ${domain} (${dateLabel})`,
      url,
      report_data: {
        job_id: jobId,
        report_url: reportData?.report_url ?? null,
        report_view_url: reportData?.report_view_url ?? null,
        report_path: reportData?.report_path ?? null,
        scan_mode: reportData?.scan_mode ?? null,
        pages_crawled: reportData?.pages_crawled ?? null,
      } as any,
    });
  } catch (e) {
    console.error('[Marina] persistMarinaReport error:', e);
  }
}
