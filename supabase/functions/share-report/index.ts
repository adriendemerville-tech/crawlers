import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

interface ShareReportRequest {
  type: 'crawlers' | 'geo' | 'llm' | 'pagespeed' | 'expert-audit';
  url: string;
  data: any;
  language: string;
  preRenderedHtml?: string;
}

const translations = {
  fr: {
    title: 'Rapport d\'Analyse',
    crawlers: 'Analyse des Bots IA',
    geo: 'Analyse GEO',
    llm: 'Analyse de Visibilité LLM',
    pagespeed: 'Analyse PageSpeed',
    generatedAt: 'Généré le',
    analyzedUrl: 'URL analysée',
    score: 'Score',
    allowed: 'Autorisés',
    blocked: 'Bloqués',
    unknown: 'Inconnu',
    botName: 'Bot',
    status: 'Statut',
    category: 'Catégorie',
    passed: 'Réussi',
    failed: 'Échec',
    metric: 'Métrique',
    value: 'Valeur',
    performance: 'Performance',
    accessibility: 'Accessibilité',
    bestPractices: 'Bonnes Pratiques',
    seo: 'SEO',
    citationRate: 'Taux de Citation',
    sentiment: 'Sentiment',
    recommends: 'Recommande',
    poweredBy: 'Propulsé par Crawlers.fr',
  },
  en: {
    title: 'Analysis Report',
    crawlers: 'AI Bots Analysis',
    geo: 'GEO Analysis',
    llm: 'LLM Visibility Analysis',
    pagespeed: 'PageSpeed Analysis',
    generatedAt: 'Generated on',
    analyzedUrl: 'Analyzed URL',
    score: 'Score',
    allowed: 'Allowed',
    blocked: 'Blocked',
    unknown: 'Unknown',
    botName: 'Bot',
    status: 'Status',
    category: 'Category',
    passed: 'Passed',
    failed: 'Failed',
    metric: 'Metric',
    value: 'Value',
    performance: 'Performance',
    accessibility: 'Accessibility',
    bestPractices: 'Best Practices',
    seo: 'SEO',
    citationRate: 'Citation Rate',
    sentiment: 'Sentiment',
    recommends: 'Recommends',
    poweredBy: 'Powered by Crawlers.fr',
  },
  es: {
    title: 'Informe de Análisis',
    crawlers: 'Análisis de Bots IA',
    geo: 'Análisis GEO',
    llm: 'Análisis de Visibilidad LLM',
    pagespeed: 'Análisis PageSpeed',
    generatedAt: 'Generado el',
    analyzedUrl: 'URL analizada',
    score: 'Puntuación',
    allowed: 'Permitidos',
    blocked: 'Bloqueados',
    unknown: 'Desconocido',
    botName: 'Bot',
    status: 'Estado',
    category: 'Categoría',
    passed: 'Pasado',
    failed: 'Fallido',
    metric: 'Métrica',
    value: 'Valor',
    performance: 'Rendimiento',
    accessibility: 'Accesibilidad',
    bestPractices: 'Mejores Prácticas',
    seo: 'SEO',
    citationRate: 'Tasa de Citación',
    sentiment: 'Sentimiento',
    recommends: 'Recomienda',
    poweredBy: 'Impulsado por Crawlers.fr',
  },
};

