import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShareReportRequest {
  type: 'crawlers' | 'geo' | 'llm' | 'pagespeed';
  url: string;
  data: any;
  language: string;
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
    poweredBy: 'Propulsé par Crawlers.lovable.app',
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
    poweredBy: 'Powered by Crawlers.lovable.app',
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
    poweredBy: 'Impulsado por Crawlers.lovable.app',
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
  const factorsRows = data.factors.map((factor: any) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${factor.name}</strong><br>
        <small style="color: #6b7280;">${factor.description}</small>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; ${
          factor.passed ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'
        }">${factor.passed ? t.passed : t.failed}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold;">
        ${factor.score}/100
      </td>
    </tr>
  `).join('');

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
  const llmsRows = data.llmResults.map((llm: any) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${llm.name}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${llm.mentioned ? '✅' : '❌'}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; ${
          llm.sentiment === 'positive' ? 'background: #dcfce7; color: #166534;' :
          llm.sentiment === 'negative' ? 'background: #fee2e2; color: #991b1b;' :
          'background: #f3f4f6; color: #6b7280;'
        }">${llm.sentiment}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${llm.recommends ? '👍' : '—'}
      </td>
    </tr>
  `).join('');

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
        ${Object.entries(data.metrics).map(([key, value]: [string, any]) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${key}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold;">${value}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
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
      ${t.poweredBy} • <a href="https://crawlers.lovable.app">crawlers.lovable.app</a>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, url, data, language }: ShareReportRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const html = generateReportHTML(type, data, url, language);
    const reportId = crypto.randomUUID();
    const fileName = `reports/${reportId}.html`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('shared-reports')
      .upload(fileName, html, {
        contentType: 'text/html',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL (expires in 7 days)
    const { data: urlData } = await supabase.storage
      .from('shared-reports')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

    if (!urlData?.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        shareUrl: urlData.signedUrl,
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
});
