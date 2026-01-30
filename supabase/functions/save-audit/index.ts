import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// 💰 CONFIGURATION DU PRICING (Source of Truth)
const BASE_PRICE = 10.00; // 10€
const FLOOR_PRICE = 2.00; // 2€ (Min)
const CAP_PRICE = 19.00;  // 19€ (Max)

// Facteurs de pondération par secteur (0.2 à 1.9)
const SECTOR_FACTORS: Record<string, number> = {
  'personal': 0.2,       // -> 2€
  'blog': 0.3,           // -> 3€
  'association': 0.4,    // -> 4€
  'local_business': 0.8, // -> 8€
  'consulting': 1.2,     // -> 12€
  'startup': 1.5,        // -> 15€
  'ecommerce': 1.8,      // -> 18€
  'finance': 1.9,        // -> 19€
  'default': 1.0         // -> 10€
};

/**
 * Calcule le prix dynamique basé sur le secteur et les correctifs
 */
function calculateDynamicPrice(sector: string, fixesCount: number): number {
  const factor = SECTOR_FACTORS[sector] || SECTOR_FACTORS['default'];
  
  // Calcul brut basé sur le secteur
  let price = BASE_PRICE * factor;
  
  // Bonus/malus basé sur le nombre de correctifs (optionnel)
  // +5% par tranche de 5 correctifs au-delà de 10
  if (fixesCount > 10) {
    const extraFixes = fixesCount - 10;
    const bonus = Math.floor(extraFixes / 5) * 0.05;
    price *= (1 + bonus);
  }
  
  // Arrondir à 2 décimales
  price = Math.round(price * 100) / 100;
  
  // Application des bornes (Clamping)
  if (price < FLOOR_PRICE) price = FLOOR_PRICE;
  if (price > CAP_PRICE) price = CAP_PRICE;
  
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
    console.log(`   Sector: ${sector}, Fixes: ${fixes_count}`);

    // 1️⃣ CALCUL DU PRIX DYNAMIQUE (côté serveur uniquement)
    const dynamicPrice = calculateDynamicPrice(sector, fixes_count);
    console.log(`💰 Calculated price: ${dynamicPrice}€`);

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
      console.log(`✅ Audit updated: ${auditId}`);
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
      console.log(`✅ New audit created: ${auditId}`);
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