function generateCrawlersHTML(data: any, t: any, url: string): string {
  const allowed = data.bots.filter((b: any) => b.status === 'allowed').length;
  const blocked = data.bots.filter((b: any) => b.status === 'blocked').length;
  const unknown = data.bots.filter((b: any) => b.status === 'unknown').length;

  const botsRows = data.bots.map((bot: any) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${bot.name}</strong><br>
        <small style="color: #6b7280;">${bot.company}</small>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; ${
          bot.status === 'allowed' ? 'background: #dcfce7; color: #166534;' :
          bot.status === 'blocked' ? 'background: #fee2e2; color: #991b1b;' :
          'background: #fef3c7; color: #92400e;'
        }">${bot.status === 'allowed' ? t.allowed : bot.status === 'blocked' ? t.blocked : t.unknown}</span>
      </td>
    </tr>
  `).join('');

  return `
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #1f2937; margin: 0;">${t.crawlers}</h2>
      <p style="color: #6b7280; margin-top: 8px;">${t.analyzedUrl}: <a href="${url}" style="color: #3b82f6;">${url}</a></p>
    </div>
    <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 30px;">
      <div style="text-align: center; padding: 20px; background: #dcfce7; border-radius: 12px; min-width: 100px;">
        <div style="font-size: 32px; font-weight: bold; color: #166534;">${allowed}</div>
        <div style="color: #166534; font-size: 14px;">${t.allowed}</div>
      </div>
      <div style="text-align: center; padding: 20px; background: #fee2e2; border-radius: 12px; min-width: 100px;">
        <div style="font-size: 32px; font-weight: bold; color: #991b1b;">${blocked}</div>
        <div style="color: #991b1b; font-size: 14px;">${t.blocked}</div>
      </div>
      <div style="text-align: center; padding: 20px; background: #fef3c7; border-radius: 12px; min-width: 100px;">
        <div style="font-size: 32px; font-weight: bold; color: #92400e;">${unknown}</div>
        <div style="color: #92400e; font-size: 14px;">${t.unknown}</div>
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">${t.botName}</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">${t.status}</th>
        </tr>
      </thead>
      <tbody>${botsRows}</tbody>
    </table>
  `;
}

function generateGeoHTML(data: any, t: any, url: string): string {
  const factorsRows = data.factors.map((factor: any) => {
    const passed = factor.status === 'good' || factor.passed;
    return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${factor.name}</strong><br>
        <small style="color: #6b7280;">${factor.description}</small>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; ${
          passed ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'
        }">${passed ? t.passed : t.failed}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold;">
        ${factor.score}/${factor.maxScore || 100}
      </td>
    </tr>
  `;}).join('');

  return `
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #1f2937; margin: 0;">${t.geo}</h2>
      <p style="color: #6b7280; margin-top: 8px;">${t.analyzedUrl}: <a href="${url}" style="color: #3b82f6;">${url}</a></p>
    </div>
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; padding: 30px 50px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 16px;">
        <div style="font-size: 48px; font-weight: bold; color: white;">${data.totalScore}/100</div>
        <div style="color: rgba(255,255,255,0.8); font-size: 14px;">${t.score} GEO</div>
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">${t.category}</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">${t.status}</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">${t.score}</th>
        </tr>
      </thead>
      <tbody>${factorsRows}</tbody>
    </table>
  `;
}

