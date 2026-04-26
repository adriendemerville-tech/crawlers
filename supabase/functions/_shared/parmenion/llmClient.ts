/**
 * parmenion/llmClient.ts — LLM call wrapper with retry & fallback strategy.
 * Priority: OpenRouter (primary) → Lovable AI Gateway (fallback).
 */

interface Gateway {
  url: string;
  key: string;
  label: string;
}

function getGateways(): Gateway[] {
  const gateways: Gateway[] = [];
  const orKey = Deno.env.get('OPENROUTER_API_KEY');
  if (orKey) {
    gateways.push({ url: 'https://openrouter.ai/api/v1/chat/completions', key: orKey, label: 'OpenRouter' });
  }
  const lovKey = Deno.env.get('LOVABLE_API_KEY');
  if (lovKey) {
    gateways.push({ url: 'https://ai.gateway.lovable.dev/v1/chat/completions', key: lovKey, label: 'Lovable' });
  }
  return gateways;
}

export async function callLLMWithTools(
  _apiKey: string,
  prompt: string,
  tools: any[],
  model = 'google/gemini-2.5-flash',
): Promise<any[]> {
  const gateways = getGateways();
  if (gateways.length === 0) {
    console.error('[Parménion] ❌ No LLM gateway configured (OPENROUTER_API_KEY / LOVABLE_API_KEY)');
    return [];
  }

  for (const gw of gateways) {
    const attempts: Array<{ model: string; toolChoice: string; temp: number }> = [
      { model, toolChoice: 'required', temp: 0.2 },
      { model, toolChoice: 'auto', temp: 0.3 },
    ];
    if (model !== 'google/gemini-3-flash-preview') {
      attempts.push({ model: 'google/gemini-3-flash-preview', toolChoice: 'required', temp: 0.3 });
      attempts.push({ model: 'google/gemini-2.5-flash', toolChoice: 'required', temp: 0.3 });
    }

    let gatewayFailed = false;

    for (let i = 0; i < attempts.length; i++) {
      const { model: currentModel, toolChoice, temp } = attempts[i];
      const timeout = currentModel.includes('pro') ? 120_000 : 90_000;

      try {
        if (i > 0 || gw.label !== gateways[0].label) {
          console.log(`[Parménion] 🔄 ${gw.label} attempt ${i + 1}/${attempts.length}: model=${currentModel}, tool_choice=${toolChoice}`);
        }

        const response = await fetch(gw.url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gw.key}`,
            'Content-Type': 'application/json',
            ...(gw.label === 'OpenRouter' ? { 'HTTP-Referer': 'https://crawlers.fr', 'X-Title': 'Crawlers Parmenion' } : {}),
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: temp,
            tools,
            tool_choice: toolChoice,
          }),
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error(`[Parménion] ${gw.label} error ${response.status}:`, err.slice(0, 300));
          // 402/429 on this gateway → try next gateway
          if (response.status === 402 || response.status === 429) {
            console.warn(`[Parménion] ${gw.label} ${response.status} — switching to next gateway`);
            gatewayFailed = true;
            break;
          }
          continue;
        }

        const result = await response.json();
        const message = result.choices?.[0]?.message;
        const toolCalls = message?.tool_calls || [];

        if (toolCalls.length === 0) {
          const textContent = message?.content || '';
          console.warn(`[Parménion] ⚠️ 0 tool calls (${gw.label}, ${currentModel}, ${toolChoice}, attempt ${i + 1}). finish_reason: ${result.choices?.[0]?.finish_reason}. Text: ${textContent.slice(0, 200)}${textContent.length > 200 ? '…' : ''}`);
          continue;
        }

        if (i > 0 || gw.label !== gateways[0].label) {
          console.log(`[Parménion] ✅ ${gw.label} succeeded (${currentModel}, ${toolChoice}): ${toolCalls.length} tool calls`);
        }

        return toolCalls.map((tc: any) => ({
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments,
        }));
      } catch (e) {
        console.error(`[Parménion] ${gw.label} failed (${currentModel}, attempt ${i + 1}):`, e);
        if (e instanceof Error && e.name === 'TimeoutError') {
          gatewayFailed = true;
          break;
        }
        continue;
      }
    }

    if (!gatewayFailed) {
      // All attempts failed on this gateway without a hard failure — still try next
      console.warn(`[Parménion] ${gw.label}: all ${attempts.length} attempts exhausted, trying next gateway`);
    }
  }

  console.error(`[Parménion] ❌ All gateways exhausted — no tool calls produced`);
  return [];
}
