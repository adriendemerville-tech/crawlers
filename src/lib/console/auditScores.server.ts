import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConsoleAuditScorePoint {
  score: number;
  at: string | null;
}

export interface ConsoleAuditScores {
  technical: ConsoleAuditScorePoint[];
  strategic: ConsoleAuditScorePoint[];
}

/**
 * Lit les notes des deux derniers audits technique et stratégique pour un domaine.
 * Source unique : audit_raw_data (RLS appliquée via le client du contexte).
 * - technique : raw_payload.totalScore sur 200 → normalisé /100
 * - stratégique : raw_payload.strategic.overallScore (/100)
 * Chaque tableau est ordonné du plus récent au plus ancien (index 0 = dernier).
 */
export async function fetchConsoleAuditScores(
  supabase: SupabaseClient,
  domain: string,
): Promise<ConsoleAuditScores> {
  const clean = domain.trim().toLowerCase();
  if (!clean) return { technical: [], strategic: [] };

  const [{ data: techRows }, { data: stratRows }] = await Promise.all([
    supabase
      .from('audit_raw_data')
      .select('raw_payload, created_at')
      .eq('domain', clean)
      .eq('audit_type', 'technical')
      .order('created_at', { ascending: false })
      .limit(2),
    supabase
      .from('audit_raw_data')
      .select('raw_payload, created_at')
      .eq('domain', clean)
      .in('audit_type', ['strategic', 'marina'])
      .order('created_at', { ascending: false })
      .limit(2),
  ]);

  const toPoints = (rows: any[] | null, extract: (p: any) => number | null): ConsoleAuditScorePoint[] =>
    (rows ?? [])
      .map((r) => {
        const score = extract(r.raw_payload);
        return score === null ? null : { score, at: (r.created_at as string) ?? null };
      })
      .filter((p): p is ConsoleAuditScorePoint => p !== null);

  return {
    technical: toPoints(techRows, (p) =>
      typeof p?.totalScore === 'number' ? Math.round((p.totalScore / 200) * 100) : null,
    ),
    strategic: toPoints(stratRows, (p) =>
      typeof p?.strategic?.overallScore === 'number' ? Math.round(p.strategic.overallScore) : null,
    ),
  };
}
