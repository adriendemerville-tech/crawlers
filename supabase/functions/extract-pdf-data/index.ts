import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackTokenUsage, trackPaidApiCall } from "../_shared/tokenTracker.ts";
import { callOpenRouter } from '../_shared/openRouterAI.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: extract-pdf-data
 * 
 * Purpose: Import third-party SaaS data (SEMrush, Ahrefs, Sistrix, etc.)
 * and produce calibration signals for the prediction algorithm.
 *
 * Workflow:
 * 1. Download file from storage
 * 2. Send to Claude (via OpenRouter) with domain context
 * 3. Claude compiles, cleans, and structures the data
 * 4. Produces calibration signals to refine prediction algorithm
 * 5. Stores calibration data in pdf_audits.extracted_data
 */
Deno.serve(handleRequest(async (req) => {
try {
    const { audit_id } = await req.json();
    if (!audit_id) {
      return jsonError('audit_id is required', 400);
    }

    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openrouterKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const supabase = getServiceClient();

    // 1. Get record
    const { data: audit, error: auditError } = await supabase
      .from('pdf_audits')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (auditError || !audit) {
      throw new Error(`Record not found: ${auditError?.message}`);
    }

    const metadata = audit.extracted_data as Record<string, any> || {};
    const dataSource = metadata._source || 'unknown';
    const targetDomain = metadata._target_domain || '';
    const contextNotes = metadata._context_notes || '';

    // 2. Update status to processing
    await supabase.from('pdf_audits').update({ status: 'processing' }).eq('id', audit_id);

    // 3. Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdf-audits')
      .download(audit.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 4. Convert file to text/base64 depending on type
    let fileContent: string;
    const fileName = metadata._original_name || audit.file_path;
    const isTextBased = /\.(csv|json|txt|tsv)$/i.test(fileName);

    if (isTextBased) {
      fileContent = await fileData.text();
      // Truncate very large files to avoid token limits
      if (fileContent.length > 50000) {
        fileContent = fileContent.substring(0, 50000) + '\n\n[... TRUNCATED — first 50k chars shown ...]';
      }
    } else {
      // PDF/Excel → base64 for multimodal
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fileContent = btoa(binary);
    }

    // 5. Build Claude prompt for data compilation & calibration
    const systemPrompt = `Tu es un Data Scientist SEO senior spécialisé dans la calibration d'algorithmes de prédiction de trafic.

CONTEXTE :
- Un administrateur importe des données provenant d'un SaaS tiers (${dataSource}) pour le domaine "${targetDomain}".
- Ces données SONT DES DONNÉES RÉELLES (pas un audit interne) et doivent être utilisées pour AFFINER l'algorithme de prédiction de trafic.
${contextNotes ? `- Notes de contexte : ${contextNotes}` : ''}

TA MISSION (en 3 étapes) :

## ÉTAPE 1 — COMPILATION & NETTOYAGE
- Extrais toutes les données structurées du fichier (mots-clés, volumes, positions, trafic, backlinks…)
- Nettoie les anomalies : doublons, outliers, données incohérentes
- Normalise les formats (volumes arrondis, positions entières)

## ÉTAPE 2 — ANALYSE CROISÉE
- Identifie les patterns : distribution des positions, clusters sémantiques, ratio brand/non-brand
- Compare avec les benchmarks sectoriels standards
- Détecte les incohérences potentielles entre les données tiers et nos propres analyses

## ÉTAPE 3 — SIGNAUX DE CALIBRATION (PRUDENCE MAXIMALE)
Produis des signaux de calibration pour l'algorithme de prédiction avec une PRUDENCE EXTRÊME :
- Tout ajustement doit être CONSERVATEUR (max ±10% sur un paramètre)
- Justifie chaque ajustement par des données factuelles
- En cas de doute, privilégie TOUJOURS le statu quo

Retourne UNIQUEMENT ce JSON (pas de blocs markdown, pas de texte autour) :
{
  "compiled_data": {
    "total_keywords": <int>,
    "avg_volume": <int>,
    "avg_difficulty": <number 0-100>,
    "top_keywords": [{"keyword": "<str>", "volume": <int>, "position": <int|null>, "difficulty": <number>}],
    "traffic_estimate": <int ou null>,
    "backlinks_count": <int ou null>,
    "referring_domains": <int ou null>,
    "domain_rating": <number ou null>
  },
  "data_quality": {
    "completeness": <number 0-1>,
    "anomalies_detected": <int>,
    "anomalies_details": ["<description>"],
    "reliability_score": <number 0-100>
  },
  "calibration_signals": {
    "confidence_level": "high"|"medium"|"low",
    "keyword_benchmarks": {
      "total_keywords": <int>,
      "avg_volume": <int>,
      "brand_ratio": <number 0-1>,
      "high_intent_ratio": <number 0-1>
    },
    "ranking_distribution": {
      "top_3": <int>,
      "top_10": <int>,
      "top_20": <int>,
      "top_50": <int>,
      "beyond_50": <int>
    },
    "adjustments": [
      {
        "parameter": "<nom du paramètre de l'algo à ajuster>",
        "current_assumption": "<hypothèse actuelle>",
        "suggested_value": "<nouvelle valeur suggérée>",
        "delta_pct": <number — variation en %>,
        "impact": "high"|"medium"|"low",
        "evidence": "<preuve factuelle justifiant l'ajustement>",
        "description": "<description lisible>"
      }
    ],
    "sector_signals": {
      "detected_sector": "<secteur détecté>",
      "competitiveness": "high"|"medium"|"low",
      "avg_cpc": <number ou null>
    },
    "summary": "<2-3 phrases résumant les conclusions et la confiance dans les ajustements>"
  }
}`;

    // 6. Call Claude via OpenRouter
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (isTextBased) {
      messages.push({
        role: 'user',
        content: `Voici les données exportées de ${dataSource} pour le domaine ${targetDomain} :\n\n${fileContent}`,
      });
    } else {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: `Analyse ce fichier exporté de ${dataSource} pour le domaine ${targetDomain}. Extrais et compile les données.` },
          {
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${fileContent}` },
          },
        ],
      });
    }

    const aiResp = await callOpenRouter({
      model: 'mistralai/mistral-large-latest',
      messages,
      referer: supabaseUrl,
    });

    const rawContent = aiResp.content;

    await trackTokenUsage('extract-pdf-data', 'mistralai/mistral-large-latest', aiResp.usage, targetDomain);
    trackPaidApiCall('extract-pdf-data', 'openrouter', 'mistralai/mistral-large-latest', targetDomain);

    // 7. Parse JSON
    const jsonMatch = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let extractedData: any;
    try {
      extractedData = JSON.parse(jsonMatch);
    } catch {
      throw new Error(`Failed to parse Claude response as JSON: ${rawContent.substring(0, 300)}`);
    }

    // 8. Validate calibration adjustments — enforce max ±10% delta
    if (extractedData.calibration_signals?.adjustments) {
      extractedData.calibration_signals.adjustments = extractedData.calibration_signals.adjustments
        .filter((adj: any) => {
          const delta = Math.abs(adj.delta_pct || 0);
          if (delta > 10) {
            console.warn(`[extract-pdf-data] Rejected adjustment "${adj.parameter}" — delta ${delta}% exceeds ±10% safety limit`);
            return false;
          }
          return true;
        });
    }

    // 9. Merge with original metadata and update
    const finalData = {
      ...metadata,
      ...extractedData,
      _processed_at: new Date().toISOString(),
      _data_source: dataSource,
      _target_domain: targetDomain,
    };

    const { error: updateError } = await supabase
      .from('pdf_audits')
      .update({
        extracted_data: finalData,
        status: 'processed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', audit_id);

    if (updateError) {
      throw new Error(`Failed to update record: ${updateError.message}`);
    }

    // 10. Update system metrics
    await supabase.rpc('recalculate_reliability');

    return jsonOk({
      success: true,
      calibration_signals: extractedData.calibration_signals,
      data_quality: extractedData.data_quality,
    });

  } catch (error) {
    console.error('extract-pdf-data error:', error);

    // Try to mark as error
    try {
      const body = await new Response(req.body).json().catch(() => ({}));
      if (body.audit_id) {
        const supabase = getServiceClient();
        await supabase.from('pdf_audits').update({ status: 'error', error_message: error.message }).eq('id', body.audit_id);
      }
    } catch {}

    return jsonError(error.message, 500);
  }
}));