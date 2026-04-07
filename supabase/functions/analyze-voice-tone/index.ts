import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * analyze-voice-tone — Analyse tonale d'un ensemble de pages crawlées
 * 
 * Modes:
 * 1. "analyze_pages" — Analyse le ton de chaque page d'un crawl, stocke dans crawl_pages.tone_analysis
 * 2. "consolidate" — Consolide le Voice DNA d'un site à partir de ses crawls
 * 
 * Appelé après la finalisation d'un crawl (process-crawl-queue).
 */

interface ToneResult {
  register: 'formel' | 'informel' | 'mixte';
  formality_score: number; // 0-100
  posture: 'pedagogique' | 'commercial' | 'expert' | 'pair' | 'autoritaire' | 'narratif';
  addressing: 'tutoiement' | 'vouvoiement' | 'impersonnel' | 'mixte';
  sentence_style: 'courtes' | 'longues' | 'mixtes';
  lexical_density: 'simple' | 'technique' | 'jargon' | 'mixte';
  emotional_tone: 'neutre' | 'enthousiaste' | 'urgent' | 'rassurant' | 'provocateur';
  confidence: number; // 0-100
}

interface VoiceDNA {
  dominant_register: string;
  dominant_posture: string;
  dominant_addressing: string;
  sentence_style: string;
  lexical_density: string;
  emotional_tone: string;
  consistency_score: number;
  inconsistencies: { url: string; field: string; expected: string; found: string }[];
  sample_excerpts: string[];
  tone_overrides: Record<string, Partial<ToneResult>>; // per page_type
  last_analyzed_at: string;
}

