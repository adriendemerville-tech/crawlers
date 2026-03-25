import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { audio_base64, site_id, domain, current_fields } = await req.json()

    if (!audio_base64 || !site_id) {
      return new Response(JSON.stringify({ error: 'Missing audio or site_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')

    // Step 1: Transcribe audio using Gemini (multimodal)
    const transcriptionResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Tu es un transcripteur audio expert. Transcris fidèlement le contenu audio en texte français. Retourne UNIQUEMENT le texte transcrit, rien d\'autre.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: audio_base64,
                  format: 'wav'
                }
              },
              {
                type: 'text',
                text: 'Transcris cet audio en français.'
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    })

    let transcript = ''
    if (transcriptionResp.ok) {
      const tData = await transcriptionResp.json()
      transcript = tData.choices?.[0]?.message?.content || ''
    }

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'Transcription failed', enriched_fields: {} }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[voice-identity] Transcript for ${domain}: "${transcript.slice(0, 100)}..."`)

    // Step 2: Extract taxonomy from transcript
    const extractionResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Tu es un analyste business expert. À partir d'une transcription vocale d'un utilisateur décrivant son entreprise, extrais les informations structurées suivantes au format JSON.

Contexte actuel de l'entreprise (domaine: ${domain}):
${JSON.stringify(current_fields, null, 2)}

IMPORTANT: Ne retourne QUE les champs que tu peux déduire de la transcription. Ne modifie pas les champs déjà bien renseignés sauf si l'utilisateur les corrige explicitement.

Champs possibles:
- market_sector: secteur d'activité
- products_services: produits/services vendus
- target_audience: audience cible
- commercial_area: zone géographique
- company_size: taille de l'entreprise
- short_term_goal: objectif business court terme
- mid_term_goal: objectif business moyen terme
- main_serp_competitor: concurrent SERP principal
- confusion_risk: risques de confusion (avec qui/quoi ne pas confondre)
- business_type: type de business (SaaS, e-commerce, local, etc.)

Réponds UNIQUEMENT en JSON valide.`
          },
          {
            role: 'user',
            content: `Transcription de l'utilisateur:\n"${transcript}"`
          }
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    })

    let enrichedFields: Record<string, string> = {}
    if (extractionResp.ok) {
      const eData = await extractionResp.json()
      const content = eData.choices?.[0]?.message?.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          enrichedFields = JSON.parse(jsonMatch[0])
        } catch { /* ignore parse error */ }
      }
    }

    // Step 3: Persist to tracked_sites (only known DB columns)
    const dbColumns = ['market_sector', 'products_services', 'target_audience', 'commercial_area', 'company_size', 'business_type', 'short_term_goal', 'mid_term_goal', 'main_serp_competitor', 'confusion_risk']
    const updatePayload: Record<string, string> = {}
    for (const col of dbColumns) {
      if (enrichedFields[col]) {
        updatePayload[col] = enrichedFields[col]
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const sb = getServiceClient()

      const { error } = await sb
        .from('tracked_sites')
        .update({ ...updatePayload, identity_source: 'user_voice', identity_enriched_at: new Date().toISOString() })
        .eq('id', site_id)

      if (error) console.error('[voice-identity] DB update error:', error)
      else console.log(`[voice-identity] Updated ${domain} with fields:`, Object.keys(updatePayload))
    }

    return new Response(JSON.stringify({
      success: true,
      transcript,
      enriched_fields: enrichedFields,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[voice-identity] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
