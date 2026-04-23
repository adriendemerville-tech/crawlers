/**
 * matriceSseClient — POST a JSON body to a Supabase Edge Function and consume
 * the response as a Server-Sent Events stream.
 *
 * Used by Sprint 6 to drive real-time per-prompt progress in MatricePrompt
 * without synthesising lifecycle events client-side.
 *
 * Events emitted by `audit-matrice` in stream mode:
 *  - `start`        : { url, total, items: [{ id, prompt, axe, detected_type }] }
 *  - `item.update`  : { id, status: 'running'|'done'|'error', result?, error? }
 *  - `complete`     : { success, url, global_score, total_items, results }
 *
 * Cancellation: pass an AbortSignal. The reader is closed and the server's
 * `cancel()` callback is invoked (releasing concurrency, stopping pending LLM
 * calls cooperatively).
 */

import { supabase } from '@/integrations/supabase/client';

export type SseEventName = 'start' | 'item.update' | 'complete' | 'error' | string;

export interface SseEvent {
  event: SseEventName;
  data: any;
}

export interface StreamMatriceOptions {
  url: string; // target audit URL
  items: Array<Record<string, any>>;
  scoring_rubric?: any[];
  signal?: AbortSignal;
  onEvent: (evt: SseEvent) => void;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function buildFunctionUrl(fnName: string): string {
  if (PROJECT_URL) return `${PROJECT_URL.replace(/\/$/, '')}/functions/v1/${fnName}`;
  if (PROJECT_ID) return `https://${PROJECT_ID}.supabase.co/functions/v1/${fnName}`;
  throw new Error('Supabase project URL not configured');
}

/**
 * Stream the `audit-matrice` edge function with SSE.
 * Resolves once the stream finishes (either `complete` event or AbortError).
 */
export async function streamAuditMatrice(opts: StreamMatriceOptions): Promise<void> {
  const { onEvent, signal, ...payload } = opts;

  // Pull the live access token (may be null for anon callers)
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || ANON_KEY || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    ...(ANON_KEY ? { apikey: ANON_KEY } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const resp = await fetch(buildFunctionUrl('audit-matrice'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    let errMsg = `audit-matrice HTTP ${resp.status}`;
    try {
      const txt = await resp.text();
      if (txt) errMsg += `: ${txt.slice(0, 300)}`;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split SSE messages (separated by blank line)
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const rawMsg = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        const evt = parseSseMessage(rawMsg);
        if (evt) onEvent(evt);
      }
    }

    // Flush any trailing partial message
    if (buffer.trim()) {
      const evt = parseSseMessage(buffer);
      if (evt) onEvent(evt);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

function parseSseMessage(raw: string): SseEvent | null {
  let event: SseEventName = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).replace(/^\s/, '');
    if (field === 'event') event = val;
    else if (field === 'data') dataLines.push(val);
  }
  if (!dataLines.length) return null;
  const dataStr = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return { event, data: dataStr };
  }
}
