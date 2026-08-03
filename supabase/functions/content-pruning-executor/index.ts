import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { isDictadeviDomain, isIktrackerDomain } from '../_shared/domainUtils.ts';

/**
 * content-pruning-executor
 *
 * Exécute la consolidation réelle d'un cluster cannibalisé détecté par
 * `_shared/cannibalizationClusters.ts` (Parménion phase prescribe / skill Copilot).
 *
 * Séquence par doublon (déterministe, 0 LLM) :
 *   1. GET du doublon sur le CMS  → snapshot intégral en base (content_pruning_log)
 *   2. FUSION : les sections <h2>/<h3> absentes du pilier sont appendées au pilier
 *   3. REDIRECT 301 doublon → pilier
 *   4. DELETE du doublon (uniquement si 1→2→3 ont réussi)
 *
 * Garde-fous :
 *   - plafond dur PRUNING_HARD_CAP actions par appel (défaut 4)
 *   - snapshot obligatoire AVANT toute mutation (restauration possible)
 *   - si la plateforme ne sait pas créer de 301 → aucune suppression (sinon 404)
 *   - dry_run : journalise le plan sans muter le CMS
 *   - action 'restore' : recrée un post depuis son snapshot
 */

const PRUNING_HARD_CAP = 4;
const MERGE_MARKER = '<!-- crawlers:consolidated -->';

interface PagePointer {
  url?: string;
  path?: string;
  slug?: string;
  title?: string;
}

interface PruningPayload {
  theme?: string;
  pilier: PagePointer;
  duplicates: PagePointer[];
}

interface StepResult {
  pruned_url: string;
  log_id: string | null;
  merge_status: string;
  redirect_status: string;
  delete_status: string;
  error?: string;
}

function pathOf(p: PagePointer): string {
  if (p.path) return p.path.startsWith('/') ? p.path : `/${p.path}`;
  if (p.url) {
    try { return new URL(p.url).pathname; } catch { /* ignore */ }
  }
  if (p.slug) return `/blog/${p.slug}`;
  return '/';
}

function slugOf(p: PagePointer): string {
  if (p.slug) return p.slug;
  const segments = pathOf(p).split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Découpe un HTML en blocs <h2>/<h3> + contenu suivant (déterministe, sans DOM). */
function splitSections(html: string): { heading: string; block: string }[] {
  if (!html) return [];
  const parts = html.split(/(?=<h[23][\s>])/i);
  const out: { heading: string; block: string }[] = [];
  for (const part of parts) {
    const m = part.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    if (!m) continue;
    const heading = stripTags(m[1] || '');
    if (!heading) continue;
    out.push({ heading, block: part.trim() });
  }
  return out;
}

/** Fusion déterministe : ajoute au pilier les sections absentes (par titre normalisé). */
function mergeIntoPilier(pilierHtml: string, duplicateHtml: string, duplicateTitle: string, duplicateUrl: string) {
  const existing = new Set(splitSections(pilierHtml).map((s) => s.heading));
  const pilierText = stripTags(pilierHtml);
  const added: string[] = [];
  for (const section of splitSections(duplicateHtml)) {
    if (existing.has(section.heading)) continue;
    if (pilierText.includes(section.heading)) continue;
    added.push(section.block);
    existing.add(section.heading);
    if (added.length >= 4) break;
  }
  if (added.length === 0) return { html: pilierHtml, added: 0 };
  const appendix = [
    MERGE_MARKER,
    `<h2>Compléments issus de « ${duplicateTitle || duplicateUrl} »</h2>`,
    ...added,
  ].join('\n');
  return { html: `${pilierHtml}\n${appendix}`, added: added.length };
}

type Bridge = {
  kind: 'dictadevi' | 'iktracker' | 'generic';
  fn: string;
  supportsRedirect: boolean;
};

function resolveBridge(domain: string): Bridge {
  if (isDictadeviDomain(domain)) return { kind: 'dictadevi', fn: 'dictadevi-actions', supportsRedirect: false };
  if (isIktrackerDomain(domain)) return { kind: 'iktracker', fn: 'iktracker-actions', supportsRedirect: true };
  return { kind: 'generic', fn: 'cms-patch-content', supportsRedirect: true };
}

async function callBridge(
  supabase: ReturnType<typeof getServiceClient>,
  fn: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: any; error?: string }> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) return { ok: false, data: null, error: error.message || String(error) };
  const payload: any = data;
  if (payload && payload.success === false) {
    return { ok: false, data: payload, error: payload.error || 'bridge returned success=false' };
  }
  // Les ponts renvoient { status, data } (proxy HTTP)
  if (payload && typeof payload.status === 'number' && payload.status >= 400) {
    return { ok: false, data: payload, error: payload.error || `HTTP ${payload.status}` };
  }
  return { ok: true, data: payload };
}

