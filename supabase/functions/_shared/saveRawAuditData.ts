import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Sauvegarde asynchrone des données brutes d'audit pour recalcul ultérieur.
 * Fire-and-forget — ne doit jamais bloquer le flux principal.
 */
export async function saveRawAuditData(params: {
  userId: string;
  url: string;
  domain: string;
  auditType: 'technical' | 'strategic' | 'crawl';
  rawPayload: Record<string, any>;
  sourceFunctions: string[];
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from('audit_raw_data').insert({
      user_id: params.userId,
      url: params.url,
      domain: params.domain,
      audit_type: params.auditType,
      raw_payload: params.rawPayload,
      source_functions: params.sourceFunctions,
    });

    if (error) {
      console.error('[saveRawAuditData] Insert error:', error.message);
    } else {
      console.log(`[saveRawAuditData] ✅ ${params.auditType} raw data saved for ${params.domain}`);
    }
  } catch (e) {
    console.error('[saveRawAuditData] Exception:', e);
  }
}
