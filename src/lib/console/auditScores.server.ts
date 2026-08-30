import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConsoleAuditScores {
  technicalScore: number | null;
  technicalAt: string | null;
  strategicScore: number | null;
  strategicAt: string | null;
}

/**
 * Lit les notes des derniers audits technique et stratégique pour un domaine.
 * Source unique : audit_raw_data (RLS appliquée via le client du contexte).
 * - technique : raw_payload.totalScore sur 200 → normalisé /100
 * - stratégique : raw_payload.strategic.overallScore (/100)
 */
export async function fetchConsoleAuditScores(
  supabase: SupabaseClient,
  domain: string,
): Promise<ConsoleAuditScores> {
  const clean = domain.trim().toLowerCase();
  if (!clean) return { technicalScore: null, technicalAt: null, strategicScore: null, strategicAt: null };

  const [{ data: tech }, { data: strat }] = await Promise.all([
    supabase
      .from('audit_raw_data')
      .select('raw_payload, created_at')
      .eq('domain', clean)
      .eq('audit_type', 'technical')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('audit_raw_data')
      .select('raw_payload, created_at')
      .eq('domain', clean)
      .in('audit_type', ['strategic', 'marina'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const techTotal = (tech?.raw_payload as any)?.totalScore;
  const stratOverall = (strat?.raw_payload as any)?.strategic?.overallScore;

  return {
    technicalScore: typeof techTotal === 'number' ? Math.round((techTotal / 200) * 100) : null,
    technicalAt: (tech?.created_at as string) ?? null,
    strategicScore: typeof stratOverall === 'number' ? Math.round(stratOverall) : null,
    strategicAt: (strat?.created_at as string) ?? null,
  };
}
