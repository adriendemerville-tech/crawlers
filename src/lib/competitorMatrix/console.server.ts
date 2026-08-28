// Helpers serveur du module Concurrence de la console.
// Les lectures passent toutes par le service role, filtrées sur user_id :
// la table competitor_matrix_jobs n'est pas exposée à la Data API.
import type { MatrixJobState } from './types';

export function toMatrixState(row: any): MatrixJobState {
  return {
    id: row.id,
    status: row.status,
    step: row.step || 'pending',
    progress: row.progress || 0,
    domain: row.domain,
    targetUrl: row.target_url,
    identity: row.identity ?? null,
    competitors: row.competitors ?? [],
    keywords: row.keywords ?? [],
    matrix: row.matrix ?? null,
    authority: row.authority ?? null,
    error: row.error ?? null,
    shareToken: row.share_token,
  };
}

export function normalizeTargetUrl(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export interface ConsoleMatrixRow {
  id: string;
  targetUrl: string;
  domain: string;
  status: string;
  step: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  hasMatrix: boolean;
  competitorCount: number;
  error: string | null;
}

export function toConsoleRow(row: any): ConsoleMatrixRow {
  return {
    id: row.id,
    targetUrl: row.target_url,
    domain: row.domain,
    status: row.status,
    step: row.step || 'pending',
    progress: row.progress ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasMatrix: !!row.matrix,
    competitorCount: Array.isArray(row.competitors) ? row.competitors.length : 0,
    error: row.error ?? null,
  };
}
