import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function: extract-pdf-data
 * 
 * Workflow:
 * 1. Receives a pdf_audit ID
 * 2. Downloads the PDF from Supabase Storage
 * 3. Extracts raw text using pdf-parse
 * 4. Sends extracted text to Gemini for structured SEO data extraction
 * 5. Updates pdf_audits row with extracted_data JSON
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audit_id } = await req.json();
    if (!audit_id) {
      return new Response(JSON.stringify({ error: 'audit_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get audit record
    const { data: audit, error: auditError } = await supabase
      .from('pdf_audits')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (auditError || !audit) {
      throw new Error(`Audit not found: ${auditError?.message}`);
    }

    // 2. Update status to processing
    await supabase.from('pdf_audits').update({ status: 'processing' }).eq('id', audit_id);

    // 3. Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdf-audits')
      .download(audit.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }

    // 4. Convert PDF blob to base64 for Gemini multimodal processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // 5. Send to Gemini for structured extraction
    const systemPrompt = `You are an expert SEO/GEO auditor. Analyze this PDF audit report and extract the following structured data as JSON:
{
  "errors": <number of technical errors found>,
  "technical_score": <overall technical SEO score 0-100>,
  "geo_keywords": [<list of GEO-relevant keywords found>],
  "location_target": "<target location/region>",
  "page_speed_score": <page speed score if available, null otherwise>,
  "mobile_score": <mobile optimization score if available, null otherwise>,
  "backlinks_count": <number of backlinks if mentioned, null otherwise>,
  "domain_authority": <DA if mentioned, null otherwise>,
  "content_quality_score": <content quality assessment 0-100>,
  "structured_data_present": <boolean>,
  "summary": "<brief 2-sentence summary of the audit findings>"
}
Return ONLY valid JSON, no markdown fences, no extra text.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this SEO/GEO audit PDF and extract structured data.' },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${base64}` }
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        await supabase.from('pdf_audits').update({ status: 'pending', error_message: 'Rate limited, will retry' }).eq('id', audit_id);
        return new Response(JSON.stringify({ error: 'Rate limited, please retry later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error ${aiResponse.status}: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';

    // 6. Parse the JSON from Gemini response
    const jsonMatch = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let extractedData;
    try {
      extractedData = JSON.parse(jsonMatch);
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${rawContent.substring(0, 200)}`);
    }

    // 7. Update audit with extracted data
    const { error: updateError } = await supabase
      .from('pdf_audits')
      .update({
        extracted_data: extractedData,
        status: 'processed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', audit_id);

    if (updateError) {
      throw new Error(`Failed to update audit: ${updateError.message}`);
    }

    // 8. Update system metrics
    await supabase.rpc('recalculate_reliability');

    return new Response(JSON.stringify({ success: true, extracted_data: extractedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('extract-pdf-data error:', error);

    // Try to mark audit as error
    try {
      const { audit_id } = await new Response(req.body).json().catch(() => ({}));
      if (audit_id) {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await supabase.from('pdf_audits').update({ status: 'error', error_message: error.message }).eq('id', audit_id);
      }
    } catch {}

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