function generateLLMHTML(data: any, t: any, url: string): string {
  const citations = data.citations || data.llmResults || [];
  const llmsRows = citations.map((item: any) => {
    const name = item.provider?.name || item.name || 'Unknown';
    const cited = item.cited ?? item.mentioned ?? false;
    const sentiment = item.sentiment || 'neutral';
    const recommends = item.recommends ?? false;
    return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${name}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${cited ? '✅' : '❌'}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; ${
          sentiment === 'positive' || sentiment === 'mostly_positive' ? 'background: #dcfce7; color: #166534;' :
          sentiment === 'negative' ? 'background: #fee2e2; color: #991b1b;' :
          'background: #f3f4f6; color: #6b7280;'
        }">${sentiment}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${recommends ? '👍' : '—'}
      </td>
    </tr>
  `;}).join('');

  return `
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #1f2937; margin: 0;">${t.llm}</h2>
      <p style="color: #6b7280; margin-top: 8px;">${t.analyzedUrl}: <a href="${url}" style="color: #3b82f6;">${url}</a></p>
    </div>
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; padding: 30px 50px; background: linear-gradient(135deg, #8b5cf6, #ec4899); border-radius: 16px;">
        <div style="font-size: 48px; font-weight: bold; color: white;">${data.overallScore}/100</div>
        <div style="color: rgba(255,255,255,0.8); font-size: 14px;">${t.score} LLM</div>
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">LLM</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">${t.citationRate}</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">${t.sentiment}</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">${t.recommends}</th>
        </tr>
      </thead>
      <tbody>${llmsRows}</tbody>
    </table>
  `;
}

function generatePageSpeedHTML(data: any, t: any, url: string): string {
  const scores = data.scores;
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#166534';
    if (score >= 50) return '#92400e';
    return '#991b1b';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return '#dcfce7';
    if (score >= 50) return '#fef3c7';
    return '#fee2e2';
  };

  return `
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #1f2937; margin: 0;">${t.pagespeed}</h2>
      <p style="color: #6b7280; margin-top: 8px;">${t.analyzedUrl}: <a href="${url}" style="color: #3b82f6;">${url}</a></p>
    </div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px;">
      <div style="text-align: center; padding: 20px; background: ${getScoreBg(scores.performance)}; border-radius: 12px;">
        <div style="font-size: 32px; font-weight: bold; color: ${getScoreColor(scores.performance)};">${scores.performance}</div>
        <div style="color: ${getScoreColor(scores.performance)}; font-size: 12px;">${t.performance}</div>
      </div>
      <div style="text-align: center; padding: 20px; background: ${getScoreBg(scores.accessibility)}; border-radius: 12px;">
        <div style="font-size: 32px; font-weight: bold; color: ${getScoreColor(scores.accessibility)};">${scores.accessibility}</div>
        <div style="color: ${getScoreColor(scores.accessibility)}; font-size: 12px;">${t.accessibility}</div>
      </div>
      <div style="text-align: center; padding: 20px; background: ${getScoreBg(scores.bestPractices)}; border-radius: 12px;">
        <div style="font-size: 32px; font-weight: bold; color: ${getScoreColor(scores.bestPractices)};">${scores.bestPractices}</div>
        <div style="color: ${getScoreColor(scores.bestPractices)}; font-size: 12px;">${t.bestPractices}</div>
      </div>
      <div style="text-align: center; padding: 20px; background: ${getScoreBg(scores.seo)}; border-radius: 12px;">
        <div style="font-size: 32px; font-weight: bold; color: ${getScoreColor(scores.seo)};">${scores.seo}</div>
        <div style="color: ${getScoreColor(scores.seo)}; font-size: 12px;">${t.seo}</div>
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">${t.metric}</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">${t.value}</th>
        </tr>
      </thead>
      <tbody>
        ${[
          ['First Contentful Paint (FCP)', scores.fcp],
          ['Largest Contentful Paint (LCP)', scores.lcp],
          ['Cumulative Layout Shift (CLS)', scores.cls],
          ['Total Blocking Time (TBT)', scores.tbt],
          ['Speed Index', scores.speedIndex],
          ['Time to Interactive (TTI)', scores.tti],
        ].filter(([, v]) => v).map(([key, value]) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${key}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold;">${value}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function generateExpertAuditHTML(data: any, t: any, url: string): string {
  const auditMode = data.auditMode || 'technical';
  const result = data.result || data;
  const domain = result.domain || url;
  const auditLabel = auditMode === 'technical' ? 'Audit Technique' : 'Audit Stratégique';

  let sections = `<div style="text-align:center;margin-bottom:30px;">
    <h1 style="font-size:24px;font-weight:700;color:#1f2937;">${domain}</h1>
    <p style="font-size:16px;color:#6b7280;">${auditLabel}</p>
    <p style="font-size:13px;color:#9ca3af;margin-top:4px;">Score: ${result.totalScore || 0}/${result.maxScore || 200}</p>
  </div>`;

  if (result.strategicAnalysis?.introduction?.main_narrative) {
    sections += `<div style="padding:16px;background:#f9fafb;border-radius:12px;margin-bottom:16px;">
      <p style="font-size:14px;color:#374151;line-height:1.6;">${result.strategicAnalysis.introduction.main_narrative}</p>
    </div>`;
  }

  if (result.recommendations?.length) {
    const recsHtml = result.recommendations.slice(0, 8).map((r: any) =>
      `<li style="margin-bottom:8px;font-size:14px;color:#374151;">${r.title || r}</li>`
    ).join('');
    sections += `<div style="margin-top:16px;"><h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">Recommandations</h3><ul style="padding-left:20px;">${recsHtml}</ul></div>`;
  }

  return sections;
}

function generateReportHTML(type: string, data: any, url: string, language: string): string {
  const t = translations[language as keyof typeof translations] || translations.en;
  const now = new Date().toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US');

  let content = '';
  switch (type) {
    case 'crawlers':
      content = generateCrawlersHTML(data, t, url);
      break;
    case 'geo':
      content = generateGeoHTML(data, t, url);
      break;
    case 'llm':
      content = generateLLMHTML(data, t, url);
      break;
    case 'pagespeed':
      content = generatePageSpeedHTML(data, t, url);
      break;
    case 'expert-audit':
      content = generateExpertAuditHTML(data, t, url);
      break;
  }

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - ${t[type as keyof typeof t] || type}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f3f4f6; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: 700; color: #3b82f6; margin-bottom: 8px; }
    .date { color: #6b7280; font-size: 14px; }
    .content { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .footer { text-align: center; margin-top: 40px; color: #9ca3af; font-size: 12px; }
    .footer a { color: #3b82f6; text-decoration: none; }
    @media (max-width: 600px) {
      .content { padding: 20px; }
      div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🤖 Crawlers</div>
      <div class="date">${t.generatedAt} ${now}</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      ${t.poweredBy} • <a href="https://crawlers.fr">crawlers.fr</a>
    </div>
  </div>
</body>
</html>`;
}

// Generate a short alphanumeric ID (7 characters)
function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(7);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 7; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

Deno.serve(handleRequest(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, url, data, language, preRenderedHtml }: ShareReportRequest = await req.json();

    const supabase = getServiceClient();

    // Use pre-rendered HTML if provided (expert-audit with full rich report), otherwise generate
    const html = preRenderedHtml || generateReportHTML(type, data, url, language);
    const shortId = generateShortId();
    const fileName = `reports/${shortId}.html`;

    // Encode as Uint8Array so Supabase respects the contentType header
    const htmlBytes = new TextEncoder().encode(html);

    // Upload to storage — use Blob to set exact MIME without charset suffix
    const htmlBlob = new Blob([htmlBytes], { type: 'text/html' });

    const { error: uploadError } = await supabase.storage
      .from('shared-reports')
      .upload(fileName, htmlBlob, {
        contentType: 'text/html',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log(`Report uploaded with shortId: ${shortId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        shareId: shortId,
        expiresIn: '7 days'
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: any) {
    console.error("Error in share-report function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
}, 'share-report'))
