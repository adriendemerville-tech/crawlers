import { supabase } from '@/integrations/supabase/client';

export interface ActionPlanTask {
  id: string;
  title: string;
  priority: 'critical' | 'important' | 'optional';
  category: string;
  isCompleted: boolean;
  description?: string;
}

/**
 * Auto-save audit recommendations directly into architect_workbench.
 * Skips tasks whose title already exists for the same domain + user.
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

    // Fetch existing titles to avoid duplicates
    const { data: existing } = await supabase
      .from('architect_workbench')
      .select('title')
      .eq('user_id', userId)
      .eq('domain', domain)
      .eq('source_type', 'audit')
      .limit(500);

    const existingTitles = new Set((existing || []).map((e: any) => e.title));
    const newTasks = tasks.filter(t => !existingTitles.has(t.title));
    if (newTasks.length === 0) return true;

    const severityMap: Record<string, string> = {
      critical: 'critical',
      important: 'high',
      optional: 'medium',
    };

    const rows = newTasks.map(t => ({
      user_id: userId,
      domain,
      title: t.title,
      description: t.description || null,
      severity: severityMap[t.priority] || 'medium',
      finding_category: t.category || 'seo',
      source_type: 'audit' as const,
      source_function: auditType === 'technical' ? 'expert-audit' : 'strategic-audit',
      target_url: url.startsWith('http') ? url : `https://${url}`,
      status: t.isCompleted ? ('done' as const) : ('pending' as const),
    }));

    const { error } = await supabase.from('architect_workbench').insert(rows);
    if (error) {
      console.error('[autoSaveActionPlan] Insert error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[autoSaveActionPlan] Error:', err);
    return false;
  }
}
