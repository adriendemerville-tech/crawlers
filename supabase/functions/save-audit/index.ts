import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// 💰 CONFIGURATION DU PRICING (Source of Truth)
// Basé sur les types de fixes sélectionnés (strategic/generative augmentent le prix)
const MIN_PRICE = 3.00;  // 3€ (300 centimes) - Base avec fixes basiques
const MAX_PRICE = 12.00; // 12€ (1200 centimes) - Tous les fixes avancés

interface FixMetadata {
  id: string;
  label: string;
  category: string;
}

/**
 * Calcule le prix dynamique basé sur les types de fixes sélectionnés
 * Seuls les fixes 'strategic' et 'generative' augmentent le prix
 */
function calculateDynamicPrice(fixesMetadata: FixMetadata[]): number {
  const PRICE_RANGE = MAX_PRICE - MIN_PRICE; // 9€ range
  
  // Compter les fixes avancés (strategic + generative)
  const strategicFixes = fixesMetadata.filter(f => f.category === 'strategic');
  const generativeFixes = fixesMetadata.filter(f => f.category === 'generative');
  
  const enabledAdvanced = strategicFixes.length + generativeFixes.length;
  
  // Si aucun fix avancé, prix minimum
  if (enabledAdvanced === 0) {
    console.log(`💰 Aucun fix avancé, prix minimum: ${MIN_PRICE}€`);
    return MIN_PRICE;
  }
  
  // Estimation du nombre max de fixes avancés possibles (environ 8-10)
  const maxAdvancedFixes = 10;
  
  // Calcul du pourcentage de fixes avancés activés
  const advancedPercent = Math.min(enabledAdvanced / maxAdvancedFixes, 1);
  
  // Prix = 3€ base + jusqu'à 9€ pour les fonctionnalités avancées
  const rawPrice = MIN_PRICE + (PRICE_RANGE * advancedPercent);
  
  // Arrondir au 0.10€ près
  const price = Math.round(rawPrice * 10) / 10;
  
  console.log(`💰 Fixes avancés: ${enabledAdvanced} (strategic: ${strategicFixes.length}, generative: ${generativeFixes.length})`);
  console.log(`💰 Pourcentage avancé: ${(advancedPercent * 100).toFixed(0)}%`);
  console.log(`💰 Prix calculé: ${price}€ (${Math.round(price * 100)} centimes)`);
  
  return price;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      url, 
      domain, 
      sector = 'default',
      fixes_count = 0,
      fixes_metadata = [],
      audit_data = null,
      generated_code = null,
      user_id = null
    } = await req.json();

    // Validation
    if (!url || !domain) {
      return new Response(
        JSON.stringify({ error: "url and domain are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📝 Saving audit for: ${url}`);
    console.log(`   Domain: ${domain}, Fixes: ${fixes_count}`);
    console.log(`   Fixes metadata: ${JSON.stringify(fixes_metadata)}`);

    // 1️⃣ CALCUL DU PRIX DYNAMIQUE basé sur les fixes sélectionnés
    const dynamicPrice = calculateDynamicPrice(fixes_metadata as FixMetadata[]);

    // Initialize Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2️⃣ INSERT OR UPDATE l'audit dans la table
    // Vérifie si un audit existe déjà pour cette URL + user
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
      console.log(`✅ Audit updated: ${auditId} with price ${dynamicPrice}€`);
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
      console.log(`✅ New audit created: ${auditId} with price ${dynamicPrice}€`);
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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