Deno.serve(handleRequest(async (req) => {
  const supabase = getServiceClient();
  const { mode, crawl_id, tracked_site_id, domain } = await req.json();

  if (mode === 'analyze_pages') {
    if (!crawl_id) return jsonError('crawl_id required', 400);

    // Get pages with body text
    const { data: pages, error } = await supabase
      .from('crawl_pages')
      .select('id, url, path, title, h1, meta_description, body_text_truncated, word_count')
      .eq('crawl_id', crawl_id)
      .gt('word_count', 50) // Skip very thin pages
      .limit(30); // Limit to control LLM costs

    if (error || !pages?.length) {
      return jsonOk({ success: true, analyzed: 0, message: 'No pages with sufficient content' });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return jsonError('LOVABLE_API_KEY missing', 500);

    let analyzed = 0;

    // Process in batches of 5
    for (let i = 0; i < pages.length; i += 5) {
      const batch = pages.slice(i, i + 5);
      
      const batchPrompt = batch.map((p, idx) => {
        const text = (p.body_text_truncated || '').slice(0, 2000);
        return `--- PAGE ${idx + 1} (${p.url}) ---
Titre: ${p.title || 'N/A'}
H1: ${p.h1 || 'N/A'}
Meta: ${p.meta_description || 'N/A'}
Contenu (extrait): ${text}`;
      }).join('\n\n');

      try {
        const llmRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [{
              role: 'user',
              content: `Analyse le ton éditorial de ces ${batch.length} pages web. Pour CHAQUE page, détermine:
- register: "formel" | "informel" | "mixte"
- formality_score: 0-100 (0=très informel, 100=très formel)
- posture: "pedagogique" | "commercial" | "expert" | "pair" | "autoritaire" | "narratif"
- addressing: "tutoiement" | "vouvoiement" | "impersonnel" | "mixte"
- sentence_style: "courtes" | "longues" | "mixtes"
- lexical_density: "simple" | "technique" | "jargon" | "mixte"
- emotional_tone: "neutre" | "enthousiaste" | "urgent" | "rassurant" | "provocateur"
- confidence: 0-100 (confiance dans l'analyse)

Réponds UNIQUEMENT en JSON: {"pages": [{...}, {...}]}

${batchPrompt}`,
            }],
            temperature: 0.1,
            max_tokens: 2000,
          }),
        });

        if (!llmRes.ok) {
          console.warn(`[analyze-voice-tone] LLM batch ${i} failed: ${llmRes.status}`);
          continue;
        }

        const llmData = await llmRes.json();
        const content = llmData.choices?.[0]?.message?.content || '';
        
        let parsed: any;
        try {
          let jsonStr = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
          const first = jsonStr.indexOf('{');
          const last = jsonStr.lastIndexOf('}');
          if (first !== -1 && last > first) jsonStr = jsonStr.substring(first, last + 1);
          parsed = JSON.parse(jsonStr);
        } catch {
          console.warn(`[analyze-voice-tone] JSON parse failed for batch ${i}`);
          continue;
        }

        const results = parsed.pages || [];
        for (let j = 0; j < Math.min(results.length, batch.length); j++) {
          const toneData = results[j];
          if (toneData && typeof toneData === 'object') {
            await supabase
              .from('crawl_pages')
              .update({ tone_analysis: toneData })
              .eq('id', batch[j].id);
            analyzed++;
          }
        }
      } catch (e) {
        console.warn(`[analyze-voice-tone] Batch ${i} error:`, e);
      }
    }

    // Calculate consistency score
    const { data: analyzedPages } = await supabase
      .from('crawl_pages')
      .select('tone_analysis, url')
      .eq('crawl_id', crawl_id)
      .not('tone_analysis', 'is', null);

    let consistencyScore = 100;
    if (analyzedPages && analyzedPages.length >= 2) {
      const tones = analyzedPages.map(p => p.tone_analysis as ToneResult);
      
      // Count how many fields are consistent across pages
      const fields = ['register', 'posture', 'addressing', 'sentence_style', 'lexical_density'] as const;
      let totalChecks = 0;
      let consistentChecks = 0;
      
      for (const field of fields) {
        const values = tones.map(t => (t as any)[field]).filter(Boolean);
        if (values.length < 2) continue;
        totalChecks++;
        const dominant = mode_of(values);
        const consistent = values.filter(v => v === dominant).length;
        consistentChecks += consistent / values.length;
      }
      
      consistencyScore = totalChecks > 0 ? Math.round((consistentChecks / totalChecks) * 100) : 50;
    }

    // Update site_crawls with tone consistency score
    await supabase
      .from('site_crawls')
      .update({ tone_consistency_score: consistencyScore })
      .eq('id', crawl_id);

    return jsonOk({ success: true, analyzed, total: pages.length, consistency_score: consistencyScore });
  }

  if (mode === 'consolidate') {
    if (!tracked_site_id || !domain) return jsonError('tracked_site_id and domain required', 400);

    // Get all tone analyses from recent crawls
    const { data: recentCrawls } = await supabase
      .from('site_crawls')
      .select('id')
      .eq('domain', domain)
      .eq('status', 'completed')
      .not('tone_consistency_score', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(3);

    if (!recentCrawls?.length) return jsonOk({ success: true, message: 'No tone data available' });

    const crawlIds = recentCrawls.map(c => c.id);
    const { data: allTones } = await supabase
      .from('crawl_pages')
      .select('url, path, tone_analysis, word_count, body_text_truncated')
      .in('crawl_id', crawlIds)
      .not('tone_analysis', 'is', null)
      .order('word_count', { ascending: false })
      .limit(100);

    if (!allTones?.length) return jsonOk({ success: true, message: 'No tone analyses found' });

    const tones = allTones.map(t => t.tone_analysis as ToneResult);
    
    // Calculate dominant values
    const dominantRegister = mode_of(tones.map(t => t.register).filter(Boolean));
    const dominantPosture = mode_of(tones.map(t => t.posture).filter(Boolean));
    const dominantAddressing = mode_of(tones.map(t => t.addressing).filter(Boolean));
    const dominantSentence = mode_of(tones.map(t => t.sentence_style).filter(Boolean));
    const dominantLexical = mode_of(tones.map(t => t.lexical_density).filter(Boolean));
    const dominantEmotion = mode_of(tones.map(t => t.emotional_tone).filter(Boolean));

    // Detect inconsistencies
    const inconsistencies: VoiceDNA['inconsistencies'] = [];
    for (const page of allTones) {
      const t = page.tone_analysis as ToneResult;
      if (t.register && t.register !== dominantRegister) {
        inconsistencies.push({ url: page.url, field: 'register', expected: dominantRegister, found: t.register });
      }
      if (t.addressing && t.addressing !== dominantAddressing) {
        inconsistencies.push({ url: page.url, field: 'addressing', expected: dominantAddressing, found: t.addressing });
      }
      if (t.posture && t.posture !== dominantPosture) {
        inconsistencies.push({ url: page.url, field: 'posture', expected: dominantPosture, found: t.posture });
      }
    }

    // Extract sample excerpts from top pages
    const excerpts = allTones
      .filter(t => t.body_text_truncated && t.word_count > 200)
      .slice(0, 3)
      .map(t => (t.body_text_truncated || '').slice(0, 300));

    // Calculate overall consistency
    const fields = ['register', 'posture', 'addressing'] as const;
    let totalChecks = 0;
    let consistentChecks = 0;
    for (const field of fields) {
      const values = tones.map(t => (t as any)[field]).filter(Boolean);
      if (values.length < 2) continue;
      totalChecks++;
      const dominant = mode_of(values);
      consistentChecks += values.filter(v => v === dominant).length / values.length;
    }
    const consistencyScore = totalChecks > 0 ? Math.round((consistentChecks / totalChecks) * 100) : 50;

    // Detect tone overrides per page type (via URL patterns)
    const toneOverrides: Record<string, Partial<ToneResult>> = {};
    const pageTypePatterns: [string, RegExp][] = [
      ['landing', /\/(landing|lp-|offre|solution|service)/],
      ['product', /\/(produit|product|shop|boutique|fiche)/],
      ['article', /\/(blog|article|actualite|guide|conseil)/],
    ];
    
    for (const [pageType, pattern] of pageTypePatterns) {
      const typePages = allTones.filter(p => pattern.test(p.path || p.url));
      if (typePages.length >= 2) {
        const typeTones = typePages.map(p => p.tone_analysis as ToneResult);
        const typePosture = mode_of(typeTones.map(t => t.posture).filter(Boolean));
        const typeRegister = mode_of(typeTones.map(t => t.register).filter(Boolean));
        if (typePosture !== dominantPosture || typeRegister !== dominantRegister) {
          toneOverrides[pageType] = { posture: typePosture as any, register: typeRegister as any };
        }
      }
    }

    const voiceDna: VoiceDNA = {
      dominant_register: dominantRegister,
      dominant_posture: dominantPosture,
      dominant_addressing: dominantAddressing,
      sentence_style: dominantSentence,
      lexical_density: dominantLexical,
      emotional_tone: dominantEmotion,
      consistency_score: consistencyScore,
      inconsistencies: inconsistencies.slice(0, 20),
      sample_excerpts: excerpts,
      tone_overrides: toneOverrides,
      last_analyzed_at: new Date().toISOString(),
    };

    // Save to tracked_sites
    await supabase
      .from('tracked_sites')
      .update({ voice_dna: voiceDna })
      .eq('id', tracked_site_id);

    // Generate workbench items for tone inconsistencies
    if (inconsistencies.length > 0) {
      const userId = (await supabase.from('tracked_sites').select('user_id').eq('id', tracked_site_id).single()).data?.user_id;
      if (userId) {
        const items = inconsistencies.slice(0, 5).map(inc => ({
          domain,
          tracked_site_id,
          user_id: userId,
          source_type: 'crawl' as const,
          source_function: 'analyze-voice-tone',
          source_record_id: `tone_${tracked_site_id}_${inc.url}_${inc.field}`,
          finding_category: 'tone_inconsistency',
          severity: 'medium',
          title: `Ton incohérent: ${inc.field} (${inc.found} au lieu de ${inc.expected})`,
          description: `La page ${inc.url} utilise un ${inc.field} "${inc.found}" alors que le ton dominant du site est "${inc.expected}".`,
          target_url: inc.url,
          target_operation: 'replace',
          payload: { inconsistency: inc, voice_dna: { dominant: dominantPosture, register: dominantRegister } },
        }));

        for (const item of items) {
          await supabase.from('architect_workbench').upsert(item, {
            onConflict: 'source_type,source_record_id',
          }).then(() => {});
        }
      }
    }

    return jsonOk({ success: true, voice_dna: voiceDna });
  }

  return jsonError('Invalid mode. Use "analyze_pages" or "consolidate"', 400);
}));

// Helper: statistical mode
function mode_of(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
