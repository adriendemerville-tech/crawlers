import { supabase } from '@/integrations/supabase/client';

export interface ActionPlanTask {
  id: string;
  title: string;
  priority: 'critical' | 'important' | 'optional';
  category: string;
  isCompleted: boolean;
}

/**
 * Auto-save (upsert) an action plan for a given user/url/auditType.
 * If a plan already exists for the same url + audit_type, merges new tasks (avoiding duplicates by title).
 */
export async function autoSaveActionPlan({
  userId,
  url,
  title,
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
    // Check if a plan already exists for this url + audit_type
    const { data: existing } = await supabase
      .from('action_plans')
      .select('id, tasks')
      .eq('user_id', userId)
      .eq('url', url)
      .eq('audit_type', auditType)
      .maybeSingle();

    if (existing) {
      // Merge: add only tasks with new titles
      const existingTasks = (existing.tasks as unknown as ActionPlanTask[]) || [];
      const existingTitles = new Set(existingTasks.map(t => t.title));
      const newTasks = tasks.filter(t => !existingTitles.has(t.title));
      
      if (newTasks.length === 0) return true; // Nothing new to add

      const merged = [...existingTasks, ...newTasks];
      await supabase
        .from('action_plans')
        .update({ tasks: JSON.parse(JSON.stringify(merged)), updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('action_plans').insert({
        user_id: userId,
        url,
        title,
        audit_type: auditType,
        tasks: JSON.parse(JSON.stringify(tasks)),
      });
    }

    return true;
  } catch (err) {
    console.error('[autoSaveActionPlan] Error:', err);
    return false;
  }
}
