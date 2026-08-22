/**
 * verification.server.ts (L4.2)
 *
 * Contrôle de publication et de maintien d'une jambe (§2.13).
 *
 * Règle dure : **aucun verdict négatif sans escalade de rendu**. Un blocage de
 * robot (403/WAF), un timeout ou une coquille JS non-SSR ne valent jamais
 * rupture : le contrôle est alors `inconclusive` / `blocked` et l'état de la
 * jambe est conservé. Tout verdict de lien passe par la même échelle que le
 * juge unique (`hard_broken` / `soft_broken` / `blocked` / `ok`).
 *
 * 100 % déterministe : aucun appel LLM.
 */

import { loadConstants, num, obj, type MarketplaceConstants } from './constants.server';

type Sb = { from: (table: string) => any };

export type CheckMethod = 'crawl' | 'linkedin_api' | 'meta_api';
export type CheckVerdict = 'ok' | 'hard_broken' | 'soft_broken' | 'blocked' | 'inconclusive';
export type LegState = 'published' | 'verified' | 'maintained' | 'broken' | 'resolved' | 'refunded';

export interface VerificationRow {
  id: string;
  order_id: string;
  method: CheckMethod;
  verdict: CheckVerdict;
  link_present: boolean | null;
  observed_attribute: string | null;
  observed_anchor: string | null;
  http_status: number | null;
  render_escalated: boolean;
  shell_detected: boolean;
  leg_state: LegState;
  checked_at: string;
  next_check_at: string | null;
}

interface Schedule {
  first: number;
  second: number;
  recurring: number;
}

/** Détection de coquille JS : un HTML sans texte visible n'est pas une preuve. */
export function isJsShell(html: string): boolean {
  const visible = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#\d+);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = visible.split(/\s+/).filter((w) => w.length > 1).length;
  return words < 120;
}

export interface LinkObservation {
  present: boolean;
  attribute: 'dofollow' | 'nofollow' | 'sponsored' | null;
  anchor: string | null;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
}

/** Recherche du lien attendu et lecture de son attribut réel. */
export function observeLink(html: string, targetUrl: string): LinkObservation {
  const target = normalizeUrl(targetUrl);
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];

  for (const tag of anchors) {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    if (normalizeUrl(hrefMatch[1]) !== target) continue;

    const rel = (tag.match(/rel\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').toLowerCase();
    const anchor = tag
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let attribute: LinkObservation['attribute'] = 'dofollow';
    if (rel.includes('sponsored')) attribute = 'sponsored';
    else if (rel.includes('nofollow') || rel.includes('ugc')) attribute = 'nofollow';

    return { present: true, attribute, anchor: anchor || null };
  }

  return { present: false, attribute: null, anchor: null };
}

interface FetchResult {
  status: number | null;
  html: string;
  escalated: boolean;
}

async function fetchStatic(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrawlersVerification/1.0; +https://crawlers.fr)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const html = res.ok ? await res.text() : '';
    return { status: res.status, html, escalated: false };
  } catch {
    return { status: null, html: '', escalated: false };
  }
}

/** Escalade de rendu via le proxy interne (JS rendu, contournement de WAF). */
async function fetchRendered(url: string): Promise<FetchResult> {
  const base = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!base || !key) return { status: null, html: '', escalated: true };
  try {
    const res = await fetch(`${base}/functions/v1/fetch-external-site`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ url }),
    });
    const html = res.ok ? await res.text() : '';
    return { status: res.ok ? 200 : res.status, html, escalated: true };
  } catch {
    return { status: null, html: '', escalated: true };
  }
}

export interface VerdictInput {
  status: number | null;
  html: string;
  escalated: boolean;
  targetUrl: string;
  expectedAttribute: 'dofollow' | 'nofollow' | 'sponsored';
  consecutiveFailures: number;
  softConfirmations: number;
}

export interface VerdictOutput {
  verdict: CheckVerdict;
  observation: LinkObservation;
  shell: boolean;
  reason: string;
}

