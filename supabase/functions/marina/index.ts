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
  return 'en'; // default
}

// ─── Combined HTML Report Generator ───
function generateMarinaReport(
  url: string,
  domain: string,
  lang: string,
  expertSeoData: any,
  strategicData: any,
  cocoonData: any | null,
): string {
  const t = {
    fr: {
      title: 'Rapport SEO & GEO Complet',
      generatedFor: 'Rapport généré pour',
      generatedAt: 'Généré le',
      techAudit: 'Audit Technique SEO',
      strategicAudit: 'Audit Stratégique GEO',
      cocoonAnalysis: 'Analyse Cocon Sémantique',
      score: 'Score',
      outOf: 'sur',
      recommendations: 'Recommandations',
      strengths: 'Points forts',
      improvements: 'Axes d\'amélioration',
      executiveSummary: 'Synthèse exécutive',
      roadmap: 'Plan d\'action prioritaire',
      priority: 'Priorité',
      action: 'Action',
      expectedRoi: 'ROI attendu',
      cocoonStats: 'Statistiques du cocon',
      nodes: 'Pages analysées',
      clusters: 'Clusters thématiques',
      edges: 'Liens sémantiques',
      noData: 'Données non disponibles',
      poweredBy: 'Propulsé par Crawlers AI',
      critical: 'Prioritaire',
      important: 'Important',
      opportunity: 'Opportunité',
    },
    en: {
      title: 'Complete SEO & GEO Report',
      generatedFor: 'Report generated for',
      generatedAt: 'Generated on',
      techAudit: 'Technical SEO Audit',
      strategicAudit: 'Strategic GEO Audit',
      cocoonAnalysis: 'Semantic Cocoon Analysis',
      score: 'Score',
      outOf: 'out of',
      recommendations: 'Recommendations',
      strengths: 'Strengths',
      improvements: 'Areas for improvement',
      executiveSummary: 'Executive Summary',
      roadmap: 'Priority Action Plan',
      priority: 'Priority',
      action: 'Action',
      expectedRoi: 'Expected ROI',
      cocoonStats: 'Cocoon Statistics',
      nodes: 'Pages analyzed',
      clusters: 'Thematic clusters',
      edges: 'Semantic links',
      noData: 'Data not available',
      poweredBy: 'Powered by Crawlers AI',
      critical: 'Critical',
      important: 'Important',
      opportunity: 'Opportunity',
    },
    es: {
      title: 'Informe SEO y GEO Completo',
      generatedFor: 'Informe generado para',
      generatedAt: 'Generado el',
      techAudit: 'Auditoría Técnica SEO',
      strategicAudit: 'Auditoría Estratégica GEO',
      cocoonAnalysis: 'Análisis de Capullo Semántico',
      score: 'Puntuación',
      outOf: 'de',
      recommendations: 'Recomendaciones',
      strengths: 'Fortalezas',
      improvements: 'Áreas de mejora',
      executiveSummary: 'Resumen ejecutivo',
      roadmap: 'Plan de acción prioritario',
      priority: 'Prioridad',
      action: 'Acción',
      expectedRoi: 'ROI esperado',
      cocoonStats: 'Estadísticas del capullo',
      nodes: 'Páginas analizadas',
      clusters: 'Clusters temáticos',
      edges: 'Enlaces semánticos',
      noData: 'Datos no disponibles',
      poweredBy: 'Desarrollado por Crawlers AI',
      critical: 'Crítico',
      important: 'Importante',
      opportunity: 'Oportunidad',
    },
  };
  
  const tr = t[lang as keyof typeof t] || t.en;
  const now = new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US');

  // Extract expert SEO data
  const techScore = expertSeoData?.totalScore || 0;
  const techMaxScore = expertSeoData?.maxScore || 200;
  const techRecommendations = expertSeoData?.recommendations || [];
  const techIntro = expertSeoData?.introduction || '';

  // Extract strategic data
  const stratScore = strategicData?.overallScore || 0;
  const stratIntro = strategicData?.introduction || {};
  const stratRoadmap = strategicData?.executive_roadmap || [];
  const stratSummary = strategicData?.executive_summary || '';

  // Cocoon stats
  const cocoonStats = cocoonData?.stats || null;

  const priorityColors: Record<string, string> = {
    'Prioritaire': '#ef4444', 'Critical': '#ef4444', 'Crítico': '#ef4444',
    'Important': '#f59e0b', 'Importante': '#f59e0b',
    'Opportunité': '#22c55e', 'Opportunity': '#22c55e', 'Oportunidad': '#22c55e',
  };

  function scoreColor(score: number, max: number): string {
    const pct = score / max * 100;
    if (pct >= 70) return '#22c55e';
    if (pct >= 40) return '#f59e0b';
    return '#ef4444';
  }

  function renderRecommendations(recs: any[]): string {
    if (!recs || recs.length === 0) return `<p style="color:#6b7280;">${tr.noData}</p>`;
    return recs.map((r: any) => {
      const title = typeof r === 'string' ? r : r.title || r.label || '';
      const desc = typeof r === 'string' ? '' : r.description || r.detail || '';
      const priority = typeof r === 'string' ? '' : r.priority || '';
      const color = priorityColors[priority] || '#6b7280';
      return `<div style="padding:12px;margin-bottom:8px;background:#f9fafb;border-left:3px solid ${color};border-radius:4px;">
        ${priority ? `<span style="font-size:11px;color:${color};font-weight:600;text-transform:uppercase;">${priority}</span>` : ''}
        <div style="font-weight:500;margin-top:2px;">${title}</div>
        ${desc ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;">${desc}</div>` : ''}
      </div>`;
    }).join('');
  }

  function renderRoadmap(items: any[]): string {
    if (!items || items.length === 0) return '';
    return `<table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">${tr.priority}</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">${tr.action}</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">${tr.expectedRoi}</th>
      </tr></thead>
      <tbody>${items.map((item: any) => {
        const color = priorityColors[item.priority] || '#6b7280';
        return `<tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 12px;"><span style="color:${color};font-weight:600;font-size:13px;">${item.priority || '-'}</span></td>
          <td style="padding:8px 12px;font-size:13px;">${item.prescriptive_action || item.title || '-'}</td>
          <td style="padding:8px 12px;font-size:13px;color:#6b7280;">${item.expected_roi || '-'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tr.title} - ${domain}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; padding: 24px 16px; color: #1e293b; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; opacity: 0.85; }
    .header .date { font-size: 12px; opacity: 0.7; margin-top: 8px; }
    .section { background: white; border-radius: 10px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .section-title { font-size: 17px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .score-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 18px; color: white; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .stat-card { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-card .value { font-size: 24px; font-weight: 700; color: #3b82f6; }
    .stat-card .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .intro-text { font-size: 14px; color: #374151; line-height: 1.7; margin-bottom: 16px; }
    .footer { text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; margin-top: 20px; }
    .footer a { color: #3b82f6; text-decoration: none; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm 10mm; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${tr.title}</h1>
      <div class="subtitle">${tr.generatedFor}: <strong>${domain}</strong></div>
      <div class="subtitle">${url}</div>
      <div class="date">${tr.generatedAt}: ${now}</div>
    </div>

    <!-- 1. Technical SEO Audit -->
    <div class="section">
      <div class="section-title">🔍 ${tr.techAudit}</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div class="score-badge" style="background:${scoreColor(techScore, techMaxScore)}">
          ${techScore} / ${techMaxScore}
        </div>
        <span style="color:#6b7280;font-size:13px;">${tr.score}</span>
      </div>
      ${typeof techIntro === 'string' && techIntro ? `<div class="intro-text">${techIntro}</div>` : 
        typeof techIntro === 'object' && techIntro.presentation ? `<div class="intro-text">${techIntro.presentation}</div>` : ''}
      <h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;">${tr.recommendations}</h3>
      ${renderRecommendations(techRecommendations)}
    </div>

    <!-- 2. Strategic GEO Audit -->
    <div class="section">
      <div class="section-title">🎯 ${tr.strategicAudit}</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div class="score-badge" style="background:${scoreColor(stratScore, 100)}">
          ${stratScore} / 100
        </div>
      </div>
      ${stratIntro?.presentation ? `<div class="intro-text">${stratIntro.presentation}</div>` : ''}
      ${stratIntro?.strengths ? `<div class="intro-text"><strong>${tr.strengths}:</strong> ${stratIntro.strengths}</div>` : ''}
      ${stratIntro?.improvement ? `<div class="intro-text"><strong>${tr.improvements}:</strong> ${stratIntro.improvement}</div>` : ''}
      ${stratSummary ? `<h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;">${tr.executiveSummary}</h3><div class="intro-text">${stratSummary}</div>` : ''}
      ${stratRoadmap.length > 0 ? `<h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;">${tr.roadmap}</h3>${renderRoadmap(stratRoadmap)}` : ''}
    </div>

    <!-- 3. Semantic Cocoon -->
    ${cocoonStats ? `
    <div class="section">
      <div class="section-title">🕸️ ${tr.cocoonAnalysis}</div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="value">${cocoonStats.nodes_count || 0}</div>
          <div class="label">${tr.nodes}</div>
        </div>
        <div class="stat-card">
          <div class="value">${cocoonStats.clusters_count || 0}</div>
          <div class="label">${tr.clusters}</div>
        </div>
        <div class="stat-card">
          <div class="value">${cocoonStats.edges_count || 0}</div>
          <div class="label">${tr.edges}</div>
        </div>
      </div>
    </div>` : ''}

    <div class="footer">
      <div>${tr.poweredBy}</div>
      <div style="margin-top:4px;"><a href="https://crawlers.fr">crawlers.fr</a></div>
    </div>
  </div>
</body>
</html>`;
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

// ─── Worker: runs the full pipeline ───
async function runPipeline(jobId: string, url: string, lang?: string) {
  const sb = getServiceClient();
  const { data: parentJob } = await sb
    .from('async_jobs')
    .select('user_id')
    .eq('id', jobId)
    .single();

  if (!parentJob?.user_id) {
    throw new Error('Parent Marina job missing user_id');
  }
  
  const updateProgress = async (progress: number, phase?: string) => {
    try {
      const updateData: any = { progress };
      if (phase) updateData.input_payload = { phase, url };
      if (progress === 5) updateData.started_at = new Date().toISOString();
      updateData.status = 'processing';
      await sb.from('async_jobs').update(updateData).eq('id', jobId);
    } catch (_) { /* ignore */ }
  };

  try {
    await updateProgress(5, 'crawling');
    
    // ─── Step 1: Technical SEO Audit (includes crawl) ───
    console.log(`[Marina] Step 1: audit-expert-seo for ${url}`);
    const expertResult = await callFunction('audit-expert-seo', { url, lang: lang || 'fr' });
    
    if (!expertResult?.success || !expertResult?.data) {
      throw new Error(`Expert SEO audit failed: ${expertResult?.error || 'No data returned'}`);
    }
    
    const domain = expertResult.data.domain;
    const detectedLang = lang || detectLanguage(expertResult.data?.rawData?.htmlAnalysis?.html || '');
    
    console.log(`[Marina] Expert SEO done. Score: ${expertResult.data.totalScore}. Lang: ${detectedLang}`);
    await updateProgress(30, 'strategic_audit');

    // ─── Step 2: Strategic GEO Audit ───
    console.log(`[Marina] Step 2: strategic-orchestrator for ${url}`);
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
    await updateProgress(65, 'cocoon');

    // ─── Step 3: Cocoon (optional, requires tracked_site) ───
    let cocoonResult: any = null;
    try {
      // Check if domain has a tracked_site
      const { data: trackedSite } = await sb
        .from('tracked_sites')
        .select('id')
        .ilike('domain', `%${domain}%`)
        .limit(1)
        .single();
      
      if (trackedSite) {
        console.log(`[Marina] Step 3: calculate-cocoon-logic for tracked_site ${trackedSite.id}`);
        cocoonResult = await callFunction('calculate-cocoon-logic', { 
          tracked_site_id: trackedSite.id 
        });
        console.log(`[Marina] Cocoon done: ${cocoonResult?.stats?.nodes_count || 0} nodes`);
      } else {
        console.log(`[Marina] No tracked_site for ${domain}, skipping cocoon`);
      }
    } catch (e) {
      console.warn(`[Marina] Cocoon failed (non-fatal):`, e);
    }
    
    await updateProgress(85, 'generating_report');

    // ─── Step 4: Generate combined HTML report ───
    const html = generateMarinaReport(
      url, domain, detectedLang,
      expertResult.data,
      strategicData,
      cocoonResult,
    );

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

    // Generate signed URL (valid 7 days)
    const { data: signedUrlData } = await sb.storage
      .from('shared-reports')
      .createSignedUrl(fileName, 7 * 24 * 60 * 60);

    const resultData = {
      url,
      domain,
      language: detectedLang,
      report_url: signedUrlData?.signedUrl || null,
      report_path: fileName,
      expert_seo_score: expertResult.data.totalScore,
      expert_seo_max: expertResult.data.maxScore,
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

    console.log(`[Marina] ✅ Pipeline completed for ${domain}`);

    // ─── Step 6: Persist structured training data for ML ───
    try {
      const scores = expertResult.data?.scores || {};
      await sb.from('marina_training_data').upsert({
        job_id: jobId,
        domain,
        url,
        language: detectedLang,
        seo_total_score: expertResult.data.totalScore || null,
        seo_max_score: expertResult.data.maxScore || null,
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
        is_spa: expertResult.data.isSPA || null,
        report_url: signedUrlData?.signedUrl || null,
        raw_seo_data: { recommendations: expertResult.data.recommendations || [], insights: expertResult.data.insights || {} },
        raw_geo_data: { executive_roadmap: strategicData?.executive_roadmap || [], scores: strategicData?.scores || {} },
        raw_cocoon_data: cocoonResult ? { stats: cocoonResult.stats || {}, cluster_summary: cocoonResult.cluster_summary || {} } : {},
      }, { onConflict: 'job_id' });
      console.log(`[Marina] 📊 Training data saved for ${domain}`);
    } catch (trainErr) {
      console.warn(`[Marina] ⚠️ Training data save failed (non-fatal):`, trainErr);
    }

  } catch (error) {
    console.error(`[Marina] ❌ Pipeline failed:`, error);
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
        
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
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
      console.log(`[Marina] Worker: executing pipeline for job ${body.job_id}`);
      await runPipeline(body.job_id, body.url, body.lang);
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
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
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

    return json({ job_id: job.id, status: 'pending' }, 202);

  } catch (error) {
    console.error('[Marina] Error:', error);
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
