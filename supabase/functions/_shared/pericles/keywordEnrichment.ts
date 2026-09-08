/**
 * parmenion/keywordEnrichment.ts — Multi-source keyword aggregation for prescribe phase.
 * Extracted from parmenion-orchestrator for testability.
 */

import { getServiceClient } from '../supabaseClient.ts';

type Supabase = ReturnType<typeof getServiceClient>;

export interface KeywordEnrichment {
  promptBlock: string;
  totalKeywords: number;
  sources: string[];
}

export async function enrichKeywordsForPrescribe(
  supabase: Supabase,
  domain: string,
  tracked_site_id: string,
  contentItems: any[],
): Promise<KeywordEnrichment> {
  const sources: string[] = [];
  const keywordMap = new Map<string, { volume?: number; position?: number; source: string }>();

  // 1. Extract from workbench item payloads
  for (const item of contentItems) {
    if (item.payload) {
      const p = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
      const kwFields = [p.keyword, p.keywords, p.target_keyword, p.suggested_keyword, p.term];
      for (const f of kwFields) {
        if (typeof f === 'string' && f.length > 1) {
          keywordMap.set(f.toLowerCase(), { source: 'workbench', volume: p.search_volume, position: p.current_rank });
        }
        if (Array.isArray(f)) {
          for (const k of f) {
            if (typeof k === 'string') keywordMap.set(k.toLowerCase(), { source: 'workbench' });
          }
        }
      }
    }
  }
  if (keywordMap.size > 0) sources.push('workbench_payload');

  // 2. Keyword rankings + SERP cache + Strategic audit (parallel)
  const [rankingsRes, serpRes, auditRes] = await Promise.all([
    supabase.from('keyword_rankings')
      .select('keyword, position, search_volume, url')
      .eq('tracked_site_id', tracked_site_id)
      .order('position', { ascending: true })
      .limit(30),
    supabase.from('serpapi_cache')
      .select('query_text, organic_results, related_searches')
      .eq('tracked_site_id', tracked_site_id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('audit_raw_data')
      .select('raw_payload')
      .eq('domain', domain)
      .eq('audit_type', 'strategic')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (rankingsRes.data?.length) {
    sources.push('keyword_rankings');
    for (const r of rankingsRes.data) {
      const k = r.keyword?.toLowerCase();
      if (k) {
        const existing = keywordMap.get(k);
        keywordMap.set(k, {
          source: existing?.source ? `${existing.source}+rankings` : 'rankings',
          volume: r.search_volume ?? existing?.volume,
          position: r.position ?? existing?.position,
        });
      }
    }
  }

  if (serpRes.data?.length) {
    sources.push('serp_cache');
    for (const s of serpRes.data) {
      const related = s.related_searches;
      if (Array.isArray(related)) {
        for (const r of related) {
          const q = (r.query || r.title || '').toLowerCase();
          if (q && !keywordMap.has(q)) {
            keywordMap.set(q, { source: 'serp_related' });
          }
        }
      }
    }
  }

  if (auditRes.data?.raw_payload) {
    const payload = auditRes.data.raw_payload as any;
    const kp = payload.keyword_positioning || payload.strategic?.keyword_positioning;
    if (kp) {
      sources.push('audit_strategic');
      const lists = [kp.high_opportunity, kp.quick_wins, kp.primary_keywords, kp.secondary_keywords];
      for (const list of lists) {
        if (Array.isArray(list)) {
          for (const item of list) {
            const k = (item.keyword || item.term || item.query || '').toLowerCase();
            if (k && !keywordMap.has(k)) {
              keywordMap.set(k, { source: 'audit_strategic', volume: item.volume, position: item.position });
            }
          }
        }
      }
    }
  }

  // Build prompt block
  if (keywordMap.size === 0) {
    return { promptBlock: '', totalKeywords: 0, sources: [] };
  }

  const sorted = Array.from(keywordMap.entries())
    .sort((a, b) => (b[1].volume ?? 0) - (a[1].volume ?? 0))
    .slice(0, 15);

  const kwLines = sorted.map(([kw, data]) => {
    const parts = [kw];
    if (data.volume) parts.push(`vol:${data.volume}`);
    if (data.position) parts.push(`pos:${data.position}`);
    return parts.join(' | ');
  });

  const quickWins = sorted.filter(([, d]) => d.position && d.position >= 8 && d.position <= 25);

  const promptBlock = `═══ MOTS-CLÉS STRATÉGIQUES (${keywordMap.size} identifiés, sources: ${sources.join(', ')}) ═══

MOTS-CLÉS PRIORITAIRES (à intégrer dans le contenu):
${kwLines.join('\n')}

${quickWins.length > 0 ? `🎯 QUICK WINS (positions 8-25, effort minimal pour top 10):
${quickWins.map(([kw, d]) => `- "${kw}" → position ${d.position}${d.volume ? `, vol ${d.volume}/mois` : ''}`).join('\n')}
RÈGLE: Optimise le contenu PRIORITAIREMENT pour ces quick wins.
` : ''}
═══ FIN MOTS-CLÉS ═══`;

  return { promptBlock, totalKeywords: keywordMap.size, sources };
}
