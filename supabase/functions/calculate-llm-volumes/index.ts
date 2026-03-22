import { corsHeaders } from '../_shared/cors.ts';
import { getUserClient } from '../_shared/supabaseClient.ts'
const INFORMATIONAL_KEYWORDS = ['comment', 'pourquoi', 'idées', 'quel', 'quelle', 'différence', 'how', 'why', 'what', 'which', 'ideas'];
const COMMERCIAL_KEYWORDS = ['prix', 'coût', 'devis', 'tarif', 'combien', 'price', 'cost', 'quote', 'pricing'];
const LOCAL_KEYWORDS = ['près de', 'autour de', 'entreprise', 'spécialiste', 'artisan', 'ville', 'near', 'around', 'local', 'nearby'];

function detectIntent(keyword: string): string {
  const lower = keyword.toLowerCase();
  if (INFORMATIONAL_KEYWORDS.some(k => lower.includes(k))) return 'informational';
  if (COMMERCIAL_KEYWORDS.some(k => lower.includes(k))) return 'commercial';
  if (LOCAL_KEYWORDS.some(k => lower.includes(k))) return 'local';
  return 'default';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyword, global_volume, keywords } = await req.json();

    // Support both single keyword and batch mode
    const isBatch = Array.isArray(keywords) && keywords.length > 0;

    if (!isBatch && (!keyword || global_volume == null)) {
      return new Response(
        JSON.stringify({ success: false, error: 'keyword and global_volume are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch market trends
    const { data: trends, error: dbError } = await supabase
      .from('market_trends')
      .select('intent_rates, llm_shares')
      .eq('market_region', 'FR')
      .single();

    if (dbError || !trends) {
      throw new Error('Failed to fetch market trends: ' + (dbError?.message || 'no data'));
    }

    const { intent_rates, llm_shares } = trends;

    const computeVolumes = (kw: string, vol: number) => {
      const intent = detectIntent(kw);
      const penetrationRate = (intent_rates as Record<string, number>)[intent] ?? intent_rates.default ?? 0.05;
      const totalLlmVolume = vol * penetrationRate;

      const breakdown: Record<string, number> = {};
      for (const [llm, share] of Object.entries(llm_shares as Record<string, number>)) {
        breakdown[llm] = Math.round(totalLlmVolume * share);
      }

      return {
        keyword: kw,
        intent,
        penetration_rate: penetrationRate,
        global_volume: vol,
        total_llm_volume: Math.round(totalLlmVolume),
        breakdown,
      };
    };

    if (isBatch) {
      const results = keywords.map((item: { keyword: string; global_volume: number }) =>
        computeVolumes(item.keyword, item.global_volume)
      );
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = computeVolumes(keyword, global_volume);
    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('calculate-llm-volumes error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
