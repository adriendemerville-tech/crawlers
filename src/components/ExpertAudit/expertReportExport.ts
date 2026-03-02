import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExpertAuditResult } from '@/types/expertAudit';

export const expertReportTranslations = {
  fr: {
    title: "Rapport d'Audit Expert",
    download: 'Télécharger .pdf',
    share: 'Partager',
    print: 'Imprimer',
    generating: 'Génération...',
    sharing: 'Création du lien...',
    shareLink: 'Lien de partage (valide 7 jours)',
    copyLink: 'Copier',
    copied: 'Copié !',
    shareSuccess: 'Lien de partage créé !',
    shareError: 'Erreur lors de la création du lien',
    pdfSuccess: 'PDF téléchargé !',
    pdfError: 'Erreur lors de la génération du PDF',
    generatedAt: 'Généré le',
    score: 'Score',
    performance: 'Performance',
    technical: 'Socle Technique',
    semantic: 'Sémantique & Contenu',
    aiReady: 'Préparation IA & GEO',
    security: 'Santé & Sécurité',
    recommendations: 'Recommandations',
    critical: 'Critique',
    important: 'Important',
    optional: 'Optionnel',
    strategic: 'Audit Stratégique IA',
    technicalAudit: 'Audit Technique SEO',
    brandIdentity: 'Identité de Marque',
    marketPositioning: 'Positionnement Marché',
    geoScore: 'Score GEO',
    roadmap: 'Roadmap Stratégique',
    executiveSummary: 'Synthèse Exécutive',
    introduction: 'Introduction',
    poweredBy: 'Crawlers.fr - Audit SEO & GEO Expert',
  },
  en: {
    title: 'Expert Audit Report',
    download: 'Download .pdf',
    share: 'Share',
    print: 'Print',
    generating: 'Generating...',
    sharing: 'Creating link...',
    shareLink: 'Share link (valid 7 days)',
    copyLink: 'Copy',
    copied: 'Copied!',
    shareSuccess: 'Share link created!',
    shareError: 'Error creating share link',
    pdfSuccess: 'PDF downloaded!',
    pdfError: 'Error generating PDF',
    generatedAt: 'Generated on',
    score: 'Score',
    performance: 'Performance',
    technical: 'Technical Foundation',
    semantic: 'Semantic & Content',
    aiReady: 'AI & GEO Ready',
    security: 'Health & Security',
    recommendations: 'Recommendations',
    critical: 'Critical',
    important: 'Important',
    optional: 'Optional',
    strategic: 'Strategic AI Audit',
    technicalAudit: 'Technical SEO Audit',
    brandIdentity: 'Brand Identity',
    marketPositioning: 'Market Positioning',
    geoScore: 'GEO Score',
    roadmap: 'Strategic Roadmap',
    executiveSummary: 'Executive Summary',
    introduction: 'Introduction',
    poweredBy: 'Crawlers.fr - Expert SEO & GEO Audit',
  },
  es: {
    title: 'Informe de Auditoría Experta',
    download: 'Descargar .pdf',
    share: 'Compartir',
    print: 'Imprimir',
    generating: 'Generando...',
    sharing: 'Creando enlace...',
    shareLink: 'Enlace para compartir (válido 7 días)',
    copyLink: 'Copiar',
    copied: '¡Copiado!',
    shareSuccess: '¡Enlace de compartir creado!',
    shareError: 'Error al crear el enlace',
    pdfSuccess: '¡PDF descargado!',
    pdfError: 'Error al generar el PDF',
    generatedAt: 'Generado el',
    score: 'Puntuación',
    performance: 'Rendimiento',
    technical: 'Base Técnica',
    semantic: 'Semántica y Contenido',
    aiReady: 'IA y GEO',
    security: 'Salud y Seguridad',
    recommendations: 'Recomendaciones',
    critical: 'Crítico',
    important: 'Importante',
    optional: 'Opcional',
    strategic: 'Auditoría Estratégica IA',
    technicalAudit: 'Auditoría Técnica SEO',
    brandIdentity: 'Identidad de Marca',
    marketPositioning: 'Posicionamiento de Mercado',
    geoScore: 'Puntuación GEO',
    roadmap: 'Hoja de Ruta Estratégica',
    executiveSummary: 'Resumen Ejecutivo',
    introduction: 'Introducción',
    poweredBy: 'Crawlers.fr - Auditoría Experta SEO & GEO',
  },
} as const;

