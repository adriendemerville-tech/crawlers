/**
 * gscSupportAccess.server.ts (L1a.15)
 *
 * Unique chemin d'accès du support aux données GSC brutes d'un actif (§2.9.1).
 * Toute lecture est tracée dans `marketplace_gsc_access_log` avec motif et
 * référence de ticket, et purgée automatiquement après la durée de rétention.
 * Sans trace écrite, aucune donnée n'est renvoyée.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { loadConstants, num } from './constants.server';

const READABLE_FIELDS = [
  'gsc_clicks_90d',
  'gsc_impressions_90d',
  'gsc_avg_position',
  'gsc_window_start',
  'gsc_window_end',
] as const;

export type ReadableGscField = (typeof READABLE_FIELDS)[number];

export interface SupportAccessRequest {
  adminUserId: string;
  assetId: string;
  fields: ReadableGscField[];
  reason: string;
  ticketRef: string;
  ip?: string | null;
}

/**
 * Lecture tracée. Les requêtes détaillées (`gsc_queries`) ne sont jamais
 * exposées, même au support : elles restent inaccessibles hors du propriétaire.
 */
export async function readGscForSupport(req: SupportAccessRequest): Promise<Record<string, unknown>> {
  if (!req.reason?.trim() || !req.ticketRef?.trim()) {
    throw new Error('Motif et référence de ticket obligatoires');
  }

  const fields = req.fields.filter((f): f is ReadableGscField =>
    (READABLE_FIELDS as readonly string[]).includes(f),
  );
  if (fields.length === 0) throw new Error('Aucun champ lisible demandé');

  const { data: asset, error } = await supabaseAdmin
    .from('marketplace_link_assets')
    .select(['id', 'user_id', 'domain', 'url', ...fields].join(', '))
    .eq('id', req.assetId)
    .maybeSingle();

  if (error) throw new Error(`Actif illisible : ${error.message}`);
  if (!asset) throw new Error('Actif introuvable');

  const row = asset as unknown as Record<string, unknown>;
  const constants = await loadConstants();
  const retentionMonths = num(constants, 'gsc_access_log_retention_months');
  const expires = new Date();
  expires.setMonth(expires.getMonth() + retentionMonths);

  const { error: logError } = await supabaseAdmin.from('marketplace_gsc_access_log').insert({
    admin_user_id: req.adminUserId,
    asset_id: req.assetId,
    owner_user_id: String(row.user_id),
    fields_read: fields,
    reason: req.reason.trim(),
    ticket_ref: req.ticketRef.trim(),
    ip: req.ip ?? null,
    expires_at: expires.toISOString(),
  });

  // Pas de trace, pas de donnée : la journalisation est bloquante.
  if (logError) throw new Error(`Journalisation refusée : ${logError.message}`);

  const payload: Record<string, unknown> = { domain: row.domain, url: row.url };
  for (const f of fields) payload[f] = row[f];
  return payload;
}

/** Purge des traces expirées (appelée par le cron de maintenance). */
export async function purgeExpiredAccessLogs(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('marketplace_gsc_access_log')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');
  if (error) throw new Error(`Purge des traces impossible : ${error.message}`);
  return data?.length ?? 0;
}
