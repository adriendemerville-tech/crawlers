import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts';

/**
 * Edge Function: Marina
 * 
 * Automated prospecting pipeline:
 * 1. Crawl target URL (audit-expert-seo)
 * 2. Generate semantic cocoon (calculate-cocoon-logic) — requires tracked_site
 * 3. Run strategic GEO audit (audit-strategique-ia)
 * 4. Combine all results into a single HTML report
 * 5. Store in shared-reports bucket
 * 
 * Modes:
 * - POST { url } → creates async job, returns { job_id }
 * - GET ?job_id=xxx → poll job status
 * - GET ?action=generate_key → generate API key for external callers
 * - POST { action: 'list_jobs' } → list recent jobs
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ─── Language detection from HTML ───
function detectLanguage(html: string): string {
  // Check <html lang="...">
  const langAttr = html.match(/<html[^>]*\slang=["']([a-z]{2})/i);
  if (langAttr) {
    const lang = langAttr[1].toLowerCase();
    if (lang === 'es') return 'es';
    if (lang === 'en') return 'en';
    if (lang === 'fr') return 'fr';
  }
  
  // Heuristic: check for common French/Spanish words in first 2000 chars
  const sample = html.substring(0, 2000).toLowerCase();
  const frWords = ['nous', 'notre', 'votre', 'avec', 'pour', 'dans', 'les', 'des', 'une', 'est'];
  const esWords = ['nosotros', 'nuestro', 'para', 'sobre', 'esta', 'los', 'las', 'una', 'con', 'por'];
  
  const frScore = frWords.filter(w => sample.includes(` ${w} `)).length;
  const esScore = esWords.filter(w => sample.includes(` ${w} `)).length;
  
  if (frScore > esScore && frScore >= 3) return 'fr';
  if (esScore > frScore && esScore >= 3) return 'es';
  return 'fr'; // default to French
}

// ─── Helper: render any object/array as structured HTML ───
function renderJsonSection(data: any, depth = 0): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return `<p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:8px;">${data}</p>`;
  if (typeof data === 'number' || typeof data === 'boolean') return `<span style="font-weight:600;color:#3b82f6;">${data}</span>`;
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    // If array of strings
    if (typeof data[0] === 'string') {
      return `<ul style="margin:8px 0;padding-left:20px;">${data.map(item => `<li style="font-size:13px;color:#374151;margin-bottom:4px;">${item}</li>`).join('')}</ul>`;
    }
    // Array of objects
    return data.map((item, i) => {
      if (typeof item === 'string') return `<div style="padding:6px 12px;margin-bottom:4px;background:#f9fafb;border-radius:4px;font-size:13px;">${item}</div>`;
      const title = item.title || item.name || item.label || item.keyword || item.action || item.prescriptive_action || item.action_concrete || '';
      const desc = item.description || item.detail || item.rationale || item.evidence || item.explanation || item.strategic_goal || '';
      const score = item.score ?? item.confidence ?? item.priority ?? '';
      return `<div style="padding:12px;margin-bottom:8px;background:#f9fafb;border-left:3px solid ${item.priority === 'Prioritaire' || item.priority === 'critical' ? '#ef4444' : item.priority === 'Important' ? '#f59e0b' : '#3b82f6'};border-radius:4px;">
        ${score ? `<span style="font-size:11px;color:#6b7280;font-weight:600;">${score}</span> ` : ''}
        ${title ? `<div style="font-weight:500;margin-top:2px;">${title}</div>` : ''}
        ${desc ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;">${desc}</div>` : ''}
        ${Object.entries(item).filter(([k]) => !['title','name','label','keyword','description','detail','rationale','evidence','explanation','score','confidence','priority','action','prescriptive_action','action_concrete','strategic_goal'].includes(k)).map(([k, v]) => {
          if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return '';
          if (typeof v === 'object') return '';
          return `<div style="font-size:12px;color:#6b7280;margin-top:2px;"><strong>${k}:</strong> ${v}</div>`;
        }).join('')}
      </div>`;
    }).join('');
  }
  if (typeof data === 'object') {
    return Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).map(([key, val]) => {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return `<div style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:left;">
          <span style="color:#6b7280;margin-right:8px;">${key.replace(/_/g, ' ')}:</span>
          <span style="font-weight:500;color:#1e293b;">${val}</span>
        </div>`;
      }
      if (depth < 2) {
        return `<div style="margin-top:12px;text-align:left;"><h4 style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;text-transform:capitalize;">${key.replace(/_/g, ' ')}</h4>${renderJsonSection(val, depth + 1)}</div>`;
      }
      return '';
    }).join('');
  }
  return '';
}

// ─── Shared styles & helpers for report sections ───
function getMarinaStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; padding: 24px 16px; color: #1e293b; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; opacity: 0.85; }
    .header .date { font-size: 12px; opacity: 0.7; margin-top: 8px; }
    .section { background: white; border-radius: 10px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); page-break-inside: avoid; }
    .section-title { font-size: 17px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .section-number { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #3b82f6; color: white; font-size: 13px; font-weight: 700; }
    .score-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 18px; color: white; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .stat-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .stat-card { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-card .value { font-size: 24px; font-weight: 700; color: #3b82f6; }
    .stat-card .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .intro-text { font-size: 14px; color: #374151; line-height: 1.7; margin-bottom: 16px; }
    .checklist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 12px 0; }
    .checklist-item { font-size: 13px; padding: 8px 12px; background: #f9fafb; border-radius: 6px; }
    .footer { text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; margin-top: 20px; }
    .footer a { color: #3b82f6; text-decoration: none; }
    .toc { background: white; border-radius: 10px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .toc-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .toc-item:last-child { border-bottom: none; }
    .reco-card { padding:12px;margin-bottom:8px;background:#f9fafb;border-left:3px solid #3b82f6;border-radius:4px; }
    .marina-separator { height: 2px; background: linear-gradient(90deg, transparent, #3b82f6, transparent); margin: 32px 0; border-radius: 2px; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm 10mm; }
      .section { break-inside: auto; }
    }
  `;
}

function getTranslations(lang: string) {
  const t = {
    fr: {
      title: 'Rapport SEO & GEO Complet',
      generatedFor: 'Rapport généré pour',
      generatedAt: 'Généré le',
      crawlReport: 'Rapport de Crawl Détaillé',
      techAudit: 'Audit Technique SEO',
      strategicAudit: 'Audit Stratégique GEO',
      cocoonAnalysis: 'Analyse du Cocon Sémantique & Maillage',
      score: 'Score',
      recommendations: 'Recommandations',
      strengths: 'Points forts',
      improvements: 'Axes d\'amélioration',
      executiveSummary: 'Synthèse exécutive',
      roadmap: 'Plan d\'action prioritaire',
      noData: 'Données non disponibles',
      poweredBy: 'Propulsé par Crawlers AI',
      cocoonPending: 'L\'analyse du cocon sémantique n\'a pas retourné de données pour ce site. Un crawl multi-pages est nécessaire.',
    },
    en: {
      title: 'Complete SEO & GEO Report',
      generatedFor: 'Report generated for',
      generatedAt: 'Generated on',
      crawlReport: 'Detailed Crawl Report',
      techAudit: 'Technical SEO Audit',
      strategicAudit: 'Strategic GEO Audit',
      cocoonAnalysis: 'Semantic Cocoon & Internal Linking Analysis',
      score: 'Score',
      recommendations: 'Recommendations',
      strengths: 'Strengths',
      improvements: 'Areas for improvement',
      executiveSummary: 'Executive Summary',
      roadmap: 'Priority Action Plan',
      noData: 'Data not available',
      poweredBy: 'Powered by Crawlers AI',
      cocoonPending: 'Semantic cocoon analysis returned no data. A multi-page crawl is required.',
    },
    es: {
      title: 'Informe SEO y GEO Completo',
      generatedFor: 'Informe generado para',
      generatedAt: 'Generado el',
      crawlReport: 'Informe de Rastreo Detallado',
      techAudit: 'Auditoría Técnica SEO',
      strategicAudit: 'Auditoría Estratégica GEO',
      cocoonAnalysis: 'Análisis del Capullo Semántico y Enlaces',
      score: 'Puntuación',
      recommendations: 'Recomendaciones',
      strengths: 'Fortalezas',
      improvements: 'Áreas de mejora',
      executiveSummary: 'Resumen ejecutivo',
      roadmap: 'Plan de acción prioritario',
      noData: 'Datos no disponibles',
      poweredBy: 'Desarrollado por Crawlers AI',
      cocoonPending: 'El análisis del capullo semántico no devolvió datos.',
    },
  };
  return t[lang as keyof typeof t] || t.fr;
}

function scoreColor(score: number, max: number): string {
  const pct = score / max * 100;
  if (pct >= 70) return '#22c55e';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function checkMark(val: boolean): string {
  return val ? '✅' : '❌';
}

function buildModuleSection(title: string, emoji: string, data: any): string {
  if (!data) return '';
  return `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">${emoji} ${title}</h3>
    ${renderJsonSection(data)}
  </div>`;
}

// ─── Dedicated renderer for Social Signals with platform names & colors ───
function buildSocialSignalsSection(data: any): string {
  if (!data) return '';

  const PLATFORM_COLORS: Record<string, { color: string; bg: string; icon: string }> = {
    linkedin:  { color: '#0a66c2', bg: '#0a66c212', icon: '💼' },
    x:         { color: '#000000', bg: '#00000008', icon: '𝕏' },
    twitter:   { color: '#1da1f2', bg: '#1da1f212', icon: '🐦' },
    reddit:    { color: '#ff4500', bg: '#ff450012', icon: '🔴' },
    youtube:   { color: '#ff0000', bg: '#ff000012', icon: '▶️' },
    instagram: { color: '#e1306c', bg: '#e1306c12', icon: '📷' },
    facebook:  { color: '#1877f2', bg: '#1877f212', icon: '📘' },
    tiktok:    { color: '#000000', bg: '#00000008', icon: '🎵' },
  };

  const PRESENCE_COLORS: Record<string, string> = {
    strong: '#22c55e', moderate: '#f59e0b', weak: '#f97316', absent: '#ef4444',
  };

  // Proof sources — one card per platform
  let sourcesHtml = '';
  const proofSources = data?.proof_sources || [];
  if (Array.isArray(proofSources) && proofSources.length > 0) {
    const filteredSources = proofSources.filter((s: any) => {
      const platform = (s.platform || '').toLowerCase();
      const url = (s.profile_url || '').toLowerCase();
      // Filter out Facebook if it links to anti-scraping documentation
      if (platform === 'facebook' && (
        url.includes('facebook.com/help') ||
        url.includes('facebook.com/policies') ||
        url.includes('developers.facebook.com') ||
        url.includes('automated_data_collection') ||
        url.includes('robots.txt') ||
        !url.includes('facebook.com/')
      )) return false;
      return true;
    });
    if (filteredSources.length > 0) {
      sourcesHtml = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
      ${filteredSources.map((s: any) => {
        const platform = (s.platform || 'unknown').toLowerCase();
        const pc = PLATFORM_COLORS[platform] || { color: '#6b7280', bg: '#6b728012', icon: '🌐' };
        const level = (s.presence_level || 'unknown').toLowerCase();
        const levelColor = PRESENCE_COLORS[level] || '#6b7280';
        const profileName = s.profile_name || '';
        const profileUrl = s.profile_url || '';
        const analysis = s.analysis || '';
        
        return `<div style="padding:14px;border-radius:8px;border-left:4px solid ${pc.color};background:${pc.bg};text-align:left;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:700;font-size:14px;color:${pc.color};">${pc.icon} ${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
            <span style="font-size:11px;font-weight:600;color:${levelColor};padding:2px 8px;background:${levelColor}15;border-radius:4px;">${level}</span>
          </div>
          ${profileName ? `<div style="font-size:12px;color:#374151;font-weight:500;margin-bottom:4px;">${profileName}</div>` : ''}
          ${profileUrl && profileUrl !== 'null' ? `<div style="font-size:11px;color:${pc.color};margin-bottom:6px;word-break:break-all;">${profileUrl}</div>` : ''}
          ${analysis ? `<div style="font-size:12px;color:#6b7280;line-height:1.5;">${analysis}</div>` : ''}
        </div>`;
      }).join('')}
      </div>`;
    }
  }

  // Thought leadership
  let leadershipHtml = '';
  const tl = data?.thought_leadership;
  if (tl) {
    const eeat = tl.eeat_score ?? null;
    leadershipHtml = `<div style="padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:12px;text-align:left;">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;">🏛️ Thought Leadership</div>
      ${tl.founder_authority ? `<div style="font-size:12px;color:#374151;margin-bottom:4px;"><strong>Autorité fondateur:</strong> ${tl.founder_authority}</div>` : ''}
      ${tl.entity_recognition ? `<div style="font-size:12px;color:#374151;margin-bottom:4px;"><strong>Reconnaissance entité:</strong> ${tl.entity_recognition}</div>` : ''}
      ${eeat != null ? `<div style="font-size:12px;color:#374151;margin-bottom:4px;"><strong>Score E-E-A-T:</strong> <span style="font-weight:700;color:${eeat >= 7 ? '#22c55e' : eeat >= 4 ? '#f59e0b' : '#ef4444'};">${eeat}/10</span></div>` : ''}
      ${tl.analysis ? `<div style="font-size:12px;color:#6b7280;line-height:1.5;margin-top:4px;">${tl.analysis}</div>` : ''}
    </div>`;
  }

  // Sentiment
  let sentimentHtml = '';
  const sent = data?.sentiment;
  if (sent) {
    const polarity = sent.overall_polarity || 'neutral';
    const polarityColor = polarity.includes('positive') ? '#22c55e' : polarity.includes('negative') ? '#ef4444' : '#6b7280';
    sentimentHtml = `<div style="padding:12px;background:#f9fafb;border-radius:8px;text-align:left;">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;">💬 Sentiment</div>
      <div style="font-size:12px;margin-bottom:4px;"><strong>Polarité:</strong> <span style="font-weight:600;color:${polarityColor};">${polarity}</span></div>
      ${sent.hallucination_risk ? `<div style="font-size:12px;margin-bottom:4px;"><strong>Risque hallucination:</strong> ${sent.hallucination_risk}</div>` : ''}
      ${sent.reputation_vibration ? `<div style="font-size:12px;color:#6b7280;line-height:1.5;">${sent.reputation_vibration}</div>` : ''}
    </div>`;
  }

  return `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;text-align:left;">📱 Signaux Sociaux</h3>
    ${sourcesHtml}
    ${leadershipHtml}
    ${sentimentHtml}
  </div>`;
}

// ─── Dedicated renderer for Competitive Landscape with colored cards ───
function buildCompetitiveLandscapeSection(data: any): string {
  if (!data) return '';

  const competitors = [
    { key: 'leader', label: '👑 Leader (Goliath)', color: '#f59e0b', borderColor: '#f59e0b' },
    { key: 'direct_competitor', label: '🎯 Concurrent Direct', color: '#3b82f6', borderColor: '#3b82f6' },
    { key: 'challenger', label: '🚀 Challenger', color: '#8b5cf6', borderColor: '#8b5cf6' },
    { key: 'inspiration_source', label: '✨ Source d\'Inspiration', color: '#10b981', borderColor: '#10b981' },
  ];

  const cards = competitors.map(({ key, label, color, borderColor }) => {
    const actor = data[key];
    if (!actor) return '';
    const name = actor.name || '';
    const analysis = actor.analysis || '';
    const authority = actor.authority_factor || '';
    const url = actor.url || '';
    
    return `<div style="padding:16px;border-radius:8px;border-left:4px solid ${borderColor};background:${color}08;margin-bottom:12px;text-align:left;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;padding:2px 8px;background:${color}15;border-radius:4px;">${label}</span>
      </div>
      <div style="font-weight:600;font-size:15px;color:#1e293b;margin-bottom:4px;">${name}</div>
      ${url ? `<div style="font-size:12px;color:${color};margin-bottom:6px;">${url}</div>` : ''}
      ${authority ? `<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">🛡️ ${authority}</div>` : ''}
      ${analysis ? `<div style="font-size:13px;color:#374151;line-height:1.6;">${analysis.length > 400 ? analysis.slice(0, 397) + '…' : analysis}</div>` : ''}
    </div>`;
  }).join('');

  return `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;text-align:left;">⚔️ Paysage Concurrentiel</h3>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      ${cards}
    </div>
  </div>`;
}

// ─── Dedicated renderer for LLM Visibility with 6 individual model cards ───
function buildLlmVisibilitySection(rawData: any, strategicData: any): string {
  // ALWAYS render this section — LLM visibility cards must appear in every report
  const LLM_NAMES = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'Mistral', 'Meta Llama'];

  const scores = rawData?.scores || rawData?.data?.scores || [];
  
  // If no real scores, generate 6 placeholder "not cited" cards so the section ALWAYS appears
  const effectiveScores = (Array.isArray(scores) && scores.length > 0) 
    ? scores 
    : LLM_NAMES.map(name => ({ llm_name: name, score_percentage: 0, score: 0 }));
  
  // If we only have strategic text and no scores at all, still show 6 cards + analysis
  const analysis = strategicData?.analysis || strategicData?.llm_analysis || null;

  // Build 6 cards — cited (green) or not cited (red), with sentiment if cited
  const cardsHtml = effectiveScores.map((s: any) => {
    const name = s.llm_name || 'Unknown';
    const score = s.score_percentage ?? s.score ?? 0;
    const cited = score > 0;
    
    // Determine sentiment from score or explicit field
    let sentiment: string;
    if (!cited) {
      sentiment = 'not_found';
    } else if (s.overall_sentiment) {
      sentiment = s.overall_sentiment;
    } else if (score >= 60) {
      sentiment = 'positive';
    } else if (score >= 30) {
      sentiment = 'neutral';
    } else {
      sentiment = 'negative';
    }

    const borderColor = cited ? '#22c55e' : '#ef4444';
    const bgColor = cited ? '#22c55e08' : '#ef444408';
    const statusLabel = cited ? 'CITÉ' : 'NON CITÉ';
    const statusColor = cited ? '#22c55e' : '#ef4444';

    const sentimentLabels: Record<string, { label: string; color: string }> = {
      'positive':    { label: 'Positif', color: '#22c55e' },
      'recommended': { label: 'Recommandé', color: '#22c55e' },
      'neutral':     { label: 'Neutre', color: '#6b7280' },
      'negative':    { label: 'Négatif', color: '#ef4444' },
      'not_found':   { label: '', color: '#9ca3af' },
    };
    const sentimentInfo = sentimentLabels[sentiment] || sentimentLabels.neutral;

    return `<div style="padding:16px;border-radius:10px;border:1px solid ${borderColor}30;background:${bgColor};text-align:center;">
      <div style="font-weight:700;font-size:14px;color:#1f2937;margin-bottom:8px;">${name}</div>
      <div style="font-weight:700;font-size:12px;color:${statusColor};text-transform:uppercase;letter-spacing:0.5px;">${statusLabel}</div>
      ${cited && sentimentInfo.label ? `<div style="font-size:11px;margin-top:6px;padding:2px 10px;border-radius:12px;display:inline-block;background:${sentimentInfo.color}15;color:${sentimentInfo.color};font-weight:600;">${sentimentInfo.label}</div>` : ''}
    </div>`;
  }).join('');

  // Strategic analysis below cards
  let strategicHtml = '';
  if (strategicData) {
    const citProb = strategicData.citation_probability;
    const stratAnalysis = strategicData.analysis || strategicData.llm_analysis;
    strategicHtml = `<div style="padding:12px;background:#f9fafb;border-radius:8px;margin-top:16px;text-align:left;">
      ${citProb != null ? `<div style="font-size:13px;margin-bottom:6px;"><strong>Probabilité de citation IA :</strong> <span style="font-weight:700;color:${citProb >= 60 ? '#22c55e' : citProb >= 30 ? '#f59e0b' : '#ef4444'};">${citProb}%</span></div>` : ''}
      ${stratAnalysis ? `<div style="font-size:13px;color:#374151;line-height:1.6;margin-top:8px;">${stratAnalysis}</div>` : ''}
    </div>`;
  }

  const citedCount = effectiveScores.filter((s: any) => (s.score_percentage ?? s.score ?? 0) > 0).length;

  return `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:4px;text-align:left;">Visibilité LLM — Benchmark en temps réel</h3>
    <p style="font-size:12px;color:#6b7280;margin-bottom:16px;">${citedCount}/${effectiveScores.length} LLMs vous citent</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
      ${cardsHtml}
    </div>
    ${strategicHtml}
  </div>`;
}

// ─── Section 1: Crawl Report (standalone HTML) ───
function generateCrawlSectionHTML(expertSeoData: any, lang: string, domain: string, url: string): string {
  const tr = getTranslations(lang);
  const now = new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US');
  const scores = expertSeoData?.scores || {};
  const rawData = expertSeoData?.rawData || {};
  const htmlAnalysis = rawData?.htmlAnalysis || {};

  const crawlMeta = {
    pagesFound: rawData?.internalLinks?.length || htmlAnalysis?.internalLinksCount || 1,
    avgResponseTime: htmlAnalysis?.responseTimeMs || rawData?.responseTimeMs || null,
    wordCount: htmlAnalysis?.wordCount || 0,
    imagesTotal: htmlAnalysis?.imagesTotal || 0,
    imagesWithoutAlt: htmlAnalysis?.imagesWithoutAlt || 0,
    h1: htmlAnalysis?.h1 || '',
    h2Count: htmlAnalysis?.h2Count || 0,
    hasSchema: htmlAnalysis?.hasSchemaOrg || false,
    hasOg: htmlAnalysis?.hasOg || false,
    hasCanonical: htmlAnalysis?.hasCanonical || false,
    brokenLinks: rawData?.brokenLinks?.length || 0,
    externalLinks: htmlAnalysis?.externalLinksCount || 0,
    internalLinks: htmlAnalysis?.internalLinksCount || 0,
    indexable: htmlAnalysis?.isIndexable !== false,
    performanceScore: scores?.performance?.psiPerformance || null,
    lcp: scores?.performance?.lcp || null,
    tbt: scores?.performance?.tbt || null,
    cls: scores?.performance?.cls || null,
    fcp: scores?.performance?.fcp || null,
    title: htmlAnalysis?.title || '',
    titleLength: htmlAnalysis?.titleLength || 0,
    metaDesc: htmlAnalysis?.metaDescription || '',
    metaDescLength: htmlAnalysis?.metaDescLength || 0,
    h1Contents: htmlAnalysis?.h1Contents || [],
    h2Contents: htmlAnalysis?.h2Contents || [],
    h3Count: htmlAnalysis?.h3Count || 0,
    schemaTypes: scores?.aiReady?.schemaTypes || [],
    hasRobotsTxt: scores?.aiReady?.hasRobotsTxt || false,
    robotsPermissive: scores?.aiReady?.robotsPermissive || false,
    isHttps: scores?.technical?.isHttps || false,
    httpStatus: scores?.technical?.httpStatus || 200,
  };

  const content = `
    <div class="section">
      <div class="section-title"><span class="section-number">1</span> 🕷️ ${tr.crawlReport}</div>
      <div class="stat-grid-4">
        <div class="stat-card"><div class="value">${crawlMeta.wordCount}</div><div class="label">Mots</div></div>
        <div class="stat-card"><div class="value">${crawlMeta.internalLinks}</div><div class="label">Liens internes</div></div>
        <div class="stat-card"><div class="value">${crawlMeta.externalLinks}</div><div class="label">Liens externes</div></div>
        <div class="stat-card"><div class="value">${crawlMeta.avgResponseTime ? crawlMeta.avgResponseTime + 'ms' : '-'}</div><div class="label">Temps de réponse</div></div>
      </div>
      <div class="stat-grid-4" style="margin-top:12px;">
        <div class="stat-card"><div class="value">${crawlMeta.imagesTotal}</div><div class="label">Images</div></div>
        <div class="stat-card"><div class="value" style="color:${crawlMeta.imagesWithoutAlt > 0 ? '#ef4444' : '#22c55e'}">${crawlMeta.imagesWithoutAlt}</div><div class="label">Sans alt</div></div>
        <div class="stat-card"><div class="value">${crawlMeta.h2Count}</div><div class="label">H2</div></div>
        <div class="stat-card"><div class="value" style="color:${crawlMeta.brokenLinks > 0 ? '#ef4444' : '#22c55e'}">${crawlMeta.brokenLinks}</div><div class="label">Liens cassés</div></div>
      </div>
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Balises SEO</h3>
        <div style="padding:12px;background:#f0f9ff;border-radius:8px;font-size:13px;margin-bottom:8px;">
          <strong>Title (${crawlMeta.titleLength} car.):</strong> ${crawlMeta.title || '-'}
        </div>
        <div style="padding:12px;background:#f0f9ff;border-radius:8px;font-size:13px;margin-bottom:8px;">
          <strong>Meta Description (${crawlMeta.metaDescLength} car.):</strong> ${crawlMeta.metaDesc || '-'}
        </div>
        ${crawlMeta.h1 ? `<div style="padding:12px;background:#f0f9ff;border-radius:8px;font-size:13px;"><strong>H1:</strong> ${crawlMeta.h1}</div>` : ''}
      </div>
      ${crawlMeta.h2Contents.length > 0 ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Structure des titres (${crawlMeta.h2Contents.length} H2, ${crawlMeta.h3Count} H3)</h3>
        <ul style="padding-left:20px;font-size:13px;color:#374151;">
          ${crawlMeta.h2Contents.slice(0, 20).map((h: string) => `<li style="margin-bottom:4px;">${h}</li>`).join('')}
        </ul>
      </div>` : ''}
      <div class="checklist" style="margin-top:16px;">
        <div class="checklist-item">${checkMark(crawlMeta.indexable)} Indexable</div>
        <div class="checklist-item">${checkMark(crawlMeta.isHttps)} HTTPS</div>
        <div class="checklist-item">${checkMark(crawlMeta.hasCanonical)} Canonical</div>
        <div class="checklist-item">${checkMark(crawlMeta.hasOg)} Open Graph</div>
        <div class="checklist-item">${checkMark(crawlMeta.hasSchema)} Schema.org ${crawlMeta.schemaTypes.length > 0 ? `(${crawlMeta.schemaTypes.join(', ')})` : ''}</div>
        <div class="checklist-item">${checkMark(crawlMeta.hasRobotsTxt)} robots.txt ${crawlMeta.robotsPermissive ? '(permissif)' : ''}</div>
      </div>
      ${crawlMeta.performanceScore ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Core Web Vitals (PageSpeed)</h3>
        <div class="stat-grid-4">
          <div class="stat-card"><div class="value" style="color:${scoreColor(crawlMeta.performanceScore, 100)}">${crawlMeta.performanceScore}</div><div class="label">Performance /100</div></div>
          ${crawlMeta.lcp ? `<div class="stat-card"><div class="value">${Number(crawlMeta.lcp) > 60 ? (Number(crawlMeta.lcp) / 1000).toFixed(2) : Number(crawlMeta.lcp).toFixed(2)}s</div><div class="label">LCP</div></div>` : ''}
          ${crawlMeta.tbt ? `<div class="stat-card"><div class="value">${crawlMeta.tbt}ms</div><div class="label">TBT</div></div>` : ''}
          ${crawlMeta.cls !== null && crawlMeta.cls !== undefined ? `<div class="stat-card"><div class="value">${Number(crawlMeta.cls).toFixed(3)}</div><div class="label">CLS (score)</div></div>` : ''}
          ${crawlMeta.fcp ? `<div class="stat-card"><div class="value">${Number(crawlMeta.fcp) > 60 ? (Number(crawlMeta.fcp) / 1000).toFixed(2) : Number(crawlMeta.fcp).toFixed(2)}s</div><div class="label">FCP</div></div>` : ''}
        </div>
      </div>` : ''}
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Détail des scores</h3>
        <div class="stat-grid-4">
          <div class="stat-card"><div class="value" style="color:${scoreColor(scores?.performance?.score || 0, scores?.performance?.maxScore || 40)}">${scores?.performance?.score || 0}</div><div class="label">Performance /${scores?.performance?.maxScore || 40}</div></div>
          <div class="stat-card"><div class="value" style="color:${scoreColor(scores?.technical?.score || 0, scores?.technical?.maxScore || 50)}">${scores?.technical?.score || 0}</div><div class="label">Technique /${scores?.technical?.maxScore || 50}</div></div>
          <div class="stat-card"><div class="value" style="color:${scoreColor(scores?.semantic?.score || 0, scores?.semantic?.maxScore || 60)}">${scores?.semantic?.score || 0}</div><div class="label">Sémantique /${scores?.semantic?.maxScore || 60}</div></div>
          <div class="stat-card"><div class="value" style="color:${scoreColor(scores?.aiReady?.score || 0, scores?.aiReady?.maxScore || 30)}">${scores?.aiReady?.score || 0}</div><div class="label">IA-Ready /${scores?.aiReady?.maxScore || 30}</div></div>
        </div>
      </div>
    </div>`;

  return wrapStandaloneHTML(content, `${tr.crawlReport} - ${domain}`, lang);
}

// ─── Section 2: Technical SEO Audit (standalone HTML) ───
function generateTechSectionHTML(expertSeoData: any, lang: string, domain: string): string {
  const tr = getTranslations(lang);
  const techScore = expertSeoData?.totalScore || 0;
  const techMaxScore = expertSeoData?.maxScore || 200;
  const techRecommendations = expertSeoData?.recommendations || [];
  const techIntro = expertSeoData?.introduction || '';

  const content = `
    <div class="section">
      <div class="section-title"><span class="section-number">2</span> 🔍 ${tr.techAudit}</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div class="score-badge" style="background:${scoreColor(techScore, techMaxScore)}">${techScore} / ${techMaxScore}</div>
      </div>
      ${typeof techIntro === 'string' && techIntro ? `<div class="intro-text">${techIntro}</div>` : 
        typeof techIntro === 'object' && techIntro.presentation ? `
          <div class="intro-text">${techIntro.presentation}</div>
          ${techIntro.strengths ? `<div class="intro-text"><strong>${tr.strengths}:</strong> ${techIntro.strengths}</div>` : ''}
          ${techIntro.improvement ? `<div class="intro-text"><strong>${tr.improvements}:</strong> ${techIntro.improvement}</div>` : ''}
        ` : ''}
      ${techRecommendations.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;">${tr.recommendations} (${techRecommendations.length})</h3>
      ${techRecommendations.map((r: any) => {
        const title = typeof r === 'string' ? r : r.title || r.label || '';
        const desc = typeof r === 'string' ? '' : r.description || r.detail || '';
        const priority = typeof r === 'string' ? '' : r.priority || '';
        const category = typeof r === 'string' ? '' : r.category || '';
        const color = priority === 'critical' ? '#ef4444' : priority === 'important' ? '#f59e0b' : '#3b82f6';
        return `<div class="reco-card" style="border-left-color:${color}">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
            ${priority ? `<span style="font-size:11px;color:${color};font-weight:600;text-transform:uppercase;">${priority}</span>` : ''}
            ${category ? `<span style="font-size:11px;color:#6b7280;background:#f3f4f6;padding:1px 6px;border-radius:4px;">${category}</span>` : ''}
          </div>
          <div style="font-weight:500;">${title}</div>
          ${desc ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;">${desc}</div>` : ''}
        </div>`;
      }).join('')}` : ''}
    </div>`;

  return wrapStandaloneHTML(content, `${tr.techAudit} - ${domain}`, lang);
}

// ─── Section 3: Strategic GEO Audit (standalone HTML) ───
function generateStrategicSectionHTML(strategicData: any, lang: string, domain: string, llmRealData?: any): string {
  const tr = getTranslations(lang);
  const stratScore = strategicData?.overallScore || 0;
  const stratIntro = strategicData?.introduction || {};
  const stratRoadmap = strategicData?.executive_roadmap || strategicData?.strategic_roadmap || [];
  const stratSummary = strategicData?.executive_summary || '';
  const brandAuth = strategicData?.brand_authority || strategicData?.brand_identity || null;
  const socialSignals = strategicData?.social_signals || null;
  const marketIntel = strategicData?.market_intelligence || strategicData?.market_positioning || null;
  const competitive = strategicData?.competitive_landscape || null;
  const geoReadiness = strategicData?.geo_readiness || strategicData?.geo_score || null;
  const keywordPos = strategicData?.keyword_positioning || strategicData?.keywordPositioning || null;
  const marketData = strategicData?.market_data_summary || strategicData?.marketDataSummary || null;
  const llmVisibility = llmRealData || strategicData?.llm_visibility_raw || null;
  const llmVisibilityStrategic = strategicData?.llm_visibility || null;
  const quotability = strategicData?.quotability || null;
  const summaryResilience = strategicData?.summary_resilience || null;
  const lexicalFootprint = strategicData?.lexical_footprint || null;
  const expertiseSentiment = strategicData?.expertise_sentiment || null;
  const redTeam = strategicData?.red_team || null;
  const gmb = strategicData?.google_my_business || null;
  const clientTargets = strategicData?.client_targets || null;

  const content = `
    <div class="section">
      <div class="section-title"><span class="section-number">3</span> 🎯 ${tr.strategicAudit}</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div class="score-badge" style="background:${scoreColor(stratScore, 100)}">${stratScore} / 100</div>
      </div>
      ${stratIntro?.presentation ? `<div class="intro-text">${stratIntro.presentation}</div>` : ''}
      ${stratIntro?.strengths ? `<div class="intro-text"><strong>${tr.strengths}:</strong> ${stratIntro.strengths}</div>` : ''}
      ${stratIntro?.improvement ? `<div class="intro-text"><strong>${tr.improvements}:</strong> ${stratIntro.improvement}</div>` : ''}
      ${stratSummary ? `<div style="margin-top:16px;padding:16px;background:#eff6ff;border-radius:8px;"><h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">📋 ${tr.executiveSummary}</h3><div class="intro-text">${stratSummary}</div></div>` : ''}
      ${buildModuleSection('Autorité de Marque', '🏛️', brandAuth)}
      ${buildSocialSignalsSection(socialSignals)}
      ${buildModuleSection('Intelligence Marché', '📊', marketIntel)}
      ${buildCompetitiveLandscapeSection(competitive)}
      ${buildModuleSection('GEO Readiness', '🌍', geoReadiness)}
      ${buildModuleSection('Positionnement Mots-clés', '🔑', keywordPos)}
      ${buildModuleSection('Données Marché', '📈', marketData)}
      ${buildLlmVisibilitySection(llmVisibility, llmVisibilityStrategic)}
      ${buildModuleSection('Quotabilité', '💬', quotability)}
      ${buildModuleSection('Résilience des Résumés', '🛡️', summaryResilience)}
      ${buildModuleSection('Empreinte Lexicale', '📝', lexicalFootprint)}
      ${buildModuleSection("Sentiment d'Expertise", '🎯', expertiseSentiment)}
      ${buildModuleSection('Red Team (Adversarial)', '🔴', redTeam)}
      ${buildModuleSection('Google My Business', '📍', gmb)}
      ${buildModuleSection('Cibles Clients', '👥', clientTargets)}
      ${stratRoadmap.length > 0 ? `
      <div style="margin-top:20px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">🗺️ ${tr.roadmap}</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Priorité</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Action</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Catégorie</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">ROI</th>
          </tr></thead>
          <tbody>${stratRoadmap.map((item: any) => {
            const color = item.priority === 'Prioritaire' ? '#ef4444' : item.priority === 'Important' ? '#f59e0b' : '#22c55e';
            return `<tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px 12px;"><span style="color:${color};font-weight:600;font-size:13px;">${item.priority || '-'}</span></td>
              <td style="padding:8px 12px;font-size:13px;">${item.prescriptive_action || item.title || item.action_concrete || '-'}</td>
              <td style="padding:8px 12px;font-size:13px;color:#6b7280;">${item.category || '-'}</td>
              <td style="padding:8px 12px;font-size:13px;color:#6b7280;">${item.expected_roi || '-'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>` : ''}
    </div>`;

  return wrapStandaloneHTML(content, `${tr.strategicAudit} - ${domain}`, lang);
}

// ─── Section 4: Cocoon Analysis (standalone HTML) ───
function generateCocoonSectionHTML(cocoonData: any, lang: string, domain: string): string {
  const tr = getTranslations(lang);
  const cocoonStats = cocoonData?.stats || null;
  const cocoonClusters = cocoonData?.cluster_summary || cocoonData?.clusters || null;
  const cocoonNodes = cocoonData?.nodes || cocoonData?.nodes_snapshot || [];
  const cocoonEdges = cocoonData?.edges || cocoonData?.edges_snapshot || [];
  const strategeRecos: Array<{ title: string; description: string; priority: string }> = cocoonData?._stratege_recommendations || [];

  const content = `
    <div class="section">
      <div class="section-title"><span class="section-number">4</span> 🕸️ ${tr.cocoonAnalysis}</div>
      ${cocoonStats ? `
      <div class="stat-grid">
        <div class="stat-card"><div class="value">${cocoonStats.nodes_count || 0}</div><div class="label">Pages analysées</div></div>
        <div class="stat-card"><div class="value">${cocoonStats.clusters_count || 0}</div><div class="label">Clusters</div></div>
        <div class="stat-card"><div class="value">${cocoonStats.edges_count || 0}</div><div class="label">Liens sémantiques</div></div>
      </div>
      ${cocoonStats.avg_geo_score ? `
      <div class="stat-grid" style="margin-top:12px;">
        <div class="stat-card"><div class="value">${cocoonStats.avg_geo_score || '-'}</div><div class="label">Geo Score Moy.</div></div>
        <div class="stat-card"><div class="value">${cocoonStats.avg_roi || '-'}</div><div class="label">ROI Moy.</div></div>
        <div class="stat-card"><div class="value">${cocoonStats.links_density || '-'}%</div><div class="label">Densité liens</div></div>
      </div>` : ''}
      ${cocoonClusters && typeof cocoonClusters === 'object' ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Clusters identifiés</h3>
        ${Object.entries(cocoonClusters).map(([key, val]: [string, any]) => `
          <div style="padding:12px;margin-bottom:8px;background:#f9fafb;border-left:3px solid #3b82f6;border-radius:6px;">
            <div style="font-weight:600;font-size:14px;">${val?.label || val?.name || key}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">
              ${val?.count || val?.pages_count || ''} pages
              ${val?.avg_geo ? ` · Geo: ${Math.round(val.avg_geo)}` : ''}
              ${val?.avg_roi ? ` · ROI: ${Math.round(val.avg_roi)}` : ''}
              ${val?.total_traffic ? ` · Trafic: ${val.total_traffic}` : ''}
              ${val?.dominant_intent ? ` · Intent: ${val.dominant_intent}` : ''}
            </div>
          </div>
        `).join('')}
      </div>` : ''}
      ${cocoonNodes.length > 0 ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Pages du graphe (${cocoonNodes.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:6px 8px;text-align:left;">URL</th>
            <th style="padding:6px 8px;text-align:center;">Intent</th>
            <th style="padding:6px 8px;text-align:center;">Autorité</th>
            <th style="padding:6px 8px;text-align:center;">Liens In</th>
            <th style="padding:6px 8px;text-align:center;">Liens Out</th>
          </tr></thead>
          <tbody>${cocoonNodes.slice(0, 50).map((nd: any) => `
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:6px 8px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nd.url || nd.title || '-'}</td>
              <td style="padding:6px 8px;text-align:center;">${nd.intent || '-'}</td>
              <td style="padding:6px 8px;text-align:center;">${nd.page_authority != null ? Math.round(nd.page_authority) : '-'}</td>
              <td style="padding:6px 8px;text-align:center;">${nd.internal_links_in ?? '-'}</td>
              <td style="padding:6px 8px;text-align:center;">${nd.internal_links_out ?? '-'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>` : ''}
      ${cocoonEdges.length > 0 ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Liens sémantiques (${cocoonEdges.length} premiers)</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:6px 8px;text-align:left;">Source</th>
            <th style="padding:6px 8px;text-align:left;">Cible</th>
            <th style="padding:6px 8px;text-align:center;">Score</th>
            <th style="padding:6px 8px;text-align:center;">Type</th>
          </tr></thead>
          <tbody>${cocoonEdges.slice(0, 30).map((e: any) => `
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:6px 8px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.source || '-'}</td>
              <td style="padding:6px 8px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.target || e.target_url || '-'}</td>
              <td style="padding:6px 8px;text-align:center;">${e.score != null ? Math.round(e.score * 100) / 100 : '-'}</td>
              <td style="padding:6px 8px;text-align:center;">${e.type || '-'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>` : ''}
      ` : `<p style="color:#6b7280;font-size:14px;">${tr.cocoonPending}</p>`}
      ${strategeRecos.length > 0 ? `
      <div style="margin-top:24px;padding:20px;background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-radius:10px;border:1px solid #bfdbfe;">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          🎯 ${lang === 'fr' ? 'Recommandations Stratège' : lang === 'es' ? 'Recomendaciones Estratégicas' : 'Strategic Recommendations'}
        </h3>
        ${strategeRecos.map((r, i) => {
          const prioColor = r.priority === 'critique' || r.priority === 'critical' ? '#ef4444' : r.priority === 'important' ? '#f59e0b' : '#22c55e';
          return `<div style="padding:12px;margin-bottom:8px;background:white;border-left:3px solid ${prioColor};border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-size:11px;color:${prioColor};font-weight:700;text-transform:uppercase;">${r.priority}</span>
            </div>
            <div style="font-weight:600;font-size:14px;">${r.title}</div>
            <div style="font-size:13px;color:#4b5563;margin-top:4px;line-height:1.6;">${r.description}</div>
          </div>`;
        }).join('')}
      </div>` : ''}
    </div>`;

  return wrapStandaloneHTML(content, `${tr.cocoonAnalysis} - ${domain}`, lang);
}

// ─── Wrap a section as standalone HTML (for temporary storage) ───
function wrapStandaloneHTML(bodyContent: string, title: string, lang: string): string {
  const now = new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US');
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${getMarinaStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <div class="date">${now}</div>
    </div>
    ${bodyContent}
    <div class="footer">
      <div>Propulsé par Crawlers AI</div>
      <div style="margin-top:4px;"><a href="https://crawlers.fr">crawlers.fr</a></div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Extract body content from standalone HTML (strip header/footer/html wrapper) ───
function extractBodyContent(html: string, options: { stripHeader?: boolean; stripFooter?: boolean } = {}): string {
  // Extract content between <div class="container"> ... </div> (last)
  const containerMatch = html.match(/<div class="container">([\s\S]*)<\/div>\s*<\/body>/);
  if (!containerMatch) return html;
  
  let content = containerMatch[1];
  
  // Strip header if requested
  if (options.stripHeader) {
    content = content.replace(/<div class="header">[\s\S]*?<\/div>\s*/, '');
  }
  
  // Strip footer if requested
  if (options.stripFooter) {
    content = content.replace(/<div class="footer">[\s\S]*?<\/div>\s*$/, '');
  }
  
  return content.trim();
}

