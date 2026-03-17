import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';

interface ArchiveRequest {
  code: string;
  fixes: Array<{
    id: string;
    label: string;
    category: string;
    priority?: string;
  }>;
  siteName: string;
  siteUrl: string;
  technologyContext?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, fixes, siteName, siteUrl, technologyContext = '' }: ArchiveRequest = await req.json();

    // Seuil minimum : 3 fixes activés pour archiver
    if (!code || !fixes || fixes.length < 3) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, error: 'Minimum 3 fixes required for archiving' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Étape 1: Anonymiser le code via IA
    let genericCode = code;
    
    if (LOVABLE_API_KEY) {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { 
                role: 'system', 
                content: `Tu es un expert en anonymisation de code JavaScript. Tu dois :
1. Remplacer tous les noms de domaine spécifiques par des placeholders génériques (ex: "example.com")
2. Remplacer les clés API, tokens, et identifiants par des placeholders (ex: "YOUR_API_KEY")
3. Remplacer les noms de marque spécifiques par des variables génériques (ex: "SITE_NAME")
4. Conserver la logique et la structure intactes
5. Répondre UNIQUEMENT avec le code anonymisé, sans markdown ni explication.` 
              },
              { 
                role: 'user', 
                content: `Anonymise ce script JavaScript correctif pour le rendre générique et réutilisable :\n\n${code}` 
              }
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let content = data.choices?.[0]?.message?.content;
          if (content) {
            if (content.includes('```')) {
              content = content.replace(/```(?:javascript|js)?\n?/g, '').replace(/```/g, '').trim();
            }
            genericCode = content;
            console.log('✅ Code anonymisé par IA');
          }
        }
      } catch (error) {
        console.error('⚠️ Anonymisation IA échouée, archivage du code tel quel:', error);
      }
    }

    // Étape 2: Dédoublonnage + archivage avec is_generic = false (en attente de validation)
    let archived = 0;
    let updated = 0;
    
    for (const fix of fixes) {
      // Vérifier si une solution existe déjà pour ce error_type + technology_context
      const { data: existing } = await supabase
        .from('solution_library')
        .select('id, usage_count, success_rate')
        .eq('error_type', fix.id)
        .eq('technology_context', technologyContext)
        .maybeSingle();

      if (existing) {
        // Dédoublonnage : juste incrémenter usage_count, pas de doublon
        await supabase
          .from('solution_library')
          .update({ 
            usage_count: (existing.usage_count || 0) + 1,
          })
          .eq('id', existing.id);
        updated++;
        console.log(`📈 Solution existante mise à jour (usage_count+1): ${fix.id}`);
      } else {
        // Nouvelle entrée avec is_generic = false (en attente de feedback utilisateur)
        await supabase
          .from('solution_library')
          .insert({
            error_type: fix.id,
            category: fix.category,
            label: fix.label,
            description: `Correctif ${fix.label} généré pour ${technologyContext || 'site générique'}`,
            technology_context: technologyContext,
            code_snippet: genericCode,
            success_rate: 0,
            usage_count: 1,
            is_generic: false,
          });
        archived++;
        console.log(`📚 Nouvelle solution archivée (is_generic=false): ${fix.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        archived,
        updated,
        message: `${archived} nouvelle(s) solution(s) en attente de validation, ${updated} mise(s) à jour`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error archiving solution:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
