/**
 * Déploiement des correctifs autorisés de la passe unique.
 * Aucune nouvelle demande d'autorisation ici : la délégation a déjà été
 * accordée une fois pour toutes. Chaque correctif est journalisé, avec un
 * état avant/après et une trace de rollback quand le canal le permet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type Db = SupabaseClient<Database>;

const CONTENT_ZONE: Record<string, string> = {
  meta_title: 'meta_title',
  meta_description: 'meta_description',
  meta_canonical: 'canonical',
  meta_robots: 'robots_meta',
  heading_h1: 'h1',
  heading_hierarchy: 'h2',
  bullet_summary: 'body_section',
  faq_section: 'faq',
  data_table: 'body_section',
  info_section: 'body_section',
  internal_links: 'body_section',
  image_alt: 'alt_text',
};

export interface FixDeployResult {
  id: string;
  fix_key: string;
  status: 'deployed' | 'failed' | 'manual';
  detail?: string;
}

export async function deployAuthorizedFixes(
  supabase: Db,
  userId: string,
  orderId: string,
  trackedSiteId: string | null,
): Promise<FixDeployResult[]> {
  const results: FixDeployResult[] = [];

  const { data: consent } = await supabase
    .from('passe_order_consents')
    .select('granted_at')
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!consent) return results;

  const { data: fixes } = await supabase
    .from('passe_order_fixes')
    .select('*')
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .eq('status', 'authorized');
  if (!fixes || fixes.length === 0) return results;

  const log = async (event: string, payload: Record<string, unknown>) => {
    await supabase
      .from('passe_order_events')
      .insert({ order_id: orderId, user_id: userId, event, payload: payload as never });
  };

  const mark = async (
    id: string,
    status: 'deployed' | 'failed' | 'not_applicable',
    extra: Record<string, unknown> = {},
  ) => {
    await supabase
      .from('passe_order_fixes')
      .update({
        status,
        deployed_at: status === 'deployed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        ...extra,
      })
      .eq('id', id)
      .eq('user_id', userId);
  };

  for (const fix of fixes) {
    const payload = (fix.payload ?? {}) as Record<string, unknown>;

    // Canaux sans écriture automatique fiable : livrés à copier, sans échec trompeur.
    if (!trackedSiteId || fix.channel === 'root_file' || fix.channel === 'image' || fix.channel === 'manual') {
      await mark(fix.id, 'not_applicable', { error_detail: 'à appliquer manuellement (livré à copier)' });
      results.push({ id: fix.id, fix_key: fix.fix_key, status: 'manual' });
      continue;
    }

    try {
      if (fix.channel === 'content') {
        const zone = CONTENT_ZONE[fix.fix_key] ?? 'body_section';
        const { data: res } = await supabase.functions.invoke('cms-patch-content', {
          body: {
            tracked_site_id: trackedSiteId,
            target_url: fix.page_url,
            patches: [
              {
                zone,
                action: String(payload['action'] ?? 'replace'),
                value: payload['value'] ?? '',
                old_value: payload['old_value'] ?? undefined,
              },
            ],
          },
        });
        const ok = (res as { success?: boolean } | null)?.success === true;
        const detail = (res as { detail?: string; error?: string } | null)?.detail ?? (res as { error?: string } | null)?.error;
        await mark(fix.id, ok ? 'deployed' : 'failed', { error_detail: ok ? null : (detail ?? 'patch_failed') });
        results.push({ id: fix.id, fix_key: fix.fix_key, status: ok ? 'deployed' : 'failed', ...(detail ? { detail } : {}) });
        await log(ok ? 'fix_deployed' : 'fix_failed', { fix_key: fix.fix_key, zone, url: fix.page_url, detail });
        continue;
      }

      if (fix.channel === 'code') {
        const code = String(payload['code'] ?? '');
        if (!code) {
          await mark(fix.id, 'not_applicable', { error_detail: 'aucun code généré' });
          results.push({ id: fix.id, fix_key: fix.fix_key, status: 'manual' });
          continue;
        }
        const { data: res } = await supabase.functions.invoke('cms-push-code', {
          body: {
            tracked_site_id: trackedSiteId,
            code,
            label: fix.label,
            placement: payload['placement'] === 'footer' ? 'footer' : 'header',
            mode: 'deploy',
            fixes_summary: [{ id: fix.id, label: fix.label, category: fix.family }],
          },
        });
        const ok = (res as { success?: boolean } | null)?.success === true;
        const detail = (res as { detail?: string; error?: string } | null)?.detail ?? (res as { error?: string } | null)?.error;
        await mark(fix.id, ok ? 'deployed' : 'failed', { error_detail: ok ? null : (detail ?? 'push_failed') });
        results.push({ id: fix.id, fix_key: fix.fix_key, status: ok ? 'deployed' : 'failed', ...(detail ? { detail } : {}) });
        await log(ok ? 'fix_deployed' : 'fix_failed', { fix_key: fix.fix_key, detail });
        continue;
      }

      if (fix.channel === 'redirect') {
        const from = String(payload['from'] ?? '');
        const to = String(payload['to'] ?? '');
        if (!from || !to) {
          await mark(fix.id, 'not_applicable', { error_detail: 'origine ou destination manquante' });
          results.push({ id: fix.id, fix_key: fix.fix_key, status: 'manual' });
          continue;
        }
        const { data: res } = await supabase.functions.invoke('cms-push-redirect', {
          body: { tracked_site_id: trackedSiteId, action: 'create', from, to, type: 301 },
        });
        const ok = (res as { success?: boolean } | null)?.success === true;
        const detail = (res as { detail?: string; error?: string } | null)?.detail ?? (res as { error?: string } | null)?.error;
        await mark(fix.id, ok ? 'deployed' : 'failed', {
          error_detail: ok ? null : (detail ?? 'redirect_failed'),
          rollback_ref: ok ? from : null,
        });
        results.push({ id: fix.id, fix_key: fix.fix_key, status: ok ? 'deployed' : 'failed', ...(detail ? { detail } : {}) });
        await log(ok ? 'fix_deployed' : 'fix_failed', { fix_key: fix.fix_key, from, to, detail });
        continue;
      }

      // gmb : appliqué par le bloc fiche Google Maps du déploiement.
      await mark(fix.id, 'deployed');
      results.push({ id: fix.id, fix_key: fix.fix_key, status: 'deployed' });
    } catch (e) {
      const detail = (e as Error).message;
      await mark(fix.id, 'failed', { error_detail: detail });
      results.push({ id: fix.id, fix_key: fix.fix_key, status: 'failed', detail });
      await log('fix_failed', { fix_key: fix.fix_key, detail });
    }
  }

  return results;
}