// ─── Compile multiple section HTMLs into one final report ───
function compileMarinaReport(
  sectionHTMLs: { crawl: string; tech: string; strategic: string; cocoon: string },
  lang: string,
  domain: string,
  url: string,
): string {
  const tr = getTranslations(lang);
  const now = new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US');

  // Extract body content with appropriate header/footer stripping:
  // Crawl: keep header (via TOC), strip footer
  // Tech: strip header, strip footer
  // Strategic: strip header, strip footer
  // Cocoon: strip header, keep footer
  const crawlContent = extractBodyContent(sectionHTMLs.crawl, { stripHeader: true, stripFooter: true });
  const techContent = extractBodyContent(sectionHTMLs.tech, { stripHeader: true, stripFooter: true });
  const strategicContent = extractBodyContent(sectionHTMLs.strategic, { stripHeader: true, stripFooter: true });
  const cocoonContent = extractBodyContent(sectionHTMLs.cocoon, { stripHeader: true, stripFooter: true });

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tr.title} - ${domain}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${getMarinaStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${tr.title}</h1>
      <div class="subtitle">${tr.generatedFor}: <strong>${domain}</strong></div>
      <div class="subtitle">${url}</div>
      <div class="date">${tr.generatedAt}: ${now}</div>
    </div>

    <!-- Table of Contents -->
    <div class="toc">
      <div class="toc-item"><span class="section-number">1</span> 🕷️ ${tr.crawlReport}</div>
      <div class="toc-item"><span class="section-number">2</span> 🔍 ${tr.techAudit}</div>
      <div class="toc-item"><span class="section-number">3</span> 🎯 ${tr.strategicAudit}</div>
      <div class="toc-item"><span class="section-number">4</span> 🕸️ ${tr.cocoonAnalysis}</div>
    </div>

    <!-- Section 1: Crawl -->
    ${crawlContent}

    <div class="marina-separator"></div>

    <!-- Section 2: Technical SEO -->
    ${techContent}

    <div class="marina-separator"></div>

    <!-- Section 3: Strategic GEO -->
    ${strategicContent}

    <div class="marina-separator"></div>

    <!-- Section 4: Cocoon -->
    ${cocoonContent}

    <div class="footer">
      <div>${tr.poweredBy}</div>
      <div style="margin-top:4px;"><a href="https://crawlers.fr">crawlers.fr</a></div>
    </div>
  </div>
</body>
</html>`;
}

// ─── LEGACY fallback: monolithic report generator (kept for resilience) ───
function generateLegacyMarinaReport(
  url: string, domain: string, lang: string,
  expertSeoData: any, strategicData: any, cocoonData: any | null,
): string {
  // Generate each section individually then compile — same logic but inline
  const crawlHTML = generateCrawlSectionHTML(expertSeoData, lang, domain, url);
  const techHTML = generateTechSectionHTML(expertSeoData, lang, domain);
  const strategicHTML = generateStrategicSectionHTML(strategicData, lang, domain);
  const cocoonHTML = generateCocoonSectionHTML(cocoonData, lang, domain);
  return compileMarinaReport({ crawl: crawlHTML, tech: techHTML, strategic: strategicHTML, cocoon: cocoonHTML }, lang, domain, url);
}

// ─── Lite Stratège: quick LLM call for top 3 cocoon recommendations ───
async function generateLiteStrategeRecommendations(
  domain: string,
  cocoonResult: any,
  expertData: any,
  strategicData: any,
  lang: string,
): Promise<Array<{ title: string; description: string; priority: string }>> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.warn('[Marina] No LOVABLE_API_KEY, skipping lite stratège');
    return [];
  }

  const stats = cocoonResult?.stats || {};
  const graphDetails = cocoonResult?.graph_details || {};
  const seoScore = expertData?.totalScore || 0;
  const geoScore = strategicData?.overallScore || 0;

  // Build detailed graph context for the strategist
  const orphans = (graphDetails.orphan_pages || []).slice(0, 5);
  const cannib = (graphDetails.cannibalization_risks || []).slice(0, 3);
  const thinPages = (graphDetails.thin_content_pages || []).slice(0, 5);
  const clusters = (graphDetails.cluster_details || []).slice(0, 5);

  const orphanBlock = orphans.length > 0
    ? `Pages orphelines (${stats.orphan_count || orphans.length} total):\n${orphans.map((o: any) => `  - ${o.url} (${o.word_count || 0} mots) "${o.title}"`).join('\n')}`
    : 'Aucune page orpheline détectée.';

  const cannibBlock = cannib.length > 0
    ? `Risques de cannibalisation (${stats.cannibalization_count || cannib.length} total):\n${cannib.map((c: any) => `  - ${c.urls.join(' vs ')} — mots-clés partagés: ${c.shared_keywords.join(', ')}`).join('\n')}`
    : 'Aucune cannibalisation détectée.';

  const thinBlock = thinPages.length > 0
    ? `Pages contenu faible (${stats.thin_content_count || thinPages.length} total, <300 mots):\n${thinPages.map((t: any) => `  - ${t.url} (${t.word_count} mots) "${t.title}"`).join('\n')}`
    : 'Aucune page à contenu faible.';

  const clusterBlock = clusters.length > 0
    ? `Clusters thématiques (${stats.clusters_count || clusters.length}):\n${clusters.map((c: any) => `  - Cluster "${c.top_keywords?.join(', ') || '?'}" : ${c.size} pages, score SEO moy: ${c.avg_seo_score}, mots moy: ${c.avg_word_count}`).join('\n')}`
    : '';

  const prompt = lang === 'fr'
    ? `Tu es un stratège SEO/GEO senior. Analyse ce diagnostic détaillé du cocon sémantique et donne exactement 3 recommandations classées par priorité (Priorité 1 = critique, Priorité 2 = important, Priorité 3 = recommandé).

Chaque recommandation doit être SPÉCIFIQUE au site, citer des URLs ou clusters précis, et proposer une action concrète.

Domaine: ${domain}
Score SEO technique: ${seoScore}/200
Score GEO stratégique: ${geoScore}/100

=== GRAPHE SÉMANTIQUE ===
Pages analysées: ${stats.nodes_count || 0}
Clusters: ${stats.clusters_count || 0}
Liens sémantiques: ${stats.edges_count || 0}
Densité de maillage: ${stats.links_density || 'N/A'}%

${clusterBlock}

=== PROBLÈMES DÉTECTÉS ===
${orphanBlock}

${cannibBlock}

${thinBlock}

Réponds en JSON strict: [{"title":"...","description":"...","priority":"Priorité 1"},{"title":"...","description":"...","priority":"Priorité 2"},{"title":"...","description":"...","priority":"Priorité 3"}]`
    : `You are a senior SEO/GEO strategist. Analyze this detailed semantic cocoon diagnostic and give exactly 3 recommendations ranked by priority (Priority 1 = critical, Priority 2 = important, Priority 3 = recommended).

Each recommendation must be SPECIFIC to the site, cite precise URLs or clusters, and propose a concrete action.

Domain: ${domain}
Technical SEO Score: ${seoScore}/200
Strategic GEO Score: ${geoScore}/100

=== SEMANTIC GRAPH ===
Pages analyzed: ${stats.nodes_count || 0}
Clusters: ${stats.clusters_count || 0}
Semantic links: ${stats.edges_count || 0}
Link density: ${stats.links_density || 'N/A'}%

${clusterBlock}

=== DETECTED ISSUES ===
${orphanBlock}

${cannibBlock}

${thinBlock}

Respond in strict JSON: [{"title":"...","description":"...","priority":"Priority 1"},{"title":"...","description":"...","priority":"Priority 2"},{"title":"...","description":"...","priority":"Priority 3"}]`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a precise SEO strategist. Always respond with valid JSON arrays only. Each recommendation must reference specific URLs, clusters, or data points from the analysis.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    console.warn(`[Marina] Lite Stratège API error: ${response.status}`);
    return [];
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content || '';
  
  // Extract JSON array from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}

// ─── Internal function call helper ───
async function callFunction(functionName: string, body: any, method = 'POST'): Promise<any> {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(540_000), // 9 min
  });
  
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function startTrackedSubJob(
  sb: ReturnType<typeof getServiceClient>,
  functionName: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const { data: job, error } = await sb
    .from('async_jobs')
    .insert({
      user_id: userId,
      function_name: functionName,
      status: 'pending',
      input_payload: body,
    })
    .select('id')
    .single();

  if (error || !job) {
    throw new Error(`Failed to create ${functionName} job: ${error?.message || 'unknown error'}`);
  }

  fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, async: false, _job_id: job.id }),
  }).catch((error) => {
    console.error(`[Marina] ${functionName} self-invocation failed:`, error);
  });

  return job.id;
}

async function waitForTrackedJob(
  sb: ReturnType<typeof getServiceClient>,
  jobId: string,
  options?: {
    timeoutMs?: number;
    pollMs?: number;
    onProgress?: (job: {
      status: string;
      progress: number | null;
      result_data: any;
      error_message: string | null;
      input_payload: any;
    }) => Promise<void> | void;
  },
): Promise<any> {
  const timeoutMs = options?.timeoutMs ?? 420_000;
  const pollMs = options?.pollMs ?? 4_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data: job, error } = await sb
      .from('async_jobs')
      .select('status, progress, result_data, error_message, input_payload')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      throw new Error(`Unable to read sub-job ${jobId}: ${error?.message || 'not found'}`);
    }

    if (job.status === 'completed') return job.result_data;
    if (job.status === 'failed') {
      throw new Error(job.error_message || `Sub-job ${jobId} failed`);
    }

    if (options?.onProgress) {
      await options.onProgress(job);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Sub-job ${jobId} timed out after ${Math.round(timeoutMs / 1000)}s`);
}

