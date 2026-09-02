// Helpers serveur de la Matrice Concurrence.
// Isolés hors de `matrix.functions.ts` : le plugin de découpage des server
// functions supprime tout ce qui vit au module scope de ce fichier, donc les
// helpers doivent être importés depuis un module dédié.

import { getRequestHeader } from '@tanstack/react-start/server';
import { type MatrixJobState } from './types';

export const MATRIX_FREE_QUOTA = 1; // 1 matrice par IP et par jour
export const MATRIX_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function clientIp(): string {
  const fwd = getRequestHeader('x-forwarded-for') || '';
  return (
    fwd.split(',')[0]?.trim() ||
    getRequestHeader('cf-connecting-ip') ||
    getRequestHeader('x-real-ip') ||
    'unknown'
  );
}

export async function hashIp(ip: string): Promise<string> {
  const pepper = (process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'matrice').slice(0, 24);
  const bytes = new TextEncoder().encode(`competitor-matrix:${pepper}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Empreinte de l'appelant courant. */
export async function requesterHash(): Promise<string> {
  return hashIp(clientIp());
}

export function normalizeUrl(raw: string): string | null {
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

/** Vrai si la requête porte un token d'un utilisateur ayant le rôle admin. */
export async function isAdminRequest(): Promise<boolean> {
  try {
    const auth = getRequestHeader('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return false;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return false;
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: data.user.id,
      _role: 'admin',
    });
    return isAdmin === true;
  } catch {
    return false;
  }
}

export function toState(row: Record<string, any>): MatrixJobState {
  return {
    id: row['id'],
    status: row['status'],
    step: row['step'] || 'pending',
    progress: row['progress'] || 0,
    domain: row['domain'],
    targetUrl: row['target_url'],
    identity: row['identity'] ?? null,
    competitors: row['competitors'] ?? [],
    keywords: row['keywords'] ?? [],
    matrix: row['matrix'] ?? null,
    authority: row['authority'] ?? null,
    semantic: row['semantic'] ?? null,
    error: row['error'] ?? null,
    shareToken: row['share_token'],
  };
}
