/**
 * parmenion/prescriptionWorkbench.ts — Traçabilité des prescriptions Parménion
 * dans `architect_workbench` (audit 2026-08-11, finding P0-3).
 *
 * Objectif : chaque plan prescrit par `cocoon-strategist` via Parménion laisse
 * une trace identifiable (`source_function = 'parmenion-orchestrator'`) afin de
 * mesurer « ce que l'Autopilot a prescrit » et de dédupliquer avec les findings
 * d'audit manuel.
 *
 * Ne lève jamais : la prescription ne doit pas échouer si le workbench refuse.
 */

export interface PrescriptionTaskLike {
  id?: string;
  action_type?: string;
  title?: string;
  urgency?: string;
  estimated_impact?: string;
  priority_score?: number;
  priority?: number;
  executor_function?: string;
  execution_mode?: string;
  affected_urls?: string[];
  target_keyword?: string;
  keywords?: string[];
  is_destructive?: boolean;
}

export interface PrescriptionWriteOptions {
  domain: string;
  trackedSiteId: string;
  userId?: string | null;
  cycleNumber?: number;
  strategyPlanId?: string | null;
  spiralPhase?: string | null;
}

function mapSeverity(urgency?: string, impact?: string): string {
  const u = (urgency || '').toLowerCase();
  if (u === 'critical' || u === 'urgent') return 'critical';
  if (u === 'high') return 'high';
  if (u === 'medium') return 'medium';
  if ((impact || '').toLowerCase() === 'high') return 'high';
  return 'low';
}

function shortHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

/**
 * Écrit (upsert idempotent) les tâches prescrites dans le workbench.
 * Clé d'idempotence : `parmenion_{domain}_c{cycle}_{taskId|hash(title)}`.
 */
export async function writePrescriptionsToWorkbench(
  sb: any,
  tasks: PrescriptionTaskLike[],
  opts: PrescriptionWriteOptions,
): Promise<{ attempted: number; written: number }> {
  try {
    if (!sb || !Array.isArray(tasks) || tasks.length === 0) return { attempted: 0, written: 0 };
    if (!opts.domain || !opts.trackedSiteId) return { attempted: 0, written: 0 };
    // Sans propriétaire réel, la ligne serait invisible aux consommateurs RLS.
    if (!opts.userId || opts.userId === 'service-role') {
      console.warn('[parmenionWorkbench] skipped: no real caller user_id');
      return { attempted: 0, written: 0 };
    }

    const cycle = opts.cycleNumber ?? 0;
    const rows = new Map<string, Record<string, unknown>>();

    for (const t of tasks.slice(0, 8)) {
      const key = t.id || shortHash(`${t.action_type || ''}|${t.title || ''}`);
      const recordId = `parmenion_${opts.domain}_c${cycle}_${key}`.slice(0, 200);
      const urls = Array.isArray(t.affected_urls) ? t.affected_urls.filter(Boolean) : [];

      rows.set(recordId, {
        domain: opts.domain,
        tracked_site_id: opts.trackedSiteId,
        user_id: opts.userId,
        source_type: 'proactive_scan',
        source_function: 'parmenion-orchestrator',
        source_record_id: recordId,
        finding_category: t.action_type || 'autopilot_task',
        severity: mapSeverity(t.urgency, t.estimated_impact),
        title: `Parménion — ${t.title || t.action_type || 'tâche'}`.slice(0, 280),
        description: [
          `Prescription Autopilot (cycle ${cycle}).`,
          t.executor_function ? `Exécuteur : ${t.executor_function}.` : '',
          t.target_keyword ? `Mot-clé cible : ${t.target_keyword}.` : '',
          t.is_destructive ? 'Action destructive (consolidation/pruning).' : '',
        ].filter(Boolean).join(' ').slice(0, 2000),
        target_url: urls[0] || `https://${opts.domain}`,
        status: 'pending',
        payload: {
          parmenion_task_id: t.id ?? null,
          cycle_number: cycle,
          action_type: t.action_type ?? null,
          urgency: t.urgency ?? null,
          estimated_impact: t.estimated_impact ?? null,
          priority: t.priority_score ?? t.priority ?? null,
          executor_function: t.executor_function ?? null,
          execution_mode: t.execution_mode ?? null,
          affected_urls: urls.slice(0, 50),
          keywords: Array.isArray(t.keywords) ? t.keywords.slice(0, 20) : [],
          strategy_plan_id: opts.strategyPlanId ?? null,
          spiral_phase: opts.spiralPhase ?? null,
        },
      });
    }

    let written = 0;
    for (const row of rows.values()) {
      try {
        const { error } = await sb
          .from('architect_workbench')
          .upsert(row, { onConflict: 'source_type,source_record_id' });
        if (!error) written++;
        else console.warn(`[parmenionWorkbench] upsert failed (${row.source_record_id}):`, error.message);
      } catch (e) {
        console.warn('[parmenionWorkbench] upsert exception:', e);
      }
    }

    console.log(`[parmenionWorkbench] wrote ${written}/${rows.size} prescriptions for ${opts.domain}`);
    return { attempted: rows.size, written };
  } catch (e) {
    console.warn('[parmenionWorkbench] fatal guard:', e);
    return { attempted: 0, written: 0 };
  }
}