/** Traduction déterministe d'un constat en verdict de jambe. */
export function decideVerdict(input: VerdictInput): VerdictOutput {
  const shell = input.html.length > 0 && isJsShell(input.html);
  const observation = observeLink(input.html, input.targetUrl);

  if (input.status === null || input.status === 0) {
    return {
      verdict: input.consecutiveFailures + 1 >= input.softConfirmations ? 'soft_broken' : 'inconclusive',
      observation,
      shell,
      reason: 'Page injoignable au contrôle (réseau ou délai dépassé) — aucun verdict de rupture prononcé.',
    };
  }

  if ([401, 403, 405, 406, 429, 999].includes(input.status) || input.status >= 500) {
    return {
      verdict: 'blocked',
      observation,
      shell,
      reason: `HTTP ${input.status} : protection serveur ou indisponibilité — un blocage de crawl ne vaut pas rupture.`,
    };
  }

  if ([404, 410, 451].includes(input.status)) {
    return {
      verdict: 'hard_broken',
      observation,
      shell,
      reason: `HTTP ${input.status} : la page d'accueil du lien n'existe plus.`,
    };
  }

  if (observation.present) {
    if (input.expectedAttribute === 'dofollow' && observation.attribute !== 'dofollow') {
      return {
        verdict: 'hard_broken',
        observation,
        shell,
        reason: `Lien présent mais en ${observation.attribute} alors que l'attribut convenu est dofollow.`,
      };
    }
    return { verdict: 'ok', observation, shell, reason: 'Lien présent, attribut conforme à la commande.' };
  }

  // Lien absent : seule une page réellement rendue autorise un verdict négatif.
  if (shell || !input.escalated) {
    return {
      verdict: 'inconclusive',
      observation,
      shell,
      reason: shell
        ? 'Page servie sans contenu rendu (coquille JS) : escalade de rendu requise avant tout verdict.'
        : 'Lien absent du HTML statique : escalade de rendu requise avant tout verdict.',
    };
  }

  return {
    verdict: 'hard_broken',
    observation,
    shell,
    reason: 'Lien absent de la page rendue : engagement de maintien rompu.',
  };
}

/** Prochain contrôle selon l'ancienneté de la publication (J+1, J+7, mensuel). */
export function nextCheckAt(publishedAt: Date, now: Date, schedule: Schedule): Date {
  const ageDays = (now.getTime() - publishedAt.getTime()) / 86_400_000;
  const step = ageDays < schedule.first ? schedule.first : ageDays < schedule.second ? schedule.second : schedule.recurring;
  const anchor = ageDays < schedule.second ? publishedAt : now;
  return new Date(anchor.getTime() + step * 86_400_000);
}

/** Transition d'état de jambe à partir du verdict et de l'état courant. */
export function nextLegState(current: LegState, verdict: CheckVerdict, ageDays: number, schedule: Schedule): LegState {
  if (current === 'refunded' || current === 'resolved') return current;
  if (verdict === 'hard_broken') return 'broken';
  if (verdict !== 'ok') return current === 'broken' ? 'broken' : current;
  if (current === 'broken') return 'maintained';
  if (ageDays >= schedule.second) return 'maintained';
  return 'verified';
}

interface OrderForCheck {
  id: string;
  buyer_id: string;
  seller_id: string;
  asset_id: string | null;
  target_url: string;
  link_attribute: 'dofollow' | 'nofollow' | 'sponsored';
  status: LegState | string;
  published_at: string | null;
  commitment_ends_at: string | null;
  consecutive_check_failures: number | null;
  broken_since: string | null;
}

export interface RunResult {
  order_id: string;
  verdict: CheckVerdict;
  leg_state: LegState;
  reason: string;
  next_check_at: string | null;
  refund_cents: number;
}

/**
 * Exécute un contrôle sur une commande publiée. Écrit une ligne de journal,
 * met à jour l'état de la jambe et déclenche le remboursement au prorata
 * quand la fenêtre de remise en conformité est dépassée.
 */
