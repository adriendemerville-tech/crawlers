/**
 * helpers.ts — Utilitaires P2 partagés (catégorisation, summarize, timeouts).
 *
 * - categorizeAction : map skill → action_category (read/navigate/write/destructive/system/other)
 * - summarizeForHistory : tronque les outputs > MAX_OUTPUT_BYTES dans l'historique LLM
 * - withTimeout : wrap une promesse avec AbortController + raison explicite
 */

export const LLM_TIMEOUT_MS = 45_000;
export const SKILL_TIMEOUT_MS = 30_000;
export const MAX_OUTPUT_BYTES = 4_000; // ~1k tokens — au-delà on tronque dans l'historique

/** Catégorie analytique d'une action skill (utilisé pour filtres UI + métriques). */
export type ActionCategory = 'read' | 'navigate' | 'write' | 'destructive' | 'system' | 'other';

const NAVIGATE_SKILLS = new Set(['navigate_to', 'open_audit_panel']);
const WRITE_SKILLS = new Set(['cms_publish_draft', 'cms_patch_content', 'deploy_cocoon_plan', 'trigger_audit', 'refresh_kpis']);
const DESTRUCTIVE_SKILLS = new Set(['delete_site', 'delete_user', 'rotate_keys', 'mass_delete', 'escalate_to_human']);

export function categorizeAction(skill: string): ActionCategory {
  if (skill.startsWith('_')) return 'system';
  if (skill.startsWith('read_')) return 'read';
  if (NAVIGATE_SKILLS.has(skill)) return 'navigate';
  if (DESTRUCTIVE_SKILLS.has(skill)) return 'destructive';
  if (WRITE_SKILLS.has(skill)) return 'write';
  return 'other';
}

/**
 * P2 #15 — tronque les payloads JSON pour l'historique LLM.
 * On garde les clés top-level mais résume les valeurs longues.
 * Si le payload tient en < MAX_OUTPUT_BYTES, on le rend tel quel.
 */
export function summarizeForHistory(value: unknown): unknown {
  if (value == null) return value;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { _truncated: true, _reason: 'non-serializable' };
  }
  if (serialized.length <= MAX_OUTPUT_BYTES) return value;

  // Trop volumineux : on garde un aperçu structuré
  if (Array.isArray(value)) {
    return {
      _truncated: true,
      _original_size: serialized.length,
      _array_length: value.length,
      sample: value.slice(0, 3).map((v) => truncateLeaf(v)),
    };
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const summary: Record<string, unknown> = {
      _truncated: true,
      _original_size: serialized.length,
      _keys: keys.slice(0, 30),
    };
    // Conserve quelques champs sémantiques importants tronqués
    for (const k of ['ok', 'error', 'status', 'count', 'id', 'message', 'reason']) {
      if (k in obj) summary[k] = truncateLeaf(obj[k]);
    }
    return summary;
  }
  return { _truncated: true, preview: serialized.slice(0, 500) };
}

function truncateLeaf(v: unknown): unknown {
  if (typeof v === 'string') return v.length > 200 ? v.slice(0, 200) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean' || v == null) return v;
  if (Array.isArray(v)) return `[Array(${v.length})]`;
  if (typeof v === 'object') return `{${Object.keys(v as object).slice(0, 5).join(',')}…}`;
  return String(v);
}

/**
 * P2 #13 — wrap une promesse avec un timeout + AbortController.
 * Si la promesse n'a pas résolu après ms ms, on rejette avec un message lisible.
 *
 * Pour fetch : passer signal: ctl.signal côté appelant ; on retourne aussi le signal
 * via la signature withAbortable.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tid = setTimeout(() => {
      reject(new Error(`Timeout ${label} après ${ms}ms`));
    }, ms);
    promise
      .then((v) => { clearTimeout(tid); resolve(v); })
      .catch((e) => { clearTimeout(tid); reject(e); });
  });
}

/**
 * Variante avec AbortController pour fetch — le signal est annulé au timeout
 * pour libérer la connexion réseau (sinon Deno garde le fetch en arrière-plan).
 */
export function withAbortableTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(new Error(`Timeout ${label} après ${ms}ms`)), ms);
  return fn(ctl.signal)
    .finally(() => clearTimeout(tid));
}
