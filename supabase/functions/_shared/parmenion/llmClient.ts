/**
 * parmenion/llmClient.ts — LLM call wrapper with retry & fallback strategy.
 * Extracted from parmenion-orchestrator for reusability.
 */

export async function callLLMWithTools(
  apiKey: string,
  prompt: string,
  tools: any[],
  model = 'google/gemini-2.5-flash',
): Promise<any[]> {
  const attempts: Array<{ model: string; toolChoice: string; temp: number }> = [
    { model, toolChoice: 'required', temp: 0.2 },
    { model, toolChoice: 'auto', temp: 0.3 },
  ];
  if (model !== 'google/gemini-2.5-flash') {
    attempts.push({ model: 'google/gemini-2.5-flash', toolChoice: 'required', temp: 0.3 });
  }
  
  for (let i = 0; i < attempts.length; i++) {
    const { model: currentModel, toolChoice, temp } = attempts[i];
    const timeout = currentModel.includes('pro') ? 120_000 : 90_000;
    
    try {
      if (i > 0) {
        console.log(`[Parménion] 🔄 Retry ${i}/${attempts.length - 1}: model=${currentModel}, tool_choice=${toolChoice}`);
      }
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
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
        console.error(`[Parménion] LLM error ${response.status}:`, err.slice(0, 300));
        // 402 = credits exhausted — abort immediately, no retry will fix it
        if (response.status === 402) {
          throw new Error('LLM_CREDITS_EXHAUSTED');
        }
        continue;
      }

      const result = await response.json();
      const message = result.choices?.[0]?.message;
      const toolCalls = message?.tool_calls || [];
      
      if (toolCalls.length === 0) {
        const textContent = message?.content || '';
        console.warn(`[Parménion] ⚠️ 0 tool calls (model: ${currentModel}, choice: ${toolChoice}, attempt: ${i + 1}). finish_reason: ${result.choices?.[0]?.finish_reason}. Text: ${textContent.slice(0, 200)}${textContent.length > 200 ? '…' : ''}`);
        continue;
      }
      
      if (i > 0) {
        console.log(`[Parménion] ✅ Retry ${i} succeeded (${currentModel}, ${toolChoice}): ${toolCalls.length} tool calls`);
      }
      
      return toolCalls.map((tc: any) => ({
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string' 
          ? JSON.parse(tc.function.arguments) 
          : tc.function.arguments,
      }));
    } catch (e) {
      console.error(`[Parménion] LLM failed (${currentModel}, attempt ${i + 1}):`, e);
      continue;
    }
  }
  
  console.error(`[Parménion] ❌ All ${attempts.length} LLM attempts failed for tool calls`);
  return [];
}
