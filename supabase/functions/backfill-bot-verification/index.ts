/**
 * backfill-bot-verification — Sprint A+
 *
 * Re-vérifie en différé les log_entries et bot_hits dont
 * `verification_status` est NULL ou 'unverified', en utilisant la
 * stack rDNS+ASN du module bot-verification.
 *
 * Cible 500 IPs uniques par exécution (cap pour rester sous 30s).
 * Cron : toutes les 10 min (table-driven, idempotent).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { verifyBotBatch } from '../_shared/bot-verification.ts';

const MAX_IPS_PER_RUN = 500;
const MAX_ROWS_PER_TABLE = 2000;

Deno.serve(handleRequest(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const stats = {
    log_entries: { scanned: 0, updated: 0 },
    bot_hits: { scanned: 0, updated: 0 },
    unique_ips: 0,
    duration_ms: 0,
  };
  const start = Date.now();

  // ─────────────────────────────────────────────
  // 1) log_entries — sélection des lignes à re-vérifier
  // ─────────────────────────────────────────────
  const { data: logRows, error: logErr } = await supabase
    .from('log_entries')
    .select('id, ip, user_agent')
    .or('verification_status.is.null,verification_status.eq.unverified')
    .not('ip', 'is', null)
    .order('ts', { ascending: false })
    .limit(MAX_ROWS_PER_TABLE);

  if (logErr) {
    console.error('[backfill] log_entries query error', logErr);
    return jsonError(logErr.message, 500);
  }
  stats.log_entries.scanned = logRows?.length || 0;

  // ─────────────────────────────────────────────
  // 2) bot_hits — pareil (IP hashée → on ne peut PAS re-vérifier les IPs déjà hashées,
  //    on cible donc uniquement les lignes où raw_meta contient l'IP brute si présente,
  //    OU on traite uniquement les UA pour passer suspect→stealth/verified si possible)
  // ─────────────────────────────────────────────
  const { data: hitRows, error: hitErr } = await supabase
    .from('bot_hits')
    .select('id, user_agent, raw_meta')
    .or('verification_status.is.null,verification_status.eq.unverified')
    .order('hit_at', { ascending: false })
    .limit(MAX_ROWS_PER_TABLE);

  if (hitErr) {
    console.error('[backfill] bot_hits query error', hitErr);
    return jsonError(hitErr.message, 500);
  }
  stats.bot_hits.scanned = hitRows?.length || 0;

  // Collecte les IPs uniques (log_entries seul — bot_hits n'a que le hash)
  const uniqueIps = new Set<string>();
  for (const r of logRows || []) {
    if (r.ip && /^\d+\.\d+\.\d+\.\d+$/.test(String(r.ip))) {
      uniqueIps.add(String(r.ip));
      if (uniqueIps.size >= MAX_IPS_PER_RUN) break;
    }
  }
  stats.unique_ips = uniqueIps.size;

  // ─────────────────────────────────────────────
  // 3) Vérification batch (réutilise le cache rDNS interne)
  // ─────────────────────────────────────────────
  const ipList = [...uniqueIps];
  const verifications = await verifyBotBatch(
    ipList.map(ip => ({ ip, ua: null })),
    { enableRdns: true, rdnsConcurrency: 8 },
  );
  const ipToVerification = new Map<string, typeof verifications[number]>();
  ipList.forEach((ip, i) => ipToVerification.set(ip, verifications[i]));

  // ─────────────────────────────────────────────
  // 4) Update log_entries — par lots de 100 IDs
  // ─────────────────────────────────────────────
  const logUpdates: Array<{
    id: string;
    verification_status: string;
    verification_method: string;
    confidence_score: number;
    bot_name?: string | null;
    bot_category?: string | null;
    is_bot?: boolean;
  }> = [];

  for (const r of logRows || []) {
    const ip = r.ip ? String(r.ip) : null;
    if (!ip) continue;
    const v = ipToVerification.get(ip);
    if (!v) continue; // IP non vérifiable (IPv6, privée, hors quota)
    // On n'écrase l'UA-detected qu'avec une donnée plus forte
    if (v.status === 'unverified') continue;
    logUpdates.push({
      id: r.id,
      verification_status: v.status,
      verification_method: v.method,
      confidence_score: v.confidence,
      ...(v.bot_name ? { bot_name: v.bot_name } : {}),
      ...(v.bot_category ? { bot_category: v.bot_category } : {}),
      ...(v.is_bot ? { is_bot: true } : {}),
    });
  }

  // Updates ligne par ligne (Supabase ne supporte pas l'upsert partiel par ID natif sans conflict)
  for (let i = 0; i < logUpdates.length; i += 50) {
    const batch = logUpdates.slice(i, i + 50);
    await Promise.all(batch.map(u => {
      const { id, ...patch } = u;
      return supabase.from('log_entries').update(patch).eq('id', id);
    }));
    stats.log_entries.updated += batch.length;
  }

  stats.duration_ms = Date.now() - start;
  console.log('[backfill-bot-verification]', stats);
  return jsonOk({ ok: true, stats });
}, 'backfill-bot-verification'));
