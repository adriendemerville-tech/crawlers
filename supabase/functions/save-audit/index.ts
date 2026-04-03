import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

// 💰 CONFIGURATION DU PRICING (Source of Truth)
// Identique à la logique frontend dans SmartConfigurator/index.tsx
const MIN_PRICE = 3.00;  // 3€ (300 centimes) - Base avec fixes basiques
const MAX_PRICE = 12.00; // 12€ (1200 centimes) - Tous les fixes avancés
const PRICE_RANGE = MAX_PRICE - MIN_PRICE; // 9€ range

interface FixMetadata {
  id: string;
  label: string;
  category: string;
}

/**
 * Calcule le prix dynamique basé sur les types de fixes sélectionnés
 * IDENTIQUE à la logique frontend pour garantir la cohérence du prix affiché
 * 
 * @param fixesMetadata - Liste des fixes activés avec leur catégorie
 * @param totalAdvancedFixes - Nombre total de fixes avancés disponibles (strategic + generative)
 */
function calculateDynamicPrice(fixesMetadata: FixMetadata[], totalAdvancedFixes: number): number {
  // Compter les fixes avancés ACTIVÉS (strategic + generative)
  const enabledStrategic = fixesMetadata.filter(f => f.category === 'strategic').length;
  const enabledGenerative = fixesMetadata.filter(f => f.category === 'generative').length;
  const enabledAdvanced = enabledStrategic + enabledGenerative;
  
  // Si aucun fix avancé disponible ou activé, prix minimum
  if (totalAdvancedFixes === 0 || enabledAdvanced === 0) {
    console.log(`💰 Aucun fix avancé activé, prix minimum: ${MIN_PRICE}€`);
    return MIN_PRICE;
  }
  
  // Calcul du pourcentage de fixes avancés activés (identique au frontend)
  const advancedPercent = enabledAdvanced / totalAdvancedFixes;
  
  // Prix = 3€ base + jusqu'à 9€ pour les fonctionnalités avancées
  const rawPrice = MIN_PRICE + (PRICE_RANGE * advancedPercent);
  
  // Arrondi dynamique identique au frontend
  const dynamicIncrement = PRICE_RANGE / totalAdvancedFixes;
  const increment = Math.max(0.10, dynamicIncrement);
  const price = Math.round(rawPrice / increment) * increment;
  
  console.log(`💰 Fixes avancés activés: ${enabledAdvanced}/${totalAdvancedFixes} (strategic: ${enabledStrategic}, generative: ${enabledGenerative})`);
  console.log(`💰 Pourcentage: ${(advancedPercent * 100).toFixed(0)}% → Prix: ${price.toFixed(2)}€ (${Math.round(price * 100)} centimes)`);
  
  return price;
}

Deno.serve(handleRequest(async (req) => {
try {
    const { 
      url, 
      domain, 
      sector = 'default',
      fixes_count = 0,
      fixes_metadata = [],
      total_advanced_fixes = 0,
      audit_data = null,
      generated_code = null,
      user_id = null
    } = await req.json();

    // Validation
    if (!url || !domain) {
      return jsonError("url and domain are required", 400);
    }

    console.log(`📝 Saving audit for: ${url}`);
    console.log(`   Domain: ${domain}, Fixes: ${fixes_count}, Total Advanced: ${total_advanced_fixes}`);

    // 1️⃣ CALCUL DU PRIX DYNAMIQUE basé sur les fixes sélectionnés
    // Utilise la même logique que le frontend pour garantir la cohérence
    const dynamicPrice = calculateDynamicPrice(
      fixes_metadata as FixMetadata[], 
      total_advanced_fixes
    );

    // Initialize Supabase client with service role (bypasses RLS)
    const supabase = getServiceClient();

    // 2️⃣ INSERT OR UPDATE l'audit dans la table
    const { data: existingAudit } = await supabase
      .from("audits")
      .select("id")
      .eq("url", url)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let auditId: string;

    if (existingAudit) {
      // UPDATE existing audit
      console.log(`📝 Updating existing audit: ${existingAudit.id}`);
      
      const { data: updatedAudit, error: updateError } = await supabase
        .from("audits")
        .update({
          domain,
          sector,
          dynamic_price: dynamicPrice,
          fixes_count,
          fixes_metadata,
          audit_data,
          generated_code,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingAudit.id)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Error updating audit:", updateError);
        throw updateError;
      }

      auditId = updatedAudit.id;
      console.log(`✅ Audit updated: ${auditId} → ${dynamicPrice.toFixed(2)}€`);
    } else {
      // INSERT new audit
      const { data: newAudit, error: insertError } = await supabase
        .from("audits")
        .insert({
          url,
          domain,
          user_id,
          sector,
          dynamic_price: dynamicPrice,
          fixes_count,
          fixes_metadata,
          audit_data,
          generated_code,
          payment_status: "pending"
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error creating audit:", insertError);
        throw insertError;
      }

      auditId = newAudit.id;
      console.log(`✅ New audit created: ${auditId} → ${dynamicPrice.toFixed(2)}€`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          audit_id: auditId,
          url,
          domain,
          sector,
          dynamic_price: dynamicPrice,
          fixes_count,
          payment_status: "pending"
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ save-audit error:", errorMessage);
    return jsonError(errorMessage, 500);
  }
}));