// ─── API Key management ───
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'marina_';
  let key = prefix;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// ─── Self-invoke helper for phase chaining ───
async function selfInvokePhase(jobId: string, url: string, lang: string, phase: string, intermediateData: any) {
  console.log(`[Marina] 🔗 Self-invoking phase "${phase}" for job ${jobId}`);
  fetch(`${SUPABASE_URL}/functions/v1/marina`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'run_job', job_id: jobId, url, lang, _phase: phase, _intermediate: intermediateData }),
  }).catch(err => {
    console.error(`[Marina] Phase "${phase}" self-invocation failed:`, err);
  });
}

// ─── Worker: runs the full pipeline in phases ───
// Phase 1 (default): audit + strategic → saves intermediate → self-invokes phase 2
// Phase 2: crawl + cocoon + LLM visibility + report generation
async function runPipeline(jobId: string, url: string, lang?: string, phase?: string, intermediateData?: any) {
  const sb = getServiceClient();
  const { data: parentJob } = await sb
    .from('async_jobs')
    .select('user_id')
    .eq('id', jobId)
    .single();

  if (!parentJob?.user_id) {
    throw new Error('Parent Marina job missing user_id');
  }
  
  const updateProgress = async (progress: number, phaseName?: string) => {
    try {
      const updateData: any = { progress };
      if (phaseName) updateData.input_payload = { phase: phaseName, url };
      if (progress === 5) updateData.started_at = new Date().toISOString();
      updateData.status = 'processing';
      await sb.from('async_jobs').update(updateData).eq('id', jobId);
    } catch (_) { /* ignore */ }
  };

  const currentPhase = phase || 'phase1';

  try {
    if (currentPhase === 'phase1') {
      // ═══ PHASE 1: Audit + Strategic ═══
      await updateProgress(5, 'crawling');
      
      // ─── Step 1: Technical SEO Audit (includes crawl) ───
      console.log(`[Marina] Phase 1 Step 1: audit-expert-seo for ${url}`);
      const expertResult = await callFunction('audit-expert-seo', { url, lang: lang || 'fr' });
      
      if (!expertResult?.success || !expertResult?.data) {
        throw new Error(`Expert SEO audit failed: ${expertResult?.error || 'No data returned'}`);
      }
      
      const domain = expertResult.data.domain;
      const detectedLang = lang || detectLanguage(expertResult.data?.rawData?.htmlAnalysis?.html || '');
      
      console.log(`[Marina] Expert SEO done. Score: ${expertResult.data.totalScore}. Lang: ${detectedLang}`);
      await updateProgress(30, 'strategic_audit');

      // ─── Step 2: Strategic GEO Audit ───
      console.log(`[Marina] Phase 1 Step 2: strategic-orchestrator for ${url}`);
      const toolsData = {
        crawlers: { note: 'Non disponible dans Marina' },
        geo: { note: 'Calcul stratégique en cours' },
        llm: { note: 'À calculer via le pipeline stratégique' },
        pagespeed: {
          overallScore: expertResult.data?.scores?.performance?.psiPerformance || null,
          lcp: expertResult.data?.scores?.performance?.lcp || null,
        },
      };

      const strategicJobId = await startTrackedSubJob(
        sb,
        'strategic-orchestrator',
        parentJob.user_id,
        {
          parent_job_id: jobId,
          url,
          lang: detectedLang,
          toolsData,
        },
      );

      let lastMirroredProgress = 30;
      const strategicData = await waitForTrackedJob(sb, strategicJobId, {
        timeoutMs: 420_000,
        pollMs: 4_000,
        onProgress: async (childJob) => {
          const childProgress = Math.max(0, Math.min(100, childJob.progress || 0));
          const mirroredProgress = Math.min(64, 30 + Math.round((childProgress / 100) * 35));
          if (mirroredProgress > lastMirroredProgress) {
            lastMirroredProgress = mirroredProgress;
            await updateProgress(mirroredProgress, 'strategic_audit');
          }
        },
      });

      console.log(`[Marina] Strategic audit done. Score: ${strategicData?.overallScore || 'N/A'}`);
      await updateProgress(65, 'phase1_complete');

      // ─── Save intermediate data and self-invoke phase 2 ───
      // Store intermediate results in audit_cache for phase 2 to pick up
      const intermediatePayload = {
        expertData: expertResult.data,
        strategicData,
        domain,
        detectedLang,
      };

      await sb.from('audit_cache').upsert({
        cache_key: `marina_intermediate_${jobId}`,
        function_name: 'marina',
        result_data: intermediatePayload,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min TTL
      }, { onConflict: 'cache_key' });

      console.log(`[Marina] ✅ Phase 1 complete — intermediate data saved, launching Phase 2`);

      // Self-invoke phase 2 with a fresh wall-clock budget
      await selfInvokePhase(jobId, url, detectedLang, 'phase2', { domain });

    } else if (currentPhase === 'phase2') {
      // ═══ PHASE 2: Crawl multi-pages only ═══
      console.log(`[Marina] Phase 2 starting for job ${jobId} — crawl`);

      // Load intermediate data from phase 1
      const { data: cached } = await sb
        .from('audit_cache')
        .select('result_data')
        .eq('cache_key', `marina_intermediate_${jobId}`)
        .single();

      if (!cached?.result_data) {
        throw new Error('Phase 2: intermediate data not found — phase 1 may have failed');
      }

      const { domain, detectedLang } = cached.result_data as any;

      await updateProgress(66, 'multi_crawl');

      // Ensure tracked_site exists
      let trackedSiteId: string | null = null;
      {
        const { data: ts } = await sb
          .from('tracked_sites')
          .select('id')
          .eq('domain', domain)
          .maybeSingle();
        if (ts) {
          trackedSiteId = ts.id;
        } else {
          const { data: newTs } = await sb
            .from('tracked_sites')
            .insert({ user_id: parentJob.user_id, domain, site_name: `Marina: ${domain}` })
            .select('id')
            .single();
          trackedSiteId = newTs?.id || null;
        }
      }

      if (!trackedSiteId) {
        console.warn(`[Marina] No tracked_site for ${domain} — skipping crawl, going to phase 3`);
      } else {
        // Check if we have a recent crawl
        const { data: existingCrawls } = await sb
          .from('site_crawls' as any)
          .select('id, crawled_pages, total_pages, status')
          .eq('tracked_site_id', trackedSiteId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1);

        const hasRecentCrawl = existingCrawls?.length && (existingCrawls[0] as any).crawled_pages > 1;

        if (!hasRecentCrawl) {
          console.log(`[Marina] No multi-page crawl for ${domain}, launching real crawl (max 20 pages)...`);
          await updateProgress(67, 'multi_crawl');

          try {
            const crawlLaunchRes = await callFunction('crawl-site', {
              url: url,
              maxPages: 20,
              userId: parentJob.user_id,
            });

            if (crawlLaunchRes?.success && crawlLaunchRes?.crawlId) {
              const crawlId = crawlLaunchRes.crawlId;
              console.log(`[Marina] Crawl launched: ${crawlId} — ${crawlLaunchRes.totalPages || '?'} pages`);

              // Poll until crawl completes — max 100s to stay within wall-clock
              const crawlStartTime = Date.now();
              const CRAWL_TIMEOUT_MS = 100_000;
              const CRAWL_POLL_MS = 5_000;
              let crawlDone = false;

              while (!crawlDone && (Date.now() - crawlStartTime) < CRAWL_TIMEOUT_MS) {
                await new Promise(r => setTimeout(r, CRAWL_POLL_MS));

                const { data: crawlStatus } = await sb
                  .from('site_crawls' as any)
                  .select('status, crawled_pages, total_pages')
                  .eq('id', crawlId)
                  .single();

                if (!crawlStatus) break;

                const status = (crawlStatus as any).status;
                const crawledPages = (crawlStatus as any).crawled_pages || 0;
                const totalPages = (crawlStatus as any).total_pages || 1;

                const crawlProgress = Math.min(78, 67 + Math.round((crawledPages / totalPages) * 11));
                await updateProgress(crawlProgress, 'multi_crawl');

                if (status === 'completed' || status === 'error' || status === 'analyzing') {
                  crawlDone = true;
                  console.log(`[Marina] Crawl ${crawlId} finished: ${status}, ${crawledPages}/${totalPages} pages`);
                  if (status === 'analyzing') {
                    await new Promise(r => setTimeout(r, 5_000));
                  }
                } else if ((Date.now() - crawlStartTime) > 60_000 && (Date.now() - crawlStartTime) % 30_000 < CRAWL_POLL_MS) {
                  fetch(`${SUPABASE_URL}/functions/v1/process-crawl-queue`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ trigger: 'marina-retry' }),
                  }).catch(() => {});
                }
              }

              if (!crawlDone) {
                console.warn(`[Marina] Crawl ${crawlId} timed out after 100s — proceeding with partial data`);
              }
            } else {
              console.warn(`[Marina] crawl-site failed: ${crawlLaunchRes?.error || 'unknown error'}`);
            }
          } catch (crawlErr) {
            console.warn(`[Marina] Multi-page crawl failed (non-fatal):`, crawlErr);
          }
        } else {
          console.log(`[Marina] Found existing crawl with ${(existingCrawls[0] as any).crawled_pages} pages — reusing`);
        }
      }

      await updateProgress(79, 'phase2_complete');
      console.log(`[Marina] ✅ Phase 2 complete — crawl done, launching Phase 3`);

      // Self-invoke phase 3
      await selfInvokePhase(jobId, url, detectedLang, 'phase3', { domain });

    } else if (currentPhase === 'phase3') {
      // ═══ PHASE 3: Cocoon + LLM Visibility + Report ═══
      console.log(`[Marina] Phase 3 starting for job ${jobId}`);

      // Load intermediate data from phase 1
      const { data: cached } = await sb
        .from('audit_cache')
        .select('result_data')
        .eq('cache_key', `marina_intermediate_${jobId}`)
        .single();

      if (!cached?.result_data) {
        throw new Error('Phase 3: intermediate data not found — phase 1 may have failed');
      }

      const { expertData, strategicData, domain, detectedLang } = cached.result_data as any;

      // Cleanup intermediate cache (fire-and-forget)
      sb.from('audit_cache').delete().eq('cache_key', `marina_intermediate_${jobId}`).then(() => {});

      await updateProgress(80, 'cocoon_analysis');

      // ─── LLM Visibility (parallel with cocoon) ───
      let llmVisibilityData: any = null;
      let trackedSiteId: string | null = null;
      {
        const { data: ts } = await sb
          .from('tracked_sites')
          .select('id')
          .eq('domain', domain)
          .maybeSingle();
        trackedSiteId = ts?.id || null;
      }

      const llmVisibilityPromise = (async () => {
        if (!trackedSiteId) return;
        try {
          console.log(`[Marina] Phase 3: calculate-llm-visibility for ${domain}`);
          const result = await callFunction('calculate-llm-visibility', {
            tracked_site_id: trackedSiteId,
            user_id: parentJob.user_id,
          });
          if (result && !result.error && (result.scores || result.data?.scores)) {
            llmVisibilityData = result;
            console.log(`[Marina] LLM visibility done: ${result.scores?.length || 0} LLMs scored`);
          } else {
            console.warn(`[Marina] LLM visibility returned no scores: ${result?.error || 'empty'}`);
          }
        } catch (e) {
          console.warn(`[Marina] LLM visibility failed (non-fatal):`, e);
        }
      })();

      // ─── Cocoon computation ───
      let cocoonResult: any = null;
      const COCOON_TIMEOUT_MS = 90_000; // 90s — safe within wall-clock
      try {
        cocoonResult = await Promise.race([
          (async () => {
            if (!trackedSiteId) {
              console.warn(`[Marina] No tracked_site for ${domain} — skipping cocoon`);
              return null;
            }

            console.log(`[Marina] Phase 3: calculate-cocoon-logic for tracked_site ${trackedSiteId}`);
            const result = await callFunction('calculate-cocoon-logic', {
              tracked_site_id: trackedSiteId,
              _user_id: parentJob.user_id,
            });

            if (result?.error) {
              console.warn(`[Marina] Cocoon returned error: ${result.error}`);
              return null;
            }

            console.log(`[Marina] Cocoon done: ${result?.stats?.nodes_count || 0} nodes`);

            // Lite Stratège
            try {
              console.log(`[Marina] Phase 3: Lite Stratège for cocoon recommendations`);
              const cocoonRecommendations = await generateLiteStrategeRecommendations(
                domain, result, expertData, strategicData, detectedLang,
              );
              if (cocoonRecommendations?.length) {
                result._stratege_recommendations = cocoonRecommendations;
                console.log(`[Marina] Lite Stratège: ${cocoonRecommendations.length} recommendations`);
              }
            } catch (stratErr) {
              console.warn(`[Marina] Lite Stratège failed (non-fatal):`, stratErr);
            }

            return result;
          })(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cocoon timeout')), COCOON_TIMEOUT_MS)),
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[Marina] Cocoon failed (non-fatal, ${msg.includes('timeout') ? 'TIMEOUT' : 'error'}):`, msg);
      }

      // Wait for LLM visibility if still running
      await llmVisibilityPromise;
      await updateProgress(85, 'generating_report');

      // ─── Step 4: Generate HTML reports ───
      let html: string;
      
      try {
        console.log(`[Marina] Phase 3 Step 4: Generating section HTMLs...`);
        
        const crawlHTML = generateCrawlSectionHTML(expertData, detectedLang, domain, url);
        const techHTML = generateTechSectionHTML(expertData, detectedLang, domain);
        const strategicHTML = generateStrategicSectionHTML(strategicData, detectedLang, domain, llmVisibilityData);
        const cocoonHTML = generateCocoonSectionHTML(cocoonResult, detectedLang, domain);

        const tempPrefix = `marina/tmp/${jobId}`;
        const storageUploads = [
          { path: `${tempPrefix}/1-crawl.html`, content: crawlHTML },
          { path: `${tempPrefix}/2-tech.html`, content: techHTML },
          { path: `${tempPrefix}/3-strategic.html`, content: strategicHTML },
          { path: `${tempPrefix}/4-cocoon.html`, content: cocoonHTML },
        ];

        await Promise.allSettled(
          storageUploads.map(({ path, content }) =>
            sb.storage.from('shared-reports').upload(path, new Blob([content], { type: 'text/html' }), {
              contentType: 'text/html',
              upsert: true,
            })
          )
        );
        console.log(`[Marina] 📦 4 section HTMLs stored`);

        await updateProgress(90, 'generating_report');

        html = compileMarinaReport(
          { crawl: crawlHTML, tech: techHTML, strategic: strategicHTML, cocoon: cocoonHTML },
          detectedLang, domain, url,
        );

        console.log(`[Marina] ✅ Compiled report from 4 sections`);

        Promise.allSettled(
          storageUploads.map(({ path }) => sb.storage.from('shared-reports').remove([path]))
        ).catch(() => {});

      } catch (compileError) {
        console.warn(`[Marina] ⚠️ Compilation failed, falling back to legacy generator:`, compileError);
        html = generateLegacyMarinaReport(url, domain, detectedLang, expertData, strategicData, cocoonResult);
      }

      // ─── Step 5: Store in shared-reports bucket ───
      const fileName = `marina/${jobId}.html`;
      const { error: uploadError } = await sb.storage
        .from('shared-reports')
        .upload(fileName, new Blob([html], { type: 'text/html' }), {
          contentType: 'text/html',
          upsert: true,
        });

      if (uploadError) {
        console.error(`[Marina] Upload error:`, uploadError);
      }

      const { data: signedUrlData } = await sb.storage
        .from('shared-reports')
        .createSignedUrl(fileName, 7 * 24 * 60 * 60);

      const resultData = {
        url,
        domain,
        language: detectedLang,
        report_url: signedUrlData?.signedUrl || null,
        report_path: fileName,
        expert_seo_score: expertData.totalScore,
        expert_seo_max: expertData.maxScore,
        strategic_score: strategicData?.overallScore || null,
        cocoon_nodes: cocoonResult?.stats?.nodes_count || null,
        cocoon_clusters: cocoonResult?.stats?.clusters_count || null,
        generated_at: new Date().toISOString(),
      };

      await sb.from('async_jobs').update({
        status: 'completed',
        result_data: resultData,
        progress: 100,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      console.log(`[Marina] ✅ Phase 2 complete — pipeline finished for ${domain}`);

      // ─── Step 6: Persist structured training data for ML ───
      try {
        const scores = expertData?.scores || {};
        await sb.from('marina_training_data').upsert({
          job_id: jobId,
          domain,
          url,
          language: detectedLang,
          seo_total_score: expertData.totalScore || null,
          seo_max_score: expertData.maxScore || null,
          seo_performance_score: scores.performance?.score || null,
          seo_technical_score: scores.technical?.score || null,
          seo_semantic_score: scores.semantic?.score || null,
          seo_ai_ready_score: scores.aiReady?.score || null,
          seo_security_score: scores.security?.score || null,
          geo_overall_score: strategicData?.overallScore || null,
          geo_scores: strategicData?.scores || {},
          cocoon_nodes_count: cocoonResult?.stats?.nodes_count || null,
          cocoon_clusters_count: cocoonResult?.stats?.clusters_count || null,
          has_schema_org: scores.aiReady?.hasSchemaOrg || null,
          has_robots_txt: scores.aiReady?.hasRobotsTxt || null,
          is_https: scores.technical?.isHttps === true || scores.technical?.isHttps === 'Oui' || null,
          word_count: scores.semantic?.wordCount || null,
          broken_links_count: scores.technical?.brokenLinksCount || null,
          psi_performance: scores.performance?.psiPerformance || null,
          psi_seo: scores.technical?.psiSeo || null,
          lcp_ms: scores.performance?.lcp || null,
          cls: scores.performance?.cls || null,
          tbt_ms: scores.performance?.tbt || null,
          is_spa: expertData.isSPA || null,
          report_url: signedUrlData?.signedUrl || null,
          raw_seo_data: { recommendations: expertData.recommendations || [], insights: expertData.insights || {} },
          raw_geo_data: { executive_roadmap: strategicData?.executive_roadmap || [], scores: strategicData?.scores || {} },
          raw_cocoon_data: cocoonResult ? { stats: cocoonResult.stats || {}, cluster_summary: cocoonResult.cluster_summary || {} } : {},
        }, { onConflict: 'job_id' });
        console.log(`[Marina] 📊 Training data saved for ${domain}`);
      } catch (trainErr) {
        console.warn(`[Marina] ⚠️ Training data save failed (non-fatal):`, trainErr);
      }
    }

  } catch (error) {
    console.error(`[Marina] ❌ Pipeline failed (${currentPhase}):`, error);
    await trackEdgeFunctionError('marina', error instanceof Error ? error.message : String(error)).catch(() => {});
    
    try {
      await sb.from('async_jobs').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Pipeline failed',
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    } catch (_) { /* ignore */ }
  }
}

// ─── Main server ───
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const sb = getServiceClient();
    const reqUrl = new URL(req.url);

    // ═══ GET: Poll job or generate key ═══
    if (req.method === 'GET') {
      const action = reqUrl.searchParams.get('action');
      
      if (action === 'generate_key') {
        // Admin only: generate a new Marina API key
        const authHeader = req.headers.get('Authorization') || '';
        if (!authHeader) return json({ error: 'Unauthorized' }, 401);
        
        const { createClient } = await import('npm:@supabase/supabase-js@2');
        const userSb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userSb.auth.getUser();
        if (!user) return json({ error: 'Unauthorized' }, 401);
        
        // Check admin
        const { data: isAdmin } = await sb.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (!isAdmin) return json({ error: 'Admin only' }, 403);
        
        const key = generateApiKey();
        // Store key in marina_api_keys table or config
        const { error: insertError } = await sb
          .from('site_config' as any)
          .upsert({ key: 'marina_api_key', value: key, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        
        if (insertError) {
          console.error('[Marina] Failed to store key:', insertError);
          return json({ error: 'Failed to store key' }, 500);
        }
        
        return json({ success: true, api_key: key });
      }
      
      // Poll job status
      const jobId = reqUrl.searchParams.get('job_id');
      if (!jobId) return json({ error: 'job_id required' }, 400);
      
      const { data: job } = await sb
        .from('async_jobs')
        .select('status, result_data, error_message, progress, input_payload')
        .eq('id', jobId)
        .single();
      
      if (!job) return json({ error: 'Job not found' }, 404);
      
      if (job.status === 'completed') {
        return json({ success: true, data: job.result_data, status: 'completed' });
      }
      if (job.status === 'failed') {
        return json({ success: false, error: job.error_message, status: 'failed' });
      }
      
      return json({ 
        status: job.status, 
        progress: job.progress,
        phase: (job.input_payload as any)?.phase || 'initializing',
      });
    }

    // ═══ POST: Start pipeline or list jobs ═══
    const body = await req.json();

    // ── Internal self-invocation with service role: skip auth ──
    const authHeader = req.headers.get('Authorization') || '';
    const isServiceCall = authHeader === `Bearer ${SERVICE_KEY}`;

    if (isServiceCall && body.action === 'run_job' && body.job_id) {
      const phase = body._phase || undefined;
      console.log(`[Marina] Worker: executing pipeline for job ${body.job_id} (phase: ${phase || 'phase1'})`);
      await runPipeline(body.job_id, body.url, body.lang, phase, body._intermediate);
      return json({ success: true, job_id: body.job_id });
    }

    // ── Auth: either API key or admin JWT ──
    let isAuthorized = false;
    let userId: string | undefined;

    if (isServiceCall) {
      isAuthorized = true;
      const { data: adminUser } = await sb
        .from('user_roles' as any)
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single();
      userId = (adminUser as any)?.user_id;
    }

    const apiKey = req.headers.get('x-marina-key') || body.api_key;
    if (!isAuthorized && apiKey) {
      const { data: configRow } = await sb
        .from('site_config' as any)
        .select('value')
        .eq('key', 'marina_api_key')
        .single();
      
      if (configRow && (configRow as any).value === apiKey) {
        isAuthorized = true;
        const { data: adminUser } = await sb
          .from('user_roles' as any)
          .select('user_id')
          .eq('role', 'admin')
          .limit(1)
          .single();
        userId = (adminUser as any)?.user_id;
      }
    }

    if (!isAuthorized) {
      if (authHeader) {
        const { createClient } = await import('npm:@supabase/supabase-js@2');
        const userSb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userSb.auth.getUser();
        if (user) {
          const { data: isAdmin } = await sb.rpc('has_role', { _user_id: user.id, _role: 'admin' });
          if (isAdmin) {
            isAuthorized = true;
            userId = user.id;
          }
        }
      }
    }

    if (!isAuthorized || !userId) {
      return json({ error: 'Unauthorized. Use x-marina-key header or admin JWT.' }, 401);
    }

    // ── List jobs ──
    if (body.action === 'list_jobs') {
      const { data: jobs } = await sb
        .from('async_jobs')
        .select('id, status, progress, result_data, error_message, created_at, completed_at, input_payload')
        .eq('function_name', 'marina')
        .order('created_at', { ascending: false })
        .limit(body.limit || 50);
      
      return json({ success: true, jobs: jobs || [] });
    }

    // ── Cancel job (interrupt a running job) ──
    if (body.action === 'cancel_job' && body.job_id) {
      const { error: cancelErr } = await sb
        .from('async_jobs')
        .update({ 
          status: 'failed', 
          error_message: 'Interrompu manuellement',
          completed_at: new Date().toISOString(),
        })
        .eq('id', body.job_id)
        .eq('function_name', 'marina')
        .in('status', ['pending', 'processing']);
      if (cancelErr) return json({ error: cancelErr.message }, 500);
      return json({ success: true, cancelled: true });
    }

    // ── Delete job ──
    if (body.action === 'delete_job' && body.job_id) {
      const { error: delErr } = await sb
        .from('async_jobs')
        .delete()
        .eq('id', body.job_id)
        .eq('function_name', 'marina');
      if (delErr) return json({ error: delErr.message }, 500);
      return json({ success: true });
    }

    // ── Auto-cleanup: mark jobs stuck > 10 min as failed ──
    try {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await sb
        .from('async_jobs')
        .update({ 
          status: 'failed', 
          error_message: 'Timeout: job bloqué depuis plus de 10 minutes',
          completed_at: new Date().toISOString(),
        })
        .eq('function_name', 'marina')
        .in('status', ['pending', 'processing'])
        .lt('created_at', tenMinAgo);
    } catch (e) {
      console.warn('[Marina] Auto-cleanup failed:', e);
    }


    // ── Start new pipeline ──
    const { url: targetUrl, lang } = body;
    if (!targetUrl) return json({ error: 'url is required' }, 400);

    // Create async job
    const { data: job, error: jobError } = await sb
      .from('async_jobs')
      .insert({
        user_id: userId,
        function_name: 'marina',
        status: 'pending',
        input_payload: { url: targetUrl, lang: lang || null },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return json({ error: 'Failed to create job' }, 500);
    }

    // Self-invocation: trigger a separate HTTP call that will run the pipeline
    // This ensures the pipeline runs as the main task of its own function instance
    fetch(`${SUPABASE_URL}/functions/v1/marina`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'run_job', job_id: job.id, url: targetUrl, lang: lang || null }),
    }).catch(err => {
      console.error('[Marina] Self-invocation failed:', err);
    });

    return json({ job_id: job.id, status: 'pending' });

  } catch (error) {
    console.error('[Marina] Error:', error);
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
