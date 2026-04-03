import { getServiceClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
/**
 * Fetches monthly market data.
 * TODO: Replace with real API calls (SimilarWeb, StatCounter, etc.)
 * Currently returns slightly varied simulated data.
 */
async function fetchMonthlyMarketData(): Promise<{
  intent_rates: Record<string, number>;
  llm_shares: Record<string, number>;
}> {
  // In production, this would call external data APIs.
  // For now, apply small random variations to simulate monthly drift.
  const baseIntentRates = { informational: 0.25, commercial: 0.12, local: 0.03, default: 0.05 };
  const baseLlmShares = { ChatGPT: 0.25, Perplexity: 0.06, Gemini: 0.12, Google_AI: 0.55, Grok: 0.02 };

  const jitter = (val: number, range: number) => {
    const delta = (Math.random() - 0.5) * 2 * range;
    return Math.round((val + delta) * 1000) / 1000;
  };

  const intent_rates: Record<string, number> = {};
  for (const [k, v] of Object.entries(baseIntentRates)) {
    intent_rates[k] = Math.max(0.01, jitter(v, 0.02));
  }

  const llm_shares: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of Object.entries(baseLlmShares)) {
    const val = Math.max(0.01, jitter(v, 0.03));
    llm_shares[k] = val;
    total += val;
  }
  // Normalize to sum to 1
  for (const k of Object.keys(llm_shares)) {
    llm_shares[k] = Math.round((llm_shares[k] / total) * 100) / 100;
  }

  return { intent_rates, llm_shares };
}

Deno.serve(handleRequest(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const newData = await fetchMonthlyMarketData();

    const { error } = await supabase
      .from('market_trends')
      .update({
        intent_rates: newData.intent_rates,
        llm_shares: newData.llm_shares,
        updated_at: new Date().toISOString(),
      })
      .eq('market_region', 'FR');

    if (error) throw error;

    console.log('✅ Market trends FR updated:', JSON.stringify(newData));

    return jsonOk({ success: true, message: 'Tendances FR mises à jour.', data: newData });
  } catch (error) {
    console.error('update-market-trends error:', error);
    return jsonOk({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400);
  }
}));