import { supabase } from '@/integrations/supabase/client';

export interface ActionPlanTask {
  id: string;
  title: string;
  priority: 'critical' | 'important' | 'optional';
  category: string;
  isCompleted: boolean;
  description?: string;
}

/** Hash stable (FNV-1a) pour construire un source_record_id déterministe. */
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

/**
 * Propage les recommandations de crawl dans architect_workbench.
 *
 * Idempotent : source_record_id déterministe (id de tâche, sinon hash du titre)
 * + upsert sur (source_type, source_record_id) — l'ancien insert dédupliqué par
 * titre créait un doublon à chaque reformulation de libellé.
 */
export async function autoSaveActionPlan({
  userId,
  url,
  title: _planTitle,
  auditType,
  tasks,
}: {
  userId: string;
  url: string;
  title: string;
  auditType: string;
  tasks: ActionPlanTask[];
}): Promise<boolean> {
  if (!userId || tasks.length === 0) return false;

  try {
    let domain = url;
    try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch {}

    const severityMap: Record<string, string> = {
      critical: 'critical',
      important: 'high',
      optional: 'medium',
    };

    const sourceType = auditType === 'technical' ? 'audit_tech' : 'audit_strategic';
    const sourceFunction = auditType === 'technical' ? 'expert-audit' : 'strategic-audit';

    const seen = new Set<string>();
    const rows = tasks
      .map(t => {
        const key = (t.id || '').trim() || shortHash(t.title || '');
        if (!key || !t.title || seen.has(key)) return null;
        seen.add(key);
        return {
          user_id: userId,
          domain,
          title: t.title,
          description: t.description || null,
          severity: severityMap[t.priority] || 'medium',
          finding_category: t.category || 'seo',
          source_type: sourceType as 'audit_tech' | 'audit_strategic',
          source_function: sourceFunction,
          source_record_id: `client_${auditType}_${domain}_${key}`,
          target_url: url.startsWith('http') ? url : `https://${url}`,
          status: t.isCompleted ? ('done' as const) : ('pending' as const),
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (rows.length === 0) return true;

    const { error } = await supabase
      .from('architect_workbench')
      .upsert(rows as never, { onConflict: 'source_type,source_record_id' });
    if (error) {
      console.error('[autoSaveActionPlan] Upsert error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[autoSaveActionPlan] Error:', err);
    return false;
  }
}

