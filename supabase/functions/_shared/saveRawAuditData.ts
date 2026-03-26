import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Sauvegarde asynchrone des données brutes d'audit pour recalcul ultérieur.
 * Fire-and-forget — ne doit jamais bloquer le flux principal.
 * Supporte les lead magnets anonymes (userId = null).
 */
export async function saveRawAuditData(params: {
  userId?: string | null;
  url: string;
  domain: string;
  auditType: string;
  rawPayload: Record<string, any>;
  sourceFunctions: string[];
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const insertData: Record<string, any> = {
      url: params.url,
      domain: params.domain,
      audit_type: params.auditType,
      raw_payload: params.rawPayload,
      source_functions: params.sourceFunctions,
    };

    if (params.userId) {
      insertData.user_id = params.userId;
    }

    const { error } = await supabase.from('audit_raw_data').insert(insertData);

    if (error) {
      console.error('[saveRawAuditData] Insert error:', error.message);
    } else {
      console.log(`[saveRawAuditData] ✅ ${params.auditType} raw data saved for ${params.domain}`);
    }
  } catch (e) {
    console.error('[saveRawAuditData] Exception:', e);
  }
}