export type ExpertReportI18n = {
  [K in keyof typeof expertReportTranslations.fr]: string;
};

export function generateExpertReportHTML(
  result: ExpertAuditResult,
  auditMode: 'technical' | 'strategic',
  t: ExpertReportI18n,
  language: string
): string {
  const now = new Date(result.scannedAt).toLocaleString(
    language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US'
  );

  const getScoreColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.8) return '#166534';
    if (ratio >= 0.5) return '#92400e';
    return '#991b1b';
  };

  const getScoreBg = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.8) return '#dcfce7';
    if (ratio >= 0.5) return '#fef3c7';
    return '#fee2e2';
  };

  let content = '';

  if (auditMode === 'technical') {
    const scores = result.scores;

    content = `
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="display: inline-block; padding: 30px 50px; background: linear-gradient(135deg, #7c3aed, #2563eb); border-radius: 20px; margin-bottom: 20px;">
          <div style="font-size: 56px; font-weight: bold; color: white;">${result.totalScore}/200</div>
          <div style="color: rgba(255,255,255,0.9); font-size: 16px;">${t.score} Global</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 40px;">
        <div style="text-align: center; padding: 16px 8px; background: ${getScoreBg(scores.performance.score, scores.performance.maxScore)}; border-radius: 12px;">
          <div style="font-size: 24px; font-weight: bold; color: ${getScoreColor(scores.performance.score, scores.performance.maxScore)};">${scores.performance.score}/${scores.performance.maxScore}</div>
          <div style="color: ${getScoreColor(scores.performance.score, scores.performance.maxScore)}; font-size: 11px; margin-top: 4px;">${t.performance}</div>
        </div>
        <div style="text-align: center; padding: 16px 8px; background: ${getScoreBg(scores.technical.score, scores.technical.maxScore)}; border-radius: 12px;">
          <div style="font-size: 24px; font-weight: bold; color: ${getScoreColor(scores.technical.score, scores.technical.maxScore)};">${scores.technical.score}/${scores.technical.maxScore}</div>
          <div style="color: ${getScoreColor(scores.technical.score, scores.technical.maxScore)}; font-size: 11px; margin-top: 4px;">${t.technical}</div>
        </div>
        <div style="text-align: center; padding: 16px 8px; background: ${getScoreBg(scores.semantic.score, scores.semantic.maxScore)}; border-radius: 12px;">
          <div style="font-size: 24px; font-weight: bold; color: ${getScoreColor(scores.semantic.score, scores.semantic.maxScore)};">${scores.semantic.score}/${scores.semantic.maxScore}</div>
          <div style="color: ${getScoreColor(scores.semantic.score, scores.semantic.maxScore)}; font-size: 11px; margin-top: 4px;">${t.semantic}</div>
        </div>
        <div style="text-align: center; padding: 16px 8px; background: ${getScoreBg(scores.aiReady.score, scores.aiReady.maxScore)}; border-radius: 12px;">
          <div style="font-size: 24px; font-weight: bold; color: ${getScoreColor(scores.aiReady.score, scores.aiReady.maxScore)};">${scores.aiReady.score}/${scores.aiReady.maxScore}</div>
          <div style="color: ${getScoreColor(scores.aiReady.score, scores.aiReady.maxScore)}; font-size: 11px; margin-top: 4px;">${t.aiReady}</div>
        </div>
        <div style="text-align: center; padding: 16px 8px; background: ${getScoreBg(scores.security.score, scores.security.maxScore)}; border-radius: 12px;">
          <div style="font-size: 24px; font-weight: bold; color: ${getScoreColor(scores.security.score, scores.security.maxScore)};">${scores.security.score}/${scores.security.maxScore}</div>
          <div style="color: ${getScoreColor(scores.security.score, scores.security.maxScore)}; font-size: 11px; margin-top: 4px;">${t.security}</div>
        </div>
      </div>

      ${result.introduction ? `
        <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #7c3aed;">
          <p style="color: #374151; line-height: 1.7; margin: 0 0 12px 0;">${result.introduction.presentation}</p>
          <p style="color: #374151; line-height: 1.7; margin: 0 0 12px 0;">${result.introduction.strengths}</p>
          <p style="color: #374151; line-height: 1.7; margin: 0;">${result.introduction.improvement}</p>
        </div>
      ` : ''}

      ${result.recommendations?.length > 0 ? `
        <h3 style="font-size: 18px; color: #1f2937; margin-bottom: 16px;">${t.recommendations}</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Priorité</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Recommandation</th>
            </tr>
          </thead>
          <tbody>
            ${result.recommendations.slice(0, 10).map(rec => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                  <span style="padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; ${
                    rec.priority === 'critical' ? 'background: #fee2e2; color: #991b1b;' :
                    rec.priority === 'important' ? 'background: #fef3c7; color: #92400e;' :
                    'background: #dcfce7; color: #166534;'
                  }">${rec.priority === 'critical' ? t.critical : rec.priority === 'important' ? t.important : t.optional}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                  <strong>${rec.title}</strong><br>
                  <small style="color: #6b7280;">${rec.description}</small>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    `;
  } else {
    const strategic = result.strategicAnalysis;
    const geoScore = strategic?.geo_score?.score || strategic?.overallScore || 0;

    const keywordsTitle =
      language === 'fr' ? 'Mots clés' : language === 'es' ? 'Palabras clave' : 'Keywords';
    const kp = strategic?.keyword_positioning;
    const ms = strategic?.market_data_summary;

    const keywordsSection = (() => {
      const renderNumber = (n: any) => {
        const num = typeof n === 'number' ? n : Number(n);
        if (!Number.isFinite(num)) return '—';
        return num.toLocaleString();
      };
      const renderRank = (rank: any) => {
        if (typeof rank === 'number' && Number.isFinite(rank)) return `#${rank}`;
        if (typeof rank === 'string' && rank.trim()) return rank;
        return '—';
      };

      const summary = ms
        ? `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">
            <div style="padding: 12px; background: #f8fafc; border-radius: 10px; text-align: center;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Volume marché / mois</div>
              <div style="font-weight: 700; color: #0f172a;">${renderNumber(ms.total_market_volume)}</div>
            </div>
            <div style="padding: 12px; background: #f8fafc; border-radius: 10px; text-align: center;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Mots-clés classés</div>
              <div style="font-weight: 700; color: #0f172a;">${renderNumber(ms.keywords_ranked)}/${renderNumber(ms.keywords_analyzed)}</div>
            </div>
            <div style="padding: 12px; background: #f8fafc; border-radius: 10px; text-align: center;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Position moyenne</div>
              <div style="font-weight: 700; color: #0f172a;">${
                typeof ms.average_position === 'number' && ms.average_position > 0
                  ? `#${ms.average_position.toFixed(1)}`
                  : '—'
              }</div>
            </div>
          </div>
        `
        : '';

      const mainKeywordsTable =
        kp?.main_keywords?.length
          ? `
            <div style="margin-top: 6px;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">Top mots-clés (volume, difficulté, position)</div>
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
                <thead style="background: #f9fafb;">
                  <tr>
                    <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Mot-clé</th>
                    <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Volume</th>
                    <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Difficulté</th>
                    <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Position</th>
                  </tr>
                </thead>
                <tbody>
                  ${kp.main_keywords
                    .slice(0, 10)
                    .map(
                      (kw: any) => `
                        <tr>
                          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 600;">${kw.keyword || '—'}</td>
                          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #334155;">${renderNumber(kw.volume)}</td>
                          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #334155;">${renderNumber(kw.difficulty)}/100</td>
                          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #334155; font-weight: 700;">${renderRank(kw.current_rank)}</td>
                        </tr>
                      `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : `<p style="color: #374151; line-height: 1.6; margin: 0;">Aucune donnée de mots-clés n'a été fournie pour ce rapport.</p>`;

      const quickWins =
        kp?.quick_wins?.length
          ? `
            <div style="margin-top: 14px;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">Quick wins (positions 11–20)</div>
              <ul style="margin: 0; padding-left: 18px; color: #334155; line-height: 1.7;">
                ${kp.quick_wins
                  .slice(0, 6)
                  .map(
                    (qw: any) =>
                      `<li><strong>\"${qw.keyword || '—'}\"</strong> — ${renderRank(qw.current_rank)} • ${renderNumber(qw.volume)} vol/mois</li>`
                  )
                  .join('')}
              </ul>
            </div>
          `
          : '';

      const contentGaps =
        kp?.content_gaps?.length
          ? `
            <div style="margin-top: 14px;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">Gaps de contenu (opportunités)</div>
              <ul style="margin: 0; padding-left: 18px; color: #334155; line-height: 1.7;">
                ${kp.content_gaps
                  .slice(0, 6)
                  .map(
                    (gap: any) =>
                      `<li><strong>\"${gap.keyword || '—'}\"</strong> — ${renderNumber(gap.volume)} vol/mois</li>`
                  )
                  .join('')}
              </ul>
            </div>
          `
          : '';

      const recommendations =
        kp?.recommendations?.length
          ? `
            <div style="margin-top: 14px; padding: 14px; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">Recommandations mots-clés</div>
              <ul style="margin: 0; padding-left: 18px; color: #0f172a; line-height: 1.7;">
                ${kp.recommendations.slice(0, 6).map((r: any) => `<li>${r}</li>`).join('')}
              </ul>
            </div>
          `
          : '';

      return `
        <div style="background: linear-gradient(135deg, #f0fdf4, #ecfeff); padding: 24px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #0ea5e9;">
          <h3 style="font-size: 16px; color: #0c4a6e; margin: 0 0 12px 0;">${keywordsTitle}</h3>
          ${summary}
          ${mainKeywordsTable}
          ${quickWins}
          ${contentGaps}
          ${recommendations}
        </div>
      `;
    })();

    content = `
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="display: inline-block; padding: 30px 50px; background: linear-gradient(135deg, #059669, #0891b2); border-radius: 20px; margin-bottom: 20px;">
          <div style="font-size: 56px; font-weight: bold; color: white;">${geoScore}/100</div>
          <div style="color: rgba(255,255,255,0.9); font-size: 16px;">${t.geoScore}</div>
        </div>
      </div>

      ${strategic?.executive_summary || strategic?.executiveSummary ? `
        <div style="background: linear-gradient(135deg, #f0fdf4, #ecfeff); padding: 24px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #059669;">
          <h3 style="font-size: 16px; color: #065f46; margin: 0 0 12px 0;">${t.executiveSummary}</h3>
          <p style="color: #374151; line-height: 1.7; margin: 0;">${strategic?.executive_summary || strategic?.executiveSummary}</p>
        </div>
      ` : ''}

      ${strategic?.brand_identity ? `
        <div style="background: #faf5ff; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
          <h3 style="font-size: 16px; color: #7c3aed; margin: 0 0 16px 0;">${t.brandIdentity}</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Archétype</div>
              <div style="font-weight: 600; color: #1f2937;">${strategic.brand_identity.archetype}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Clarté</div>
              <div style="font-weight: 600; color: #1f2937;">${strategic.brand_identity.clarity_score}/100</div>
            </div>
          </div>
          <div style="margin-top: 12px;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Valeurs perçues</div>
            <div>${strategic.brand_identity.perceived_values.map(v => `<span style="display: inline-block; padding: 4px 8px; background: #e9d5ff; color: #7c3aed; border-radius: 6px; font-size: 12px; margin: 2px;">${v}</span>`).join('')}</div>
          </div>
        </div>
      ` : ''}

      ${keywordsSection}

      ${strategic?.strategic_roadmap?.length > 0 ? `
        <h3 style="font-size: 18px; color: #1f2937; margin-bottom: 16px;">${t.roadmap}</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Priorité</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Action</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Objectif</th>
            </tr>
          </thead>
          <tbody>
            ${strategic.strategic_roadmap.map(item => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                  <span style="padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; ${
                    item.priority === 'Prioritaire' ? 'background: #fee2e2; color: #991b1b;' :
                    item.priority === 'Important' ? 'background: #fef3c7; color: #92400e;' :
                    'background: #dcfce7; color: #166534;'
                  }">${item.priority}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.action_concrete}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">${item.strategic_goal}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    `;
  }

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${auditMode === 'technical' ? t.technicalAudit : t.strategic} - ${result.domain}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f3f4f6; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; padding: 28px; background: linear-gradient(135deg, #7c3aed, #2563eb); border-radius: 20px; }
    .logo { font-size: 28px; font-weight: 700; color: white; margin-bottom: 8px; }
    .subtitle { color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 12px; }
    .url { color: rgba(255,255,255,0.8); font-size: 13px; }
    .date { color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 8px; }
    .content { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .footer { text-align: center; margin-top: 40px; padding: 24px; background: linear-gradient(135deg, #7c3aed, #2563eb); border-radius: 16px; }
    .footer-brand { color: white; font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .footer-link { color: white; text-decoration: none; font-weight: 500; padding: 10px 20px; background: rgba(255,255,255,0.2); border-radius: 10px; display: inline-block; }
    @media print {
      body { background: white; padding: 0; }
      .content { box-shadow: none; }
      .header, .footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media (max-width: 700px) {
      .content { padding: 24px; }
      div[style*="grid-template-columns: repeat(5"] { grid-template-columns: repeat(2, 1fr) !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🤖 Crawlers.fr</div>
      <div class="subtitle">${auditMode === 'technical' ? t.technicalAudit : t.strategic}</div>
      <div class="url">${result.url}</div>
      <div class="date">${t.generatedAt} ${now}</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <div class="footer-brand">${t.poweredBy}</div>
      <a href="https://crawlers.fr/audit-expert" class="footer-link">crawlers.fr/audit-expert</a>
    </div>
  </div>
</body>
</html>`;
}

export function generateExpertPDF(result: ExpertAuditResult, auditMode: 'technical' | 'strategic', t: ExpertReportI18n) {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, doc.internal.pageSize.width, 35, 'F');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('Crawlers.fr', 20, 18);
  doc.setFontSize(11);
  doc.text(auditMode === 'technical' ? t.technicalAudit : t.strategic, 20, 28);
  doc.text(result.domain, doc.internal.pageSize.width - 20, 22, { align: 'right' });

  // URL and date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`URL: ${result.url}`, 20, 48);
  doc.text(`${t.generatedAt}: ${new Date(result.scannedAt).toLocaleString()}`, 20, 55);

  if (auditMode === 'technical') {
    // Global score
    doc.setFontSize(28);
    doc.setTextColor(124, 58, 237);
    doc.text(`${result.totalScore}/200`, 20, 78);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(t.score + ' Global', 75, 78);

    let currentY = 90;

    // Introduction narrative (3 paragraphes)
    if (result.introduction) {
      doc.setFontSize(14);
      doc.setTextColor(124, 58, 237);
      doc.text(t.introduction, 20, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.setTextColor(60);

      const presentationLines = doc.splitTextToSize(result.introduction.presentation, 170);
      doc.text(presentationLines, 20, currentY);
      currentY += presentationLines.length * 5 + 4;

      const strengthsLines = doc.splitTextToSize(result.introduction.strengths, 170);
      doc.text(strengthsLines, 20, currentY);
      currentY += strengthsLines.length * 5 + 4;

      const improvementLines = doc.splitTextToSize(result.introduction.improvement, 170);
      doc.text(improvementLines, 20, currentY);
      currentY += improvementLines.length * 5 + 10;
    }

    // Category scores table
    const scoresData = [
      [t.performance, `${result.scores.performance.score}/${result.scores.performance.maxScore}`],
      [t.technical, `${result.scores.technical.score}/${result.scores.technical.maxScore}`],
      [t.semantic, `${result.scores.semantic.score}/${result.scores.semantic.maxScore}`],
      [t.aiReady, `${result.scores.aiReady.score}/${result.scores.aiReady.maxScore}`],
      [t.security, `${result.scores.security.score}/${result.scores.security.maxScore}`],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Catégorie', t.score]],
      body: scoresData,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] },
      styles: { fontSize: 10 },
    });

    // Recommendations
    if (result.recommendations?.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY || currentY + 50;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(t.recommendations, 20, finalY + 15);

      const recsData = result.recommendations.slice(0, 8).map((rec) => [
        rec.priority === 'critical' ? t.critical : rec.priority === 'important' ? t.important : t.optional,
        rec.title,
        rec.description.substring(0, 60) + (rec.description.length > 60 ? '...' : ''),
      ]);

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Priorité', 'Action', 'Description']],
        body: recsData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] },
        styles: { fontSize: 9 },
        columnStyles: { 2: { cellWidth: 70 } },
      });
    }
  } else {
    const strategic = result.strategicAnalysis;
    const geoScore = strategic?.geo_score?.score || strategic?.overallScore || 0;

    doc.setFontSize(28);
    doc.setTextColor(5, 150, 105);
    doc.text(`${geoScore}/100`, 20, 78);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(t.geoScore, 70, 78);

    let currentY = 90;

    // Introduction narrative
    if (result.introduction) {
      doc.setFontSize(14);
      doc.setTextColor(5, 150, 105);
      doc.text(t.introduction, 20, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.setTextColor(60);

      const presentationLines = doc.splitTextToSize(result.introduction.presentation, 170);
      doc.text(presentationLines, 20, currentY);
      currentY += presentationLines.length * 5 + 4;

      const strengthsLines = doc.splitTextToSize(result.introduction.strengths, 170);
      doc.text(strengthsLines, 20, currentY);
      currentY += strengthsLines.length * 5 + 4;

      const improvementLines = doc.splitTextToSize(result.introduction.improvement, 170);
      doc.text(improvementLines, 20, currentY);
      currentY += improvementLines.length * 5 + 10;
    }

    // Executive summary
    if (strategic?.executive_summary || strategic?.executiveSummary) {
      doc.setFontSize(14);
      doc.setTextColor(5, 150, 105);
      doc.text(t.executiveSummary, 20, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.setTextColor(60);
      const summary = strategic?.executive_summary || strategic?.executiveSummary || '';
      const lines = doc.splitTextToSize(summary, 170);
      doc.text(lines, 20, currentY);
      currentY += lines.length * 5 + 10;
    }

    // Mots-clés (encadré dédié)
    {
      // Intentionally keep French wording here to match the product spec
      // and avoid ambiguity across locales in exported PDFs.
      const keywordsTitle = 'Mots clés';
      const kp = strategic?.keyword_positioning;
      const ms = strategic?.market_data_summary;

      doc.setFontSize(14);
      doc.setTextColor(5, 150, 105);
      doc.text(keywordsTitle, 20, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.setTextColor(60);

      if (ms) {
        const summaryLine = `Volume marché/mois: ${ms.total_market_volume?.toLocaleString?.() || ms.total_market_volume || '—'} | Classés: ${ms.keywords_ranked}/${ms.keywords_analyzed} | Position moy.: ${
          typeof ms.average_position === 'number' && ms.average_position > 0 ? `#${ms.average_position.toFixed(1)}` : '—'
        }`;
        const summaryLines = doc.splitTextToSize(summaryLine, 170);
        doc.text(summaryLines, 20, currentY);
        currentY += summaryLines.length * 5 + 6;
      }

      if (kp?.main_keywords?.length > 0) {
        const rows = kp.main_keywords.slice(0, 10).map((kw: any) => [
          kw.keyword || '—',
          typeof kw.volume === 'number' ? kw.volume.toLocaleString() : String(kw.volume ?? '—'),
          `${kw.difficulty ?? '—'}/100`,
          typeof kw.current_rank === 'number' ? `#${kw.current_rank}` : String(kw.current_rank ?? '—'),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [[keywordsTitle, 'Volume', 'Diff.', 'Pos.']],
          body: rows,
          theme: 'striped',
          headStyles: { fillColor: [5, 150, 105] },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 20, halign: 'center' },
          },
        });

        currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 10;
      } else {
        const msg = 'Aucune donnée de mots-clés n\'a été fournie pour ce rapport.';
        const msgLines = doc.splitTextToSize(msg, 170);
        doc.text(msgLines, 20, currentY);
        currentY += msgLines.length * 5 + 10;
      }
    }

    // Roadmap
    if (strategic?.strategic_roadmap && strategic.strategic_roadmap.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(t.roadmap, 20, currentY);

      const roadmapData = strategic.strategic_roadmap.map((item: any) => [
        item.priority,
        item.action_concrete,
        item.strategic_goal.substring(0, 50) + (item.strategic_goal.length > 50 ? '...' : ''),
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Priorité', 'Action', 'Objectif']],
        body: roadmapData,
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105] },
        styles: { fontSize: 9 },
        columnStyles: { 1: { cellWidth: 70 } },
      });
    }
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(124, 58, 237);
    doc.rect(0, pageHeight - 20, doc.internal.pageSize.width, 20, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(t.poweredBy, 20, pageHeight - 8);
    doc.text('crawlers.fr/audit-expert', doc.internal.pageSize.width - 20, pageHeight - 8, { align: 'right' });
  }

  doc.save(`audit-expert-${result.domain.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}
