/**
 * Streaming helpers — Sprint 1 S1.1.
 *
 * Parseur SSE OpenAI-compat + writer d'événements applicatifs consommés par
 * `useCopilot.sendMessageStream` côté front.
 *
 * Format événements applicatifs (SSE nommés) :
 *   event: iteration        data: { "n": 1 }
 *   event: token            data: { "text": "..." }
 *   event: tool_call        data: { "skill": "read_site", "input": {...} }
 *   event: tool_result      data: { "skill": "...", "status": "success"|"error"|"rejected"|"awaiting_approval", "action_id"?: "..." }
 *   event: awaiting_approval data: { "action_id": "...", "skill": "...", "input": {...} }
 *   event: final            data: { "session_id":..., "reply":..., "actions":[...], "awaiting_approvals":[...], "iterations": N }
 *   event: error            data: { "message": "..." }
 */

export interface OpenAIStreamDelta {
  content?: string;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    type?: 'function';
    function?: { name?: string; arguments?: string };
  }>;
}

export interface OpenAIStreamChunk {
  choices?: Array<{
    index?: number;
    delta?: OpenAIStreamDelta;
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_creation_tokens?: number };
  };
}

/**
 * Itère sur une Response SSE OpenAI-compat en yieldant chaque frame parsé.
 * Ignore silencieusement `data: [DONE]` et les lignes non-JSON.
 */
export async function* parseSseStream(resp: Response): AsyncGenerator<OpenAIStreamChunk> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Frames séparés par \n\n
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of frame.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            yield JSON.parse(payload) as OpenAIStreamChunk;
          } catch { /* ignore malformed */ }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

/** Fusionne les deltas OpenAI en un message final { content, tool_calls, usage }. */
export interface AggregatedMessage {
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  finish_reason?: string;
  usage?: OpenAIStreamChunk['usage'];
}

export function createStreamAggregator(onTextDelta?: (text: string) => void) {
  let content = '';
  const toolCallsByIndex = new Map<number, { id: string; name: string; args: string }>();
  let finish_reason: string | undefined;
  let usage: OpenAIStreamChunk['usage'] | undefined;

  function ingest(chunk: OpenAIStreamChunk): void {
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finish_reason = choice.finish_reason;
    const delta = choice.delta;
    if (!delta) return;
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      content += delta.content;
      onTextDelta?.(delta.content);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const prev = toolCallsByIndex.get(idx) ?? { id: '', name: '', args: '' };
        if (tc.id) prev.id = tc.id;
        if (tc.function?.name) prev.name = tc.function.name;
        if (tc.function?.arguments) prev.args += tc.function.arguments;
        toolCallsByIndex.set(idx, prev);
      }
    }
  }

  function finalize(): AggregatedMessage {
    const tool_calls = Array.from(toolCallsByIndex.entries())
      .sort(([a], [b]) => a - b)
      .map(([, tc]) => ({
        id: tc.id || `stream_${Math.random().toString(36).slice(2, 12)}`,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.args || '{}' },
      }))
      .filter((t) => t.function.name);
    return {
      content: content.length > 0 ? content : null,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
      finish_reason,
      usage,
    };
  }

  return { ingest, finalize };
}

// ═══════════════════════════════════════════════════════════
// SSE Writer applicatif (event: nom + data: JSON)
// ═══════════════════════════════════════════════════════════
export function createSseWriter() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
    cancel() { closed = true; },
  });

  function write(event: string, data: unknown): void {
    if (closed) return;
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch { closed = true; }
  }
  function close(): void {
    if (closed) return;
    closed = true;
    try { controller.close(); } catch { /* noop */ }
  }
  function isClosed(): boolean { return closed; }

  return { stream, write, close, isClosed };
}