export async function runVerification(orderId: string, constants?: MarketplaceConstants): Promise<RunResult> {
  const c = constants ?? (await loadConstants());
  const schedule = obj<Schedule & Record<string, unknown>>(c, 'verification_schedule_days');
  const remediationDays = num(c, 'verification_remediation_days');
  const softConfirmations = num(c, 'verification_soft_confirmations');

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const { data: orderRow, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select(
      'id, buyer_id, seller_id, asset_id, target_url, link_attribute, status, published_at, commitment_ends_at, consecutive_check_failures, broken_since',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!orderRow) throw new Error('Commande introuvable');
  const order = orderRow as unknown as OrderForCheck;
  if (!order.published_at) throw new Error('Commande non publiée : aucun contrôle possible');

  // Page porteuse du lien (côté vendeur).
  let sellerUrl: string | null = null;
  if (order.asset_id) {
    const { data: asset } = await supabaseAdmin
      .from('marketplace_link_assets')
      .select('url')
      .eq('id', order.asset_id)
      .maybeSingle();
    sellerUrl = (asset as { url?: string } | null)?.url ?? null;
  }
  if (!sellerUrl) throw new Error('Page vendeur inconnue : contrôle impossible');

  let fetched = await fetchStatic(sellerUrl);
  let decision = decideVerdict({
    status: fetched.status,
    html: fetched.html,
    escalated: false,
    targetUrl: order.target_url,
    expectedAttribute: order.link_attribute,
    consecutiveFailures: order.consecutive_check_failures ?? 0,
    softConfirmations,
  });

  // Escalade obligatoire avant tout verdict négatif.
  if (decision.verdict !== 'ok') {
    const rendered = await fetchRendered(sellerUrl);
    if (rendered.html) {
      fetched = rendered;
      decision = decideVerdict({
        status: rendered.status,
        html: rendered.html,
        escalated: true,
        targetUrl: order.target_url,
        expectedAttribute: order.link_attribute,
        consecutiveFailures: order.consecutive_check_failures ?? 0,
        softConfirmations,
      });
    }
  }

  const now = new Date();
  const publishedAt = new Date(order.published_at);
  const ageDays = (now.getTime() - publishedAt.getTime()) / 86_400_000;
  const currentState = (['published', 'verified', 'maintained', 'broken', 'resolved', 'refunded'] as LegState[]).includes(
    order.status as LegState,
  )
    ? (order.status as LegState)
    : 'published';

  let legState = nextLegState(currentState, decision.verdict, ageDays, schedule);
  const failures = decision.verdict === 'ok' ? 0 : (order.consecutive_check_failures ?? 0) + 1;
  const next = nextCheckAt(publishedAt, now, schedule);

  let refundCents = 0;
  let remediationDue = order.broken_since
    ? new Date(new Date(order.broken_since).getTime() + remediationDays * 86_400_000)
    : null;

  if (legState === 'broken') {
    if (!order.broken_since) {
      remediationDue = new Date(now.getTime() + remediationDays * 86_400_000);
    } else if (remediationDue && remediationDue.getTime() <= now.getTime()) {
      const { refundBrokenLeg } = await import('./refunds.server');
      const refund = await refundBrokenLeg(orderId, now);
      refundCents = refund.refund_cents;
      legState = 'refunded';
    }
  }

  await supabaseAdmin.from('marketplace_verifications').insert({
    order_id: orderId,
    method: 'crawl',
    verdict: decision.verdict,
    link_present: decision.observation.present,
    observed_attribute: decision.observation.attribute,
    observed_anchor: decision.observation.anchor,
    http_status: fetched.status,
    render_escalated: fetched.escalated,
    shell_detected: decision.shell,
    leg_state: legState,
    consecutive_failures: failures,
    proof: { reason: decision.reason, seller_url: sellerUrl, target_url: order.target_url },
    next_check_at: next.toISOString(),
  });

  await supabaseAdmin
    .from('marketplace_orders')
    .update({
      status: legState,
      last_checked_at: now.toISOString(),
      next_check_at: next.toISOString(),
      consecutive_check_failures: failures,
      broken_since: legState === 'broken' ? (order.broken_since ?? now.toISOString()) : null,
      remediation_due_at: legState === 'broken' ? (remediationDue?.toISOString() ?? null) : null,
    })
    .eq('id', orderId);

  return {
    order_id: orderId,
    verdict: decision.verdict,
    leg_state: legState,
    reason: decision.reason,
    next_check_at: next.toISOString(),
    refund_cents: refundCents,
  };
}

/** Commandes dont le contrôle est échu (cron L4.3). */
export async function listDueOrders(limit = 25): Promise<string[]> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select('id, next_check_at, commitment_ends_at')
    .in('status', ['published', 'verified', 'maintained', 'broken'])
    .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
    .order('next_check_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`File de contrôle illisible : ${error.message}`);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** Journal des contrôles d'une commande, visible des deux parties (RLS). */
export async function listVerifications(sb: Sb, params: { userId: string; orderId: string }): Promise<VerificationRow[]> {
  const { data: order } = await sb
    .from('marketplace_orders')
    .select('id, buyer_id, seller_id')
    .eq('id', params.orderId)
    .maybeSingle();
  if (!order || (order.buyer_id !== params.userId && order.seller_id !== params.userId)) {
    throw new Error('Commande introuvable pour ce compte');
  }

  const { data, error } = await sb
    .from('marketplace_verifications')
    .select(
      'id, order_id, method, verdict, link_present, observed_attribute, observed_anchor, http_status, render_escalated, shell_detected, leg_state, checked_at, next_check_at',
    )
    .eq('order_id', params.orderId)
    .order('checked_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(`Contrôles illisibles : ${error.message}`);
  return (data ?? []) as VerificationRow[];
}
