/**
 * useMatriceAudits — Sprint 7
 * CRUD layer for the `matrix_audits` table.
 * - listAudits: paginated history for the current user
 * - getAudit: single audit by id (RLS scoped)
 * - saveAudit: persist a new completed/partial audit
 * - renameAudit / deleteAudit
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';
import type { PivotShape } from '@/utils/matrice/pivotTransform';

export type MatrixAuditStatus = 'completed' | 'partial' | 'failed';
export type MatrixAuditType = 'rapport' | 'expert' | 'eeat' | 'marina' | 'custom';

export interface MatrixAuditRow {
  id: string;
  user_id: string;
  site_id: string | null;
  label: string;
  audit_type: MatrixAuditType;
  status: MatrixAuditStatus;
  global_score: number | null;
  items_count: number;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface MatrixAuditFull extends MatrixAuditRow {
  results: MatrixResult[];
  pivot_snapshot: PivotShape | null;
}

export interface SaveAuditInput {
  label?: string;
  audit_type?: MatrixAuditType;
  status?: MatrixAuditStatus;
  site_id?: string | null;
  global_score?: number | null;
  duration_ms?: number | null;
  results: MatrixResult[];
  pivot_snapshot?: PivotShape | null;
}

export function useMatriceAudits() {
  const { user } = useAuth();

  const listAudits = useCallback(
    async (limit = 50): Promise<MatrixAuditRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('matrix_audits')
        .select('id, user_id, site_id, label, audit_type, status, global_score, items_count, duration_ms, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        console.error('[useMatriceAudits.list]', error);
        return [];
      }
      return (data ?? []) as MatrixAuditRow[];
    },
    [user],
  );

  const getAudit = useCallback(
    async (id: string): Promise<MatrixAuditFull | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('matrix_audits')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) {
        if (error) console.error('[useMatriceAudits.get]', error);
        return null;
      }
      return {
        ...(data as any),
        results: (data.results ?? []) as MatrixResult[],
        pivot_snapshot: (data.pivot_snapshot ?? null) as PivotShape | null,
      };
    },
    [user],
  );

  const saveAudit = useCallback(
    async (input: SaveAuditInput): Promise<string | null> => {
      if (!user) return null;
      const payload = {
        user_id: user.id,
        site_id: input.site_id ?? null,
        label: input.label ?? `Audit du ${new Date().toLocaleDateString('fr-FR')}`,
        audit_type: input.audit_type ?? 'rapport',
        status: input.status ?? 'completed',
        global_score: input.global_score ?? null,
        items_count: input.results.length,
        duration_ms: input.duration_ms ?? null,
        results: input.results as any,
        pivot_snapshot: (input.pivot_snapshot ?? null) as any,
      };
      const { data, error } = await supabase
        .from('matrix_audits')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        console.error('[useMatriceAudits.save]', error);
        return null;
      }
      return data.id;
    },
    [user],
  );

  const renameAudit = useCallback(
    async (id: string, label: string): Promise<boolean> => {
      if (!user || !label.trim()) return false;
      const { error } = await supabase
        .from('matrix_audits')
        .update({ label: label.trim() })
        .eq('id', id);
      if (error) {
        console.error('[useMatriceAudits.rename]', error);
        return false;
      }
      return true;
    },
    [user],
  );

  const deleteAudit = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false;
      const { error } = await supabase
        .from('matrix_audits')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('[useMatriceAudits.delete]', error);
        return false;
      }
      return true;
    },
    [user],
  );

  return { listAudits, getAudit, saveAudit, renameAudit, deleteAudit };
}