/** Les ponts CMS emballent le post à des profondeurs variables ({result:{data:{data:{…}}}}). */
function extractPost(bridgeData: any, depth = 0): Record<string, any> | null {
  if (!bridgeData || typeof bridgeData !== 'object' || depth > 6) return null;
  if (Array.isArray(bridgeData)) {
    for (const item of bridgeData) {
      const found = extractPost(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const hasHtml = bridgeData.content || bridgeData.content_html || bridgeData.body || bridgeData.html;
  if (hasHtml && typeof hasHtml === 'string') return bridgeData;
  for (const key of ['result', 'data', 'post', 'item']) {
    const found = extractPost(bridgeData[key], depth + 1);
    if (found) return found;
  }
  return null;
}


function postHtml(post: Record<string, any> | null): string {
  if (!post) return '';
  return String(post.content ?? post.content_html ?? post.body ?? post.html ?? '');
}

Deno.serve(handleRequest(async (req: Request) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  let body: any = {};
  try { body = await req.json(); } catch { return jsonError('Invalid JSON body', 400); }

  const supabase = getServiceClient();
  const action = String(body.action || 'prune');

  // ─────────────── RESTORE ───────────────
  if (action === 'restore') {
    const logId = String(body.log_id || '');
    if (!logId) return jsonError('log_id required', 400);
    const { data: row, error } = await supabase
      .from('content_pruning_log').select('*').eq('id', logId).maybeSingle();
    if (error || !row) return jsonError('pruning log entry not found', 404);
    if (!row.pruned_html) return jsonError('no HTML snapshot stored for this entry', 422);

    const bridge = resolveBridge(row.domain);
    const restore = await callBridge(supabase, bridge.fn, {
      action: 'create-post',
      params: {
        slug: row.pruned_slug,
        title: row.pruned_title,
        content: row.pruned_html,
        status: 'draft',
        ...(row.pruned_payload?.restore_extra || {}),
      },
    });
    await supabase.from('content_pruning_log').update({
      restored_at: restore.ok ? new Date().toISOString() : null,
      error_message: restore.ok ? null : `restore: ${restore.error}`,
    }).eq('id', logId);
    return restore.ok
      ? jsonOk({ restored: true, log_id: logId, slug: row.pruned_slug, status: 'draft' })
      : jsonError(`restore failed: ${restore.error}`, 502);
  }

  // ─────────────── PRUNE ───────────────
  const domain = String(body.domain || '').trim();
  const trackedSiteId = body.tracked_site_id ? String(body.tracked_site_id) : null;
  const userId = body.user_id ? String(body.user_id) : null;
  const decisionId = body.decision_id ? String(body.decision_id) : null;
  const dryRun = body.dry_run === true;
  const pruning: PruningPayload | null = body.pruning || null;

  if (!domain) return jsonError('domain required', 400);
  if (!userId) return jsonError('user_id required', 400);
  if (!pruning?.pilier || !Array.isArray(pruning.duplicates) || pruning.duplicates.length === 0) {
    return jsonError('pruning.pilier and pruning.duplicates required', 400);
  }

  const cap = Math.max(1, Math.min(PRUNING_HARD_CAP, Number(body.max_actions) || PRUNING_HARD_CAP));
  const bridge = resolveBridge(domain);
  const pilierSlug = slugOf(pruning.pilier);
  const pilierPath = pathOf(pruning.pilier);
  const pilierUrl = pruning.pilier.url || `https://${domain}${pilierPath}`;

  // Le pilier est intouchable en tant que cible : on refuse de le pruner.
  const duplicates = pruning.duplicates
    .filter((d) => slugOf(d) && slugOf(d) !== pilierSlug)
    .slice(0, cap);

  if (duplicates.length === 0) return jsonError('no eligible duplicate (pilier excluded)', 422);

  // Chargement du pilier
  const pilierRes = await callBridge(supabase, bridge.fn, { action: 'get-post', params: { slug: pilierSlug } });
  let pilierPost = extractPost(pilierRes.data);
  if (!pilierRes.ok || !pilierPost) {
    return jsonError(`pilier "${pilierSlug}" unreadable on CMS: ${pilierRes.error || 'not found'}`, 424);
  }
  let pilierContent = postHtml(pilierPost);

  const results: StepResult[] = [];

  for (const dup of duplicates) {
    const dupSlug = slugOf(dup);
    const dupPath = pathOf(dup);
    const dupUrl = dup.url || `https://${domain}${dupPath}`;
    const step: StepResult = {
      pruned_url: dupUrl, log_id: null,
      merge_status: 'pending', redirect_status: 'pending', delete_status: 'pending',
    };

    // 1. Snapshot obligatoire
    const dupRes = await callBridge(supabase, bridge.fn, { action: 'get-post', params: { slug: dupSlug } });
    const dupPost = extractPost(dupRes.data);
    if (!dupRes.ok || !dupPost) {
      step.merge_status = 'aborted';
      step.redirect_status = 'aborted';
      step.delete_status = 'aborted';
      step.error = `doublon illisible: ${dupRes.error || 'not found'}`;
      results.push(step);
      continue;
    }
    const dupHtml = postHtml(dupPost);
    const dupTitle = String(dupPost.title || dup.title || dupSlug);

    const { data: logRow } = await supabase.from('content_pruning_log').insert({
      user_id: userId,
      tracked_site_id: trackedSiteId,
      domain,
      decision_id: decisionId,
      cluster_theme: pruning.theme || null,
      pilier_url: pilierUrl,
      pilier_slug: pilierSlug,
      pruned_url: dupUrl,
      pruned_slug: dupSlug,
      pruned_title: dupTitle,
      pruned_html: dupHtml,
      pruned_payload: { cms_post: dupPost, bridge: bridge.kind },
      redirect_target: pilierUrl,
      dry_run: dryRun,
    }).select('id').maybeSingle();
    step.log_id = logRow?.id || null;

    const patchLog = async (patch: Record<string, unknown>) => {
      if (step.log_id) await supabase.from('content_pruning_log').update(patch).eq('id', step.log_id);
    };

    if (dryRun) {
      const preview = mergeIntoPilier(pilierContent, dupHtml, dupTitle, dupUrl);
      step.merge_status = `dry_run:${preview.added}_sections`;
      step.redirect_status = bridge.supportsRedirect ? 'dry_run' : 'unsupported';
      step.delete_status = 'dry_run';
      await patchLog({ merge_status: step.merge_status, redirect_status: step.redirect_status, delete_status: 'dry_run' });
      results.push(step);
      continue;
    }

    // 2. Fusion vers le pilier
    const merged = mergeIntoPilier(pilierContent, dupHtml, dupTitle, dupUrl);
    if (merged.added > 0) {
      const upd = await callBridge(supabase, bridge.fn, {
        action: 'update-post',
        params: { slug: pilierSlug, content: merged.html, title: pilierPost.title },
      });
      if (!upd.ok) {
        step.merge_status = 'failed';
        step.redirect_status = 'aborted';
        step.delete_status = 'aborted';
        step.error = `fusion pilier échouée: ${upd.error}`;
        await patchLog({ merge_status: 'failed', redirect_status: 'aborted', delete_status: 'aborted', error_message: step.error });
        results.push(step);
        continue;
      }
      pilierContent = merged.html;
      step.merge_status = `merged:${merged.added}_sections`;
    } else {
      step.merge_status = 'nothing_to_merge';
    }
    await patchLog({ merge_status: step.merge_status });

    // 3. Redirection 301 — bloquante pour la suppression
    if (!bridge.supportsRedirect) {
      step.redirect_status = 'unsupported';
      step.delete_status = 'blocked_no_redirect';
      step.error = `${bridge.kind}: création de 301 non supportée → suppression annulée (404 évité)`;
      await patchLog({ redirect_status: 'unsupported', delete_status: 'blocked_no_redirect', error_message: step.error });
      results.push(step);
      continue;
    }

    const redirectCall = bridge.kind === 'iktracker'
      ? { action: 'create-redirect', params: { source_path: dupPath, target_url: pilierUrl, status_code: 301 } }
      : { tracked_site_id: trackedSiteId, action: 'create', from: dupPath, to: pilierUrl, type: 301 };
    const redirectFn = bridge.kind === 'iktracker' ? bridge.fn : 'cms-push-redirect';
    const red = await callBridge(supabase, redirectFn, redirectCall);
    if (!red.ok) {
      step.redirect_status = 'failed';
      step.delete_status = 'blocked_no_redirect';
      step.error = `301 échouée: ${red.error} → suppression annulée`;
      await patchLog({ redirect_status: 'failed', delete_status: 'blocked_no_redirect', error_message: step.error });
      results.push(step);
      continue;
    }
    step.redirect_status = 'created';
    await patchLog({ redirect_status: 'created' });

    // 4. Suppression (snapshot en base → restaurable)
    const del = await callBridge(supabase, bridge.fn, { action: 'delete-post', params: { slug: dupSlug } });
    step.delete_status = del.ok ? 'deleted' : 'failed';
    if (!del.ok) step.error = `suppression échouée: ${del.error}`;
    await patchLog({ delete_status: step.delete_status, error_message: del.ok ? null : step.error });
    results.push(step);
  }

  const deleted = results.filter((r) => r.delete_status === 'deleted').length;
  const blocked = results.filter((r) => r.delete_status.startsWith('blocked')).length;

  return jsonOk({
    success: true,
    domain,
    cluster_theme: pruning.theme || null,
    pilier: { url: pilierUrl, slug: pilierSlug },
    dry_run: dryRun,
    cap,
    processed: results.length,
    deleted,
    blocked,
    results,
    summary: dryRun
      ? `[dry-run] ${results.length} doublon(s) évalué(s) vers ${pilierPath}`
      : `${deleted}/${results.length} doublon(s) fusionné(s) + 301 + supprimé(s) vers ${pilierPath}${blocked ? `, ${blocked} bloqué(s) faute de 301` : ''}`,
  });
}, 'content-pruning-executor'));
