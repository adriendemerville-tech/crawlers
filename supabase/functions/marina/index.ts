import { getServiceClient } from '../_shared/supabaseClient.ts';
import {
  extractTopPriorities,
  buildConsolidatedActionPlan,
  renderTopPrioritiesHTML,
  renderConsolidatedPlanHTML,
  splitLongTitle,
  type SectionTopPriorities,
  type RawFinding,
  type WorkbenchTask,
  type ConsolidatedPlanStats,
} from '../_shared/topPriorities.ts';
import { severityFromSignal } from '../_shared/actionPlanDiscrimination.ts';
import {
  botRenderingFinding,
  botRenderingBlockHTML,
  isSuppressedByShell,
  type BotRenderingReport,
} from '../_shared/botRenderingShell.ts';
import {
  riskClaimsFinding,
  authorityMismatchFinding,
  trustSignalsBlockHTML,
} from '../_shared/trustClaims.ts';
import { deadUrlFindings } from '../_shared/deadUrls.ts';
import {
  isBotOnlyAbsence,
  absenceVerificationFinding,
  absenceReliabilityBlockHTML,
  type AbsenceVerificationReport,
} from '../_shared/absenceVerification.ts';
import { buildGeoSubSignals, geoSubSignalsBlockHTML } from '../_shared/geoSubSignals.ts';
import { verdictsFromCocoonRisks, pillarSatelliteBlockHTML, pageAuthority } from '../_shared/pillarSatelliteVerdict.ts';




import {
  humanizeKey,
  humanizeValue,
  severityBadgeHTML,
  splitTrailingSeverity,
  clusterDisplayName,
  consolidateClusters,
  clusterSize,
  isolatedClustersNoteHTML,
  isFillerTable,
} from '../_shared/reportEditorial.ts';
import { writeMarinaFindingsToWorkbench } from '../_shared/marinaWorkbench.ts';
import { analyzePageArchetypes, renderPageArchetypesHTML, type ArchetypeAnalysis } from '../_shared/pageArchetypes.ts';
import { fetchSitemapUrls } from '../_shared/sitemapUrls.ts';
import { writeArchetypePrescriptions } from '../_shared/archetypeWorkbench.ts';
import { buildAeoRewrites, writeAeoRewritePrescriptions } from '../_shared/aeoRewrites.ts';
import {
  clampScore,
  resolvePerimeter,
  resolveOrphanCount,
  resolveToxicity,
  assessIdentityUsability,
  reconcileReportHtml,
  formatVitalSeconds,
} from '../_shared/auditReconciliation.ts';


import { buildMarketProfile, fetchArchetypeBenchmarks, writeMarketObservation } from '../_shared/marketObservations.ts';
import {
  sectorLabel,
  commercialModelLabel,
  normalizeSector,
  normalizeCommercialModel,
  SECTOR_OPTIONS,
  COMMERCIAL_MODEL_OPTIONS,
} from '../_shared/sectorTaxonomy.ts';

import { writeIntegrityFindingsToWorkbench } from '../_shared/contentIntegrity/workbench.ts';
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts';
import { renderScopeLimitsHTML } from '../_shared/scopeAndLimits.ts';
import { provenanceLegendHTML, metricBadge, provenanceBadge } from '../_shared/provenance.ts';
import { resolveScanMode, scanModeSentence, type ScanModeResolution } from '../_shared/marinaScanMode.ts';
import { applyRoiWeighting, summarizeRoi, type RoiSummary } from '../_shared/roiWeighting.ts';
import { buildPageVerdictHTML, buildCocoonPageFocusHTML, pageKey } from '../_shared/marinaPageVerdict.ts';

import {
  fetchOwnerPerformanceData,
  renderOwnerPerformanceHTML,
  type OwnerPerformanceData,
} from '../_shared/marinaOwnerData.ts';
import {
  resolveIdentityCard,
  detectIdentityContradiction,
  renderIdentityCardHTML,
  emptyIdentityCard,
  reviseIdentityAfterCrawl,
  type IdentityCard,
} from '../_shared/identityResolver.ts';



import { corsHeaders } from '../_shared/cors.ts';
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { writeIdentity } from '../_shared/identityGateway.ts';
import { callLovableAIText } from '../_shared/lovableAI.ts';
import { sanitizeReportData } from '../_shared/llmGuards.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { captureSiteVisual, buildVisualEvidenceHtml, type VisualCapture } from '../_shared/pageboltCapture.ts';
import { buildStrategicVerdict, type VerdictSignals } from '../_shared/strategicVerdict.ts';
import { narrateStrategicVerdict } from '../_shared/verdictNarration.ts';
import { comparePotentialVsMeasured, buildAggregate, AXIS_WEIGHTS } from '../_shared/llmVisibilityScore.ts';

import {
  analyzeHostDuplication,
  probeHostRedirect,
  hostDuplicationFinding,
  buildHostDuplicationHTML,
  type HostDuplicationResult,
} from '../_shared/hostDuplication.ts';

/** Poids diagnostique affiché par axe de benchmark LLM (source : _shared/llmVisibilityScore.ts). */
const AXIS_DISPLAY_WEIGHT: Record<string, number> = { ...AXIS_WEIGHTS };

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

// ─── Language detection from site signals ───
function detectLanguageFromText(text: string): string | null {
  if (!text) return null;

  const sample = ` ${text
    .toLowerCase()
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

  if (!sample.trim()) return null;

  const frWords = ['bonjour', 'nous', 'notre', 'votre', 'avec', 'pour', 'dans', 'les', 'des', 'une', 'est', 'traducteur', 'instantané', 'écouteurs', 'questions', 'fréquentes'];
  const esWords = ['hola', 'nosotros', 'nuestro', 'para', 'sobre', 'esta', 'los', 'las', 'una', 'con', 'por', 'traductor', 'auriculares', 'preguntas', 'frecuentes'];
  const enWords = ['hello', 'our', 'your', 'with', 'for', 'the', 'and', 'this', 'that', 'instant', 'translator', 'wireless', 'headphones', 'frequently', 'asked'];

  const scoreWords = (words: string[]) => words.reduce((score, word) => score + (sample.includes(` ${word} `) ? 1 : 0), 0);

  const scores = {
    fr: scoreWords(frWords),
    es: scoreWords(esWords),
    en: scoreWords(enWords),
  };

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestLang, bestScore] = sorted[0] || [];
  const secondScore = sorted[1]?.[1] ?? 0;

  if (!bestLang || typeof bestScore !== 'number' || bestScore < 2) return null;
  if (bestScore === secondScore) return null;

  return bestLang;
}

function detectLanguage(html: string): string {
  const visibleSample = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 4000);

  const textDetected = detectLanguageFromText(visibleSample);
  if (textDetected) return textDetected;

  const langAttr = html.match(/<html[^>]*\slang=["']([a-z]{2})/i);
  if (langAttr) {
    const lang = langAttr[1].toLowerCase();
    if (lang === 'es') return 'es';
    if (lang === 'en') return 'en';
    if (lang === 'fr') return 'fr';
  }

  return 'fr';
}

function resolveReportLanguage(explicitLang: string | undefined, expertData: any): string {
  if (explicitLang === 'fr' || explicitLang === 'en' || explicitLang === 'es') {
    return explicitLang;
  }

  const htmlAnalysis = expertData?.rawData?.htmlAnalysis || {};
  const prioritySignals = [
    htmlAnalysis?.titleContent,
    htmlAnalysis?.metaDescContent,
    ...(Array.isArray(htmlAnalysis?.h1Contents) ? htmlAnalysis.h1Contents : []),
    ...(Array.isArray(htmlAnalysis?.h2Contents) ? htmlAnalysis.h2Contents.slice(0, 6) : []),
  ].filter(Boolean).join(' ');

  const detectedFromPrioritySignals = detectLanguageFromText(prioritySignals);
  if (detectedFromPrioritySignals) return detectedFromPrioritySignals;

  return detectLanguage(htmlAnalysis?.rawHtml || '');
}

// ─── Helper: render any object/array as structured HTML ───
function renderJsonSection(data: any, depth = 0): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') {
    // Lot 6 — une sévérité collée en fin de phrase devient un badge.
    const { text, severity } = splitTrailingSeverity(data);
    const badge = severityBadgeHTML(severity);
    return `<p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:8px;">${text}${badge ? ` ${badge}` : ''}</p>`;
  }
  if (typeof data === 'number' || typeof data === 'boolean') return `<span style="font-weight:600;color:#3b82f6;">${humanizeValue(data)}</span>`;
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    // If array of strings
    if (typeof data[0] === 'string') {
      return `<ul style="margin:8px 0;padding-left:20px;">${data.map(item => {
        const { text, severity } = splitTrailingSeverity(String(item));
        const badge = severityBadgeHTML(severity);
        return `<li style="font-size:13px;color:#374151;margin-bottom:4px;">${text}${badge ? ` ${badge}` : ''}</li>`;
      }).join('')}</ul>`;
    }
    // Lot 6 — un tableau d'objets dont toutes les valeurs numériques sont à zéro
    // est un remplissage : on ne le rend pas.
    if (data.every((it) => it && typeof it === 'object') && isFillerTable(data as Array<Record<string, unknown>>)) return '';
    // Array of objects
    return data.map((item) => {
      if (typeof item === 'string') return `<div style="padding:6px 12px;margin-bottom:4px;background:#f9fafb;border-radius:4px;font-size:13px;">${item}</div>`;
      const rawTitle = item.title || item.name || item.label || item.keyword || item.action || item.prescriptive_action || item.action_concrete || '';
      const desc = item.description || item.detail || item.rationale || item.evidence || item.explanation || item.strategic_goal || '';
      const split = splitTrailingSeverity(String(rawTitle || ''));
      const title = split.text;
      const badge = severityBadgeHTML(item.severity ?? item.priority ?? split.severity);
      const score = item.score ?? item.confidence ?? '';
      const accent = badge && String(item.severity ?? item.priority ?? split.severity ?? '').toLowerCase().match(/crit|priorit/) ? '#ef4444'
        : badge ? '#f59e0b' : '#3b82f6';
      return `<div style="padding:12px;margin-bottom:8px;background:#f9fafb;border-left:3px solid ${accent};border-radius:4px;">
        ${badge || score !== '' ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">${badge}${score !== '' ? `<span style="font-size:11px;color:#6b7280;font-weight:600;">${humanizeValue(score)}</span>` : ''}</div>` : ''}
        ${title ? `<div style="font-weight:500;margin-top:2px;">${title}</div>` : ''}
        ${desc ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;">${splitTrailingSeverity(String(desc)).text}</div>` : ''}
        ${Object.entries(item).filter(([k]) => !['title','name','label','keyword','description','detail','rationale','evidence','explanation','score','confidence','priority','severity','action','prescriptive_action','action_concrete','strategic_goal'].includes(k)).map(([k, v]) => {
          if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return '';
          if (typeof v === 'object') return '';
          return `<div style="font-size:12px;color:#6b7280;margin-top:2px;"><strong>${humanizeKey(k)} :</strong> ${humanizeValue(v)}</div>`;
        }).join('')}
      </div>`;
    }).join('');
  }
  if (typeof data === 'object') {
    return Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).map(([key, val]) => {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        const isSeverityField = /^(severity|priority|sévérité|priorité)$/i.test(key);
        const rendered = isSeverityField
          ? (severityBadgeHTML(val) || humanizeValue(val))
          : humanizeValue(val);
        return `<div style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:left;">
          <span style="color:#6b7280;margin-right:8px;">${humanizeKey(key)} :</span>
          <span style="font-weight:500;color:#1e293b;">${rendered}</span>
        </div>`;
      }
      if (depth < 2) {
        return `<div style="margin-top:12px;text-align:left;"><h4 style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">${humanizeKey(key)}</h4>${renderJsonSection(val, depth + 1)}</div>`;
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
    .section-number { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #3b82f6; color: white; font-size: 13px; font-weight: 700; line-height: 1; text-align: center; flex-shrink: 0; }
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
    /* Floating toolbar */
    .marina-toolbar {
      position: sticky; top: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: flex-end; gap: 8px;
      padding: 10px 20px;
      background: rgba(255,255,255,0.95); backdrop-filter: blur(8px);
      border-bottom: 1px solid #e5e7eb;
      max-width: 900px; margin: 0 auto 0 auto;
    }
    .marina-toolbar-title {
      margin-right: auto; font-size: 14px; font-weight: 600; color: #1e293b;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .marina-toolbar button {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border: 1px solid #d1d5db; border-radius: 8px;
      background: white; color: #374151; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
    }
    .marina-toolbar button:hover { background: #f3f4f6; border-color: #9ca3af; }
    .marina-toolbar button.primary { background: #3b82f6; color: white; border-color: #3b82f6; }
    .marina-toolbar button.primary:hover { background: #2563eb; }
    .marina-toolbar button svg { width: 16px; height: 16px; }
    .marina-toolbar .copied { color: #22c55e; border-color: #22c55e; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm 10mm; }
      .section { break-inside: auto; }
      .marina-toolbar { display: none !important; }
    }
    @media (max-width: 640px) {
      .marina-toolbar { gap: 4px; padding: 8px 12px; }
      .marina-toolbar .btn-label { display: none; }
      .marina-toolbar button { padding: 7px 10px; }
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
      toolbarPdf: 'Télécharger PDF',
      toolbarPrint: 'Imprimer',
      toolbarCopy: 'Copier le lien',
      toolbarCopied: 'Copié !',
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
      toolbarPdf: 'Download PDF',
      toolbarPrint: 'Print',
      toolbarCopy: 'Copy link',
      toolbarCopied: 'Copied!',
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
      toolbarPdf: 'Descargar PDF',
      toolbarPrint: 'Imprimir',
      toolbarCopy: 'Copiar enlace',
      toolbarCopied: '¡Copiado!',
    },
  };
  return t[lang as keyof typeof t] || t.fr;
}
// ─── Generate floating toolbar HTML + JS ───
function getToolbarHtml(domain: string, lang: string): string {
  const tr = getTranslations(lang);
  // SVG icons inline
  const downloadIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  const printIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
  const linkIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  const checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  const pdfIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  return `
  <div class="marina-toolbar" id="marina-toolbar">
    <span class="marina-toolbar-title">${domain}</span>
    <button class="primary" onclick="marinaDownloadPDF()" id="marina-pdf-btn" title="${tr.toolbarPdf}">
      ${pdfIcon}<span class="btn-label" id="marina-pdf-label">${tr.toolbarPdf}</span>
    </button>
    <button onclick="marinaPrint()" title="${tr.toolbarPrint}">
      ${printIcon}<span class="btn-label">${tr.toolbarPrint}</span>
    </button>
    <button onclick="marinaCopyLink()" id="marina-copy-btn" title="${tr.toolbarCopy}">
      ${linkIcon}<span class="btn-label" id="marina-copy-label">${tr.toolbarCopy}</span>
    </button>
  </div>
  <script>
    var _pdfLibsLoaded = false;
    var _pdfLibsLoading = false;
    function loadPdfLibs() {
      if (_pdfLibsLoaded || _pdfLibsLoading) return Promise.resolve();
      _pdfLibsLoading = true;
      return new Promise(function(resolve, reject) {
        var s1 = document.createElement('script');
        s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s1.crossOrigin = 'anonymous';
        s1.onload = function() {
          var s2 = document.createElement('script');
          s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          s2.crossOrigin = 'anonymous';
          s2.onload = function() { _pdfLibsLoaded = true; _pdfLibsLoading = false; resolve(); };
          s2.onerror = function() { _pdfLibsLoading = false; reject(new Error('Failed to load jsPDF')); };
          document.head.appendChild(s2);
        };
        s1.onerror = function() { _pdfLibsLoading = false; reject(new Error('Failed to load html2canvas')); };
        document.head.appendChild(s1);
      });
    }
    // Pre-load libs on page load
    if (document.readyState === 'complete') { loadPdfLibs(); }
    else { window.addEventListener('load', function() { loadPdfLibs(); }); }

    function marinaPrint() { window.print(); }
    function marinaCopyLink() {
      var meta = document.querySelector('meta[name="marina-report-url"]');
      var url = meta ? meta.getAttribute('content') : window.location.href;
      if (!url || url === 'about:srcdoc') url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() { showCopied(); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showCopied(); } catch(e) {}
        document.body.removeChild(ta);
      }
    }
    function showCopied() {
      var btn = document.getElementById('marina-copy-btn');
      var label = document.getElementById('marina-copy-label');
      btn.classList.add('copied');
      label.textContent = '${tr.toolbarCopied}';
      setTimeout(function() {
        btn.classList.remove('copied');
        label.textContent = '${tr.toolbarCopy}';
      }, 2000);
    }
    function marinaPendingCount() {
      return document.querySelectorAll('[data-llm-status="pending"]').length;
    }
    // Tant que des interrogations LLM sont en cours, l'export produirait un PDF incomplet.
    function marinaSyncPdfAvailability() {
      var btn = document.getElementById('marina-pdf-btn');
      var label = document.getElementById('marina-pdf-label');
      if (!btn || !label) return;
      if (marinaPendingCount() > 0) {
        btn.disabled = true;
        btn.style.opacity = '0.55';
        btn.title = 'Mesure LLM en cours — export disponible à la fin des interrogations';
        label.textContent = 'Mesure LLM en cours…';
      } else {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.title = '${tr.toolbarPdf}';
        label.textContent = '${tr.toolbarPdf}';
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', marinaSyncPdfAvailability);
    } else { marinaSyncPdfAvailability(); }
    setInterval(marinaSyncPdfAvailability, 5000);

    async function marinaDownloadPDF() {
      var btn = document.getElementById('marina-pdf-btn');
      var label = document.getElementById('marina-pdf-label');
      if (btn.disabled) return;
      if (marinaPendingCount() > 0) {
        alert('Les interrogations des modèles IA ne sont pas terminées. L’export PDF sera disponible dès que toutes les réponses seront enregistrées : rechargez la page dans quelques minutes.');
        return;
      }
      btn.disabled = true;
      label.textContent = '${tr.toolbarLoading || '…'}';
      try {
        await loadPdfLibs();
        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF not available');
        if (typeof html2canvas === 'undefined') throw new Error('html2canvas not available');
        var jsPDF = window.jspdf.jsPDF;
        var container = document.querySelector('.container');
        if (!container) throw new Error('No container');
        // Hide toolbar during capture
        var toolbar = document.querySelector('.marina-toolbar');
        if (toolbar) toolbar.style.display = 'none';
        var sections = Array.from(container.children).filter(function(el) {
          return el.nodeType === 1 && (!el.classList || !el.classList.contains('marina-toolbar'));
        });
        var pdfW = 210, pdfH = 297, mTop = 15, mBot = 15, mSide = 10;
        var usableH = pdfH - mTop - mBot;
        var usableW = pdfW - mSide * 2;
        var doc = new jsPDF('p', 'mm', 'a4');
        var curY = mTop;
        var first = true;
        for (var i = 0; i < sections.length; i++) {
          var sec = sections[i];
          try {
            var canvas = await html2canvas(sec, { 
              scale: 2, 
              useCORS: true, 
              allowTaint: true, 
              backgroundColor: '#f8fafc', 
              logging: false,
              imageTimeout: 15000,
              removeContainer: true
            });
          } catch(renderErr) {
            console.warn('html2canvas failed for section', i, renderErr);
            continue;
          }
          if (!canvas || canvas.width === 0 || canvas.height === 0) continue;
          var imgData = canvas.toDataURL('image/jpeg', 0.92);
          var secW = usableW;
          var secH = (canvas.height * secW) / canvas.width;
          if (curY + secH <= pdfH - mBot) {
            doc.addImage(imgData, 'JPEG', mSide, curY, secW, secH);
            curY += secH + 2;
          } else if (secH <= usableH) {
            if (!first || curY > mTop + 5) { doc.addPage(); curY = mTop; }
            doc.addImage(imgData, 'JPEG', mSide, curY, secW, secH);
            curY += secH + 2;
          } else {
            var pxPerMm = canvas.height / secH;
            var srcY = 0; var rem = secH;
            while (rem > 0) {
              var space = (pdfH - mBot) - curY;
              var sliceH = Math.min(rem, space);
              var slicePx = Math.round(sliceH * pxPerMm);
              var sc = document.createElement('canvas');
              sc.width = canvas.width; sc.height = slicePx;
              var ctx = sc.getContext('2d');
              if (ctx) {
                ctx.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
                doc.addImage(sc.toDataURL('image/jpeg', 0.92), 'JPEG', mSide, curY, secW, sliceH);
              }
              srcY += slicePx; rem -= sliceH; curY += sliceH;
              if (rem > 0) { doc.addPage(); curY = mTop; }
            }
            curY += 2;
          }
          first = false;
        }
        if (toolbar) toolbar.style.display = '';
        var fname = 'marina_${domain.replace(/[^a-zA-Z0-9.-]/g, '_')}_' + new Date().toISOString().slice(0,10) + '.pdf';
        doc.save(fname);
      } catch(e) {
        console.error('PDF error', e);
        alert(e.message || 'PDF generation failed');
        var toolbar2 = document.querySelector('.marina-toolbar');
        if (toolbar2) toolbar2.style.display = '';
      } finally {
        btn.disabled = false;
        label.textContent = '${tr.toolbarPdf}';
      }
    }
  </` + `script>`;
}

function scoreColor(score: number, max: number): string {
  const pct = score / max * 100;
  if (pct >= 70) return '#22c55e';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

/**
 * Chapeaux pédagogiques de section (déterministes, 0 token).
 * Chaque section du rapport explique en une phrase vulgarisée ce qu'elle mesure,
 * comment la lire, et ce qu'elle ne dit pas.
 */
const SECTION_LEADS: Record<string, { fr: string; en: string; es: string }> = {
  crawl: {
    fr: "Ce que mesure cette section : le robot Crawlers a parcouru le site comme le fait Googlebot, puis a relevé pour chaque page ses balises, sa structure de titres, ses liens et sa vitesse réelle. À lire comme un état des lieux factuel : aucun jugement éditorial ici, uniquement ce qui est techniquement présent ou absent.",
    en: "What this section measures: the Crawlers robot browsed the site the way Googlebot does, then recorded each page's tags, heading structure, links and real-world speed. Read it as a factual inventory: no editorial judgement here, only what is technically present or missing.",
    es: "Lo que mide esta sección: el robot de Crawlers recorrió el sitio como lo hace Googlebot y registró etiquetas, estructura de títulos, enlaces y velocidad real.",
  },
  tech: {
    fr: "Ce que mesure cette section : la conformité technique et sémantique de la page auditée, notée sur 200 points répartis en performance, technique, sémantique et lisibilité par les IA. Un score élevé ne garantit pas du trafic : il garantit qu'aucun blocage technique n'empêche d'en obtenir.",
    en: "What this section measures: technical and semantic compliance of the audited page, scored out of 200 points across performance, technical, semantic and AI readability. A high score does not guarantee traffic: it guarantees no technical blocker prevents it.",
    es: "Lo que mide esta sección: la conformidad técnica y semántica de la página auditada, sobre 200 puntos.",
  },
  strategic: {
    fr: "Ce que mesure cette section : la citabilité du site par les moteurs de réponse IA (ChatGPT, Perplexity, Gemini, Google AI Overviews) et la solidité de son positionnement de marché. Elle repose sur des interrogations réelles de modèles et sur des données de marché externes, pas sur une simple lecture du code.",
    en: "What this section measures: how citable the site is for AI answer engines (ChatGPT, Perplexity, Gemini, Google AI Overviews) and how solid its market positioning is. It relies on real model queries and external market data, not merely on reading the code.",
    es: "Lo que mide esta sección: la citabilidad del sitio por los motores de respuesta IA y la solidez de su posicionamiento.",
  },
  cocoon: {
    fr: "Ce que mesure cette section : la manière dont les pages du site se relient entre elles et se répartissent en thématiques. Un cocon sain regroupe les pages par intention, évite les pages orphelines et empêche deux pages de se disputer la même requête (cannibalisation).",
    en: "What this section measures: how the site's pages link to each other and cluster into topics. A healthy cocoon groups pages by intent, avoids orphan pages and prevents two pages competing for the same query (cannibalisation).",
    es: "Lo que mide esta sección: cómo se enlazan las páginas del sitio y cómo se agrupan por temática.",
  },
  indexation: {
    fr: "Ce que mesure cette section : la présence effective des URLs dans l'index Google. Une page non indexée ne peut générer aucun trafic, quel que soit son score technique — c'est donc à traiter avant toute optimisation de contenu.",
    en: "What this section measures: whether URLs are actually in Google's index. A non-indexed page cannot generate traffic whatever its technical score.",
    es: "Lo que mide esta sección: la presencia efectiva de las URL en el índice de Google.",
  },
};

function sectionLead(key: keyof typeof SECTION_LEADS | string, lang: string): string {
  const entry = SECTION_LEADS[key];
  if (!entry) return '';
  const text = lang === 'en' ? entry.en : lang === 'es' ? entry.es : entry.fr;
  return `<p style="font-size:12.5px;line-height:1.7;color:#4b5563;background:#faf9f5;border-left:3px solid #d4af37;padding:10px 14px;border-radius:6px;margin:0 0 16px 0;">${text}</p>`;
}


function checkMark(val: boolean): string {
  return val ? '✅' : '❌';
}

function buildModuleSection(title: string, emoji: string, data: any): string {
  if (!data) return '';
  return `<div data-marina-block="module" style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">${emoji} ${title}</h3>
    ${renderJsonSection(data)}
  </div>`;
}

/**
 * Bloc « Positionnement Mots-clés » — rendu explicite en 3 sous-sections
 * pédagogiques (positions actuelles / gains rapides / mots-clés non attaqués)
 * au lieu du dump JSON générique qui affichait `current_rank` brut.
 * Chaque sous-section est un bloc paginable (`data-marina-block`) pour que la
 * coupure PDF tombe entre deux cadres et jamais au milieu d'un titre.
 */
function buildKeywordPositioningSection(kp: any, rankingOverview?: any): string {
  if (!kp && !rankingOverview) return '';
  kp = kp || {};


  const num = (v: any): number | null => {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const esc = (s: any) => String(s ?? '').replace(/</g, '&lt;');

  const row = (kw: any, extra: string[] = []) => {
    const rank = num(kw?.current_rank ?? kw?.position);
    const vol = num(kw?.volume);
    const meta = [
      rank ? `Position dans la SERP : <strong>${rank}</strong>` : 'Position dans la SERP : non classé',
      vol ? `Volume de recherche : <strong>${vol.toLocaleString('fr-FR')}</strong>/mois` : null,
      num(kw?.difficulty) ? `Difficulté : <strong>${num(kw.difficulty)}</strong>/100` : null,
      ...extra,
    ].filter(Boolean).join(' · ');
    const action = kw?.action || kw?.strategic_analysis?.recommended_action || '';
    return `<div style="border-left:3px solid #7c3aed;padding:6px 0 6px 12px;margin-bottom:10px;">
      <div style="font-size:13.5px;font-weight:600;color:#111827;">${esc(kw?.keyword || kw?.term || '')}</div>
      <div style="font-size:12px;color:#4b5563;margin-top:2px;">${meta}</div>
      ${action ? `<div style="font-size:12px;color:#374151;margin-top:4px;">${esc(action)}</div>` : ''}
    </div>`;
  };

  const sub = (title: string, lead: string, body: string) => body
    ? `<div data-marina-block="keywords-sub" style="margin-top:16px;padding:14px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
        <h4 style="font-size:14px;font-weight:600;margin:0 0 4px 0;color:#111827;">${title}</h4>
        <p style="font-size:12px;color:#6b7280;margin:0 0 10px 0;">${lead}</p>
        ${body}
      </div>`
    : '';

  const main: any[] = Array.isArray(kp.main_keywords) ? kp.main_keywords : [];
  const quickWins: any[] = Array.isArray(kp.quick_wins) ? kp.quick_wins : [];
  const gaps: any[] = Array.isArray(kp.content_gaps) ? kp.content_gaps : [];

  const ranked = main.filter((k) => num(k?.current_rank ?? k?.position));
  const positions = (ranked.length ? ranked : main).slice(0, 15);

  // Vue d'ensemble chiffrée issue de DataForSEO (ranking_overview) : jusqu'ici
  // produite par la chaîne stratégique mais jamais affichée dans Marina.
  const ro = rankingOverview || null;
  const roNum = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const roStats = ro
    ? [
        roNum(ro.total_ranked_keywords) != null ? ['Mots-clés positionnés', roNum(ro.total_ranked_keywords)!.toLocaleString('fr-FR'), 'serp_position'] : null,
        roNum(ro.average_position_global) != null ? ['Position moyenne', String(Math.round(roNum(ro.average_position_global)!)), 'serp_position'] : null,
        roNum(ro.average_position_top10) != null ? ['Position moyenne du top 10', String(Math.round(roNum(ro.average_position_top10)!)), 'serp_position'] : null,
        roNum(ro.etv) != null ? ['Trafic organique estimé', `${Math.round(roNum(ro.etv)!).toLocaleString('fr-FR')} visites/mois`, 'traffic_gain'] : null,
      ].filter(Boolean) as string[][]
    : [];
  const roTop: any[] = Array.isArray(ro?.top_keywords) ? ro!.top_keywords : [];
  const overviewHtml = ro && (roStats.length || roTop.length)
    ? sub(
        'Vue d’ensemble des positions',
        'Volumétrie mesurée sur la SERP : combien de mots-clés le domaine capte déjà et à quelle profondeur.',
        `${roStats.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:10px;">${roStats
            .map(([l, v, m]) => `<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;"><div style="font-size:16px;font-weight:700;color:#111827;">${v}</div><div style="font-size:11px;color:#6b7280;">${l}</div>${m ? `<div style="margin-top:4px;">${metricBadge(m, 'fr')}</div>` : ''}</div>`)
            .join('')}</div>` : ''}
         ${roTop.length ? roTop.slice(0, 10).map((k: any) => row(k)).join('') : ''}`,
      )
    : '';

  const html = [
    overviewHtml,
    sub(
      'Positions actuelles',
      'Mots-clés sur lesquels le domaine est déjà positionné dans les résultats Google.',
      positions.map((k) => row(k)).join(''),
    ),
    sub(
      'Quick Wins',
      'Gains rapides : mots-clés à optimiser en priorité.',
      quickWins.slice(0, 15).map((k) => row(k)).join(''),
    ),
    sub(
      'Content gap',
      'Mots-clés non attaqués actuellement.',
      gaps.slice(0, 15).map((k) => row(k, k?.priority ? [`Priorité : <strong>${esc(k.priority)}</strong>`] : [])).join(''),
    ),
  ].join('');


  // Le reste du module (densité sémantique, termes manquants, recommandations…)
  // garde le rendu générique, sans les trois clés déjà traitées ci-dessus.
  const rest: any = { ...kp };
  delete rest.main_keywords; delete rest.quick_wins; delete rest.content_gaps;
  const restHtml = renderJsonSection(rest);

  if (!html && !restHtml) return '';

  return `<div data-marina-block="keywords" style="margin-top:20px;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:4px;">🔑 Positionnement Mots-clés</h3>
    ${html}
    ${restHtml ? `<div data-marina-block="keywords-sub" style="margin-top:16px;padding:14px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">${restHtml}</div>` : ''}
  </div>`;
}


function normalizeUrl(value: string | null | undefined, base?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).href.replace(/\/+$/, '').toLowerCase();
  } catch {
    return value.replace(/\/+$/, '').toLowerCase();
  }
}

function buildMultiPageCrawlSnapshot(crawl: any, crawlPages: any[], expertSeoData: any, domain: string) {
  const scores = expertSeoData?.scores || {};
  const rawData = expertSeoData?.rawData || {};
  const htmlAnalysis = rawData?.htmlAnalysis || {};
  const linkProfile = htmlAnalysis?.insights?.linkProfile || {};
  const brokenLinksInsight = htmlAnalysis?.insights?.brokenLinks || {};
  const normalizedHome = normalizeUrl(`https://${domain}`);

  const primaryPage = crawlPages.find((page) => {
    const normalizedPage = normalizeUrl(page?.url);
    return normalizedPage === normalizedHome || normalizedPage === `${normalizedHome}/index`;
  }) || crawlPages[0] || null;

  const totalWordCount = crawlPages.reduce((sum, page) => sum + Number(page?.word_count || 0), 0);
  const totalInternalLinks = crawlPages.reduce((sum, page) => sum + Number(page?.internal_links || 0), 0);
  const totalExternalLinks = crawlPages.reduce((sum, page) => sum + Number(page?.external_links || 0), 0);
  const brokenPages = crawlPages.filter((page) => Number(page?.http_status || 200) >= 400).length;

  // Agrégats site (et non page d'accueil) : les tuiles du rapport annonçaient
  // « Images 0 / Sans alt 0 » parce qu'on lisait la seule home, et sur une
  // colonne inexistante (`images_missing_alt` au lieu de `images_without_alt`).
  const totalImages = crawlPages.reduce((sum, page) => sum + Number(page?.images_total || 0), 0);
  const totalImagesWithoutAlt = crawlPages.reduce(
    (sum, page) => sum + Number(page?.images_without_alt ?? page?.images_missing_alt ?? 0),
    0,
  );
  const responseTimes = crawlPages
    .map((page) => Number(page?.response_time_ms))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgResponseTime = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : (rawData?.responseTimeMs || null);

  const title = primaryPage?.title || htmlAnalysis?.titleContent || '';
  const metaDesc = primaryPage?.meta_description || htmlAnalysis?.metaDescContent || '';
  const h1 = primaryPage?.h1 || htmlAnalysis?.h1Contents?.[0] || '';

  return {
    pagesFound: Number(crawl?.crawled_pages || crawlPages.length || 1),
    // Alias consommés par la synthèse exécutive et « Portée et limites » :
    // sans eux, « Pages explorées » retombait sur n/d et le rapport se déclarait
    // mono-page alors que le crawl multi-pages avait bien tourné.
    crawled_pages: Number(crawl?.crawled_pages || crawlPages.length || 1),
    total_pages: Number(crawl?.total_pages || crawl?.pages_discovered || crawl?.urls_discovered || 0) || null,
    // `seo_score` est stocké sur /200 : on l'affiche normalisé sur /100 comme
    // partout ailleurs dans le rapport.
    avgSeoScore: crawl?.avg_score ? Math.min(100, Math.round(Number(crawl.avg_score) / 2)) : null,
    avgResponseTime,
    wordCount: totalWordCount || htmlAnalysis?.wordCount || 0,
    imagesTotal: totalImages || htmlAnalysis?.imagesTotal || 0,
    imagesWithoutAlt: totalImagesWithoutAlt,
    h1,
    h2Count: primaryPage?.h2_count ?? htmlAnalysis?.h2Count ?? 0,
    hasSchema: primaryPage?.has_schema_org ?? htmlAnalysis?.hasSchemaOrg ?? false,
    // Priorité au crawl réel : l'analyse expert ne voyait pas les balises
    // injectées côté serveur et déclarait canonical/OG absents à tort.
    hasOg: primaryPage?.has_og ?? htmlAnalysis?.hasOg ?? false,
    hasCanonical: primaryPage?.has_canonical ?? htmlAnalysis?.hasCanonical ?? false,
    canonicalCoverage: crawlPages.length
      ? Math.round((crawlPages.filter((p) => p?.has_canonical).length / crawlPages.length) * 100)
      : null,
    brokenLinks: brokenPages || rawData?.brokenLinks?.length || brokenLinksInsight?.broken?.length || 0,
    externalLinks: totalExternalLinks || linkProfile?.external || 0,
    internalLinks: totalInternalLinks || linkProfile?.internal || 0,

    indexable: htmlAnalysis?.isIndexable !== false,
    performanceScore: scores?.performance?.psiPerformance || null,
    lcp: scores?.performance?.lcp || null,
    tbt: scores?.performance?.tbt || null,
    cls: scores?.performance?.cls || null,
    fcp: scores?.performance?.fcp || null,
    title,
    titleLength: title.length,
    metaDesc,
    metaDescLength: metaDesc.length,
    h1Contents: h1 ? [h1] : (htmlAnalysis?.h1Contents || []),
    h2Contents: primaryPage?.h2_contents || htmlAnalysis?.h2Contents || [],
    h3Count: primaryPage?.h3_count ?? htmlAnalysis?.h3Count ?? 0,
    schemaTypes: scores?.aiReady?.schemaTypes || [],
    hasRobotsTxt: scores?.aiReady?.hasRobotsTxt || false,
    robotsPermissive: scores?.aiReady?.robotsPermissive || false,
    isHttps: scores?.technical?.isHttps || false,
    httpStatus: scores?.technical?.httpStatus || 200,
    // Lot B — agrégats de mise en forme des réponses (sous-signal GEO déduit).
    // Une composante non collectée reste `null` : elle est alors exclue du calcul
    // au lieu d'être lue comme une absence de balisage.
    answerFormatting: (() => {
      const has = (k: string) => crawlPages.some((p) => p && p[k] !== undefined && p[k] !== null);
      const count = (fn: (p: any) => boolean) => crawlPages.filter((p) => { try { return fn(p); } catch { return false; } }).length;
      return {
        pagesAnalyzed: crawlPages.length || null,
        pagesWithH1: crawlPages.length ? count((p) => Boolean(String(p?.h1 ?? '').trim())) : null,
        pagesWithFaq: (has('has_faq') || has('faq_count') || has('has_faq_schema'))
          ? count((p) => Boolean(p?.has_faq || p?.has_faq_schema || Number(p?.faq_count) > 0))
          : null,
        pagesWithLists: (has('lists_count') || has('has_lists') || has('ul_count'))
          ? count((p) => Boolean(p?.has_lists) || Number(p?.lists_count) > 0 || Number(p?.ul_count) > 0)
          : null,
        avgWordCount: crawlPages.length ? Math.round(totalWordCount / crawlPages.length) : null,
      };
    })(),
    contentIntegrity: summarizeCrawlIntegrity(crawl?.content_integrity),
  };
}


/** Résumé compact (déterministe, 0 token) de l'intégrité du contenu pour les prompts Marina. */
function summarizeCrawlIntegrity(report: any) {
  if (!report || typeof report !== 'object') return null;
  const botRendering = report.bot_rendering || null;
  // Lot 3 — contre-vérification des absences de balises (rendu complet).
  const absenceVerification = report.absence_verification || null;
  // Lot A — signaux de confiance machine et URLs mortes : transportés tels
  // quels (déjà compacts et bornés côté crawl).
  const trust = {
    riskClaims: report.risk_claims || null,
    authorityMismatch: report.authority_mismatch || null,
    deadUrls: report.dead_urls || null,
  };
  if (!report.near_duplicate) {
    return botRendering || absenceVerification || trust.riskClaims || trust.authorityMismatch || trust.deadUrls
      ? { analyzedPages: 0, botRendering, absenceVerification, ...trust }
      : null;
  }

  const nd = report.near_duplicate;
  const thin = report.thin_content || { pages: [], count: 0, avg_thin_score: 0 };
  return {
    botRendering,
    absenceVerification,
    ...trust,
    analyzedPages: report.analyzed_pages || 0,


    nearDuplicateGroups: nd.clusters?.length || 0,
    cannibalizationGroups: nd.cannibalization_clusters || 0,
    watchGroups: nd.watch_clusters || 0,
    pagesAffected: nd.pages_affected || 0,
    thinPages: thin.count || 0,
    avgThinScore: thin.avg_thin_score || 0,
    topClusters: (nd.clusters || [])
      .filter((c: any) => c.verdict !== 'normal')
      .slice(0, 5)
      .map((c: any) => ({
        pages: (c.pages || []).map((p: any) => p.url),
        pivotUrl: c.pivot_url,
        similarity: Math.round((c.avg_similarity || 0) * 100),
        verdict: c.verdict,
        rationale: c.rationale,
        recommendedAction: c.recommended_action,
      })),
    topThinPages: (thin.pages || []).slice(0, 5).map((p: any) => ({
      url: p.url,
      thinScore: p.thin_score,
      usefulWords: p.useful_words,
      kind: p.kind,
    })),
  };
}


function hydrateCocoonReportData(cocoonResult: any, semanticNodes: any[]) {
  if (!cocoonResult || !semanticNodes?.length) return cocoonResult;

  const nodes = semanticNodes.map((node) => ({
    url: node.url,
    title: node.title,
    intent: node.intent,
    page_authority: node.page_authority,
    internal_links_in: node.internal_links_in,
    internal_links_out: node.internal_links_out,
    cluster_id: node.cluster_id,
    word_count: node.word_count,
    eeat_score: node.eeat_score,
    traffic_estimate: node.traffic_estimate,
    roi_predictive: node.roi_predictive,
  }));

  const cluster_summary = nodes.reduce((acc: Record<string, any>, node: any) => {
    const clusterId = node.cluster_id || 'cluster_unknown';
    if (!acc[clusterId]) {
      acc[clusterId] = {
        label: clusterId,
        count: 0,
        total_roi: 0,
        total_traffic: 0,
        intents: [] as string[],
      };
    }

    acc[clusterId].count += 1;
    acc[clusterId].total_roi += Number(node.roi_predictive || 0);
    acc[clusterId].total_traffic += Number(node.traffic_estimate || 0);
    if (node.intent) acc[clusterId].intents.push(node.intent);
    return acc;
  }, {});

  Object.values(cluster_summary).forEach((cluster: any) => {
    const dominantIntentCounts = cluster.intents.reduce((acc: Record<string, number>, intent: string) => {
      acc[intent] = (acc[intent] || 0) + 1;
      return acc;
    }, {});
    cluster.avg_roi = cluster.count ? Math.round(cluster.total_roi / cluster.count) : 0;
    cluster.dominant_intent = Object.entries(dominantIntentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    delete cluster.total_roi;
    delete cluster.intents;
  });

  const seenEdges = new Set<string>();
  const edges = semanticNodes.flatMap((node) => {
    const source = node.url;
    const similarityEdges = Array.isArray(node.similarity_edges) ? node.similarity_edges : [];
    return similarityEdges.map((edge: any) => {
      const target = edge?.target_url || edge?.target;
      const key = `${source}=>${target}`;
      if (!target || seenEdges.has(key)) return null;
      seenEdges.add(key);
      return {
        source,
        target,
        target_url: target,
        score: edge?.score ?? null,
        type: edge?.type || null,
      };
    }).filter(Boolean);
  });

  return {
    ...cocoonResult,
    nodes,
    edges,
    cluster_summary,
  };
}

// ─── Dedicated renderer for Social Signals with platform names & colors ───
function buildSocialSignalsSection(data: any): string {
  // Pas de court-circuit : même sans signal social, la recommandation porte-parole doit sortir.

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
  // Recommandation indépendante du bloc Thought Leadership : elle doit apparaître
  // dès qu'aucun porte-parole n'est résolu, y compris si le module n'a rien renvoyé.
  const unresolvedSpokesperson = !tl?.founder_name;
  const authorityLevel = String(tl?.founder_authority || 'unknown').toLowerCase();
  const voiceNeedsStrengthening = unresolvedSpokesperson || authorityLevel === 'unknown' || authorityLevel === 'low';
  const spokespersonRecommendation = voiceNeedsStrengthening
    ? `<div style="margin-top:10px;padding:10px;border-left:3px solid #f59e0b;background:#fffbeb;font-size:12px;color:#374151;line-height:1.6;">
        <strong>Recommandation E-E-A-T — voix experte :</strong> ${tl?.founder_name
          ? `${tl.founder_name}${tl.founder_role ? ` (${tl.founder_role})` : ''} devrait devenir la voix experte et le porte-parole régulier de l’entreprise.`
          : `L’audit n’a identifié aucun porte-parole public et vérifié. Le dirigeant, gérant, CEO ou fondateur devrait devenir la voix experte et le porte-parole régulier de l’entreprise.`}
        Renforcer cette incarnation avec une page auteur et une biographie vérifiable sur le site, des contenus experts signés, un profil professionnel relié par <code>sameAs</code> et des prises de parole cohérentes dans le temps afin d’améliorer l’autorité SEO et la citabilité dans les moteurs de réponse IA.
      </div>`
    : '';
  if (tl) {
    const eeat = tl.eeat_score ?? null;

    leadershipHtml = `<div style="padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:12px;text-align:left;">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;">🏛️ Thought Leadership</div>
      ${(() => {
        const LABELS: Record<string, string> = { high: 'forte', moderate: 'modérée', low: 'faible', unknown: 'non mesurée sur ce run' };
        const lvl = tl.founder_authority ? (LABELS[String(tl.founder_authority)] || String(tl.founder_authority)) : null;
        if (!lvl && !tl.founder_name) return '';
        const who = tl.founder_name
          ? (tl.founder_profile_url ? `<a href="${tl.founder_profile_url}" style="color:#7c3aed;">${tl.founder_name}</a>` : tl.founder_name)
          : null;
        const role = tl.founder_role ? ` (${tl.founder_role})` : '';
        const conf = tl.founder_confidence != null ? ` — confiance ${Math.round(Number(tl.founder_confidence) * 100)}%` : '';
        const head = `<div style="font-size:12px;color:#374151;margin-bottom:4px;"><strong>Porte-parole identifié:</strong> ${who ? `${who}${role} — autorité ${lvl || 'non mesurée'}${conf}` : `non résolu (autorité ${lvl})`}</div>`;
        const why = tl.founder_resolution ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${tl.founder_resolution}</div>` : '';
        // Tant qu'aucun porte-parole n'est corroboré, aucun nom de candidat
        // n'est cité : une piste non vérifiée lue dans le corps du rapport passe
        // pour une affirmation.
        const altList = Array.isArray(tl.founder_alternatives) ? tl.founder_alternatives : [];
        const alts = altList.length === 0
          ? ''
          : tl.founder_name
            ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Autres personnes rattachées : ${altList.slice(0, 3).map((a: any) => `${a.name}${a.role && a.role !== 'inconnu' ? ` (${a.role})` : ''}`).join(', ')}</div>`
            : `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${altList.length} nom${altList.length > 1 ? 's' : ''} candidat${altList.length > 1 ? 's' : ''} ${altList.length > 1 ? 'ont' : 'a'} été repéré${altList.length > 1 ? 's' : ''} hors du site mais aucun n'est corroboré par une page du domaine : ils ne sont pas cités ici.</div>`;
        return head + why + alts;
      })()}

      ${tl.entity_recognition ? `<div style="font-size:12px;color:#374151;margin-bottom:4px;"><strong>Reconnaissance entité:</strong> ${tl.entity_recognition}</div>` : ''}
      ${eeat != null ? `<div style="font-size:12px;color:#374151;margin-bottom:4px;"><strong>Score E-E-A-T:</strong> <span style="font-weight:700;color:${eeat >= 7 ? '#22c55e' : eeat >= 4 ? '#f59e0b' : '#ef4444'};">${eeat}/10</span></div>` : ''}
      ${tl.analysis ? `<div style="font-size:12px;color:#6b7280;line-height:1.5;margin-top:4px;">${tl.analysis}</div>` : ''}
      ${spokespersonRecommendation}
    </div>`;
  } else if (spokespersonRecommendation) {
    leadershipHtml = `<div style="padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:12px;text-align:left;">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;">🏛️ Thought Leadership</div>
      <div style="font-size:12px;color:#374151;margin-bottom:4px;"><strong>Porte-parole identifié:</strong> non résolu</div>
      ${spokespersonRecommendation}
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
      ${analysis ? `<div style="font-size:13px;color:#374151;line-height:1.6;">${analysis}</div>` : ''}
    </div>`;
  }).join('');

  return `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;text-align:left;">⚔️ Paysage Concurrentiel</h3>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      ${cards}
    </div>
  </div>`;
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Certains helpers HTTP enveloppent encore le résultat sous plusieurs clés `data`. */
function unwrapFunctionPayload(payload: any): any {
  let current = payload;
  for (let depth = 0; depth < 4; depth++) {
    if (!current || typeof current !== 'object' || !current.data || typeof current.data !== 'object') break;
    if (Array.isArray(current.scores) || Array.isArray(current.benchmarks)) break;
    current = current.data;
  }
  return current;
}

// ─── Cartes « modèle interrogé » (réutilisées par le score global et par chaque benchmark) ───
function renderLlmModelCards(scoreList: any[]): string {
  return scoreList.map((s: any) => {
    const name = s.llm_name || 'Unknown';
    const raw = s.score_percentage ?? s.score ?? 0;
    const unmeasured = raw === null || raw === undefined || s.measurement_status === 'unmeasured' || s.measurement_status === 'pending';
    const score = unmeasured ? 0 : raw;
    const cited = !unmeasured && score > 0;

    let sentiment: string;
    if (unmeasured || !cited) sentiment = 'not_found';
    else if (s.overall_sentiment) sentiment = s.overall_sentiment;
    else if (score >= 60) sentiment = 'positive';
    else if (score >= 30) sentiment = 'neutral';
    else sentiment = 'negative';

    const borderColor = unmeasured ? '#9ca3af' : cited ? '#22c55e' : '#ef4444';
    const bgColor = unmeasured ? '#9ca3af08' : cited ? '#22c55e08' : '#ef444408';
    const statusLabel = s.measurement_status === 'pending' ? 'MESURE EN COURS' : unmeasured ? 'NON MESURÉ' : cited ? 'CITÉ' : 'NON CITÉ';
    const statusColor = unmeasured ? '#6b7280' : cited ? '#22c55e' : '#ef4444';

    const sentimentLabels: Record<string, { label: string; color: string }> = {
      'positive':    { label: 'Positif', color: '#22c55e' },
      'recommended': { label: 'Recommandé', color: '#22c55e' },
      'neutral':     { label: 'Neutre', color: '#6b7280' },
      'negative':    { label: 'Négatif', color: '#ef4444' },
      'not_found':   { label: '', color: '#9ca3af' },
    };
    const sentimentInfo = sentimentLabels[sentiment] || sentimentLabels.neutral;

    return `<div data-llm-status="${s.measurement_status === 'pending' ? 'pending' : 'done'}" style="padding:16px;border-radius:10px;border:1px solid ${borderColor}30;background:${bgColor};text-align:center;">
      <div style="font-weight:700;font-size:14px;color:#1f2937;margin-bottom:8px;">${name}</div>
      <div style="font-weight:700;font-size:12px;color:${statusColor};text-transform:uppercase;letter-spacing:0.5px;">${statusLabel}</div>
      ${cited && sentimentInfo.label ? `<div style="font-size:11px;margin-top:6px;padding:2px 10px;border-radius:12px;display:inline-block;background:${sentimentInfo.color}15;color:${sentimentInfo.color};font-weight:600;">${sentimentInfo.label}</div>` : ''}
    </div>`;
  }).join('');
}

// ─── Trois benchmarks distincts : une section de résultats par intention ───
function renderLlmBenchmarkSections(benchmarks: any[]): string {
  if (!Array.isArray(benchmarks) || benchmarks.length === 0) return '';
  return benchmarks.map((b: any) => {
    const prompts: any[] = Array.isArray(b?.prompts) ? b.prompts : [];
    const scoreList: any[] = Array.isArray(b?.scores) ? b.scores : [];
    const measured = Number(b?.measured_models ?? scoreList.length) || 0;
    const cited = Number(b?.cited_models ?? 0) || 0;
    const score = b?.score;
    const weight = AXIS_DISPLAY_WEIGHT[String(b?.id || '')] ?? 1.0;
    const cov = b?.coverage;
    const scoreColor = score === null || score === undefined ? '#6b7280' : score >= 60 ? '#22c55e' : score >= 30 ? '#f59e0b' : '#ef4444';
    const covHtml = cov && cov.observations > 0
      ? `<p style="font-size:12px;color:#374151;margin:0 0 6px;text-align:left;"><strong>Taux de citation : ${cov.rate} %</strong> — ${cov.hits} apparition${cov.hits > 1 ? 's' : ''} sur ${cov.observations} interrogation${cov.observations > 1 ? 's' : ''} mesurée${cov.observations > 1 ? 's' : ''} (fourchette de confiance ${cov.ci_low}–${cov.ci_high} %).</p>`
      : '';
    return `<div style="margin-top:16px;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;page-break-inside:avoid;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:4px;">
        <h4 style="font-size:14px;font-weight:600;color:#1f2937;margin:0;text-align:left;">${escapeHtmlText(String(b?.label || 'Benchmark'))}</h4>
        <span style="font-size:12px;font-weight:700;color:${scoreColor};white-space:nowrap;">${score === null || score === undefined ? 'Non mesuré' : score + '/100'}</span>
      </div>
      <p style="font-size:11px;color:#6b7280;margin:0 0 8px;line-height:1.5;text-align:left;">${escapeHtmlText(String(b?.description || ''))}</p>
      ${covHtml}
      <p style="font-size:12px;color:#374151;margin:0 0 6px;text-align:left;"><strong>${cited}/${measured}</strong> modèle${measured > 1 ? 's' : ''} citent le site sur cette intention. Poids de cet axe dans le score global : <strong>×${weight.toFixed(1)}</strong>.</p>
      ${prompts.length ? `<ol style="margin:0 0 10px 18px;padding:0;font-size:12px;color:#374151;line-height:1.6;text-align:left;">
        ${prompts.map((p: any) => `<li>« ${escapeHtmlText(String(p?.text || p))} »</li>`).join('')}
      </ol>` : ''}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${renderLlmModelCards(scoreList)}
      </div>
    </div>`;
  }).join('');
}

// ─── Dedicated renderer for LLM Visibility with 6 individual model cards ───
function buildLlmVisibilitySection(rawData: any, strategicData: any): string {
  // ALWAYS render this section — LLM visibility cards must appear in every report
  const LLM_NAMES = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'Mistral', 'Meta Llama'];

  const visibilityPayload = unwrapFunctionPayload(rawData);

  const scores = visibilityPayload?.scores || [];
  
  // If no real scores, generate 6 placeholder "not cited" cards so the section ALWAYS appears
  const effectiveScores = (Array.isArray(scores) && scores.length > 0) 
    ? scores 
    : LLM_NAMES.map(name => ({ llm_name: name, score_percentage: 0, score: 0 }));
  
  // If we only have strategic text and no scores at all, still show 6 cards + analysis
  const analysis = strategicData?.analysis || strategicData?.llm_analysis || null;

  // Cartes par modèle (score global, toutes intentions confondues)
  const cardsHtml = renderLlmModelCards(effectiveScores);

  // Trois benchmarks distincts (découverte / comparaison / usage & preuve)
  const benchmarks = visibilityPayload?.benchmarks || [];
  const benchmarksHtml = renderLlmBenchmarkSections(benchmarks);

  // ── Agrégat : couverture + qualité pondérée par axe + fiabilité.
  // Recalculé ici si le payload est antérieur à l'agrégat (rapports rejoués).
  const aggregate = visibilityPayload?.aggregate || (
    Array.isArray(benchmarks) && benchmarks.some((b: any) => b?.coverage)
      ? buildAggregate(benchmarks.map((b: any) => ({
          id: String(b?.id || ''),
          label: String(b?.label || ''),
          score: b?.score ?? null,
          hits: Number(b?.coverage?.hits ?? 0),
          observations: Number(b?.coverage?.observations ?? 0),
        })), 1)
      : null
  );

  // ── Potentiel (score déterministe de citabilité) vs mesuré (taux observé).
  // L'écart entre les deux est le constat le plus discriminant du rapport.
  const gapHtml = (() => {
    if (!aggregate?.coverage || aggregate.coverage.rate === null) return '';
    const potential = strategicData?.citation_probability;
    const cmp = comparePotentialVsMeasured(potential, aggregate.coverage.rate);
    const cov = aggregate.coverage;
    const quality = aggregate.quality_score;
    const rel = aggregate.reliability;
    const accent = cmp.verdict === 'notoriety_gap' ? '#f59e0b'
      : cmp.verdict === 'structure_gap' ? '#7c3aed'
      : cmp.verdict === 'both_low' ? '#ef4444'
      : '#6b7280';
    return `<div style="margin-top:16px;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;border-left:3px solid ${accent};page-break-inside:avoid;text-align:left;">
      <h4 style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 8px;text-align:left;">Potentiel de citabilité vs citation réellement observée</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;">
        <div style="padding:10px;background:#f8fafc;border-radius:6px;">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Taux de citation mesuré</div>
          <div style="font-size:18px;font-weight:700;color:#1f2937;">${cov.rate} %</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">${cov.hits}/${cov.observations} interrogations — fourchette ${cov.ci_low}–${cov.ci_high} %</div>
        </div>
        <div style="padding:10px;background:#f8fafc;border-radius:6px;">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Qualité de citation pondérée</div>
          <div style="font-size:18px;font-weight:700;color:#1f2937;">${quality === null || quality === undefined ? 'n/m' : quality + '/100'}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">Pondéré par axe : position SERP ×2,0 · cœur de marché ×1,5 · potentiel non capté ×1,0</div>
        </div>
        <div style="padding:10px;background:#f8fafc;border-radius:6px;">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Potentiel de citabilité</div>
          <div style="font-size:18px;font-weight:700;color:#1f2937;">${cmp.potential === null ? 'n/m' : cmp.potential + '/100'}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">Score déterministe : SERP, données structurées, fraîcheur, autorité</div>
        </div>
      </div>
      <p style="font-size:12px;color:#374151;margin:0 0 6px;line-height:1.6;text-align:left;"><strong>${escapeHtmlText(cmp.label)}.</strong> ${escapeHtmlText(cmp.explanation)}</p>
      <p style="font-size:11px;color:#6b7280;margin:0;line-height:1.5;text-align:left;">Le <strong>potentiel</strong> est calculé sur des signaux mesurables du site : il est stable d'un run à l'autre. Le <strong>taux de citation</strong> est une observation : il dépend de réponses non déterministes. Les deux ne mesurent pas la même chose et ne doivent pas être additionnés. ${escapeHtmlText(rel?.caveat || '')}</p>
    </div>`;
  })();



  // Strategic analysis below cards
  let strategicHtml = '';
  if (strategicData) {
    const citProb = strategicData.citation_probability;
    const breakdown = strategicData.citation_breakdown;
    const stratAnalysis = strategicData.analysis || strategicData.llm_analysis;
    
    // Build breakdown bars if available
    let breakdownHtml = '';
    if (breakdown && typeof breakdown === 'object') {
      const signals = [
        { key: 'serp_presence', label: 'Présence SERP', weight: '20%' },
        { key: 'content_quotability', label: 'Citabilité contenu', weight: '15%' },
        { key: 'business_intent_match', label: 'Intent. business', weight: '15%' },
        { key: 'brand_authority', label: 'Autorité marque', weight: '15%' },
        { key: 'structured_data_quality', label: 'Données struct.', weight: '10%' },
        { key: 'self_citation_signals', label: 'Auto-citations', weight: '10%' },
        { key: 'knowledge_graph_signals', label: 'Knowledge Graph', weight: '10%' },
        { key: 'content_freshness', label: 'Fraîcheur', weight: '5%' },
      ];
      const rows = signals.map(s => {
        const val = (breakdown as any)[s.key] ?? 0;
        const color = val >= 60 ? '#22c55e' : val >= 30 ? '#f59e0b' : '#ef4444';
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span style="font-size:11px;color:#6b7280;width:110px;flex-shrink:0;">${s.label} <span style="color:#9ca3af;font-size:10px;">(${s.weight})</span></span>
          <div style="flex:1;background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
            <div style="width:${val}%;height:100%;background:${color};border-radius:4px;transition:width 0.3s;"></div>
          </div>
          <span style="font-size:11px;font-weight:600;color:${color};width:30px;text-align:right;">${val}</span>
        </div>`;
      }).join('');
      breakdownHtml = `<div style="margin-top:10px;padding:10px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;">
        <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:8px;">Décomposition du score</div>
        ${rows}
      </div>`;
    }

    strategicHtml = `<div style="padding:12px;background:#f9fafb;border-radius:8px;margin-top:16px;text-align:left;">
      ${citProb != null ? `<div style="font-size:13px;margin-bottom:6px;"><strong>Probabilité de citation IA :</strong> <span style="font-weight:700;color:${citProb >= 60 ? '#22c55e' : citProb >= 30 ? '#f59e0b' : '#ef4444'};">${citProb}%</span></div>` : ''}
      ${breakdownHtml}
      ${stratAnalysis ? `<div style="font-size:13px;color:#374151;line-height:1.6;margin-top:8px;">${stratAnalysis}</div>` : ''}
    </div>`;
  }

  const citedCount = effectiveScores.filter((s: any) => (s.score_percentage ?? s.score ?? 0) > 0).length;

  // ── Questions réellement posées aux LLM (méthodologie visible dans chaque rapport) ──
  const askedPrompts: string[] = [];
  for (const b of (Array.isArray(benchmarks) ? benchmarks : [])) {
    for (const p of (Array.isArray(b?.prompts) ? b.prompts : [])) {
      const t = typeof p?.text === 'string' ? p.text.trim() : typeof p === 'string' ? p.trim() : '';
      if (t && !askedPrompts.includes(t)) askedPrompts.push(t);
    }
  }
  for (const s of effectiveScores) {
    for (const d of (Array.isArray(s?.details) ? s.details : [])) {
      const p = typeof d?.prompt === 'string' ? d.prompt.trim() : '';
      if (p && !askedPrompts.includes(p)) askedPrompts.push(p);
    }
  }
  const hasBenchmarks = !!benchmarksHtml;
  const nbQuestions = askedPrompts.length;
  const interrogations = nbQuestions * effectiveScores.length;
  const promptsHtml = `<div style="padding:12px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:16px;text-align:left;">
    <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;">Méthode de mesure ${provenanceBadge('test', 'fr')}</div>
    ${hasBenchmarks
      ? `<p style="font-size:11px;color:#6b7280;margin:0 0 8px;line-height:1.5;">La mesure est découpée en <strong>${benchmarks.length} benchmarks indépendants</strong>, chacun portant sur une <strong>zone de marché différente</strong>, déterminée à partir des positions réelles dans les résultats Google : le cœur de marché déjà couvert, le besoin sur lequel le site est le mieux classé, et le besoin fortement recherché qu'il n'adresse pas. À l'intérieur de chaque benchmark, trois questions de forme différente sont posées : découverte du besoin, comparaison d'options, et contexte d'usage (géolocalisé lorsque l'activité a une zone de chalandise). Chaque benchmark est scoré séparément et affiché ci-dessous avec ses questions et ses modèles interrogés : une marque peut être citée sur son cœur de marché et invisible ailleurs, ce qu'un score unique masquait.</p>`
      : (nbQuestions > 0
        ? `<ol style="margin:0 0 8px 18px;padding:0;font-size:12px;color:#374151;line-height:1.6;">
            ${askedPrompts.map(p => `<li>« ${escapeHtmlText(p)} »</li>`).join('')}
          </ol>`
        : `<p style="font-size:12px;color:#6b7280;margin:0 0 8px;">Questions non enregistrées sur ce run.</p>`)}
    <p style="font-size:11px;color:#6b7280;margin:0 0 8px;line-height:1.5;">Aucune question ne mentionne la marque ni le domaine : la citation est détectée après coup dans la réponse. Chaque question est jouée en conversation sur ${effectiveScores.length} modèles, avec jusqu'à 3 « tours » : le tour 1 est la question initiale, les tours 2 et 3 sont des relances de l'internaute. La conversation s'arrête dès que la marque apparaît. Une citation au tour 1 vaut 100, au tour 2 50, au tour 3 25, absente 0 — puis le score est modulé par le rang dans la liste, la tonalité et la richesse de la mention.</p>
    <p style="font-size:11px;color:#6b7280;margin:0;line-height:1.5;"><strong>Représentativité de l'échantillon :</strong> ${nbQuestions} question${nbQuestions > 1 ? 's' : ''} × ${effectiveScores.length} modèle${effectiveScores.length > 1 ? 's' : ''} = ${interrogations} interrogation${interrogations > 1 ? 's' : ''}.${nbQuestions < 8 ? ` Sous 8 questions, ce score est un <strong>indicateur de tendance</strong>, pas une mesure de part de voix : les réponses des modèles varient d'un appel à l'autre. À interpréter comme « cité / non cité sur ces intentions », et à retester dans le temps.` : ' Échantillon suffisant pour une lecture comparative dans le temps.'}</p>
  </div>`;

  return `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;">
    <h3 style="font-size:15px;font-weight:600;margin-bottom:4px;text-align:left;">Visibilité LLM — Benchmark en temps réel</h3>
    <p style="font-size:12px;color:#6b7280;margin-bottom:16px;">${citedCount}/${effectiveScores.length} LLMs vous citent, toutes intentions confondues</p>
    ${promptsHtml}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
      ${cardsHtml}
    </div>
    ${benchmarksHtml}
    ${gapHtml}
    ${strategicHtml}
  </div>`;

}

// ─── Section 1: Crawl Report (standalone HTML) ───
function generateCrawlSectionHTML(expertSeoData: any, lang: string, domain: string, url: string, crawlSnapshot?: any, topHtml = '', hostDupHtml = ''): string {
  const tr = getTranslations(lang);
  const scores = expertSeoData?.scores || {};
  const rawData = expertSeoData?.rawData || {};
  const htmlAnalysis = rawData?.htmlAnalysis || {};
  const linkProfile = htmlAnalysis?.insights?.linkProfile || {};
  const brokenLinksInsight = htmlAnalysis?.insights?.brokenLinks || {};

  const crawlMeta = crawlSnapshot || {
    pagesFound: rawData?.internalLinks?.length || linkProfile?.internal || 1,
    avgSeoScore: null,
    avgResponseTime: rawData?.responseTimeMs || null,
    wordCount: htmlAnalysis?.wordCount || 0,
    imagesTotal: htmlAnalysis?.imagesTotal || 0,
    imagesWithoutAlt: htmlAnalysis?.imagesMissingAlt || 0,
    h1: htmlAnalysis?.h1Contents?.[0] || '',
    h2Count: htmlAnalysis?.h2Count || 0,
    hasSchema: htmlAnalysis?.hasSchemaOrg || false,
    hasOg: htmlAnalysis?.hasOg || false,
    hasCanonical: htmlAnalysis?.hasCanonical || false,
    brokenLinks: rawData?.brokenLinks?.length || brokenLinksInsight?.broken?.length || 0,
    externalLinks: linkProfile?.external || 0,
    internalLinks: linkProfile?.internal || 0,
    indexable: htmlAnalysis?.isIndexable !== false,
    performanceScore: scores?.performance?.psiPerformance || null,
    lcp: scores?.performance?.lcp || null,
    tbt: scores?.performance?.tbt || null,
    cls: scores?.performance?.cls || null,
    fcp: scores?.performance?.fcp || null,
    title: htmlAnalysis?.titleContent || '',
    titleLength: htmlAnalysis?.titleLength || 0,
    metaDesc: htmlAnalysis?.metaDescContent || '',
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
      ${sectionLead('crawl', lang)}
      ${topHtml}
      ${hostDupHtml}
      ${crawlMeta.pagesFound > 1 ? `<div class="intro-text">Crawl multi-pages analysé : <strong>${crawlMeta.pagesFound}</strong> pages${crawlMeta.avgSeoScore != null ? ` · score SEO moyen <strong>${crawlMeta.avgSeoScore}/100</strong>` : ''}</div>` : ''}
      <div class="intro-text" style="font-size:12px;color:#6b7280;">Les quatre premières tuiles cumulent l'ensemble des pages explorées ; les balises et la structure de titres qui suivent décrivent la page d'accueil.</div>
      <div class="stat-grid-4">
        <div class="stat-card"><div class="value">${crawlMeta.wordCount}</div><div class="label">Mots (total site)</div></div>
        <div class="stat-card"><div class="value">${crawlMeta.internalLinks}</div><div class="label">Liens internes (total)</div></div>
        <div class="stat-card"><div class="value">${crawlMeta.externalLinks}</div><div class="label">Liens externes (total)</div></div>
        <div class="stat-card"><div class="value">${crawlMeta.avgResponseTime ? crawlMeta.avgResponseTime + 'ms' : 'non mesuré'}</div><div class="label">Temps de réponse moyen</div></div>
      </div>
      <div class="stat-grid-4" style="margin-top:12px;">
        <div class="stat-card"><div class="value">${crawlMeta.imagesTotal}</div><div class="label">Images (total site)</div></div>
        <div class="stat-card"><div class="value" style="color:${crawlMeta.imagesWithoutAlt > 0 ? '#ef4444' : '#22c55e'}">${crawlMeta.imagesWithoutAlt}</div><div class="label">Images sans alt</div></div>
        <div class="stat-card"><div class="value">${crawlMeta.h2Count}</div><div class="label">H2 (page d'accueil)</div></div>
        <div class="stat-card"><div class="value" style="color:${crawlMeta.brokenLinks > 0 ? '#ef4444' : '#22c55e'}">${crawlMeta.brokenLinks}</div><div class="label">Pages en erreur</div></div>
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
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Structure des titres (${crawlMeta.h2Count || crawlMeta.h2Contents.length} H2, ${crawlMeta.h3Count} H3)${
          (crawlMeta.h2Count || 0) > crawlMeta.h2Contents.length
            ? ` — extrait de ${crawlMeta.h2Contents.length} intitulé${crawlMeta.h2Contents.length > 1 ? 's' : ''} relevé${crawlMeta.h2Contents.length > 1 ? 's' : ''}`
            : ''
        }</h3>
        <ul style="padding-left:20px;font-size:13px;color:#374151;">
          ${crawlMeta.h2Contents.slice(0, 20).map((h: string) => `<li style="margin-bottom:4px;">${h}</li>`).join('')}
        </ul>
      </div>` : ''}
      <div class="checklist" style="margin-top:16px;">
        <div class="checklist-item">${checkMark(crawlMeta.indexable)} Indexable</div>
        <div class="checklist-item">${checkMark(crawlMeta.isHttps)} HTTPS</div>
        <div class="checklist-item">${checkMark(crawlMeta.hasCanonical)} Canonical${crawlMeta.canonicalCoverage != null ? ` (${crawlMeta.canonicalCoverage} % des pages crawlées)` : ''}</div>
        <div class="checklist-item">${checkMark(crawlMeta.hasOg)} Open Graph</div>
        <div class="checklist-item">${checkMark(crawlMeta.hasSchema)} Schema.org ${crawlMeta.schemaTypes.length > 0 ? `(${crawlMeta.schemaTypes.join(', ')})` : ''}</div>
        <div class="checklist-item">${checkMark(crawlMeta.hasRobotsTxt)} robots.txt ${crawlMeta.robotsPermissive ? '(permissif)' : ''}</div>
      </div>
      ${crawlMeta.performanceScore ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Core Web Vitals (PageSpeed Insights — profil mobile)</h3>
        <p style="font-size:12px;color:var(--muted-foreground,#666);margin:0 0 10px;line-height:1.5;">
          Mesure effectuée exclusivement en profil mobile (Lighthouse, réseau et CPU bridés), conformément à l'indexation mobile-first de Google : c'est cette version que Google explore et classe. Les performances peuvent différer de celles constatées sur ordinateur. En France en 2026, 65 % des requêtes search sont mobiles ; en revanche, la conversion reste environ 2x plus élevée sur desktop.
        </p>
        <div class="stat-grid-4">
          <div class="stat-card"><div class="value" style="color:${scoreColor(crawlMeta.performanceScore, 100)}">${crawlMeta.performanceScore}</div><div class="label">Performance mobile /100</div></div>

          ${crawlMeta.lcp ? `<div class="stat-card"><div class="value">${formatVitalSeconds(crawlMeta.lcp)}</div><div class="label">LCP</div></div>` : ''}
          ${crawlMeta.tbt ? `<div class="stat-card"><div class="value">${formatVitalSeconds(crawlMeta.tbt)}</div><div class="label">TBT</div></div>` : ''}
          ${crawlMeta.cls !== null && crawlMeta.cls !== undefined ? `<div class="stat-card"><div class="value">${Number(crawlMeta.cls).toFixed(3)}</div><div class="label">CLS (score)</div></div>` : ''}
          ${crawlMeta.fcp ? `<div class="stat-card"><div class="value">${formatVitalSeconds(crawlMeta.fcp)}</div><div class="label">FCP</div></div>` : ''}
        </div>
      </div>` : ''}
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Détail des scores</h3>
        ${(() => {
          const axes: Array<[string, any, number]> = [
            ['Performance', scores?.performance, 40],
            ['Technique', scores?.technical, 50],
            ['Sémantique', scores?.semantic, 60],
            ['IA-Ready', scores?.aiReady, 50],
            ['Sécurité', scores?.security, 20],
          ];
          let sum = 0; let sumMax = 0;
          const cards = axes.map(([label, axis, defMax]) => {
            const max = Number(axis?.maxScore || defMax);
            const val = clampScore(axis?.score, max) ?? 0;
            sum += val; sumMax += max;
            return `<div class="stat-card"><div class="value" style="color:${scoreColor(val, max)}">${val}</div><div class="label">${label} /${max}</div></div>`;
          }).join('');
          const total = Number(expertSeoData?.totalScore ?? sum);
          const declaredMax = Number(expertSeoData?.maxScore || sumMax);
          return `<div class="stat-grid-4">${cards}</div>
        <p style="font-size:12px;color:#6b7280;margin:10px 0 0;">
          Somme des cinq axes : <strong>${sum}/${sumMax}</strong>${total !== sum ? ` — le score global d'audit technique affiché ailleurs (${total}/${declaredMax}) intègre en plus les contrôles hors page d'accueil (sitemaps, robots.txt, llms.txt).` : `, soit le score global d'audit technique (${total}/${declaredMax}).`}
          Le score sur 100 de la synthèse exécutive est cette même valeur ramenée en pourcentage : ${Math.round((total / (declaredMax || 1)) * 100)}/100.
        </p>`;
        })()}
      </div>
    </div>`;

  return wrapStandaloneHTML(content, `${tr.crawlReport} - ${domain}`, lang);
}

// ─── Section 2: Technical SEO Audit (standalone HTML) ───
function generateTechSectionHTML(expertSeoData: any, lang: string, domain: string, topHtml = ''): string {
  const tr = getTranslations(lang);
  const techScore = expertSeoData?.totalScore || 0;
  const techMaxScore = expertSeoData?.maxScore || 220;
  const techRecommendations = expertSeoData?.recommendations || [];
  const techIntro = expertSeoData?.introduction || '';

  const content = `
    <div class="section">
      <div class="section-title"><span class="section-number">2</span> 🔍 ${tr.techAudit}</div>
      ${sectionLead('tech', lang)}
      ${topHtml}
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
        const rawTitle = typeof r === 'string' ? r : r.title || r.label || '';
        const split = splitTrailingSeverity(String(rawTitle));
        const title = split.text;
        const desc = typeof r === 'string' ? '' : r.description || r.detail || '';
        const priority = typeof r === 'string' ? (split.severity || '') : (r.priority || r.severity || split.severity || '');
        const category = typeof r === 'string' ? '' : r.category || '';
        const color = priority === 'critical' ? '#ef4444' : priority === 'important' ? '#f59e0b' : '#3b82f6';
        return `<div class="reco-card" style="border-left-color:${color}">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
            ${severityBadgeHTML(priority)}
            ${category ? `<span style="font-size:11px;color:#6b7280;background:#f3f4f6;padding:1px 6px;border-radius:4px;">${humanizeKey(String(category))}</span>` : ''}
          </div>
          <div style="font-weight:500;">${title}</div>
          ${desc ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;">${splitTrailingSeverity(String(desc)).text}</div>` : ''}
        </div>`;

      }).join('')}` : ''}
    </div>`;

  return wrapStandaloneHTML(content, `${tr.techAudit} - ${domain}`, lang);
}

// ─── Section 3: Strategic GEO Audit (standalone HTML) ───
function generateStrategicSectionHTML(strategicDataRaw: any, lang: string, domain: string, llmRealDataRaw?: any, topHtmlGeo = '', topHtmlKw = '', topHtmlEeat = '', hasConsolidatedPlan = false, geoSubSignalsHtml = ''): string {
  // Garde-fou de rendu : aucune fuite de gabarit de prompt ne doit atteindre le
  // rapport, y compris via des données mises en cache avant les garde-fous.
  const strategicData = sanitizeReportData(strategicDataRaw);
  const llmRealData = sanitizeReportData(llmRealDataRaw);
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
  // Modules produits par strategic-synthesis mais jusqu'ici jamais rendus dans
  // Marina (ils n'étaient visibles que dans /audit) : citabilité GEO, intention
  // conversationnelle, risque zéro-clic, contenus prioritaires, autorité de
  // domaine (backlinks) et vue d'ensemble des positions.
  const geoCitability = strategicData?.geo_citability || null;
  const conversationalIntent = strategicData?.conversational_intent || null;
  const zeroClickRisk = strategicData?.zero_click_risk || null;
  const priorityContent = strategicData?.priority_content || null;
  const domainAuthority = strategicData?.domain_authority || null;
  const rankingOverview = strategicData?.ranking_overview || null;


  const content = `
    <div class="section">
      <div class="section-title"><span class="section-number">3</span> 🎯 ${tr.strategicAudit}</div>
      ${sectionLead('strategic', lang)}
      ${topHtmlGeo}
      ${topHtmlEeat}
      ${topHtmlKw}
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div class="score-badge" style="background:${scoreColor(stratScore, 100)}">${stratScore} / 100</div>
      </div>
      ${stratIntro?.presentation ? `<div class="intro-text">${stratIntro.presentation}</div>` : ''}
      ${stratIntro?.strengths ? `<div class="intro-text"><strong>${tr.strengths}:</strong> ${stratIntro.strengths}</div>` : ''}
      ${stratIntro?.improvement ? `<div class="intro-text"><strong>${tr.improvements}:</strong> ${stratIntro.improvement}</div>` : ''}
      ${stratSummary ? `<div style="margin-top:16px;padding:16px;background:#eff6ff;border-radius:8px;"><h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">📋 ${tr.executiveSummary}</h3><div class="intro-text">${stratSummary}</div></div>` : ''}
      <!-- ── Bloc GEO / citabilité IA : remonté en tête de la section, c'est
           l'objet même de l'audit stratégique. ── -->
      ${buildModuleSection('Citabilité par les moteurs de réponse IA', '🌍', geoCitability)}
      ${geoSubSignalsHtml}
      <!--MARINA_LLM_START-->${buildLlmVisibilitySection(llmVisibility, llmVisibilityStrategic)}<!--MARINA_LLM_END-->

      ${buildModuleSection('Maturité GEO', '🌍', geoReadiness)}
      ${buildModuleSection('Citabilité : extraits reprenables', '💬', quotability)}
      ${buildModuleSection('Résilience des Résumés', '🛡️', summaryResilience)}
      ${buildModuleSection('Intention conversationnelle', '💭', conversationalIntent)}
      ${buildModuleSection('Risque zéro-clic', '🚫', zeroClickRisk)}

      <!-- ── Bloc mots-clés et marché ── -->
      ${buildKeywordPositioningSection(keywordPos, rankingOverview)}
      ${buildModuleSection('Contenus prioritaires à créer / renforcer', '🧭', priorityContent)}
      ${buildModuleSection('Marché et autorité de domaine', '🔗', domainAuthority)}
      ${buildModuleSection('Données Marché', '📈', marketData)}

      <!-- ── Bloc marque, concurrence, audience ── -->
      ${buildModuleSection('Autorité de Marque', '🏛️', brandAuth)}
      ${buildSocialSignalsSection(socialSignals)}
      ${buildModuleSection('Intelligence Marché', '📊', marketIntel)}
      ${buildCompetitiveLandscapeSection(competitive)}
      ${buildModuleSection('Empreinte Lexicale', '📝', lexicalFootprint)}
      ${buildModuleSection("Sentiment d'Expertise", '🎯', expertiseSentiment)}
      ${buildModuleSection('Test adversarial (résistance aux contre-arguments)', '🔴', redTeam)}
      ${buildModuleSection('Google My Business', '📍', gmb)}
      ${buildModuleSection('Cibles Clients', '👥', clientTargets)}

      ${hasConsolidatedPlan ? `<div class="intro-text" style="font-size:12px;color:#6b7280;">Les actions issues de cette analyse ne sont pas listées ici : elles sont fusionnées, dédoublonnées et pondérées par impact / effort dans la section « Plan d'action consolidé ».</div>` : ''}
      ${(!hasConsolidatedPlan && stratRoadmap.length > 0) ? `

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

// ─── Section 5: Indexation Health (standalone HTML) ───
function generateIndexationSectionHTML(indexationData: any[], lang: string, domain: string): string {
  const title = lang === 'fr' ? 'Santé d\'indexation Google' : lang === 'es' ? 'Salud de indexación Google' : 'Google Indexation Health';
  const total = indexationData.length;
  const indexed = indexationData.filter(r => r.verdict === 'PASS').length;
  const notIndexed = total - indexed;
  const ratio = total > 0 ? Math.round((indexed / total) * 100) : 0;
  const ratioColor = ratio >= 80 ? '#22c55e' : ratio >= 50 ? '#f59e0b' : '#ef4444';

  const issueRows = indexationData
    .filter(r => r.verdict !== 'PASS')
    .slice(0, 20)
    .map(r => `<tr>
      <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #f1f5f9;word-break:break-all;">${r.page_url}</td>
      <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #f1f5f9;color:#ef4444;">${r.coverage_state || r.verdict}</td>
      <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #f1f5f9;">${r.last_crawl_time ? new Date(r.last_crawl_time).toLocaleDateString() : '—'}</td>
    </tr>`)
    .join('');

  return `<div class="section"><h2><span class="section-number">5</span> 📊 ${title}</h2>
  ${sectionLead('indexation', lang)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
      <div class="stat-card"><div class="value" style="color:${ratioColor}">${ratio}%</div><div class="label">${lang === 'fr' ? 'Taux d\'indexation' : 'Indexation rate'}</div></div>
      <div class="stat-card"><div class="value" style="color:#22c55e">${indexed}</div><div class="label">${lang === 'fr' ? 'Pages indexées' : 'Indexed pages'}</div></div>
      <div class="stat-card"><div class="value" style="color:#ef4444">${notIndexed}</div><div class="label">${lang === 'fr' ? 'Non indexées' : 'Not indexed'}</div></div>
    </div>
    ${notIndexed > 0 ? `<table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;color:#64748b;">URL</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;color:#64748b;">${lang === 'fr' ? 'Raison' : 'Reason'}</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;color:#64748b;">${lang === 'fr' ? 'Dernier crawl' : 'Last crawl'}</th>
      </tr></thead>
      <tbody>${issueRows}</tbody>
    </table>` : `<p style="color:#22c55e;font-weight:600;">✅ ${lang === 'fr' ? 'Toutes les pages vérifiées sont correctement indexées.' : 'All checked pages are properly indexed.'}</p>`}
  </div>`;
}

// ─── Section 4: Cocoon Analysis (standalone HTML) ───
function generateCocoonSectionHTML(cocoonData: any, lang: string, domain: string, topHtml = ''): string {
  const tr = getTranslations(lang);
  const cocoonStats = cocoonData?.stats || null;
  const cocoonClusters = cocoonData?.cluster_summary || cocoonData?.clusters || null;
  const cocoonNodes = cocoonData?.nodes || cocoonData?.nodes_snapshot || [];
  const cocoonEdges = cocoonData?.edges || cocoonData?.edges_snapshot || [];
  const cocoonGraphDetails = cocoonData?.graph_details || {};
  const orphanPages = cocoonGraphDetails?.orphan_pages || [];
  const clusterDetails = cocoonGraphDetails?.cluster_details || [];
  const cannibalizationRisks = cocoonGraphDetails?.cannibalization_risks || [];
  const thinContentPages = cocoonGraphDetails?.thin_content_pages || [];
  const strategeRecos: Array<{ title: string; description: string; priority: string }> = cocoonData?._stratege_recommendations || [];

  // Lot B — verdict pilier / satellite : « /a ↔ /b » n'indique pas quelle page
  // garder. Chaque groupe reçoit donc un verdict déterministe et une action unique.
  // Repli sur la liste brute si les métriques de nœuds manquent.
  const pillarSatelliteHtml = pillarSatelliteBlockHTML(
    verdictsFromCocoonRisks(cannibalizationRisks, cocoonNodes, 5),
  );


  // Lot 6 — nommage lisible des clusters + regroupement des thématiques isolées
  // (un cluster à une page n'a aucune valeur de lecture en tant que cadre).
  const clusterEntries: any[] = cocoonClusters && typeof cocoonClusters === 'object'
    ? Object.entries(cocoonClusters).map(([key, val]: [string, any]) => ({ cluster_id: key, ...(val || {}) }))
    : (clusterDetails || []);
  const { clusters: namedClusters, isolatedCount: isolatedClusters } = consolidateClusters(clusterEntries as any[]);



  const content = `
    <div class="section">
      <div class="section-title"><span class="section-number">4</span> 🕸️ ${tr.cocoonAnalysis}</div>
      ${sectionLead('cocoon', lang)}
      ${topHtml}
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
      ${(namedClusters.length > 0 || isolatedClusters > 0) ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Thématiques identifiées${namedClusters.length > 0 ? ` (${namedClusters.length})` : ''}</h3>
        ${namedClusters.map((val: any, i: number) => `
          <div style="padding:12px;margin-bottom:8px;background:#f9fafb;border-left:3px solid #3b82f6;border-radius:6px;">
            <div style="font-weight:600;font-size:14px;">${clusterDisplayName(val, i)}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">
              ${clusterSize(val)} pages
              ${val?.avg_geo ? ` · Score GEO moyen : ${Math.round(val.avg_geo)}` : ''}
              ${val?.avg_seo_score ? ` · Score SEO moyen : ${Math.round(val.avg_seo_score)}` : ''}
              ${val?.avg_word_count ? ` · ${Math.round(val.avg_word_count)} mots en moyenne` : ''}
              ${val?.avg_roi ? ` · ROI moyen : ${Math.round(val.avg_roi)}` : ''}
              ${val?.total_traffic ? ` · Trafic estimé : ${val.total_traffic}` : ''}
              ${val?.dominant_intent ? ` · Intention dominante : ${humanizeValue(val.dominant_intent)}` : ''}
            </div>
          </div>
        `).join('')}
        ${isolatedClustersNoteHTML(isolatedClusters)}
      </div>` : ''}

      ${orphanPages.length > 0 ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Pages orphelines (${orphanPages.length})</h3>
        <ul style="padding-left:20px;font-size:13px;color:#374151;">
          ${orphanPages.slice(0, 10).map((page: any) => `<li style="margin-bottom:4px;">${page.url} ${page.word_count ? `(${page.word_count} mots)` : ''}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${cannibalizationRisks.length > 0 ? (pillarSatelliteHtml || `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Risques de cannibalisation (${cannibalizationRisks.length})</h3>
        ${cannibalizationRisks.slice(0, 5).map((risk: any) => `
          <div style="padding:12px;margin-bottom:8px;border:1px solid #e5e7eb;border-left:3px solid #8a6d1f;border-radius:6px;">
            <div style="font-weight:600;font-size:13px;">${(risk?.urls || []).join(' ↔ ')}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Mots-clés partagés : ${(risk?.shared_keywords || []).join(', ') || '-'}</div>
          </div>
        `).join('')}
      </div>`) : ''}
      ${thinContentPages.length > 0 ? `
      <div style="margin-top:16px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">Pages à contenu faible (${thinContentPages.length})</h3>
        <ul style="padding-left:20px;font-size:13px;color:#374151;">
          ${thinContentPages.slice(0, 10).map((page: any) => `<li style="margin-bottom:4px;">${page.url} (${page.word_count || 0} mots)</li>`).join('')}
        </ul>
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
              <td style="padding:6px 8px;text-align:center;">${(() => {
                // `page_authority` n'est pas toujours calculé côté cocon : plutôt
                // qu'une colonne à 0 partout (donc illisible), on recalcule la
                // même autorité interne déterministe que le verdict pilier/satellite.
                const stored = Number(nd.page_authority);
                if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
                const computed = pageAuthority({
                  url: String(nd.url || ''),
                  seo_score: nd.seo_score ?? null,
                  word_count: nd.word_count ?? null,
                  inbound: nd.internal_links_in ?? null,
                  depth: nd.crawl_depth ?? nd.depth ?? null,
                });
                return computed > 0 ? `${Math.round(computed)}<span style="color:#9ca3af;"> *</span>` : 'n/m';
              })()}</td>
              <td style="padding:6px 8px;text-align:center;">${nd.internal_links_in ?? '-'}</td>
              <td style="padding:6px 8px;text-align:center;">${nd.internal_links_out ?? '-'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
        <p style="font-size:11px;color:#6b7280;margin-top:6px;">Autorité interne déterministe (score SEO, volume de contenu, liens entrants, profondeur de crawl). Les valeurs suivies d'un astérisque sont recalculées ici faute de valeur stockée ; « n/m » signale une page sans signal exploitable.</p>
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
        ${strategeRecos.map((r) => {
          const split = splitTrailingSeverity(String(r.title || ''));
          const prio = r.priority || split.severity || '';
          const prioColor = prio === 'critique' || prio === 'critical' ? '#ef4444' : prio === 'important' ? '#f59e0b' : '#22c55e';
          return `<div style="padding:12px;margin-bottom:8px;background:white;border-left:3px solid ${prioColor};border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
            ${severityBadgeHTML(prio) ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">${severityBadgeHTML(prio)}</div>` : ''}
            <div style="font-weight:600;font-size:14px;">${split.text}</div>
            <div style="font-size:13px;color:#4b5563;margin-top:4px;line-height:1.6;">${splitTrailingSeverity(String(r.description || '')).text}</div>
          </div>`;
        }).join('')}

      </div>` : ''}
    </div>`;

  return wrapStandaloneHTML(content, `${tr.cocoonAnalysis} - ${domain}`, lang);
}

// ─── Wrap a section as standalone HTML (for temporary storage) ───
function wrapStandaloneHTML(bodyContent: string, title: string, lang: string): string {
  const tr = getTranslations(lang);
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
    <!-- MARINA_SECTION_BODY_START -->
    ${bodyContent}
    <!-- MARINA_SECTION_BODY_END -->
    <div class="footer">
      <div>${tr.poweredBy}</div>
      <div style="margin-top:4px;"><a href="https://crawlers.fr">crawlers.fr</a></div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Extract body content from standalone HTML (strip header/footer/html wrapper) ───
function extractBodyContent(html: string, options: { stripHeader?: boolean; stripFooter?: boolean } = {}): string {
  const markerMatch = html.match(/<!-- MARINA_SECTION_BODY_START -->([\s\S]*?)<!-- MARINA_SECTION_BODY_END -->/);
  if (markerMatch) return markerMatch[1].trim();

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

// ─── Branding type for white-label ───
interface MarinaBranding {
  enabled: boolean;
  fullWhiteLabel: boolean;
  logoUrl?: string | null;
  primaryColor?: string | null;
  brandName?: string | null;
  customIntro?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  hideBadge?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
  reportHeaderText?: string | null;
  reportFooterText?: string | null;
}

// ─── Compile multiple section HTMLs into one final report ───
/**
 * Détecte une couche stratégique (audit GEO) dégradée.
 * `strategic-synthesis` répond toujours HTTP 200 : en cas d'échec LLM il renvoie
 * un objet fallback (`_error`, `executive_summary: 'Analyse interrompue.'`,
 * `overallScore: 0`, roadmap vide). Il faut donc l'identifier explicitement.
 */
function detectStrategicDegradation(strategicData: any): { degraded: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!strategicData) {
    return { degraded: true, reasons: ['aucune donnée stratégique retournée'] };
  }
  if (strategicData._error) reasons.push(String(strategicData._error));

  const summary = String(strategicData.executive_summary || '');
  const intro = String(strategicData.introduction?.presentation || '');
  if (/analyse interrompue/i.test(summary) || /analyse interrompue/i.test(intro)) {
    reasons.push('synthèse exécutive non produite');
  }

  const roadmap = strategicData.executive_roadmap || strategicData.strategic_roadmap || [];
  const score = Number(strategicData.overallScore || 0);
  if (score === 0 && (!Array.isArray(roadmap) || roadmap.length === 0)) {
    reasons.push('score GEO à 0 et feuille de route vide');
  }

  return { degraded: reasons.length > 0, reasons };
}

/** Bandeau d'avertissement, palette Crawlers (violet / or / noir / blanc), sans emoji. */
function buildStrategicDegradedBannerHTML(lang: string, reasons: string[]): string {
  const isFr = lang === 'fr';
  const title = isFr
    ? 'Couche stratégique indisponible'
    : lang === 'es' ? 'Capa estratégica no disponible' : 'Strategic layer unavailable';
  const body = isFr
    ? `L'audit stratégique GEO (synthèse exécutive, score global de visibilité, feuille de route priorisée) n'a pas pu être produit lors de cette exécution. Les sections techniques, de crawl et de cocon sémantique ci-dessous restent valides et exploitables. Ce rapport est donc <strong>partiel</strong> : relancez l'audit pour obtenir la couche stratégique.`
    : lang === 'es'
      ? `La auditoría estratégica GEO no pudo generarse en esta ejecución. Las secciones técnicas, de rastreo y de arquitectura semántica siguen siendo válidas. Este informe es <strong>parcial</strong>: vuelva a lanzar la auditoría.`
      : `The GEO strategic audit (executive summary, overall visibility score, prioritised roadmap) could not be produced during this run. The technical, crawl and semantic-architecture sections below remain valid. This report is therefore <strong>partial</strong>: re-run the audit to obtain the strategic layer.`;
  const detail = reasons.length
    ? `<div style="margin-top:8px;font-size:11px;color:#6b7280;">${isFr ? 'Cause technique' : 'Technical cause'} : ${reasons.map(r => r.replace(/[<>]/g, '')).join(' · ')}</div>`
    : '';

  return `<div class="marina-degraded-banner" data-marina-scope="page" data-marina-block="degraded" style="margin:20px 24px;padding:16px 18px;border:2px solid #6d28d9;border-left:6px solid #d4af37;border-radius:10px;background:#ffffff;">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6d28d9;font-weight:700;margin-bottom:6px;">${isFr ? 'Rapport partiel' : 'Partial report'}</div>
    <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:6px;">${title}</div>
    <div style="font-size:13px;line-height:1.65;color:#374151;">${body}</div>
    ${detail}
  </div>`;
}

/** Insère le bandeau juste après l'ouverture du <body> (compatible avec les deux générateurs). */
function injectDegradedBanner(html: string, banner: string): string {
  if (!banner || html.includes('marina-degraded-banner')) return html;
  const m = html.match(/<body[^>]*>/i);
  if (!m) return banner + html;
  return html.replace(m[0], `${m[0]}\n${banner}`);
}

/**
 * Charte Crawlers : violet, or, noir, blanc. Le bleu « IA » est interdit,
 * les emoji aussi. Les templates historiques (et les sections produites par
 * d'autres fonctions) contiennent encore les deux : on normalise le HTML final
 * de façon déterministe plutôt que de dupliquer la charte à chaque template.
 */
const CRAWLERS_COLOR_MAP: Record<string, string> = {
  '#3b82f6': '#6d28d9', '#2563eb': '#5b21b6', '#1d4ed8': '#4c1d95',
  '#1e40af': '#4c1d95', '#60a5fa': '#8b5cf6', '#93c5fd': '#c4b5fd',
  '#bfdbfe': '#ddd6fe', '#dbeafe': '#ede9fe', '#eff6ff': '#f5f3ff',
  '#0ea5e9': '#7c3aed', '#38bdf8': '#a78bfa', '#0284c7': '#5b21b6',
};

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{2139}]/gu;

function sanitizeMarinaHtml(html: string, opts?: { keepColors?: boolean }): string {
  let out = html;
  if (!opts?.keepColors) {
    for (const [from, to] of Object.entries(CRAWLERS_COLOR_MAP)) {
      out = out.replaceAll(from, to).replaceAll(from.toUpperCase(), to);
    }
  }
  out = out
    .replace(/([>\s])\u2705([<\s])/gu, '$1Oui$2')
    .replace(/([>\s])\u274C([<\s])/gu, '$1Non$2')
    .replace(EMOJI_RE, '')
    .replace(/[ \t]{2,}</g, ' <')
    .replace(/>\s{2,}([A-Za-zÀ-ÿ0-9])/g, '> $1');
  return out;
}

/**
 * Synthèse exécutive : un score global et un verdict en une phrase, en tête de
 * rapport. 100 % déterministe (aucun appel LLM, donc aucun coût token).
 */
function buildExecutiveSummaryHTML(
  lang: string,
  domain: string,
  ctx: { expertData?: any; strategicData?: any; crawlSnapshot?: any; degraded?: boolean; criticalCount?: number; roi?: RoiSummary | null; verdictSignals?: VerdictSignals | null; verdictHtml?: string | null },

): string {
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const t = (fr: string, en: string, es: string) => (isEn ? en : isEs ? es : fr);

  const techRaw = Number(ctx.expertData?.totalScore || 0);
  const techMax = Number(ctx.expertData?.maxScore || 220) || 220;
  const tech100 = techRaw > 0 ? Math.round((techRaw / techMax) * 100) : null;
  const geo100 = ctx.strategicData?.overallScore ? Math.round(Number(ctx.strategicData.overallScore)) : null;
  const pages = ctx.crawlSnapshot?.crawled_pages || ctx.crawlSnapshot?.pages?.length || null;

  const parts = [tech100, geo100].filter((v): v is number => typeof v === 'number' && v > 0);
  const global = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

  const band = (s: number | null) =>
    s === null ? 'unknown' : s >= 75 ? 'strong' : s >= 55 ? 'ok' : s >= 35 ? 'weak' : 'critical';
  // Garde d'exigence : un site avec des blocages critiques ne peut pas être
  // déclaré « solide » sur la seule moyenne des scores — le verdict est
  // rétrogradé d'un cran dès qu'il reste au moins un point critique ouvert.
  const rawBand = band(global);
  const critical = Number(ctx.criticalCount || 0);
  const b =
    critical > 0 && rawBand === 'strong' ? 'ok'
    : critical >= 3 && rawBand === 'ok' ? 'weak'
    : rawBand;

  const verdict =
    b === 'unknown'
      ? t(
          `Le score global n'a pas pu être consolidé pour ${domain} : lisez les sections une par une avant tout arbitrage.`,
          `The global score could not be consolidated for ${domain}: read each section before any decision.`,
          `La puntuación global no pudo consolidarse para ${domain}.`,
        )
      : b === 'strong'
      ? t(
          `La stratégie de ${domain} est globalement saine (${global}/100) : les gains restants sont d'optimisation, pas de refonte.`,
          `${domain} is globally sound (${global}/100): remaining gains are optimisation, not rebuild.`,
          `${domain} es globalmente sólido (${global}/100).`,
        )
      : b === 'ok'
      ? t(
          `La stratégie de ${domain} est fonctionnelle mais incomplète (${global}/100) : la base technique tient, la couche sémantique et de citabilité IA reste à construire.`,
          `${domain} is functional but incomplete (${global}/100): the technical base holds, the semantic and AI-citability layer is still missing.`,
          `${domain} es funcional pero incompleto (${global}/100).`,
        )
      : b === 'weak'
      ? t(
          `La stratégie de ${domain} est insuffisante en l'état (${global}/100) : les correctifs prioritaires du plan d'action conditionnent tout gain de visibilité.`,
          `${domain} is insufficient as it stands (${global}/100): the priority fixes in the action plan condition any visibility gain.`,
          `${domain} es insuficiente en su estado actual (${global}/100).`,
        )
      : t(
          `La stratégie de ${domain} est en défaut critique (${global}/100) : traiter les blocages techniques avant toute production de contenu.`,
          `${domain} is critically failing (${global}/100): fix technical blockers before producing content.`,
          `${domain} presenta un fallo crítico (${global}/100).`,
        );

  const cell = (label: string, value: string, metric?: string) => `
    <div style="flex:1 1 140px;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">${label}</div>
      <div style="font-size:20px;font-weight:700;color:#111827;">${value}</div>
      ${metric ? `<div style="margin-top:5px;">${metricBadge(metric, lang)}</div>` : ''}
    </div>`;

  return `
  <div class="section" data-marina-scope="page" data-marina-block="summary" style="border-left:6px solid #d4af37;">
    <h2 style="font-size:20px;margin:0 0 4px 0;">${t('Synthèse exécutive', 'Executive summary', 'Síntesis ejecutiva')}</h2>
    <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 14px 0;"><strong>${verdict}</strong></p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;">
      ${cell(t('Score global', 'Global score', 'Puntuación global'), global === null ? 'n/d' : `${global}/100`, 'global_score')}
      ${cell(t('SEO technique', 'Technical SEO', 'SEO técnico'), tech100 === null ? 'n/d' : `${tech100}/100`, 'seo_score')}
      ${cell(t('GEO / citabilité IA', 'GEO / AI citability', 'GEO / citabilidad IA'), geo100 === null ? 'n/d' : `${geo100}/100`, 'geo_score')}
      ${cell(t('Pages explorées', 'Pages crawled', 'Páginas rastreadas'), pages ? String(pages) : 'n/d', 'pages_crawled')}
      ${ctx.roi ? cell(t('Gains rapides', 'Quick wins', 'Ganancias rápidas'), `${ctx.roi.quickWins}${ctx.roi.quickWinDays ? ` · ~${ctx.roi.quickWinDays} j` : ''}`, 'quick_win_days') : ''}
    </div>
    ${ctx.roi ? `<p style="font-size:13px;line-height:1.7;color:#374151;margin:12px 0 0 0;">${ctx.roi.sentence}${ctx.roi.topQuickWins.length ? ` ${t('À traiter en premier', 'Start with', 'Empezar por')} : ${ctx.roi.topQuickWins.join(' ; ')}.` : ''}</p>` : ''}

    ${ctx.verdictHtml
      ? ctx.verdictHtml
      : ctx.verdictSignals
      ? buildStrategicVerdict(domain, { ...ctx.verdictSignals, criticalCount: ctx.criticalCount, geoScore: geo100, techScore: tech100, pagesAnalyzed: pages }, lang).html
      : ''}



    <p style="font-size:12px;color:#6b7280;line-height:1.7;margin:12px 0 0 0;">
      ${t(
        `Score global = moyenne des scores SEO technique et GEO ramenés sur 100. Il ne remplace pas la lecture détaillée : la portée et les limites de la méthode sont exposées en fin de rapport.`,
        `Global score = average of technical SEO and GEO scores normalised to 100. It does not replace detailed reading: scope and limits are set out at the end of the report.`,
        `Puntuación global = media de SEO técnico y GEO sobre 100.`,
      )}
      ${ctx.degraded ? ' ' + t('La couche stratégique est indisponible sur ce rapport : le score global est partiel.', 'The strategic layer is unavailable in this report: the global score is partial.', 'La capa estratégica no está disponible: la puntuación global es parcial.') : ''}
    </p>
  </div>`;
}

/**
 * Introduction méthodologique en tête de rapport : périmètre réellement exploré,
 * précision de la mesure, outils externes mobilisés, points clés à retenir.
 * 100 % déterministe (aucun appel LLM).
 */
function buildReportIntroHTML(
  lang: string,
  domain: string,
  ctx: {
    expertData?: any;
    strategicData?: any;
    crawlSnapshot?: any;
    llmVisibilityData?: any;
    indexationCount?: number;
    visual?: boolean;
    plan?: Array<{ severity: string; title: string }>;
    /** Mode de scan réellement appliqué au run (persisté sur le job). */
    scanMode?: ScanModeResolution | null;
    /** Synthèse de la pondération impact / effort du plan d'action. */
    roi?: RoiSummary | null;
  },

): string {
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const t = (fr: string, en: string, es: string) => (isEn ? en : isEs ? es : fr);

  // Lot 4 : source unique de vérité pour le périmètre (crawlées / découvertes /
  // sitemap), afin que toutes les sections affichent les mêmes nombres.
  const perimeter = resolvePerimeter({
    crawledPages: ctx.crawlSnapshot?.crawled_pages || ctx.crawlSnapshot?.pagesFound,
    discoveredUrls: ctx.crawlSnapshot?.total_pages,
    sitemapUrls: ctx.crawlSnapshot?.sitemap_urls_count ?? ctx.crawlSnapshot?.sitemapUrlsCount,
  });
  const pagesAnalyzed = perimeter.crawled;
  const pagesKnown = perimeter.reference;
  const coverage = perimeter.coveragePct;


  const tools: string[] = [];
  tools.push(t(
    `Crawler Crawlers (exploration des pages, balises, maillage interne, contenu dupliqué et pages fines)`,
    `Crawlers crawler (pages, tags, internal linking, near-duplicate and thin content)`,
    `Rastreador Crawlers (páginas, etiquetas, enlazado interno, contenido duplicado)`,
  ));
  if (ctx.expertData?.scores?.performance?.psiPerformance) {
    tools.push(t(
      `Google PageSpeed Insights / Lighthouse (Core Web Vitals mesurés en session mobile)`,
      `Google PageSpeed Insights / Lighthouse (Core Web Vitals, mobile session)`,
      `Google PageSpeed Insights / Lighthouse (Core Web Vitals, sesión móvil)`,
    ));
  }
  if (ctx.strategicData?.market_data_summary || ctx.strategicData?.domain_authority || ctx.strategicData?.keyword_positioning) {
    tools.push(t(
      `DataForSEO (volumes de recherche, positions, backlinks et autorité de domaine)`,
      `DataForSEO (search volumes, rankings, backlinks and domain authority)`,
      `DataForSEO (volúmenes, posiciones, backlinks y autoridad de dominio)`,
    ));
  }
  if (ctx.llmVisibilityData) {
    tools.push(t(
      `Interrogation réelle de moteurs de réponse IA pour mesurer la citabilité de la marque`,
      `Real queries sent to AI answer engines to measure brand citability`,
      `Consultas reales a motores de respuesta IA para medir la citabilidad`,
    ));
  }
  if (ctx.indexationCount) {
    tools.push(t(
      `Vérification d'indexation Google sur ${ctx.indexationCount} URLs`,
      `Google indexation check on ${ctx.indexationCount} URLs`,
      `Verificación de indexación en Google sobre ${ctx.indexationCount} URL`,
    ));
  }
  if (ctx.visual) {
    tools.push(t(
      `Capture visuelle de la page (preuve d'affichage desktop et mobile)`,
      `Visual page capture (desktop and mobile rendering evidence)`,
      `Captura visual de la página (desktop y móvil)`,
    ));
  }

  // Les titres issus du Workbench peuvent être des paragraphes LLM : on les
  // ramène à une accroche complète (jamais coupée en milieu de phrase).
  const takeaways = (ctx.plan || [])
    .filter((p) => ['critical', 'important'].includes(String(p.severity)))
    .slice(0, 3)
    .map((p) => `<li style="margin:0 0 6px 0;">${splitLongTitle(p.title, '').title}</li>`)
    .join('');

  const li = (s: string) => `<li style="margin:0 0 6px 0;">${s}</li>`;

  return `
  <div class="section" data-marina-scope="site" data-marina-block="intro" data-pdf-section style="border-left:6px solid #6d28d9;">
    <h2 style="font-size:19px;margin:0 0 10px 0;">${t('Comment lire ce rapport', 'How to read this report', 'Cómo leer este informe')}</h2>
    <p style="font-size:13.5px;line-height:1.75;color:#374151;margin:0 0 14px 0;">
      ${t(
        `Ce document combine cinq analyses distinctes de ${domain}, dans cet ordre : le crawl (ce que voit un robot), l'audit technique SEO (conformité de la page), l'audit stratégique GEO (citabilité par les IA et positionnement de marché), le cocon sémantique et le maillage interne, puis le plan d'action consolidé. Chaque section débute par une phrase qui explique ce qu'elle mesure et comment l'interpréter.`,
        `This document combines five distinct analyses of ${domain}, in order: the crawl (what a robot sees), the technical SEO audit, the strategic GEO audit (AI citability and market positioning), the semantic cocoon and internal linking, then the consolidated action plan. Each section opens with a sentence explaining what it measures and how to read it.`,
        `Este documento combina cinco análisis distintos de ${domain}: rastreo, auditoría técnica SEO, auditoría estratégica GEO, capullo semántico y plan de acción consolidado.`,
      )}
    </p>
    <h3 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">${t('Périmètre et précision de la mesure', 'Scope and measurement precision', 'Alcance y precisión')}</h3>
    <ul style="padding-left:20px;font-size:13px;color:#374151;line-height:1.7;margin:0 0 14px 0;">
      ${li(pagesAnalyzed
        ? t(`<strong>${pagesAnalyzed} page${pagesAnalyzed > 1 ? 's' : ''}</strong> réellement explorée${pagesAnalyzed > 1 ? 's' : ''} et analysée${pagesAnalyzed > 1 ? 's' : ''}${pagesKnown ? ` sur ${pagesKnown} URLs découvertes${coverage !== null ? ` (couverture ${coverage} %)` : ''}` : ''}.`,
            `<strong>${pagesAnalyzed} page(s)</strong> actually crawled and analysed${pagesKnown ? ` out of ${pagesKnown} discovered URLs${coverage !== null ? ` (${coverage}% coverage)` : ''}` : ''}.`,
            `<strong>${pagesAnalyzed} página(s)</strong> rastreadas${pagesKnown ? ` de ${pagesKnown} URL descubiertas` : ''}.`)
        : t(`Analyse limitée à l'URL soumise : le crawl multi-pages n'a pas produit de périmètre exploitable pour ce rapport.`,
            `Analysis limited to the submitted URL: the multi-page crawl produced no usable scope.`,
            `Análisis limitado a la URL enviada.`))}
      ${li(scanModeSentence(ctx.scanMode ?? resolveScanMode(pagesKnown), lang))}
      ${li(t(
        `Trois modes de scan existent et la bascule est automatique, jamais manuelle : Approfondi (site ≤ 120 URLs, jusqu'à 120 pages), Standard (≤ 1 000 URLs, jusqu'à 150 pages), Échantillon (> 1 000 URLs, 60 pages représentatives des gabarits). Ce plafonnement garantit un diagnostic complet dans un temps d'exécution maîtrisé.`,
        `Three scan modes exist and switching is automatic, never manual: Deep (site ≤ 120 URLs, up to 120 pages), Standard (≤ 1,000 URLs, up to 150 pages), Sample (> 1,000 URLs, 60 template-representative pages).`,
        `Existen tres modos de escaneo con conmutación automática: Profundo (≤ 120 URL), Estándar (≤ 1 000 URL) y Muestra (> 1 000 URL, 60 páginas).`,
      ))}
      ${li(t(
        `Les scores ne sont ni de simples mesures ni de simples estimations : ils sont <strong>déduits</strong> par des règles fixes à partir de faits mesurés au moment du crawl. Ils décrivent l'état du site, ils ne prédisent aucun volume de trafic. Le statut exact de chaque chiffre est indiqué par une pastille (voir ci-dessous).`,
        `Scores are neither raw measurements nor mere estimates: they are <strong>inferred</strong> by fixed rules from facts measured at crawl time. They describe the state of the site and predict no traffic volume. Each figure's exact status is shown by a badge (see below).`,
        `Las puntuaciones son <strong>deducidas</strong> mediante reglas fijas a partir de hechos medidos: describen el estado del sitio, no predicen tráfico.`,
      ))}
      ${li(t(
        `Les données de marché et de backlinks proviennent de bases tierces mises à jour périodiquement : un écart de quelques jours avec la réalité est normal.`,
        `Market and backlink data come from third-party databases refreshed periodically: a few days' lag is normal.`,
        `Los datos de mercado y backlinks provienen de bases de terceros.`,
      ))}
      ${li(t(
        `La section « Portée et limites », en fin de document, détaille précisément ce qui est mesuré et ce qui ne l'est pas.`,
        `The "Scope and limits" section at the end of the document details exactly what is and is not measured.`,
        `La sección «Alcance y límites» al final detalla lo medido y lo no medido.`,
      ))}
      ${li(t(
        `Les constats ne sont pas listés à plat : chaque action est pondérée par son rapport <strong>impact / effort</strong> et étiquetée « gain rapide », « chantier rentable » ou « investissement de fond ». Les blocages critiques restent en tête quel que soit leur rendement ; à gravité égale, ce qui rapporte le plus vite passe devant.`,
        `Findings are not listed flat: every action is weighted by its <strong>impact / effort</strong> ratio and labelled quick win, worthwhile project or long-term investment. Critical blockers stay first regardless of return.`,
        `Los hallazgos se ponderan por <strong>impacto / esfuerzo</strong> y se etiquetan como ganancia rápida, proyecto rentable o inversión de fondo.`,
      ))}
      ${li(t(
        `L'effort affiché est un ordre de grandeur en jours-homme déduit de la nature de l'action, pas un devis : il sert à comparer les actions entre elles.`,
        `The displayed effort is an order of magnitude in person-days inferred from the nature of the action, not a quote: it is meant to compare actions with each other.`,
        `El esfuerzo mostrado es un orden de magnitud, no un presupuesto.`,
      ))}
    </ul>
    ${provenanceLegendHTML(lang)}
    <h3 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">${t('Sources et outils mobilisés', 'Sources and tools used', 'Fuentes y herramientas')}</h3>
    <ul style="padding-left:20px;font-size:13px;color:#374151;line-height:1.7;margin:0 0 ${takeaways ? '14px' : '0'} 0;">
      ${tools.map(li).join('')}
    </ul>
    ${takeaways ? `
    <h3 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">${t('À retenir en priorité', 'Key takeaways', 'Puntos clave')}</h3>
    <ol style="padding-left:20px;font-size:13px;color:#374151;line-height:1.7;margin:0;">${takeaways}</ol>` : ''}

  </div>`;
}

/**
 * Conclusion en fin de rapport : hiérarchisation des chantiers en trois horizons.
 * Déterministe, dérivée du plan d'action consolidé (aucun appel LLM).
 */
function buildConclusionHTML(
  lang: string,
  domain: string,
  plan: Array<{ severity: string; title: string; description?: string; roi?: { tier_label: string; effort_label: string } }>,
  archetypes?: ArchetypeAnalysis | null,
  roi?: RoiSummary | null,
): string {
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const t = (fr: string, en: string, es: string) => (isEn ? en : isEs ? es : fr);

  const critical = plan.filter((p) => String(p.severity) === 'critical');
  const important = plan.filter((p) => String(p.severity) === 'important');
  const rest = plan.filter((p) => !['critical', 'important'].includes(String(p.severity)));

  const bucket = (
    label: string,
    horizon: string,
    items: Array<{ title: string; roi?: { tier_label: string; effort_label: string } }>,
    color: string,
  ) => `
    <div style="border:1px solid #e5e7eb;border-left:4px solid ${color};border-radius:8px;padding:14px 16px;margin:0 0 10px 0;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:2px;">${horizon}</div>
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">${label}</div>
      ${items.length
        ? `<ol style="padding-left:18px;font-size:13px;color:#374151;line-height:1.7;margin:0;">${items.slice(0, 4).map((i) => `<li style="margin:0 0 4px 0;">${i.title}${i.roi ? ` <span style="color:#6b7280;font-size:12px;">— ${i.roi.tier_label}, ${i.roi.effort_label.toLowerCase()}</span>` : ''}</li>`).join('')}</ol>`
        : `<p style="font-size:13px;color:#6b7280;margin:0;">${t('Aucun chantier de ce niveau détecté.', 'No item detected at this level.', 'Ningún elemento detectado en este nivel.')}</p>`}
    </div>`;


  return `
  <div class="section" data-marina-scope="page" data-marina-block="conclusion" data-pdf-section style="border-left:6px solid #d4af37;">
    <h2 style="font-size:19px;margin:0 0 10px 0;">${t('Conclusion : par où commencer', 'Conclusion: where to start', 'Conclusión: por dónde empezar')}</h2>
    <p style="font-size:13.5px;line-height:1.75;color:#374151;margin:0 0 14px 0;">
      ${t(
        `L'ordre ci-dessous n'est pas négociable : tant qu'un blocage technique ou d'indexation subsiste sur ${domain}, la production de contenu et le netlinking produisent peu d'effet mesurable. Traitez les chantiers dans l'ordre des horizons, puis relancez un audit pour mesurer le delta.`,
        `The order below matters: while a technical or indexation blocker remains on ${domain}, content production and link building yield little measurable effect. Work through the horizons in order, then re-run an audit to measure the delta.`,
        `El orden importa: mientras exista un bloqueo técnico o de indexación en ${domain}, el contenido y el netlinking tendrán poco efecto medible.`,
      )}
    </p>
    ${roi ? `<p style="font-size:13.5px;line-height:1.75;color:#374151;margin:0 0 14px 0;">
      ${roi.sentence}
      ${roi.topQuickWins.length ? `${t('Concrètement, les trois premières actions à lancer cette semaine', 'Concretely, the first three actions to launch this week', 'Concretamente, las tres primeras acciones de esta semana')} : ${roi.topQuickWins.join(' ; ')}.` : ''}
      ${t(
        `À l'intérieur de chaque horizon, les chantiers sont ordonnés par rendement décroissant : commencer par le haut maximise le gain visible à budget constant.`,
        `Within each horizon, items are ordered by decreasing return: starting at the top maximises visible gain at constant budget.`,
        `Dentro de cada horizonte, los elementos se ordenan por rendimiento decreciente.`,
      )}
    </p>` : ''}

    ${archetypes ? `
    <div style="border:1px solid #e5e7eb;border-left:4px solid #6d28d9;border-radius:8px;padding:14px 16px;margin:0 0 12px 0;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">${t('Lecture business par type de page', 'Business reading by page type', 'Lectura por tipo de página')}</div>
      <p style="font-size:13px;line-height:1.8;color:#111827;margin:0;">${archetypes.synthesis}</p>
    </div>` : ''}
    ${bucket(
      t('Débloquer', 'Unblock', 'Desbloquear'),
      t('Horizon 0 à 30 jours', 'Horizon 0 to 30 days', 'Horizonte 0 a 30 días'),
      critical, '#ef4444',
    )}
    ${bucket(
      t('Consolider', 'Consolidate', 'Consolidar'),
      t('Horizon 30 à 60 jours', 'Horizon 30 to 60 days', 'Horizonte 30 a 60 días'),
      important, '#d4af37',
    )}
    ${bucket(
      t('Amplifier', 'Amplify', 'Amplificar'),
      t('Horizon 60 à 90 jours', 'Horizon 60 to 90 days', 'Horizonte 60 a 90 días'),
      rest, '#6d28d9',
    )}
    <p style="font-size:12px;color:#6b7280;line-height:1.7;margin:12px 0 0 0;">
      ${t(
        `Hiérarchisation dérivée automatiquement du plan d'action consolidé : elle reprend les mêmes éléments, réordonnés par effort et par dépendance. Un second audit après remédiation permet de chiffrer le gain réel.`,
        `This prioritisation is derived automatically from the consolidated action plan, reordered by effort and dependency. A second audit after remediation quantifies the real gain.`,
        `Priorización derivada del plan de acción consolidado.`,
      )}
    </p>
  </div>`;
}


function compileMarinaReport(
  sectionHTMLs: { crawl: string; tech: string; strategic: string; cocoon: string; indexation?: string; consolidatedPlan?: string; visual?: string; disclosure?: string; summary?: string; scopeLimits?: string; intro?: string; conclusion?: string; archetypes?: string; identity?: string; ownerPerformance?: string; pageVerdict?: string; cocoonPage?: string },


  lang: string,
  domain: string,
  url: string,
  branding?: MarinaBranding,
): string {
  const tr = getTranslations(lang);
  const now = new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US');

  const crawlContent = extractBodyContent(sectionHTMLs.crawl, { stripHeader: true, stripFooter: true });
  const techContent = extractBodyContent(sectionHTMLs.tech, { stripHeader: true, stripFooter: true });
  const strategicRaw = extractBodyContent(sectionHTMLs.strategic, { stripHeader: true, stripFooter: true });
  // La visibilité IA est de périmètre site (identique pour toutes les URLs d'un
  // domaine) : on la sort de la section stratégique pour pouvoir la mutualiser
  // dans les rapports multipages.
  const llmMatch = strategicRaw.match(/<!--MARINA_LLM_START-->([\s\S]*?)<!--MARINA_LLM_END-->/);
  const llmVisibilityBlock = llmMatch ? llmMatch[1] : '';
  const strategicContent = llmMatch
    ? strategicRaw.replace(llmMatch[0], '')
    : strategicRaw;
  const cocoonContent = extractBodyContent(sectionHTMLs.cocoon, { stripHeader: true, stripFooter: true });

  // White-label: determine colors and texts
  const isWL = branding?.enabled && branding?.fullWhiteLabel;
  const headerColor = isWL && branding?.primaryColor ? branding.primaryColor : '#3b82f6';
  const headerColorDark = isWL && branding?.primaryColor ? adjustColor(branding.primaryColor, -30) : '#1d4ed8';
  const brandLabel = isWL && branding?.brandName ? branding.brandName : '';
  const poweredByText = isWL ? '' : tr.poweredBy;
  const footerLink = isWL ? '' : `<div style="margin-top:4px;"><a href="https://crawlers.fr">crawlers.fr</a></div>`;
  const logoHtml = isWL && branding?.logoUrl 
    ? `<img src="${branding.logoUrl}" alt="${brandLabel}" style="max-height:48px;max-width:200px;margin:0 auto 12px;display:block;" />`
    : '';
  const introHtml = branding?.enabled && branding?.customIntro
    ? `<div class="section" style="border-left:4px solid ${headerColor};"><p style="font-size:14px;color:#374151;line-height:1.7;">${branding.customIntro}</p></div>`
    : '';
  const ctaHtml = branding?.enabled && branding?.ctaText && branding?.ctaUrl
    ? `<div style="text-align:center;margin:24px 0;"><a href="${branding.ctaUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 32px;background:${headerColor};color:white;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">${branding.ctaText}</a></div>`
    : '';
  const footerCustom = isWL && branding?.reportFooterText 
    ? `<div style="margin-top:4px;font-size:11px;color:#9ca3af;">${branding.reportFooterText}</div>` 
    : '';
  const contactFooter = isWL && (branding?.contactEmail || branding?.contactPhone)
    ? `<div style="margin-top:8px;font-size:11px;color:#9ca3af;">${[branding.contactEmail, branding.contactPhone].filter(Boolean).join(' • ')}</div>`
    : '';

  // Override CSS colors if white-label
  const colorOverrides = isWL ? `
    .header { background: linear-gradient(135deg, ${headerColor}, ${headerColorDark}) !important; }
    .section-number { background: ${headerColor} !important; }
    .footer a { color: ${headerColor} !important; }
    .stat-card .value { color: ${headerColor} !important; }
    .marina-toolbar button.primary { background: ${headerColor} !important; border-color: ${headerColor} !important; }
    .marina-toolbar button.primary:hover { background: ${headerColorDark} !important; }
    .marina-separator { background: linear-gradient(90deg, transparent, ${headerColor}, transparent) !important; }
  ` : '';

  // « Portée et limites » : contrat non négociable — la section est toujours
  // présente. Si l'appelant n'a pas fourni de version enrichie par les signaux
  // collectés, on en génère une dès le départ à partir du nom de domaine.
  const scopeLimitsHtml = sectionHTMLs.scopeLimits || renderScopeLimitsHTML({ domain, url, lang });

  const compiled = `<!DOCTYPE html>


<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isWL && brandLabel ? `${brandLabel} — ` : ''}${tr.title} - ${domain}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${getMarinaStyles()}${colorOverrides}</style>
</head>
<body>
  ${getToolbarHtml(domain, lang)}
  <div class="container">
    <div class="header">
      ${logoHtml}
      ${isWL && brandLabel ? `<div style="font-size:13px;opacity:0.85;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">${brandLabel}</div>` : ''}
      <h1>${tr.title}</h1>
      <div class="subtitle">${tr.generatedFor}: <strong>${domain}</strong></div>
      <div class="subtitle">${url}</div>
      <div class="date">${tr.generatedAt}: ${now}</div>
    </div>

    ${introHtml}

    ${sectionHTMLs.summary || ''}

    ${sectionHTMLs.identity || ''}

    ${sectionHTMLs.intro || ''}

    ${sectionHTMLs.visual || ''}



    <!-- Table of Contents -->
    <div class="toc" data-pdf-section>
      <div class="toc-item"><span class="section-number">1</span> 🕷️ ${tr.crawlReport}</div>
      ${sectionHTMLs.archetypes ? `<div class="toc-item"><span class="section-number">1b</span> ${lang === 'fr' ? 'Audit par type de page' : lang === 'es' ? 'Auditoría por tipo de página' : 'Audit by page type'}</div>` : ''}
      <div class="toc-item"><span class="section-number">2</span> 🔍 ${tr.techAudit}</div>
      <div class="toc-item"><span class="section-number">3</span> 🎯 ${tr.strategicAudit}</div>
      ${sectionHTMLs.ownerPerformance ? `<div class="toc-item"><span class="section-number">3b</span> ${lang === 'fr' ? 'Données propriétaires du domaine' : lang === 'es' ? 'Datos propietarios del dominio' : 'First-party domain data'}</div>` : ''}
      <div class="toc-item"><span class="section-number">4</span> 🕸️ ${tr.cocoonAnalysis}</div>
      ${sectionHTMLs.indexation ? `<div class="toc-item"><span class="section-number">5</span> 📊 ${lang === 'fr' ? 'Santé d\'indexation' : lang === 'es' ? 'Salud de indexación' : 'Indexation Health'}</div>` : ''}
      ${sectionHTMLs.consolidatedPlan ? `<div class="toc-item"><span class="section-number">${sectionHTMLs.indexation ? '6' : '5'}</span> ${lang === 'fr' ? "Plan d'action consolidé" : lang === 'es' ? 'Plan de acción consolidado' : 'Consolidated Action Plan'}</div>` : ''}
      ${sectionHTMLs.conclusion ? `<div class="toc-item"><span class="section-number">${sectionHTMLs.indexation ? '7' : '6'}</span> ${lang === 'fr' ? 'Conclusion et priorités' : lang === 'es' ? 'Conclusión y prioridades' : 'Conclusion and priorities'}</div>` : ''}
    </div>

    <!-- Section 1: Crawl (périmètre site) -->
    <div data-marina-scope="site" data-marina-block="crawl">${crawlContent}</div>

    ${sectionHTMLs.archetypes ? `
    <div class="marina-separator"></div>
    <!-- Audit par type de page (périmètre site) -->
    ${sectionHTMLs.archetypes}
    ` : ''}

    <div class="marina-separator"></div>

    ${sectionHTMLs.pageVerdict ? `
    <!-- Conclusion intermédiaire propre à cette URL (périmètre page, en tête de la partie URL) -->
    ${sectionHTMLs.pageVerdict}
    <div class="marina-separator"></div>
    ` : ''}

    <!-- Section 2: Technical SEO (périmètre page) -->
    <div data-marina-scope="page" data-marina-block="tech">${techContent}</div>

    <div class="marina-separator"></div>

    <!-- Section 3: Strategic GEO (périmètre page) -->
    <div data-marina-scope="page" data-marina-block="strategic">${strategicContent}</div>

    ${llmVisibilityBlock ? `
    <!-- Visibilité / citabilité IA : périmètre site, mais rattachée à la section GEO
         (elle en est l'objet). Placée juste après l'audit stratégique, plus en fin de rapport. -->
    <div data-marina-scope="site" data-marina-block="llm">${llmVisibilityBlock}</div>
    ` : ''}

    ${sectionHTMLs.ownerPerformance ? `
    <div class="marina-separator"></div>
    <!-- Section 3b : données propriétaires GSC/GA4 (périmètre site, mutualisable) -->
    ${sectionHTMLs.ownerPerformance}
    ` : ''}

    <div class="marina-separator"></div>

    <!-- Section 4: Cocoon (périmètre site) -->
    <div data-marina-scope="site" data-marina-block="cocoon">${cocoonContent}</div>

    ${sectionHTMLs.cocoonPage ? `
    <div class="marina-separator"></div>
    <!-- Cocon : recommandations propres à CETTE URL (périmètre page) -->
    ${sectionHTMLs.cocoonPage}
    ` : ''}


    ${sectionHTMLs.indexation ? `
    <div class="marina-separator"></div>
    <!-- Section 5: Indexation Health (périmètre site) -->
    <div data-marina-scope="site" data-marina-block="indexation">${extractBodyContent(sectionHTMLs.indexation, { stripHeader: true, stripFooter: true })}</div>
    ` : ''}

    ${sectionHTMLs.consolidatedPlan ? `
    <div class="marina-separator"></div>
    <!-- Final Section: Consolidated Action Plan -->
    <div data-marina-scope="page" data-marina-block="plan">${sectionHTMLs.consolidatedPlan}</div>
    ` : ''}

    ${sectionHTMLs.conclusion || ''}

    ${sectionHTMLs.disclosure || ''}

    <div class="marina-separator"></div>
    ${scopeLimitsHtml}


    ${ctaHtml}

    <div class="footer">
      ${poweredByText ? `<div>${poweredByText}</div>` : ''}
      ${footerLink}
      ${footerCustom}
      ${contactFooter}
      ${isWL && brandLabel && !poweredByText ? `<div style="font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} ${brandLabel}</div>` : ''}
    </div>
  </div>
</body>
</html>`;

  // Charte Crawlers : le blanc-label garde ses couleurs client, les emoji sont
  // retirés dans tous les cas.
  return sanitizeMarinaHtml(compiled, { keepColors: Boolean(isWL) });
}


// ─── Helper: darken/lighten hex color ───
function adjustColor(hex: string, amount: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ─── LEGACY fallback: monolithic report generator (kept for resilience) ───
function generateLegacyMarinaReport(
  url: string, domain: string, lang: string,
  expertSeoData: any, strategicData: any, cocoonData: any | null,
  branding?: MarinaBranding,
): string {
  // Generate each section individually then compile — same logic but inline
  const crawlHTML = generateCrawlSectionHTML(expertSeoData, lang, domain, url);
  const techHTML = generateTechSectionHTML(expertSeoData, lang, domain);
  const strategicHTML = generateStrategicSectionHTML(strategicData, lang, domain);
  const cocoonHTML = generateCocoonSectionHTML(cocoonData, lang, domain);
  return compileMarinaReport({ crawl: crawlHTML, tech: techHTML, strategic: strategicHTML, cocoon: cocoonHTML }, lang, domain, url, branding);
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

  try {
    const strictLanguageInstruction = lang === 'en'
      ? 'You MUST respond entirely in English. All titles, descriptions and priority labels must be in English. Return valid JSON only.'
      : lang === 'es'
        ? 'Debes responder exclusivamente en español. Todos los títulos, descripciones y prioridades deben estar en español. Devuelve solo JSON válido.'
        : 'Tu DOIS répondre exclusivement en français. Tous les titres, descriptions et niveaux de priorité doivent être en français. Retourne uniquement du JSON valide.';

    const content = await callLovableAIText({
      system: `${strictLanguageInstruction} You are a precise SEO strategist. Always respond with valid JSON arrays only. Each recommendation must reference specific URLs, clusters, or data points from the analysis.`,
      user: prompt,
      maxTokens: 2048,
      signal: AbortSignal.timeout(135_000),
    });
  
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
  
    try {
      const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    } catch {
      return [];
    }
  } catch (err) {
    console.warn(`[Marina] Lite Stratège error:`, err);
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

// ─── Checkpoint de phase : rend le pipeline reprenable ───
// Un run d'edge function peut être tué (wall-time CPU) au milieu d'une phase.
// On persiste donc systématiquement la dernière phase demandée + son payload :
// un reaper peut alors relancer exactement ce point au lieu d'échouer le job.
const PHASE_CHECKPOINT_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_PHASE_RESUMES = 6;

function phaseCheckpointKey(jobId: string): string {
  return `marina_checkpoint_${jobId}`;
}

async function savePhaseCheckpoint(
  jobId: string,
  payload: { url: string; lang: string; phase: string; intermediate: any },
) {
  try {
    const sb = getServiceClient();
    const { data: existing } = await sb
      .from('audit_cache')
      .select('result_data')
      .eq('cache_key', phaseCheckpointKey(jobId))
      .maybeSingle();
    const resumes = Number((existing?.result_data as any)?.resumes || 0);
    await sb.from('audit_cache').upsert({
      cache_key: phaseCheckpointKey(jobId),
      function_name: 'marina',
      result_data: { ...payload, resumes, saved_at: new Date().toISOString() },
      expires_at: new Date(Date.now() + PHASE_CHECKPOINT_TTL_MS).toISOString(),
    }, { onConflict: 'cache_key' });
  } catch (e) {
    console.warn('[Marina] checkpoint write failed (non-fatal):', e);
  }
}

// ─── Self-invoke helper for phase chaining ───
async function selfInvokePhase(jobId: string, url: string, lang: string, phase: string, intermediateData: any) {
  console.log(`[Marina] 🔗 Self-invoking phase "${phase}" for job ${jobId}`);
  await savePhaseCheckpoint(jobId, { url, lang, phase, intermediate: intermediateData });
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

// ─── Reprise d'un job interrompu depuis son checkpoint ───
async function resumeJobFromCheckpoint(jobId: string): Promise<{ resumed: boolean; reason?: string; phase?: string }> {
  const sb = getServiceClient();
  const { data: row } = await sb
    .from('audit_cache')
    .select('result_data')
    .eq('cache_key', phaseCheckpointKey(jobId))
    .maybeSingle();

  const cp = row?.result_data as any;
  if (!cp?.phase || !cp?.url) return { resumed: false, reason: 'no_checkpoint' };

  const resumes = Number(cp.resumes || 0);
  if (resumes >= MAX_PHASE_RESUMES) return { resumed: false, reason: 'max_resumes_reached', phase: cp.phase };

  await sb.from('audit_cache').upsert({
    cache_key: phaseCheckpointKey(jobId),
    function_name: 'marina',
    result_data: { ...cp, resumes: resumes + 1, resumed_at: new Date().toISOString() },
    expires_at: new Date(Date.now() + PHASE_CHECKPOINT_TTL_MS).toISOString(),
  }, { onConflict: 'cache_key' });

  await sb
    .from('async_jobs')
    .update({ status: 'processing', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('function_name', 'marina');

  console.log(`[Marina] ♻️ Reprise du job ${jobId} sur la phase "${cp.phase}" (reprise ${resumes + 1}/${MAX_PHASE_RESUMES})`);
  fetch(`${SUPABASE_URL}/functions/v1/marina`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'run_job',
      job_id: jobId,
      url: cp.url,
      lang: cp.lang ?? null,
      _phase: cp.phase,
      _intermediate: cp.intermediate ?? null,
    }),
  }).catch(err => console.error('[Marina] resume self-invocation failed:', err));

  return { resumed: true, phase: cp.phase };
}



// ─── Mutualisation par domaine : cache des analyses "site-scoped" ───
// Lorsqu'un batch multipages audite N URLs du même domaine, les analyses de
// niveau site (visibilité LLM, cocon sémantique, capture visuelle) sont
// identiques d'une URL à l'autre. On les calcule une fois puis on les réutilise
// pendant 24h → économie de crédits LLM et de temps de génération.
const SITE_SCOPE_TTL_MS = 24 * 60 * 60 * 1000;

function siteScopeCacheKey(domain: string, userId: string): string {
  return `marina_site_scope_${domain}_${userId}`;
}

async function readSiteScopeCache(sb: any, domain: string, userId: string): Promise<any | null> {
  try {
    const { data } = await sb
      .from('audit_cache')
      .select('result_data, expires_at')
      .eq('cache_key', siteScopeCacheKey(domain, userId))
      .maybeSingle();
    if (!data?.result_data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.result_data;
  } catch (_) {
    return null;
  }
}

async function writeSiteScopeCache(sb: any, domain: string, userId: string, patch: Record<string, unknown>) {
  try {
    const existing = (await readSiteScopeCache(sb, domain, userId)) || {};
    await sb.from('audit_cache').upsert({
      cache_key: siteScopeCacheKey(domain, userId),
      function_name: 'marina',
      result_data: { ...existing, ...patch, _cached_at: new Date().toISOString() },
      expires_at: new Date(Date.now() + SITE_SCOPE_TTL_MS).toISOString(),
    }, { onConflict: 'cache_key' });
  } catch (e) {
    console.warn('[Marina] site-scope cache write failed (non-fatal):', e);
  }
}

// ─── Freins de crawlabilité observés (partagés divulgation + portée et limites) ───
function buildCrawlabilityBlockers(
  lang: string,
  ctx: { expertData?: any; crawlSnapshot?: any },
): string[] {
  const t = (fr: string, en: string, es: string) => (lang === 'en' ? en : lang === 'es' ? es : fr);
  const pagesAnalyzed = ctx.crawlSnapshot?.crawled_pages || ctx.crawlSnapshot?.pages?.length || null;
  const pagesKnown = ctx.crawlSnapshot?.total_pages || null;
  const blockers: string[] = [];
  const robots = ctx.expertData?.checks?.robots || ctx.expertData?.robots || null;
  if (robots && robots.blocksAll) blockers.push(t('robots.txt bloque tout ou partie du crawl', 'robots.txt blocks all or part of crawling', 'robots.txt bloquea todo o parte del rastreo'));
  if (ctx.expertData?.scores?.performance?.lcp && Number(ctx.expertData.scores.performance.lcp) > 4)
    blockers.push(t('LCP supérieur à 4s : rendu lent, budget de crawl consommé', 'LCP above 4s: slow rendering, crawl budget consumed', 'LCP superior a 4s: renderizado lento'));
  if (pagesAnalyzed && pagesKnown && pagesAnalyzed < pagesKnown)
    blockers.push(
      t(
        `Crawl partiel : ${pagesAnalyzed} pages explorées sur ${pagesKnown} connues`,
        `Partial crawl: ${pagesAnalyzed} of ${pagesKnown} known pages explored`,
        `Rastreo parcial: ${pagesAnalyzed} de ${pagesKnown} páginas conocidas`,
      ),
    );
  if (!pagesAnalyzed)
    blockers.push(t('Aucun crawl multi-pages exploitable : le périmètre est réduit à la page auditée', 'No usable multi-page crawl: scope limited to the audited page', 'Sin rastreo multipágina utilizable: alcance limitado a la página auditada'));
  return blockers;
}

// La section « Divulgation méthodologique » a été supprimée : elle répétait
// « Portée et limites » (renderScopeLimitsHTML), qui reste l'unique section
// méthodologique de fin de rapport et intègre désormais les angles morts.


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
  
  // Mode de scan réellement appliqué au run : résolu en phase 2, transporté
  // dans intermediateData d'une phase à l'autre, puis répliqué dans
  // input_payload à chaque updateProgress (qui réécrit ce champ).
  let scanModeInfo: ScanModeResolution | null = (intermediateData as any)?.scanMode ?? null;
  let pagesCrawledInfo: number | null = (intermediateData as any)?.pagesCrawled ?? null;

  const updateProgress = async (progress: number, phaseName?: string) => {
    try {
      const updateData: any = { progress };
      if (phaseName) updateData.input_payload = {
        phase: phaseName,
        url,
        ...(scanModeInfo ? { scan_mode: scanModeInfo } : {}),
        ...(pagesCrawledInfo !== null ? { pages_crawled: pagesCrawledInfo } : {}),
      };
      if (progress === 5) updateData.started_at = new Date().toISOString();
      updateData.status = 'processing';
      await sb.from('async_jobs').update(updateData).eq('id', jobId);
    } catch (_) { /* ignore */ }
  };

  const currentPhase = phase || 'phase1';

  try {
    if (currentPhase === 'phase1') {
      // ═══ PHASE 1a: Expert Audit + Launch Strategic (no waiting) ═══
      await updateProgress(5, 'crawling');
      
      // ─── Step 1: Technical SEO Audit (includes crawl) ───
      // Retry borné : un rendu vide (Browserless saturé, fallback froid) faisait
      // échouer tout l'audit dès le premier appel raté. 3 tentatives espacées
      // suffisent à absorber une indisponibilité passagère du rendu.
      console.log(`[Marina] Phase 1 Step 1: audit-expert-seo for ${url}`);
      let expertResult: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        expertResult = await callFunction('audit-expert-seo', { url, lang });
        if (expertResult?.success && expertResult?.data) break;
        console.warn(
          `[Marina] audit-expert-seo tentative ${attempt}/3 échouée: ${expertResult?.error || 'No data returned'}`,
        );
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 8000));
      }

      if (!expertResult?.success || !expertResult?.data) {
        throw new Error(
          `Expert SEO audit failed after 3 attempts: ${expertResult?.error || 'No data returned'}`,
        );
      }
      
      // Normalisation obligatoire : les actions identity_* et tracked_sites stockent le
      // domaine sans `www.`. Sans ce strip, une carte d'identité verrouillée sur
      // example.com était ignorée quand le site répond sur www.example.com.
      const domain = String(expertResult.data.domain || '').replace(/^www\./, '');

      // Priority: explicit lang param > visible SEO signals (title/meta/H1/H2) > HTML visible text > fallback FR
      const detectedLang = resolveReportLanguage(lang, expertResult.data);
      
      console.log(`[Marina] Expert SEO done. Score: ${expertResult.data.totalScore}. Lang: ${detectedLang}`);

      // ─── Phase 0 : carte d'identité AVANT toute analyse de gabarits ───
      // Le mix de pages attendu dépend entièrement du modèle d'affaires : on le
      // résout ici (lecture en base, sinon une seule inférence légère) pour que
      // les phases suivantes calibrent leurs fourchettes au lieu de les subir.
      let identityCard: IdentityCard;
      try {
        identityCard = await resolveIdentityCard(sb, { domain, url, userId: parentJob.user_id });
        console.log(
          `[Marina] Phase 0 identité ${domain} : ${identityCard.sector} / ${identityCard.commercialModel} ` +
          `(source ${identityCard.source}, confiance ${identityCard.confidence})`,
        );
      } catch (e) {
        identityCard = emptyIdentityCard(domain, null, [
          'Résolution de la carte d’identité impossible : ' + String((e as Error)?.message || e),
        ]);
        console.warn(`[Marina] Phase 0 identité échouée pour ${domain} — audit poursuivi sans calibration.`);
      }

      await updateProgress(30, 'strategic_audit');


      // ─── Step 2: Launch Strategic GEO Audit (don't wait — self-invoke phase1b) ───
      console.log(`[Marina] Phase 1 Step 2: launching strategic-orchestrator for ${url}`);
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

      // Save expert data + strategic job ID for phase1b to pick up
      await sb.from('audit_cache').upsert({
        cache_key: `marina_phase1a_${jobId}`,
        function_name: 'marina',
        result_data: {
          expertData: expertResult.data,
          domain,
          detectedLang,
          strategicJobId,
          identityCard,
        },

        expires_at: new Date(Date.now() + PHASE_CHECKPOINT_TTL_MS).toISOString(),
      }, { onConflict: 'cache_key' });

      console.log(`[Marina] ✅ Phase 1a complete — strategic launched (${strategicJobId}), self-invoking phase1b`);
      await selfInvokePhase(jobId, url, detectedLang, 'phase1b', { domain });

    } else if (currentPhase === 'phase1b') {
      // ═══ PHASE 1b: Poll Strategic + Save Intermediate + Launch Phase 2 ═══
      console.log(`[Marina] Phase 1b starting for job ${jobId} — waiting for strategic-orchestrator`);

      const { data: cached1a } = await sb
        .from('audit_cache')
        .select('result_data')
        .eq('cache_key', `marina_phase1a_${jobId}`)
        .single();

      if (!cached1a?.result_data) {
        throw new Error('Phase 1b: phase 1a data not found');
      }

      const { expertData, domain, detectedLang, strategicJobId, identityCard } = cached1a.result_data as any;

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
      const intermediatePayload = {
        expertData,
        strategicData,
        domain,
        detectedLang,
        identityCard: identityCard ?? null,
      };


      await sb.from('audit_cache').upsert({
        cache_key: `marina_intermediate_${jobId}`,
        function_name: 'marina',
        result_data: intermediatePayload,
        expires_at: new Date(Date.now() + PHASE_CHECKPOINT_TTL_MS).toISOString(),
      }, { onConflict: 'cache_key' });

      console.log(`[Marina] ✅ Phase 1b complete — intermediate data saved, launching Phase 2`);
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

      // Un crawl long (ou une reprise après kill) peut dépasser la fenêtre
      // initiale : on repousse l'expiration à chaque tour pour que les données
      // de phase 1 restent disponibles jusqu'à la fin du pipeline.
      await sb.from('audit_cache').update({
        expires_at: new Date(Date.now() + PHASE_CHECKPOINT_TTL_MS).toISOString(),
      }).eq('cache_key', `marina_intermediate_${jobId}`);

      const { domain, detectedLang } = cached.result_data as any;

      // ─── Attente du crawl découpée en tours courts ───
      // Un run d'edge function ne peut pas attendre un crawl de plusieurs
      // centaines de pages : au-delà du wall-time, le run est tué. Le worker
      // traite des lots de 150 pages depuis le checkpoint `crawl_pages` ; Marina
      // fait pareil avec des tours courts (~70 s) et beaucoup de tours, chaque
      // tour étant persisté en checkpoint donc reprenable après un kill.
      const crawlWaitRound = Number((intermediateData as any)?.crawlWaitRound || 0);
      const MAX_CRAWL_WAIT_ROUNDS = 20;


      await updateProgress(66, 'multi_crawl');

      // Ensure tracked_site exists
      let trackedSiteId: string | null = null;
      {
        const { data: trackedSites, error: trackedSiteLookupError } = await sb
          .from('tracked_sites')
          .select('id')
          .eq('user_id', parentJob.user_id)
          .eq('domain', domain)
          .limit(1);
        const ts = trackedSites?.[0];
        if (ts) {
          trackedSiteId = ts.id;
          console.log(`[Marina] Found tracked_site ${ts.id} for ${domain} (user ${parentJob.user_id})`);
        } else {
          console.log(`[Marina] No tracked_site for ${domain}, creating one...`);
          const { data: newTs, error: insertErr } = await sb
            .from('tracked_sites')
            .insert({ user_id: parentJob.user_id, domain, site_name: `Marina: ${domain}` })
            .select('id')
            .single();
          if (insertErr) {
            console.warn(`[Marina] Failed to create tracked_site: ${insertErr.message}`);
            // Retry lookup — might have been created concurrently
            const { data: retryTsRows } = await sb
              .from('tracked_sites')
              .select('id')
              .eq('user_id', parentJob.user_id)
              .eq('domain', domain)
              .limit(1);
            trackedSiteId = retryTsRows?.[0]?.id || null;
          } else {
            trackedSiteId = newTs?.id || null;
          }
        }
        if (trackedSiteLookupError) {
          console.warn(`[Marina] tracked_site lookup warning for ${domain}: ${trackedSiteLookupError.message}`);
        }
      }

      if (!trackedSiteId) {
        console.warn(`[Marina] No tracked_site for ${domain} — skipping crawl, going to phase 3`);
      } else {
        // ─── Mutualisation du crawl par domaine ───
        // 1) crawl terminé récent (< 12h, >= 10 pages) → réutilisation directe
        // 2) crawl déjà en vol (< 30 min) → on s'y raccroche au lieu d'en lancer un second
        // 3) sinon → un seul crawl est lancé (la 1re URL du batch)
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        // `site_crawls.domain` est stocké tel que résolu par crawl-site (avec ou
        // sans `www.`) : on interroge les deux variantes, sinon on ne retrouve
        // jamais le crawl mutualisé et on en relance un à chaque tour d'attente.
        const apexDomain = domain.replace(/^www\./, '');
        const domainVariants = [apexDomain, `www.${apexDomain}`];
        const { data: existingCrawls, error: existingCrawlError } = await sb
          .from('site_crawls' as any)
          .select('id, crawled_pages, total_pages, status, created_at')
          .in('domain', domainVariants)
          .eq('user_id', parentJob.user_id)
          .gte('created_at', twelveHoursAgo)
          .order('created_at', { ascending: false })
          .limit(10);


        if (existingCrawlError) {
          console.warn(`[Marina] Existing crawl lookup failed for ${domain}: ${existingCrawlError.message}`);
        }

        const crawlRows = (existingCrawls || []) as any[];
        const reusableCrawl = crawlRows.find(
          (c) => c.status === 'completed' && (c.crawled_pages || 0) >= 10,
        );
        const IN_FLIGHT_STATUSES = ['pending', 'queued', 'running', 'crawling', 'analyzing', 'processing'];
        // Fenêtre alignée sur le crawl découpé en lots : 8 tours d'attente de
        // ~3 min = jusqu'à ~25 min d'attente côté Marina, plus la marge des
        // relais du worker → 60 min.
        const inFlightWindowStart = Date.now() - 60 * 60 * 1000;
        const inFlightCrawl = crawlRows.find(
          (c) => IN_FLIGHT_STATUSES.includes(c.status) && new Date(c.created_at).getTime() > inFlightWindowStart,
        );

        if (reusableCrawl) {
          if (!scanModeInfo) {
            scanModeInfo = resolveScanMode(reusableCrawl.total_pages || reusableCrawl.crawled_pages || null);
          }
          pagesCrawledInfo = reusableCrawl.crawled_pages || null;
          console.log(`[Marina] Found recent crawl with ${reusableCrawl.crawled_pages} pages (< 12h) — reusing`);
        } else {
          let crawlLaunchRes: any = null;

          if (inFlightCrawl) {
            console.log(`[Marina] Crawl ${inFlightCrawl.id} already in flight for ${domain} — attaching instead of launching a second one`);
            if (!scanModeInfo) scanModeInfo = resolveScanMode(inFlightCrawl.total_pages || null);
            crawlLaunchRes = {
              success: true,
              crawlId: inFlightCrawl.id,
              totalPages: inFlightCrawl.total_pages,
            };
            await updateProgress(67, 'multi_crawl');
          } else {
            await updateProgress(67, 'multi_crawl');

            // ─── Résolution automatique du mode de scan (sample / standard / deep) ───
            // On mesure d'abord la taille réelle du domaine, sans scraper :
            // 1) total_pages du dernier crawl connu (gratuit, immédiat)
            // 2) sinon détection d'URLs via crawl-site mode 'detect' (gratuit)
            let discoveredUrls: number | null = null;
            const knownTotal = crawlRows.find((c) => (c.total_pages || 0) > 0)?.total_pages ?? null;
            if (knownTotal) {
              discoveredUrls = knownTotal;
            } else {
              try {
                const detectRes: any = await callFunction('crawl-site', {
                  url: url,
                  mode: 'detect',
                  userId: parentJob.user_id,
                });
                if (detectRes?.success && typeof detectRes.totalDiscovered === 'number') {
                  discoveredUrls = detectRes.totalDiscovered;
                }
              } catch (detectErr) {
                console.warn(`[Marina] URL detection failed (non-fatal), falling back to standard mode:`, detectErr);
              }
            }

            const scanMode = resolveScanMode(discoveredUrls);
            scanModeInfo = scanMode;
            await updateProgress(67, 'multi_crawl');
            console.log(`[Marina] Scan mode = ${scanMode.mode} (${scanMode.maxPages} pages max) — ${scanMode.reason}`);

            try {
              crawlLaunchRes = await callFunction('crawl-site', {
                url: url,
                maxPages: scanMode.maxPages,
                userId: parentJob.user_id,
                forceRefresh: true,
              });
            } catch (crawlErr) {
              console.warn(`[Marina] Crawl launch failed (non-fatal):`, crawlErr);
            }

            // Le run de lancement a déjà consommé la détection d'URLs + le
            // démarrage du crawl : on ne poll pas dans le même run (risque de
            // kill wall-time sur gros site), on rend la main et on reprend
            // l'attente au tour suivant, qui se raccrochera au crawl en vol.
            if (crawlLaunchRes?.success && crawlLaunchRes?.crawlId) {
              console.log(`[Marina] Crawl ${crawlLaunchRes.crawlId} lancé — attente déportée au tour suivant`);
              await selfInvokePhase(jobId, url, detectedLang, 'phase2', {
                domain,
                crawlWaitRound: crawlWaitRound + 1,
                scanMode: scanModeInfo,
                pagesCrawled: pagesCrawledInfo,
              });
              return;
            }
          }

          try {
            if (crawlLaunchRes?.success && crawlLaunchRes?.crawlId) {
              const crawlId = crawlLaunchRes.crawlId;
              console.log(`[Marina] Crawl in progress: ${crawlId} — ${crawlLaunchRes.totalPages || '?'} pages`);

              // Poll until crawl completes — tour d'attente court (70 s),
              // puis relais explicite par ré-invocation de la phase 2.
              const crawlStartTime = Date.now();
              const CRAWL_TIMEOUT_MS = 70_000;
              const CRAWL_POLL_MS = 5_000;

              let crawlDone = false;
              let lastCrawledPages = 0;

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
                lastCrawledPages = crawledPages;
                pagesCrawledInfo = crawledPages;

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
                if (crawlWaitRound + 1 < MAX_CRAWL_WAIT_ROUNDS) {
                  // Le worker reprendra le lot suivant depuis le checkpoint
                  // `crawl_pages` ; on relance un tour d'attente au lieu de
                  // consommer tout le wall-time d'un seul run.
                  console.log(`[Marina] Crawl ${crawlId} encore en cours (${lastCrawledPages} pages) — tour d'attente ${crawlWaitRound + 1}/${MAX_CRAWL_WAIT_ROUNDS}`);
                  fetch(`${SUPABASE_URL}/functions/v1/process-crawl-queue`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${SERVICE_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ trigger: 'marina-chunk-relay' }),
                  }).catch(() => {});
                  await selfInvokePhase(jobId, url, detectedLang, 'phase2', {
                    domain,
                    crawlWaitRound: crawlWaitRound + 1,
                    scanMode: scanModeInfo,
                    pagesCrawled: pagesCrawledInfo,
                  });
                  return;
                }
                console.warn(`[Marina] Crawl ${crawlId} non terminé après ${MAX_CRAWL_WAIT_ROUNDS} tours — poursuite avec les ${lastCrawledPages} pages déjà crawlées`);
              }
            } else {
              console.warn(`[Marina] crawl-site unavailable: ${crawlLaunchRes?.error || 'unknown error'}`);
            }
          } catch (crawlErr) {
            console.warn(`[Marina] Multi-page crawl failed (non-fatal):`, crawlErr);
          }
        }
      }

      await updateProgress(79, 'phase2_complete');
      console.log(`[Marina] ✅ Phase 2 complete — crawl done, launching Phase 3`);

      // Self-invoke phase 3
      await selfInvokePhase(jobId, url, detectedLang, 'phase3', {
        domain,
        scanMode: scanModeInfo,
        pagesCrawled: pagesCrawledInfo,
      });

    } else if (currentPhase === 'phase3') {
      // ═══ PHASE 3: Cocoon + LLM Visibility + Report ═══
      console.log(`[Marina] Phase 3 starting for job ${jobId}`);

      // Load intermediate data from phase 1
      const { data: cached } = await sb
        .from('audit_cache')
        .select('result_data')
        .eq('cache_key', `marina_intermediate_${jobId}`)
        .maybeSingle();

      if (!cached?.result_data) {
        // Le checkpoint intermédiaire a disparu (ancien run qui le supprimait au
        // démarrage de la phase 3, purge de cache, TTL). Plutôt que d'échouer le
        // job, on relance le pipeline depuis la phase 1 : les données coûteuses
        // sont recalculées mais l'utilisateur obtient un rapport. Une seule
        // relance est autorisée pour éviter toute boucle.
        const { data: cpRow } = await sb
          .from('audit_cache')
          .select('result_data')
          .eq('cache_key', `marina_phase3_restart_${jobId}`)
          .maybeSingle();
        const restarts = Number((cpRow?.result_data as any)?.count || 0);
        if (restarts >= 1) {
          throw new Error('Phase 3: données intermédiaires introuvables après relance — pipeline interrompu');
        }
        await sb.from('audit_cache').upsert({
          cache_key: `marina_phase3_restart_${jobId}`,
          function_name: 'marina',
          result_data: { count: restarts + 1 },
          expires_at: new Date(Date.now() + PHASE_CHECKPOINT_TTL_MS).toISOString(),
        }, { onConflict: 'cache_key' });

        console.warn(`[Marina] Phase 3 sans données intermédiaires — relance depuis la phase 1 pour ${jobId}`);
        await updateProgress(10, 'phase1_restart');
        await selfInvokePhase(jobId, url, lang, 'phase1', {});
        return;
      }



      const { expertData, strategicData, domain, detectedLang, identityCard: identityCardRaw } = cached.result_data as any;
      const phase0Identity: IdentityCard | null = identityCardRaw ?? null;


      // ─── Détection de dégradation de la couche stratégique (GEO) ───
      // strategic-synthesis renvoie un fallback silencieux (« Analyse interrompue. »,
      // overallScore 0, roadmap vide) lorsque tous les appels LLM échouent. Sans
      // détection, le rapport se présente comme complet alors qu'une couche entière
      // manque : on le signale dans le rapport et on marque le job en `partial`.
      const strategicDegradation = detectStrategicDegradation(strategicData);

      // Le cache intermédiaire n'est PAS supprimé ici : la phase 3 peut être
      // relancée (timeout d'edge function, reaper de jobs zombies). Le nettoyage
      // se fait après la finalisation du job, une fois le rapport rendu.
      await sb.from('audit_cache').update({
        expires_at: new Date(Date.now() + PHASE_CHECKPOINT_TTL_MS).toISOString(),
      }).eq('cache_key', `marina_intermediate_${jobId}`);


      await updateProgress(80, 'cocoon_analysis');

      // ─── LLM Visibility (parallel with cocoon) ───
      let llmVisibilityData: any = null;
      // Modèles encore en attente de réponse au moment du rendu du rapport.
      let llmPendingAtRender: string[] = [];

      let trackedSiteId: string | null = null;
      let identityRow: Record<string, any> | null = null;
      {
        const { data: trackedSites, error: trackedSiteLookupError } = await sb
          .from('tracked_sites')
          .select('id, market_sector, entity_type, commercial_model, business_model, business_type, is_local_business, target_audience, client_targets, competitors')
          .eq('user_id', parentJob.user_id)
          .eq('domain', domain)
          .limit(1);
        trackedSiteId = trackedSites?.[0]?.id || null;
        identityRow = trackedSites?.[0] || null;
        if (trackedSiteLookupError) {
          console.warn(`[Marina] Phase 3 tracked_site lookup warning for ${domain}: ${trackedSiteLookupError.message}`);
        }
        console.log(`[Marina] Phase 3: tracked_site lookup for ${domain}: ${trackedSiteId || 'NOT FOUND'}`);
      }

      // ─── Profil de marché normalisé (secteur + modèle commercial) ───
      // La carte d'identité résolue en phase 0 est la source primaire : elle a été
      // établie AVANT le crawl, donc sans se laisser influencer par ce que le crawl
      // a trouvé. Les données de l'audit stratégique ne servent qu'à combler les
      // trous, et la ligne tracked_sites qu'en dernier recours.
      // ─── Révision post-crawl de la carte d'identité ───
      // La phase 0 ne lit que la home et 2-3 pages clés : si elle n'a pas conclu,
      // le corpus de crawl (titres + H1) tranche AVANT toute calibration.
      let revisedIdentity: IdentityCard | null = phase0Identity;
      if (phase0Identity) {
        try {
          const { data: lastCrawl } = await sb
            .from('site_crawls').select('id')
            .in('domain', [domain.replace(/^www\./, ''), `www.${domain.replace(/^www\./, '')}`])
            .order('created_at', { ascending: false }).limit(1);

          const crawlId = lastCrawl?.[0]?.id;
          if (crawlId) {
            const { data: corpusPages } = await sb
              .from('crawl_pages').select('url, title, h1').eq('crawl_id', crawlId).limit(60);
            if (corpusPages?.length) {
              revisedIdentity = await reviseIdentityAfterCrawl(
                sb,
                { ...phase0Identity, trackedSiteId: phase0Identity.trackedSiteId || trackedSiteId },
                corpusPages,
                { userId: parentJob.user_id, domain },
              );
            }
          }
        } catch (e) {
          console.warn(`[Marina] Révision post-crawl de l'identité ignorée : ${String((e as Error)?.message || e)}`);
        }
      }

      const marketProfile = buildMarketProfile({

        ...(identityRow || {}),
        market_sector: (revisedIdentity?.marketSector
          || strategicData?.introduction?.sector
          || strategicData?.market_sector
          || identityRow?.['market_sector']) ?? null,
        commercial_model: (revisedIdentity?.commercialModel && revisedIdentity.commercialModel !== 'unknown'
          ? revisedIdentity.commercialModel
          : identityRow?.['commercial_model']) ?? null,
        products_services: (revisedIdentity?.productsServices || identityRow?.['products_services']) ?? null,
        is_local_business: revisedIdentity?.isLocalBusiness ?? identityRow?.['is_local_business'] ?? null,
        entity_type: (revisedIdentity?.entityType || identityRow?.['entity_type']) ?? null,
        target_audience: (revisedIdentity?.targetAudience
          || strategicData?.introduction?.target_audience
          || identityRow?.['target_audience']) ?? null,
      });
      const identitySectorOverride = revisedIdentity && revisedIdentity.sector !== 'unknown'
        ? revisedIdentity.sector : null;
      if (identitySectorOverride && marketProfile.sector === 'unknown') marketProfile.sector = identitySectorOverride;

      const marketSectorLabel = marketProfile.sector === 'unknown' ? null : sectorLabel(marketProfile.sector);
      console.log(
        `[Marina] Profil de marché : ${marketProfile.sector} / ${marketProfile.commercialModel} ` +
        `(identité phase 0 : ${phase0Identity?.source || 'absente'})`,
      );
      const archetypeBenchmarks = await fetchArchetypeBenchmarks(sb, marketProfile);




      // Extract site context from strategic audit data (enriches LLM prompts)
      const marinaSiteContext: Record<string, string> = {};
      if (strategicData) {
        const intro = strategicData.introduction || strategicData.executive_summary || {};
        if (intro.sector || intro.market_sector) marinaSiteContext.market_sector = intro.sector || intro.market_sector;
        if (intro.products_services || intro.core_offering) marinaSiteContext.products_services = intro.products_services || intro.core_offering;
        if (intro.target_audience || intro.primary_audience) marinaSiteContext.target_audience = intro.target_audience || intro.primary_audience;
        if (intro.commercial_area || intro.geographic_scope) marinaSiteContext.commercial_area = intro.commercial_area || intro.geographic_scope;
        // Also try top-level fields
        if (!marinaSiteContext.market_sector && strategicData.market_sector) marinaSiteContext.market_sector = strategicData.market_sector;
        if (!marinaSiteContext.products_services && strategicData.products_services) marinaSiteContext.products_services = strategicData.products_services;
      }
      const hasMarinaContext = Object.keys(marinaSiteContext).length > 0;
      if (hasMarinaContext) {
        console.log(`[Marina] Enriched LLM visibility context: ${JSON.stringify(marinaSiteContext)}`);
        
        // Persist extracted context to identity card via gateway (fire-and-forget)
        if (trackedSiteId) {
          writeIdentity({
            siteId: trackedSiteId,
            fields: marinaSiteContext,
            source: 'marina',
            userId: parentJob.user_id,
          })
            .then(result => {
              if (result.applied.length) {
                console.log(`[Marina] 🏗️ Identity enriched: ${result.applied.join(', ')}`);
              }
            })
            .catch(err => console.warn('[Marina] Identity enrichment failed (non-fatal):', err));
       }
      }

      // ─── Enrich voice_dna (fire-and-forget) ───
      if (trackedSiteId) {
        (async () => {
          try {
            console.log(`[Marina] Enriching voice_dna for ${domain}...`);
            await callFunction('analyze-voice-tone', {
              tracked_site_id: trackedSiteId,
              domain,
            });
            console.log(`[Marina] ✅ voice_dna enriched for ${domain}`);
          } catch (e) {
            console.warn('[Marina] voice_dna enrichment failed (non-fatal):', e);
          }
        })();
      }

      // ─── Enrich keyword_universe from strategic data (fire-and-forget) ───
      if (trackedSiteId && strategicData) {
        (async () => {
          try {
            const kp = strategicData.keyword_positioning || strategicData.keywordPositioning || {};
            const allKw: any[] = [];

            // Extract main keywords
            if (Array.isArray(kp.main_keywords)) {
              for (const kw of kp.main_keywords) {
                if (kw?.keyword) allKw.push({
                  keyword: kw.keyword,
                  search_volume: kw.volume || 0,
                  difficulty: kw.difficulty || null,
                  position: kw.current_rank ? parseInt(String(kw.current_rank)) : null,
                  intent: kw.strategic_analysis?.intent || 'default',
                  target_url: kw.target_url || kw.page_url || url,
                });
              }
            }

            // Extract quick wins
            if (Array.isArray(kp.quick_wins)) {
              for (const qw of kp.quick_wins) {
                const kwd = qw.keyword || qw.title;
                if (kwd) allKw.push({
                  keyword: kwd,
                  search_volume: qw.volume || 0,
                  position: qw.current_rank ? parseInt(String(qw.current_rank)) : null,
                  intent: 'transactional',
                  is_quick_win: true,
                  quick_win_type: 'strategic',
                  quick_win_action: qw.action || qw.recommended_action || '',
                  target_url: qw.url || qw.page_url || url,
                });
              }
            }

            // Extract content gaps as keywords
            if (Array.isArray(kp.content_gaps)) {
              for (const cg of kp.content_gaps) {
                const kwd = cg.keyword || cg.title;
                if (kwd) allKw.push({
                  keyword: kwd,
                  search_volume: cg.volume || 0,
                  intent: 'informational',
                  target_url: cg.suggested_url || url,
                });
              }
            }

            if (allKw.length > 0) {
              console.log(`[Marina] Enriching keyword_universe with ${allKw.length} keywords for ${domain}`);
              await sb.rpc('upsert_keyword_universe', {
                p_domain: domain,
                p_user_id: parentJob.user_id,
                p_keywords: allKw,
                p_source: 'marina',
                p_tracked_site_id: trackedSiteId,
              });
              console.log(`[Marina] ✅ keyword_universe enriched for ${domain}`);
            }
          } catch (e) {
            console.warn('[Marina] keyword_universe enrichment failed (non-fatal):', e);
          }
        })();
      }

      // Mutualisation : lecture du cache "site-scoped" (24h) partagé par toutes
      // les URLs d'un même domaine (batch multipages inclus).
      const siteScope = await readSiteScopeCache(sb, domain, parentJob.user_id);
      const reusedFromCache: string[] = [];

      // Garde de cohérence du cache : un payload antérieur à l'architecture
      // « triple benchmark » ne contient pas les 3 blocs (ni les questions
      // groundées sur les besoins réels). On le rejette et on remesure.
      const isFreshLlmPayload = (p: any): boolean => {
        const b = unwrapFunctionPayload(p)?.benchmarks;
        return Array.isArray(b) && b.length >= 3;
      };

      // Un payload « frais » peut encore être en cours de mesure : les questions
      // sont persistées AVANT les appels modèles. Le rapport ne doit être ni rendu
      // ni marqué terminé tant que toutes les réponses ne sont pas reçues et
      // compilées dans les scores.
      const llmPendingModels = (p: any): string[] => {
        const d = unwrapFunctionPayload(p);
        if (!d) return [];
        const pendingTop = d.measurement_status === 'processing' ? ['*'] : [];
        const pendingScores = (Array.isArray(d.scores) ? d.scores : [])
          .filter((s: any) => s?.measurement_status === 'pending')
          .map((s: any) => String(s.llm_name));
        return pendingScores.length > 0 ? pendingScores : pendingTop;
      };
      const isSettledLlmPayload = (p: any): boolean =>
        isFreshLlmPayload(p) && llmPendingModels(p).length === 0;

      const llmVisibilityPromise = (async () => {
        if (!trackedSiteId) return;
        if (siteScope?.llmVisibility && isSettledLlmPayload(siteScope.llmVisibility)) {
          llmVisibilityData = siteScope.llmVisibility;
          reusedFromCache.push('visibilité IA');
          console.log(`[Marina] ♻️ LLM visibility réutilisée depuis le cache domaine (${domain})`);
          return;
        }
        if (siteScope?.llmVisibility) {
          console.log(`[Marina] ⚠️ Cache LLM inutilisable (moins de 3 benchmarks ou mesure en cours) pour ${domain} → remesure`);
        }
        try {
          console.log(`[Marina] Phase 3: calculate-llm-visibility for ${domain}`);
          const result = await callFunction('calculate-llm-visibility', {
            tracked_site_id: trackedSiteId,
            user_id: parentJob.user_id,
            ...(hasMarinaContext ? { siteContext: marinaSiteContext } : {}),
          });
          const normalizedResult = unwrapFunctionPayload(result);
          if (normalizedResult && !result?.error && Array.isArray(normalizedResult.scores)) {
            llmVisibilityData = normalizedResult;
            console.log(`[Marina] LLM visibility done: ${normalizedResult.scores.length} LLMs scored, ${normalizedResult.benchmarks?.length || 0} benchmarks persisted`);
            await writeSiteScopeCache(sb, domain, parentJob.user_id, { llmVisibility: normalizedResult });
          } else if (isFreshLlmPayload(siteScope?.llmVisibility)) {
            // Ne jamais perdre les questions persistées si l'appel HTTP est coupé
            // après le démarrage de la mesure.
            llmVisibilityData = unwrapFunctionPayload(siteScope.llmVisibility);
          } else {
            console.warn(`[Marina] LLM visibility returned no scores: ${result?.error || 'empty'}`);
          }
        } catch (e) {
          console.warn(`[Marina] LLM visibility failed (non-fatal):`, e);
        }
      })();


      // ─── Cocoon computation (mutualisé par domaine) ───
      let cocoonResult: any = null;
      const COCOON_TIMEOUT_MS = 270_000; // 270s — tripled for heavy sites
      if (siteScope?.cocoon) {
        cocoonResult = siteScope.cocoon;
        reusedFromCache.push('cocon sémantique');
        console.log(`[Marina] ♻️ Cocon réutilisé depuis le cache domaine (${domain})`);
      } else {
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
        if (cocoonResult) {
          await writeSiteScopeCache(sb, domain, parentJob.user_id, { cocoon: cocoonResult });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[Marina] Cocoon failed (non-fatal, ${msg.includes('timeout') ? 'TIMEOUT' : 'error'}):`, msg);
      }
      }

      // Wait for LLM visibility if still running
      await llmVisibilityPromise;

      // ─── Barrière de complétude visibilité LLM ───
      // Deux cas à couvrir avant de rendre le rapport :
      //  1. l'appel HTTP a été coupé alors que la fonction écrivait dans domain_data_cache ;
      //  2. les questions sont persistées (3 benchmarks) mais des modèles répondent encore.
      // Dans les deux cas on repolle le cache domaine jusqu'à obtenir un payload
      // « settled » (statut != processing et aucun score pending), avec un budget borné.
      const LLM_SETTLE_ATTEMPTS = 36; // 36 × 5s = 3 min max d'attente supplémentaire
      if (!isSettledLlmPayload(llmVisibilityData)) {
        for (let attempt = 0; attempt < LLM_SETTLE_ATTEMPTS; attempt++) {
          try {
            const { data: cached } = await sb
              .from('domain_data_cache')
              .select('result_data, expires_at')
              .eq('data_type', 'llm_visibility')
              .in('domain', [domain, `www.${domain}`, domain.replace(/^www\./, '')])
              .gt('expires_at', new Date().toISOString())
              .order('week_start_date', { ascending: false })
              .limit(1)
              .maybeSingle();
            const payload = (cached as any)?.result_data;
            // Un payload legacy (sans les 3 benchmarks) ne doit pas écraser la mesure.
            if (payload?.scores?.length && Array.isArray(payload?.benchmarks) && payload.benchmarks.length >= 3) {
              llmVisibilityData = { data: payload };
              if (isSettledLlmPayload(llmVisibilityData)) {
                console.log(`[Marina] ✅ Visibilité LLM complète (${payload.benchmarks.length} benchmarks, tous modèles compilés)`);
                await writeSiteScopeCache(sb, domain, parentJob.user_id, { llmVisibility: llmVisibilityData });
                break;
              }
              console.log(`[Marina] ⏳ Visibilité LLM encore en cours (${llmPendingModels(llmVisibilityData).join(', ')}) — attente ${attempt + 1}/${LLM_SETTLE_ATTEMPTS}`);
            }
          } catch (e) {
            console.warn('[Marina] read-back visibilité LLM échoué (non-fatal):', e);
            break;
          }
          await new Promise((r) => setTimeout(r, 5_000));
        }
        if (!llmVisibilityData) {
          console.warn(`[Marina] Visibilité LLM indisponible pour ${domain} — rendu dégradé (pas de blocs benchmark)`);
        }
      }

      // Trace du verdict de complétude : consommée à la finalisation du job pour
      // interdire le passage en « terminé » avec des réponses manquantes.
      llmPendingAtRender = llmPendingModels(llmVisibilityData);
      if (llmPendingAtRender.length > 0) {
        console.warn(`[Marina] ⚠️ Rapport rendu avec mesures LLM incomplètes : ${llmPendingAtRender.join(', ')}`);
      }



      let crawlSnapshot: any = null;
      let hostDuplication: HostDuplicationResult | null = null;
      let archetypeAnalysis: ArchetypeAnalysis | null = null;
      try {
        const { data: recentCrawls, error: crawlLookupError } = await sb
          .from('site_crawls' as any)
          .select('id, crawled_pages, total_pages, avg_score, created_at, content_integrity')
          .in('domain', [domain.replace(/^www\./, ''), `www.${domain.replace(/^www\./, '')}`])

          .eq('user_id', parentJob.user_id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1);

        if (crawlLookupError) {
          console.warn(`[Marina] Crawl snapshot lookup failed for ${domain}: ${crawlLookupError.message}`);
        }

        const latestCrawl = recentCrawls?.[0];
        if (latestCrawl?.id) {
          // Plafond du mode de scan : on ne lit jamais plus de pages que le
          // budget du mode retenu (deep 120 / standard 150 / sample 60), sinon
          // un gros domaine ferait exploser le coût d'analyse en aval.
          const pageCeiling = (scanModeInfo ?? resolveScanMode((latestCrawl as any).total_pages || null)).maxPages;
          const { data: crawlPages, error: crawlPagesError } = await sb
            .from('crawl_pages')
            .select('*')
            .eq('crawl_id', latestCrawl.id)
            .order('created_at', { ascending: true })
            .limit(pageCeiling);

          if (crawlPagesError) {
            console.warn(`[Marina] Crawl pages lookup failed for crawl ${latestCrawl.id}: ${crawlPagesError.message}`);
          } else if (crawlPages?.length) {
            crawlSnapshot = buildMultiPageCrawlSnapshot(latestCrawl, crawlPages, expertData, domain);

            // Doublon d'hôte (www vs apex) : preuve directe dans les pages
            // crawlées + sonde HTTP de 2 requêtes pour savoir si une 301 existe.
            // 0 token LLM, non bloquant.
            try {
              const probe = await probeHostRedirect(domain);
              hostDuplication = analyzeHostDuplication(crawlPages as any[], domain, probe);
              if (hostDuplication.detected) {
                console.log(`[Marina] Doublon d'hôte détecté sur ${domain}: ${hostDuplication.duplicatePaths.length} chemins, canonical ${hostDuplication.canonicalCoverage ?? 'n/d'}%`);
              }
            } catch (hostErr) {
              console.warn('[Marina] Host duplication check failed (non-fatal):', hostErr);
            }
            // Segmentation par type de page (agence / produit / service / avis / éditorial…) :
            // conclusion intermédiaire par type, puis synthèse business. 0 token LLM.
            // Pondération du mix de gabarits : le sitemap donne la répartition du site
            // entier, le crawl la qualité. Fetch XML léger, aucun token LLM.
            const sitemapUrlsForMix = await fetchSitemapUrls(domain).catch(() => [] as string[]);

            // Audit ciblé sur une URL précise (pas la racine du domaine) : on ne
            // segmente que cette page et son voisinage de liens, au lieu de
            // décrire des gabarits que l'audit n'a pas examinés.
            const auditedPath = (() => { try { return new URL(url).pathname.replace(/\/+$/, ''); } catch { return ''; } })();
            const isFocusedAudit = auditedPath !== '' && auditedPath !== '/';
            let linkedUrls: string[] = [];
            if (isFocusedAudit) {
              const rawHtml: string = expertData?.rawData?.htmlAnalysis?.rawHtml || '';
              const outbound = new Set<string>();
              for (const m of rawHtml.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
                try {
                  const abs = new URL(m[1], url);
                  if (abs.hostname.replace(/^www\./, '') === domain.replace(/^www\./, '')) outbound.add(abs.toString());
                } catch { /* href non résolvable */ }
              }
              // Voisinage entrant approché : pages de la même branche de
              // répertoire, seule information de maillage disponible au crawl.
              const branch = auditedPath.split('/').slice(0, -1).join('/');
              const inbound = (crawlPages as any[])
                .filter((p) => branch && typeof p.path === 'string' && p.path.startsWith(`${branch}/`))
                .map((p) => p.url as string);
              linkedUrls = [...outbound, ...inbound];
            }

            archetypeAnalysis = analyzePageArchetypes(crawlPages as any[], {
              sitemapUrls: sitemapUrlsForMix,
              benchmarks: archetypeBenchmarks,
              sectorLabel: marketSectorLabel,
              commercialModel: marketProfile.commercialModel,
              commercialModelLabel: marketProfile.commercialModel === 'unknown'
                ? null
                : commercialModelLabel(marketProfile.commercialModel),
              focusUrl: isFocusedAudit ? url : null,
              linkedUrls: isFocusedAudit ? linkedUrls : null,
            });



            // Les arbitrages de gabarits deviennent des prescriptions exécutables
            // (Parménion phase prescribe + Stratège cocoon), pas un simple constat.
            await writeArchetypePrescriptions(sb, archetypeAnalysis, {
              domain,
              url,
              userId: parentJob.user_id,
              trackedSiteId: trackedSiteId || null,
              sectorLabel: marketSectorLabel,
            }).catch(() => {});

            // Réécritures « réponse directe » (~40 mots) : un exemple concret par
            // gabarit de page, poussé dans le Workbench (catégorie rewrite_content)
            // et donc exécutable par Parménion / Stratège cocoon. 0 token LLM.
            try {
              const archetypeByUrl = new Map<string, { key: string; label: string }>();
              for (const g of archetypeAnalysis?.groups || []) {
                for (const s of (g as any).sample || []) archetypeByUrl.set(s, { key: (g as any).key, label: (g as any).label });
              }
              const aeoRewrites = buildAeoRewrites((crawlPages as any[]).map((p: any) => ({
                url: p.url,
                title: p.title,
                h1: p.h1,
                text: p.body_text_truncated,
                page_intent: p.page_intent,
                word_count: p.word_count,
                archetype_key: archetypeByUrl.get(p.url)?.key || null,
                archetype_label: archetypeByUrl.get(p.url)?.label || null,
              })), 6);
              await writeAeoRewritePrescriptions(sb, aeoRewrites, {
                domain,
                userId: parentJob.user_id,
                trackedSiteId: trackedSiteId || null,
                sourceFunction: 'marina',
              });
            } catch (aeoErr) {
              console.warn('[Marina] AEO rewrite prescriptions failed (non-fatal):', aeoErr);
            }


            // Mémoire de marché : observation historisée, base de la calibration
            // sectorielle hebdomadaire et d'un apprentissage ultérieur.
            await writeMarketObservation(sb, {
              domain,
              userId: parentJob.user_id,
              trackedSiteId: trackedSiteId || null,
              source: 'marina',
              profile: marketProfile,
              analysis: archetypeAnalysis,
              // Normalisé /100 comme le reste du rapport (avg_score est stocké /200).
              avgSeoScore: (latestCrawl as any)?.avg_score
                ? Math.min(100, Math.round(Number((latestCrawl as any).avg_score) / 2))
                : null,

              geoScore: Number(llmVisibilityData?.global_score ?? llmVisibilityData?.data?.global_score) || null,
              authorityScore: Number((strategicData as any)?.domain_authority?.authority_score) || null,
            }).catch(() => {});

            // Constats d'intégrité → Workbench (idempotent, partagé avec le crawl)
            await writeIntegrityFindingsToWorkbench(sb, (latestCrawl as any).content_integrity || null, {
              domain,
              userId: parentJob.user_id,
              trackedSiteId: trackedSiteId || null,
              sourceFunction: 'marina',
            }).catch(() => {});

          }
        }
      } catch (crawlSnapshotError) {
        console.warn(`[Marina] Crawl snapshot build failed (non-fatal):`, crawlSnapshotError);
      }

      if (trackedSiteId && cocoonResult) {
        try {
          const { data: semanticNodes, error: semanticNodesError } = await sb
            .from('semantic_nodes' as any)
            .select('url, title, intent, page_authority, internal_links_in, internal_links_out, cluster_id, similarity_edges, word_count, eeat_score, traffic_estimate, roi_predictive')
            .eq('tracked_site_id', trackedSiteId)
            .order('created_at', { ascending: false })
            .limit(100);

          if (semanticNodesError) {
            console.warn(`[Marina] semantic_nodes lookup failed for ${domain}: ${semanticNodesError.message}`);
          } else if (semanticNodes?.length) {
            cocoonResult = hydrateCocoonReportData(cocoonResult, semanticNodes);
          }
        } catch (semanticHydrationError) {
          console.warn(`[Marina] Cocoon hydration failed (non-fatal):`, semanticHydrationError);
        }
      }

      await updateProgress(85, 'generating_report');

      // ─── Fetch user branding for white-label ───
      let marinaBranding: MarinaBranding | undefined;
      try {
        const { data: brandProfile } = await sb
          .from('profiles')
          .select('marina_brand_enabled, marina_full_whitelabel, marina_custom_intro, marina_custom_cta_text, marina_custom_cta_url, marina_hide_crawlers_badge, agency_logo_url, agency_primary_color, agency_brand_name, agency_contact_email, agency_contact_phone, agency_report_footer_text, plan_type')
          .eq('user_id', parentJob.user_id)
          .single();
        
        if (brandProfile?.marina_brand_enabled && (brandProfile.plan_type === 'agency_pro' || brandProfile.plan_type === 'agency_premium')) {
          const isPremium = brandProfile.plan_type === 'agency_premium';
          marinaBranding = {
            enabled: true,
            fullWhiteLabel: isPremium && (brandProfile.marina_full_whitelabel || false),
            logoUrl: brandProfile.agency_logo_url,
            primaryColor: brandProfile.agency_primary_color,
            brandName: brandProfile.agency_brand_name,
            customIntro: brandProfile.marina_custom_intro,
            ctaText: brandProfile.marina_custom_cta_text,
            ctaUrl: brandProfile.marina_custom_cta_url,
            hideBadge: brandProfile.marina_hide_crawlers_badge || false,
            contactEmail: brandProfile.agency_contact_email,
            contactPhone: brandProfile.agency_contact_phone,
            reportFooterText: brandProfile.agency_report_footer_text,
          };
          console.log(`[Marina] 🎨 White-label branding loaded (full=${marinaBranding.fullWhiteLabel})`);
        }
      } catch (brandErr) {
        console.warn('[Marina] Branding fetch failed (non-fatal):', brandErr);
      }

      // ─── Fetch indexation data ───
      let indexationData: any[] = [];
      if (trackedSiteId) {
        try {
          const { data: idxRows } = await sb
            .from('indexation_checks')
            .select('page_url, verdict, coverage_state, last_crawl_time')
            .eq('tracked_site_id', trackedSiteId)
            .order('checked_at', { ascending: false })
            .limit(100);
          indexationData = idxRows || [];
          console.log(`[Marina] Indexation data: ${indexationData.length} checks found`);
        } catch (idxErr) {
          console.warn('[Marina] Indexation fetch failed (non-fatal):', idxErr);
        }
      }

      // ─── Step 3bis: Preuve visuelle du site prospect (Pagebolt, non bloquant) ───
      let visualCapture: VisualCapture | null = null;
      try {
        visualCapture = await captureSiteVisual({
          url,
          service: sb,
          bucket: 'site-captures',
          pathPrefix: `marina/${jobId}`,
          signedTtl: 7 * 24 * 60 * 60,
        });
        if (visualCapture.errors.length > 0) {
          console.warn('[Marina] Visual capture partielle:', visualCapture.errors.join(' | '));
        }
        if (!visualCapture.desktop_url && !visualCapture.mobile_url) visualCapture = null;
      } catch (capErr) {
        console.warn('[Marina] Visual capture failed (non-fatal):', capErr);
        visualCapture = null;
      }

      // ─── Step 4: Generate HTML reports ───
      let html: string;
      
      try {
        console.log(`[Marina] Phase 3 Step 4: Generating section HTMLs...`);
        
        // ─── Verdict racine : contenu rendu pour les robots ? ───
        // Si le HTML servi est une coquille JS, les constats de contenu ne
        // mesurent que l'absence de rendu : un seul constat racine les remplace.
        const botRendering: BotRenderingReport | null = crawlSnapshot?.contentIntegrity?.botRendering || null;
        const renderBlocked = Boolean(botRendering?.blocked);
        const botRenderingHtml = renderBlocked ? botRenderingBlockHTML(botRendering!, domain) : '';
        // ─── Lot 3 : contre-vérification des absences de balises ───
        // Une balise présente après rendu JS mais absente du HTML servi n'est
        // pas un manque éditorial : le constat devient un défaut de rendu.
        const absenceReport: AbsenceVerificationReport | null =
          crawlSnapshot?.contentIntegrity?.absenceVerification || null;
        const absenceHtml = absenceReliabilityBlockHTML(absenceReport);
        const absenceFinding = absenceVerificationFinding(absenceReport) as unknown as RawFinding | null;

        const dropShellSymptoms = (findings: RawFinding[]): RawFinding[] => {
          let out = findings;
          if (renderBlocked) {
            out = out.filter((f) => !isSuppressedByShell(String(f.title || ''), String(f.description || '')));
          }
          // Absences démenties par le rendu complet : retirées quel que soit le
          // verdict racine, elles décrivent le rendu et non le contenu.
          return out.filter((f) => !isBotOnlyAbsence(absenceReport, String(f.title || ''), String(f.description || '')));
        };

        // ─── Lot A : signaux de confiance machine + URLs mortes (déterministes) ───
        const riskClaimsReport = crawlSnapshot?.contentIntegrity?.riskClaims || null;
        const authorityMismatchReport = crawlSnapshot?.contentIntegrity?.authorityMismatch || null;
        const deadUrlsReport = crawlSnapshot?.contentIntegrity?.deadUrls || null;
        const trustHtml = trustSignalsBlockHTML(riskClaimsReport, authorityMismatchReport);
        const claimFinding = riskClaimsFinding(riskClaimsReport);
        const authorityFinding = authorityMismatchFinding(authorityMismatchReport);
        const deadFindings = deadUrlFindings(deadUrlsReport) as unknown as RawFinding[];

        // ─── Top-3 priorities per section + consolidated plan ───
        const hostDupFinding = hostDuplication ? hostDuplicationFinding(hostDuplication, domain) : null;
        const seoFindings: RawFinding[] = dropShellSymptoms([
          ...(renderBlocked ? [botRenderingFinding(botRendering!, domain) as unknown as RawFinding] : []),
          ...(!renderBlocked && absenceFinding ? [absenceFinding] : []),
          ...(hostDupFinding ? [hostDupFinding as RawFinding] : []),
          ...deadFindings,
          ...(expertData?.recommendations || []).map((r: any) => ({
            id: r.id, title: r.title || r.label || '', description: r.description || r.detail || '',
            priority: r.priority || r.severity, category: r.category, fixes: r.fixes,
          })),
        ]);


        const roadmap = strategicData?.executive_roadmap || strategicData?.strategic_roadmap || [];
        const geoFindings: RawFinding[] = dropShellSymptoms(roadmap
          .filter((it: any) => !/keyword|mots?-cl|content gap/i.test(`${it.category || ''} ${it.title || ''}`))
          .map((it: any) => ({
            title: it.prescriptive_action || it.title || it.action_concrete || '',
            // Ne JAMAIS retomber sur expected_roi ('High'/'Medium') : cette
            // étiquette se collait en fin de phrase dans le rapport.
            description: it.description || it.strategic_rationale || '',

            priority: it.priority, category: it.category,
          })));

        const kwFindings: RawFinding[] = [
          ...(strategicData?.keyword_positioning?.content_gaps || []).map((g: any) => ({
            title: `Content gap : ${g.keyword || g.term || g}`,
            description: `Volume ${g.volume || '-'} · ${g.priority || g.importance || ''}`,
            priority: (g.priority || g.importance || 'important'),
            category: 'keywords',
          })),
          ...roadmap.filter((it: any) => /keyword|mots?-cl/i.test(`${it.category || ''} ${it.title || ''}`))
            .map((it: any) => ({
              title: it.prescriptive_action || it.title || '',
              description: it.description || '', priority: it.priority, category: 'keywords',
            })),
        ];
        const eeatFindings: RawFinding[] = [
          ...(claimFinding ? [claimFinding as unknown as RawFinding] : []),
          ...(authorityFinding ? [authorityFinding as unknown as RawFinding] : []),
          ...(expertData?.recommendations || [])
            .filter((r: any) => /eeat|e-e-a-t|autorit|expertise|trust/i.test(`${r.category || ''} ${r.title || ''}`))
            .map((r: any) => ({
              title: r.title || '', description: r.description || '',
              priority: r.priority, category: 'eeat', fixes: r.fixes,
            })),
        ];

        // Autorité / backlinks : le bloc était calculé et affiché mais ne
        // produisait aucune action. Il alimente désormais le plan consolidé
        // (donc la conclusion 0-30/30-60/60-90 et le Workbench).
        {
          const da: any = strategicData?.domain_authority;
          if (da && da.data_source === 'dataforseo') {
            const score = Number(da.authority_score) || 0;
            const refs = Number(da.referring_domains) || 0;
            const tox = Number(da.toxicity?.toxicity_score) || 0;
            if (score > 0 && score < 40) {
              // Lot 5 — la sévérité vient de l'écart mesuré au seuil, pas d'une constante.
              const sig = severityFromSignal({ value: score, threshold: 40, direction: 'below', coverage: 1 });
              eeatFindings.push({
                title: `Autorité de domaine faible (Authority Score ${score}/100)`,
                description: `${refs} domaine(s) référent(s) mesuré(s) — ${sig.basis}. Acquérir des liens éditoriaux thématiques (relations presse, partenariats sectoriels, contenus citables) pour lever le plafond de positions atteignable.`,
                priority: sig.severity === 'critical' ? 'critical' : sig.severity === 'important' ? 'important' : 'suggestion',
                category: 'eeat',
                gap_ratio: sig.gapRatio,
              } as RawFinding);
            }
            if (tox >= 35) {
              const sigTox = severityFromSignal({ value: tox, threshold: 35, direction: 'above', coverage: 1 });
              eeatFindings.push({
                title: `Profil de liens à assainir (toxicité ${tox}/100 — ${da.toxicity?.verdict || ''})`,
                description: `${da.toxicity?.recommendation || 'Diversifier les ancres et désavouer les référents de faible qualité.'} (${sigTox.basis})`,
                priority: sigTox.severity === 'critical' ? 'critical' : 'important',
                category: 'eeat',
                gap_ratio: sigTox.gapRatio,
              } as RawFinding);
            }
          }
        }
        const cocoonFindings: RawFinding[] = dropShellSymptoms((cocoonResult?._stratege_recommendations || []).map((r: any) => ({
          title: r.title || '', description: r.description || '',
          priority: /1/.test(r.priority || '') ? 'critical' : /2/.test(r.priority || '') ? 'important' : 'suggestion',
          category: 'cocoon',
        })));


        const topSeo    = extractTopPriorities('seo', seoFindings);
        const topGeo    = extractTopPriorities('geo', geoFindings);
        const topKw     = extractTopPriorities('keywords', kwFindings);
        const topEeat   = extractTopPriorities('eeat', eeatFindings);
        const topCocoon = extractTopPriorities('cocoon', cocoonFindings);

        // ─── Step A: PUSH findings to architect_workbench BEFORE building the plan ───
        // The consolidated plan reads from the workbench; if Marina did not write
        // first, fresh reports would render an empty conclusion. Non-fatal on error.
        try {
          await writeMarinaFindingsToWorkbench(
            sb,
            [
              { section: 'seo',      findings: seoFindings },
              { section: 'geo',      findings: geoFindings },
              { section: 'keywords', findings: kwFindings },
              { section: 'eeat',     findings: eeatFindings },
              { section: 'cocoon',   findings: cocoonFindings },
            ],
            {
              domain,
              url,
              userId: parentJob.user_id,
              trackedSiteId: trackedSiteId || null,
            },
          );
        } catch (wbWriteErr) {
          console.warn('[Marina] Workbench write failed (non-fatal):', wbWriteErr);
        }

        // ─── Step B: now read the workbench (Marina findings included) ───
        let workbenchTasks: WorkbenchTask[] = [];
        try {
          const { data: wb } = await sb
            .from('architect_workbench')
            .select('id, title, description, severity, finding_category, status, source_type, target_url')
            .eq('domain', domain)
            .eq('user_id', parentJob.user_id)
            .neq('status', 'done')
            .order('created_at', { ascending: false })
            .limit(50);
          workbenchTasks = (wb as WorkbenchTask[]) || [];
        } catch (wbErr) {
          console.warn('[Marina] Workbench fetch failed (non-fatal):', wbErr);
        }
        // ─── Données propriétaires (avant le plan : elles servent à estimer le trafic) ───
        // Uniquement si l'utilisateur possède une connexion Google vérifiée
        // couvrant CE domaine. Sinon la section n'existe pas et l'estimation
        // de gain reste explicitement « non estimable ».
        let ownerPerformance: OwnerPerformanceData | null = null;
        try {
          ownerPerformance = await fetchOwnerPerformanceData(sb, parentJob.user_id, domain);
          console.log(
            `[Marina] Données propriétaires ${ownerPerformance ? 'disponibles' : 'absentes'} pour ${domain}`,
          );
        } catch (ownerErr) {
          console.warn('[Marina] Owner performance fetch failed (non-fatal):', ownerErr);
        }

        // Lot 5 — contexte de trafic mesuré : clics/impressions GSC si le domaine
        // est vérifié, sinon volume de recherche DataForSEO du périmètre visé.
        const kpForVolume: any = strategicData?.keyword_positioning || strategicData?.keywordPositioning || {};
        const measuredKeywordVolume = [
          ...(Array.isArray(kpForVolume.quick_wins) ? kpForVolume.quick_wins : []),
          ...(Array.isArray(kpForVolume.content_gaps) ? kpForVolume.content_gaps : []),
        ].reduce((acc: number, k: any) => acc + (Number(k?.volume) || 0), 0);

        const trafficContext = {
          monthlyClicks: ownerPerformance?.gsc?.current?.clicks ?? null,
          monthlyImpressions: ownerPerformance?.gsc?.current?.impressions ?? null,
          keywordVolume: measuredKeywordVolume > 0 ? measuredKeywordVolume : null,
          pagesAnalyzed: crawlSnapshot?.crawled_pages || crawlSnapshot?.pages?.length || null,
        };

        let consolidatedPlanStats: ConsolidatedPlanStats | undefined;
        const rawConsolidatedPlan = buildConsolidatedActionPlan(
          workbenchTasks,
          [topSeo, topGeo, topKw, topEeat, topCocoon],
          {
            maxItems: 12,
            traffic: trafficContext,
            onStats: (s) => { consolidatedPlanStats = s; },
          },
        );


        // Quand un plan d'action consolidé existe, il contient déjà — fusionnées,
        // dédoublonnées et pondérées — les actions des Top-3 de section. Les
        // réinjecter dans chaque section produisait la même liste 4 à 5 fois.
        const hasPlan = rawConsolidatedPlan.length > 0;
        const sectionTop = (html: string) => (hasPlan ? '' : html);

        const crawlHTML = generateCrawlSectionHTML(
          expertData, detectedLang, domain, url, crawlSnapshot,
          botRenderingHtml + absenceHtml + sectionTop(renderTopPrioritiesHTML(topSeo)),
          hostDuplication ? buildHostDuplicationHTML(hostDuplication, domain) : '',
        );
        const techHTML = generateTechSectionHTML(expertData, detectedLang, domain);

        // ─── Lot B : le GEO décomposé en 10 sous-signaux (compréhension / autorité) ───
        // Un score GEO global masque deux causes opposées. La décomposition est
        // déterministe (0 token) : elle réagrège des signaux déjà mesurés ailleurs
        // et produit un verdict d'écart entre les deux familles.
        const tlSignals = strategicData?.social_signals?.thought_leadership || null;
        const geoSubSignalsReport = buildGeoSubSignals({
          // Le breakdown est imbriqué sous llm_visibility dans l'objet d'audit
          // stratégique ; l'accès direct renvoyait undefined et laissait les
          // 8 sous-signaux correspondants en « non mesuré ».
          breakdown:
            strategicData?.llm_visibility?.citation_breakdown ||
            strategicData?.llm_visibility_raw?.citation_breakdown ||
            strategicData?.citation_breakdown ||
            llmVisibilityData?.citation_breakdown ||
            null,
          isBotShell: botRendering ? Boolean(botRendering.blocked) : null,
          botOnlyAbsences: absenceReport ? (absenceReport.bot_only_signals?.length ?? 0) : null,
          crawlFormatting: crawlSnapshot?.answerFormatting || null,
          founderResolved: tlSignals ? Boolean(tlSignals.founder_name) : null,
          founderCorroborated: tlSignals
            ? Boolean(tlSignals.founder_profile_url) ||
              ['strong', 'high', 'confirmed', 'corroborated'].includes(String(tlSignals.founder_authority || '').toLowerCase())
            : null,
        });
        const geoSubSignalsHtml = geoSubSignalsBlockHTML(geoSubSignalsReport, detectedLang);

        const strategicHTML = generateStrategicSectionHTML(
          strategicData, detectedLang, domain, llmVisibilityData,
          sectionTop(renderTopPrioritiesHTML(topGeo)),
          sectionTop(renderTopPrioritiesHTML(topKw)),
          trustHtml + sectionTop(renderTopPrioritiesHTML(topEeat)),
          hasPlan,
          geoSubSignalsHtml,
        );


        const cocoonHTML = generateCocoonSectionHTML(cocoonResult, detectedLang, domain, botRenderingHtml + sectionTop(renderTopPrioritiesHTML(topCocoon)));

        const indexationHTML = indexationData.length > 0 ? generateIndexationSectionHTML(indexationData, detectedLang, domain) : '';

        const ownerPerformanceHTML = renderOwnerPerformanceHTML(ownerPerformance, '3b');

        // Pondération ROI diffuse (impact / effort, 0 token) : les blocages critiques
        // restent en tête, l'ordre interne suit le rendement.
        // Lot 5 — l'impact est modulé par des signaux mesurés : volume du cluster
        // pour les actions mots-clés, position moyenne mesurée si GSC est branché.
        const measuredPosition = ownerPerformance?.gsc?.current?.position ?? null;
        const planWithSignals = rawConsolidatedPlan.map((it) => ({
          ...it,
          keyword_volume: it.source_section === 'keywords' && trafficContext.keywordVolume
            ? trafficContext.keywordVolume
            : undefined,
          current_position: measuredPosition && measuredPosition > 0
            ? Math.round(measuredPosition * 10) / 10
            : undefined,
        }));
        const consolidatedPlan = applyRoiWeighting(planWithSignals, {
          pagesAnalyzed: trafficContext.pagesAnalyzed,
          hasOwnerPerformance: Boolean(ownerPerformance),
        });
        const roiSummary = summarizeRoi(consolidatedPlan, detectedLang);
        const consolidatedPlanHTML = renderConsolidatedPlanHTML(consolidatedPlan, consolidatedPlanStats);


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

        // ─── Conclusion intermédiaire PROPRE À CETTE URL ───
        // Le crawl et le graphe de cocon sont mutualisés au niveau du domaine,
        // mais le score technique, le score GEO et les correctifs de maillage
        // rendus ici ne concernent que l'URL auditée (0 token LLM).
        const pageTech100 = Number(expertData?.totalScore || 0) > 0
          ? Math.round((Number(expertData.totalScore) / (Number(expertData?.maxScore || 220) || 220)) * 100)
          : null;
        const pageGeo100 = strategicData?.overallScore ? Math.round(Number(strategicData.overallScore)) : null;
        const urlKey = pageKey(url);
        const pageScopedActions = (consolidatedPlan || []).filter((i: any) => {
          const target = i?.target_url ? String(i.target_url) : '';
          return target ? pageKey(target) === urlKey : false;
        });
        const pageVerdict = buildPageVerdictHTML(detectedLang, domain, url, {
          techScore: pageTech100,
          geoScore: pageGeo100,
          criticalCount: (consolidatedPlan || []).filter((i: any) => i.severity === 'critical').length,
          pageActions: (pageScopedActions.length ? pageScopedActions : (consolidatedPlan || []))
            .map((i: any) => ({ severity: i.severity, title: splitLongTitle(String(i.title || ''), '').title })),
          cocoonData: cocoonResult,
        });
        const cocoonPageHTML = buildCocoonPageFocusHTML(cocoonResult, url, detectedLang);

        // Signaux mesurés : source de vérité du verdict stratégique.
        const verdictSignals: VerdictSignals = {
          pagesKnown: crawlSnapshot?.total_pages || null,
          pagesAnalyzed: crawlSnapshot?.crawled_pages || crawlSnapshot?.pages?.length || null,
          techScore: pageTech100,
          geoScore: pageGeo100,
          criticalCount: (consolidatedPlan || []).filter((i: any) => i.severity === 'critical').length,
          psiPerformanceMobile: expertData?.scores?.performance?.psiPerformance ?? null,
          cannibalizationGroups: crawlSnapshot?.contentIntegrity?.cannibalizationGroups ?? null,
          nearDuplicateGroups: crawlSnapshot?.contentIntegrity?.nearDuplicateGroups ?? null,
          thinPages: crawlSnapshot?.contentIntegrity?.thinPages ?? null,
          clusterCount: cocoonResult?.stats?.cluster_count ?? (cocoonResult?.cluster_summary?.length || null),
          orphanPages: cocoonResult?.graph_details?.orphan_pages?.length ?? null,
          hasSchema: crawlSnapshot?.hasSchema ?? null,
          schemaTypesCount: (crawlSnapshot?.schemaTypes || []).length,
          rankedKeywords: (strategicData?.keyword_positioning?.main_keywords || []).length,
          quickWinKeywords: (strategicData?.keyword_positioning?.quick_wins || []).length,
          contentGapKeywords: (strategicData?.keyword_positioning?.content_gaps || []).length,
          hostDuplication: Boolean(hostDuplication?.detected),
          // Autorité / backlinks : intégrée au verdict et à la fourchette
          // de gain, uniquement si DataForSEO a réellement répondu.
          authorityScore: strategicData?.domain_authority?.data_source === 'dataforseo'
            ? Number(strategicData.domain_authority.authority_score) || null
            : null,
          referringDomains: strategicData?.domain_authority?.data_source === 'dataforseo'
            ? Number(strategicData.domain_authority.referring_domains) || null
            : null,
          backlinkToxicity: Number(strategicData?.domain_authority?.toxicity?.toxicity_score) || null,
        };

        // Rédaction du verdict : les faits restent déterministes, la formulation
        // varie d'un audit à l'autre (angle tiré au sort, chiffres contrôlés).
        // Tout écart retombe automatiquement sur le paragraphe déterministe.
        const narratedVerdict = await narrateStrategicVerdict(domain, verdictSignals, {
          lang: detectedLang,
          seed: `${url}|${crawlSnapshot?.id || ''}`,
        });

        html = compileMarinaReport(
          {
            crawl: crawlHTML, tech: techHTML, strategic: strategicHTML, cocoon: cocoonHTML,
            indexation: indexationHTML || undefined, consolidatedPlan: consolidatedPlanHTML,
            ownerPerformance: ownerPerformanceHTML || undefined,
            pageVerdict: pageVerdict.html,
            cocoonPage: cocoonPageHTML || undefined,
            visual: buildVisualEvidenceHtml(visualCapture, detectedLang),
            summary: buildExecutiveSummaryHTML(detectedLang, domain, {
              expertData, strategicData, crawlSnapshot, degraded: strategicDegradation.degraded,
              criticalCount: (consolidatedPlan || []).filter((i: any) => i.severity === 'critical').length,
              roi: roiSummary,
              verdictSignals,
              verdictHtml: narratedVerdict.html,
            }),


            intro: buildReportIntroHTML(detectedLang, domain, {
              expertData, strategicData, crawlSnapshot, llmVisibilityData,
              indexationCount: indexationData.length,
              visual: Boolean(visualCapture),
              plan: consolidatedPlan,
              scanMode: scanModeInfo,
              roi: roiSummary,
            }),

            // Carte d'identité résolue AVANT le crawl : elle explique au lecteur sur
            // quelle lecture du business les fourchettes de gabarits ont été calées,
            // et signale une éventuelle contradiction avec ce que le crawl a trouvé.
            identity: revisedIdentity
              ? renderIdentityCardHTML(
                  revisedIdentity,
                  detectedLang,
                  detectIdentityContradiction(revisedIdentity, archetypeAnalysis?.mix ?? null),
                  // Concurrents détectés par l'analyse de marché : la carte ne peut
                  // plus afficher « Non résolu » quand la section GEO en nomme.
                  ['leader', 'direct_competitor', 'challenger', 'inspiration_source']
                    .map((k) => strategicData?.competitive_landscape?.[k]?.name)
                    .map((n: unknown) => (typeof n === 'string' ? n.trim() : ''))
                    .filter(Boolean),
                )
              : undefined,
            archetypes: archetypeAnalysis ? renderPageArchetypesHTML(archetypeAnalysis, domain) : undefined,
            conclusion: buildConclusionHTML(detectedLang, domain, consolidatedPlan, archetypeAnalysis, roiSummary),

            // « Divulgation méthodologique » supprimée : forces / faiblesses / angles morts
            // faisaient doublon avec « Portée et limites », qui est désormais l'unique
            // section méthodologique de fin de rapport (angles morts inclus).
            scopeLimits: renderScopeLimitsHTML({
              domain,
              url,
              lang: detectedLang,
              pagesAnalyzed: crawlSnapshot?.crawled_pages || crawlSnapshot?.pages?.length || null,
              pagesKnown: crawlSnapshot?.total_pages || null,
              singlePage: !(crawlSnapshot?.crawled_pages || crawlSnapshot?.pages?.length),
              analyzedAt: new Date().toISOString(),
              authority:
                strategicData?.domain_authority && strategicData.domain_authority.data_source !== 'unavailable'
                  ? strategicData.domain_authority
                  : null,
              blockers: buildCrawlabilityBlockers(detectedLang, { expertData, crawlSnapshot }),
            }),
          },

          detectedLang, domain, url, marinaBranding,
        );

        console.log(`[Marina] Compiled report from 4 sections + consolidated plan`);


        Promise.allSettled(
          storageUploads.map(({ path }) => sb.storage.from('shared-reports').remove([path]))
        ).catch(() => {});

      } catch (compileError) {
        console.warn(`[Marina] Compilation failed, falling back to legacy generator:`, compileError);
        html = sanitizeMarinaHtml(
          generateLegacyMarinaReport(url, domain, detectedLang, expertData, strategicData, cocoonResult, marinaBranding),
          { keepColors: Boolean(marinaBranding?.enabled && marinaBranding?.fullWhiteLabel) },
        );
      }

      // Bandeau « couche stratégique indisponible » (les deux générateurs).
      if (strategicDegradation.degraded) {
        html = injectDegradedBanner(
          html,
          buildStrategicDegradedBannerHTML(detectedLang, strategicDegradation.reasons),
        );
        console.warn(`[Marina] Strategic layer degraded for ${domain}: ${strategicDegradation.reasons.join(' | ')}`);
      }

      // ─── Lot 4 : réconciliation finale des chiffres et des conclusions ───
      // Le graphe cocoon fait foi pour les pages orphelines, et la conclusion
      // « profil de liens sain / aucun désaveu » est interdite dès qu'une
      // toxicité est mesurée sur le profil de backlinks.
      {
        const orphanCount = resolveOrphanCount(cocoonResult);
        const toxicity = resolveToxicity(strategicData?.domain_authority);
        const identityUsability = assessIdentityUsability(revisedIdentity ?? null);
        if (!identityUsability.usable) {
          console.log(`[Marina] Identité partiellement résolue : ${identityUsability.notes.join(' | ')}`);
        }
        // Web Vitals : la mesure Lighthouse est la source unique, tout le
        // document est réécrit au format canonique « X,XX s ».
        const perf = expertData?.scores?.performance ?? null;
        html = reconcileReportHtml(html, {
          orphanCount,
          toxicity,
          webVitals: perf
            ? { lcp: perf.lcp, fcp: perf.fcp, inp: perf.inp, tbt: perf.tbt, ttfb: perf.ttfb }
            : null,
        });
        console.log(
          `[Marina] Réconciliation : orphelines=${orphanCount ?? 'n/d'}, toxicité=${toxicity.score ?? 'n/d'} (désaveu interdit: ${toxicity.disavowClaimForbidden})`,
        );
      }




      // ─── Step 5: Store in shared-reports bucket ───
      const fileName = `marina/${jobId}.html`;

      // First upload without the meta tag to get the signed URL
      const { error: uploadError } = await sb.storage
        .from('shared-reports')
        .upload(fileName, new Blob([html], { type: 'text/html' }), {
          contentType: 'text/html',
          upsert: true,
        });

      if (uploadError) {
        console.error(`[Marina] Upload error:`, uploadError);
      }

      // Signature du rapport : une seule tentative silencieuse laissait le job
      // sans report_url. On réessaie et on trace explicitement l'échec.
      let signedUrlData: { signedUrl: string } | null = null;
      for (let attempt = 1; attempt <= 3 && !signedUrlData?.signedUrl; attempt++) {
        const { data: signed, error: signError } = await sb.storage
          .from('shared-reports')
          .createSignedUrl(fileName, 7 * 24 * 60 * 60);
        if (signed?.signedUrl) {
          signedUrlData = signed as { signedUrl: string };
          break;
        }
        console.warn(`[Marina] createSignedUrl attempt ${attempt} failed: ${signError?.message || 'unknown'}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
      if (!signedUrlData?.signedUrl) {
        console.error(`[Marina] ❌ report_url indisponible pour ${jobId} (HTML présent: ${fileName})`);
      }


      // Lien court à partager : les URLs signées Storage font ~700 caractères
      // (jeton JWT inclus) et sont illisibles. `/r/<8 premiers caractères de
      // l'identifiant>` est servi par notre domaine en text/html.
      const reportShortUrl = `https://crawlers.fr/r/${jobId.slice(0, 8)}`;
      
      html = html.replace('</head>', `<meta name="marina-report-url" content="${reportShortUrl}" />\n</head>`);
      await sb.storage
        .from('shared-reports')
        .upload(fileName, new Blob([html], { type: 'text/html' }), {
          contentType: 'text/html',
          upsert: true,
        });

      const resultData = {
        url,
        domain,
        language: detectedLang,
        report_url: signedUrlData?.signedUrl || null,
        // Lecteur HTML sur notre domaine : les URLs signées Storage sont servies
        // en text/plain + nosniff et afficheraient le code source du rapport.
        report_view_url: reportShortUrl,
        report_long_view_url: `https://crawlers.fr/api/public/marina-report?id=${jobId}`,

        report_path: fileName,
        expert_seo_score: expertData.totalScore,
        expert_seo_max: expertData.maxScore,
        strategic_score: strategicData?.overallScore || null,
        cocoon_nodes: cocoonResult?.stats?.nodes_count || null,
        cocoon_clusters: cocoonResult?.stats?.clusters_count || null,
        visual_capture: visualCapture,
        strategic_layer: strategicDegradation.degraded ? 'unavailable' : 'ok',
        partial: strategicDegradation.degraded || llmPendingAtRender.length > 0,
        llm_measurement_complete: llmPendingAtRender.length === 0,
        llm_pending_models: llmPendingAtRender,
        degraded_reasons: [
          ...(strategicDegradation.degraded ? strategicDegradation.reasons : []),
          ...(llmPendingAtRender.length > 0
            ? [`Réponses IA non compilées : ${llmPendingAtRender.join(', ')}`]
            : []),
        ],
        generated_at: new Date().toISOString(),
      };

      // Un rapport dont les réponses IA ne sont ni reçues ni compilées dans les
      // scores ne peut pas être déclaré « terminé » : il reste « partial ».
      const isIncomplete = strategicDegradation.degraded || llmPendingAtRender.length > 0;
      await sb.from('async_jobs').update({
        status: isIncomplete ? 'partial' : 'completed',
        result_data: resultData,
        progress: 100,
        error_message: isIncomplete
          ? (resultData.degraded_reasons as string[]).join(' | ')
          : null,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      // Nettoyage des checkpoints seulement après finalisation du rapport.
      await sb.from('audit_cache').delete()
        .in('cache_key', [`marina_intermediate_${jobId}`, `marina_phase1a_${jobId}`]);

      console.log(`[Marina] ✅ Phase 3 complete — pipeline finished for ${domain}`);

      // Trigger next queued job
      await triggerNextPendingJob();

      // ─── Webhook callback ───
      try {
        const { data: completedJob } = await sb.from('async_jobs')
          .select('input_payload')
          .eq('id', jobId)
          .single();
        const callbackUrl = (completedJob?.input_payload as any)?.callback_url;
        if (callbackUrl) {
          console.log(`[Marina] 📡 Sending webhook to ${callbackUrl}`);
          const eventName = isIncomplete ? 'marina.report.partial' : 'marina.report.completed';
          const webhookPayload = {
            event: eventName,
            job_id: jobId,
            ...resultData,
          };
          const cbRes = await fetch(callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-marina-event': eventName },
            body: JSON.stringify(webhookPayload),
          });
          console.log(`[Marina] Webhook response: ${cbRes.status}`);
        }

      } catch (webhookErr) {
        console.warn('[Marina] Webhook delivery failed:', webhookErr);
        // Non-blocking: don't fail the job if webhook fails
      }

      // ─── Step 5bis: Données brutes en BDD pour CHAQUE URL du batch ───
      // Sans cette écriture, seules les URLs passées par le crawl multi-pages
      // laissaient une trace dans audit_raw_data (recalcul impossible ensuite).
      await saveRawAuditData({
        userId: parentJob.user_id,
        url,
        domain,
        auditType: 'marina',
        rawPayload: {
          expert: {
            totalScore: expertData?.totalScore ?? null,
            maxScore: expertData?.maxScore ?? null,
            scores: expertData?.scores || {},
            recommendations: expertData?.recommendations || [],
          },
          strategic: {
            overallScore: strategicData?.overallScore ?? null,
            scores: strategicData?.scores || {},
            executive_roadmap: strategicData?.executive_roadmap || [],
            keyword_positioning: strategicData?.keyword_positioning || null,
          },
          llm_visibility: llmVisibilityData || null,
          cocoon: cocoonResult ? { stats: cocoonResult.stats || {}, cluster_summary: cocoonResult.cluster_summary || {} } : null,
          crawl_snapshot: crawlSnapshot ? { crawled_pages: crawlSnapshot.crawled_pages, total_pages: crawlSnapshot.total_pages } : null,
          report_path: fileName,
          job_id: jobId,
        },
        sourceFunctions: ['marina', 'expert-audit', 'audit-strategique-ia'],
      }).catch((e) => console.warn('[Marina] saveRawAuditData failed (non-fatal):', e));

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

    // ─── Webhook d'échec (marina.report.failed) ───
    // Manquait totalement : les clients API n'étaient jamais notifiés d'un échec
    // et devaient deviner via polling.
    try {
      const { data: failedJob } = await sb.from('async_jobs')
        .select('input_payload')
        .eq('id', jobId)
        .single();
      const callbackUrl = (failedJob?.input_payload as any)?.callback_url;
      if (callbackUrl) {
        const cbRes = await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-marina-event': 'marina.report.failed' },
          body: JSON.stringify({
            event: 'marina.report.failed',
            job_id: jobId,
            url,
            domain: (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } })(),

            phase: currentPhase,
            error: error instanceof Error ? error.message : 'Pipeline failed',
            failed_at: new Date().toISOString(),
          }),
        });
        console.log(`[Marina] Webhook (failed) response: ${cbRes.status}`);
      }
    } catch (webhookErr) {
      console.warn('[Marina] Webhook (failed) delivery error:', webhookErr);
    }



    // Trigger next queued job even on failure
    await triggerNextPendingJob();
  }
}

// ─── Queue: concurrence Marina ───
/** Nombre de jobs Marina exécutés simultanément (limité par les 7 slots Browserless). */
const MAX_CONCURRENT_MARINA = 3;
/** Plafond par utilisateur, pour qu'un compte ne monopolise pas la file. */
const MAX_CONCURRENT_PER_USER = 2;

async function countProcessing(sb: any, userId?: string | null): Promise<number> {
  let q = sb
    .from('async_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('function_name', 'marina')
    .eq('status', 'processing');
  if (userId) q = q.eq('user_id', userId);
  const { count } = await q;
  return count || 0;
}

// ─── Queue: trigger next pending Marina job(s) ───
async function triggerNextPendingJob() {
  try {
    const sb = getServiceClient();

    let freeSlots = MAX_CONCURRENT_MARINA - (await countProcessing(sb));
    if (freeSlots <= 0) {
      console.log('[Marina] 🔄 Queue: all slots busy, skipping');
      return;
    }

    // Find oldest pending jobs
    const { data: next } = await sb
      .from('async_jobs')
      .select('id, user_id, input_payload')
      .eq('function_name', 'marina')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (!next || next.length === 0) {
      console.log('[Marina] 🔄 Queue: no pending jobs');
      return;
    }

    const perUser = new Map<string, number>();

    for (const nextJob of next) {
      if (freeSlots <= 0) break;
      const uid = String((nextJob as any).user_id || '');
      if (uid) {
        let used = perUser.get(uid);
        if (used === undefined) {
          used = await countProcessing(sb, uid);
          perUser.set(uid, used);
        }
        if (used >= MAX_CONCURRENT_PER_USER) continue;
        perUser.set(uid, used + 1);
      }

      const payload = (nextJob as any).input_payload as any;
      console.log(`[Marina] 🔄 Queue: starting next pending job ${nextJob.id} (${payload?.url})`);
      freeSlots--;

      fetch(`${SUPABASE_URL}/functions/v1/marina`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'run_job', job_id: nextJob.id, url: payload?.url, lang: payload?.lang || null }),
      }).catch(err => {
        console.error('[Marina] Queue: self-invocation for next job failed:', err);
      });
    }
  } catch (e) {
    console.warn('[Marina] Queue: triggerNextPendingJob error:', e);
  }
}


// ─── Main server ───
Deno.serve(handleRequest(async (req) => {
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
        // Authenticated user: generate a Marina API key for their account
        const authHeader = req.headers.get('Authorization') || '';
        if (!authHeader) return json({ error: 'Unauthorized' }, 401);
        
        const { createClient } = await import('npm:@supabase/supabase-js@2');
        const userSb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userSb.auth.getUser();
        if (!user) return json({ error: 'Unauthorized' }, 401);
        
        const key = generateApiKey();
        // Upsert into marina_api_keys table
        const { error: insertError } = await sb
          .from('marina_api_keys')
          .upsert({ user_id: user.id, api_key: key, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        
        if (insertError) {
          console.error('[Marina] Failed to store key:', insertError);
          return json({ error: 'Failed to store key' }, 500);
        }
        
        return json({ success: true, key });
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
      
      if (job.status === 'completed' || job.status === 'partial') {
        // `partial` = rapport livré mais couche stratégique (GEO) indisponible.
        return json({
          success: true,
          data: job.result_data,
          status: job.status,
          ...(job.status === 'partial' ? { warning: job.error_message || 'Couche stratégique indisponible' } : {}),
        });
      }
      if (job.status === 'failed') {
        return json({ success: false, error: job.error_message, status: 'failed' });
      }
      
      return json({ 
        status: job.status, 
        progress: job.progress,
        phase: (job.input_payload as any)?.phase || 'initializing',
        scan_mode: (job.input_payload as any)?.scan_mode || null,
        pages_crawled: (job.input_payload as any)?.pages_crawled ?? null,
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
      const { data: keyRow } = await sb
        .from('marina_api_keys')
        .select('user_id')
        .eq('api_key', apiKey)
        .single();
      
      if (keyRow) {
        isAuthorized = true;
        userId = keyRow.user_id;
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
          isAuthorized = true;
          userId = user.id;
        }
      }
    }

    if (!isAuthorized || !userId) {
      return json({ error: 'Unauthorized. Use x-marina-key header or authenticate.' }, 401);
    }

    // ── Carte d'identité : édition / verrouillage AVANT le crawl ──
    // identity_resolve   : résolution (réutilise la base, sinon inférence légère)
    // identity_recompute : recalcul déterministe des axes depuis les champs édités (0 token, 0 écriture)
    // identity_lock      : persistance en source `user_manual`, qui prime ensuite sur toute inférence
    if (typeof body.action === 'string' && body.action.startsWith('identity_')) {
      const identityOptions = {
        sectors: SECTOR_OPTIONS,
        commercialModels: COMMERCIAL_MODEL_OPTIONS,
      };

      if (body.action === 'identity_options') {
        return json({ success: true, options: identityOptions });
      }

      const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
      let parsedIdentityUrl: URL;
      try {
        parsedIdentityUrl = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
        if (!['http:', 'https:'].includes(parsedIdentityUrl.protocol)) throw new Error('protocole invalide');
      } catch {
        return json({ error: 'url invalide' }, 400);
      }
      const identityDomain = parsedIdentityUrl.hostname.replace(/^www\./, '');

      const clean = (v: unknown, max = 400): string | null => {
        const s = typeof v === 'string' ? v.trim() : '';
        return s.length >= 2 ? s.slice(0, max) : null;
      };
      const raw = (body.fields || {}) as Record<string, unknown>;
      const overrides = {
        sector: clean(raw['sector'], 60),
        commercialModel: clean(raw['commercialModel'], 60),
        marketSector: clean(raw['marketSector']),
        productsServices: clean(raw['productsServices'], 600),
        targetAudience: clean(raw['targetAudience'], 600),
        commercialArea: clean(raw['commercialArea']),
        entityType: clean(raw['entityType'], 120),
        isLocalBusiness: typeof raw['isLocalBusiness'] === 'boolean' ? (raw['isLocalBusiness'] as boolean) : null,
        competitors: Array.isArray(raw['competitors'])
          ? (raw['competitors'] as unknown[]).map((c) => String(c).trim()).filter(Boolean).slice(0, 6)
          : [],
      };

      // Le texte stocké dans market_sector doit se re-normaliser vers la clé choisie.
      const chosenSector = SECTOR_OPTIONS.find((s) => s.key === overrides.sector);
      const sectorKey = chosenSector ? chosenSector.key : normalizeSector(overrides.marketSector);
      const sectorText = chosenSector ? chosenSector.canonicalText : overrides.marketSector;
      const chosenModel = COMMERCIAL_MODEL_OPTIONS.find((m) => m.key === overrides.commercialModel);
      const modelKey = chosenModel
        ? chosenModel.key
        : normalizeCommercialModel({
            commercial_model: overrides.commercialModel,
            business_type: overrides.entityType,
            entity_type: overrides.entityType,
            is_local_business: overrides.isLocalBusiness,
            sector: sectorKey,
          });

      if (body.action === 'identity_recompute') {
        let confidence = 0;
        if (sectorKey !== 'unknown') confidence += 35;
        if (modelKey !== 'unknown') confidence += 35;
        if (overrides.productsServices) confidence += 15;
        if (overrides.targetAudience) confidence += 8;
        if (overrides.commercialArea) confidence += 7;

        const notes: string[] = [];
        if (sectorKey === 'unknown') notes.push("Secteur non résolu : les fourchettes de mix de pages resteront génériques.");
        if (modelKey === 'unknown') notes.push("Modèle d'affaires non résolu : la calibration par modèle ne sera pas appliquée.");
        notes.push("Prévisualisation non enregistrée : verrouillez la carte pour qu'elle soit utilisée par l'audit.");

        const preview: IdentityCard = {
          domain: identityDomain,
          trackedSiteId: null,
          source: sectorKey === 'unknown' && modelKey === 'unknown' ? 'unresolved' : 'identity_card',
          reused: false,
          resolvedAt: new Date().toISOString(),
          confidence: Math.min(100, confidence),
          sector: sectorKey,
          sectorLabelText: sectorLabel(sectorKey),
          commercialModel: modelKey,
          commercialModelLabelText: commercialModelLabel(modelKey),
          marketSector: sectorText,
          productsServices: overrides.productsServices,
          targetAudience: overrides.targetAudience,
          secondaryAudience: null,
          commercialArea: overrides.commercialArea,
          entityType: overrides.entityType,
          isLocalBusiness: overrides.isLocalBusiness,
          competitors: overrides.competitors,
          pagesUsed: [],
          notes,
        };
        return json({ success: true, card: preview, locked: false, options: identityOptions });
      }

      if (body.action === 'identity_lock') {
        // Un site suivi est nécessaire pour persister la carte.
        let trackedSiteId: string | null = null;
        try {
          const { data: existing } = await sb
            .from('tracked_sites')
            .select('id')
            .eq('user_id', userId)
            .eq('domain', identityDomain)
            .limit(1);
          trackedSiteId = existing?.[0]?.id ? String(existing[0].id) : null;
          if (!trackedSiteId) {
            const { data: created, error: insErr } = await sb
              .from('tracked_sites')
              .insert({ user_id: userId, domain: identityDomain, site_name: identityDomain })
              .select('id')
              .single();
            if (insErr) throw insErr;
            trackedSiteId = String((created as any).id);
          }
        } catch (e) {
          return json({ error: `Site suivi indisponible : ${String((e as Error)?.message || e)}` }, 500);
        }

        const write: Record<string, unknown> = {};
        if (sectorText) write['market_sector'] = sectorText;
        if (modelKey !== 'unknown') write['commercial_model'] = modelKey;
        if (overrides.productsServices) write['products_services'] = overrides.productsServices;
        if (overrides.targetAudience) write['target_audience'] = overrides.targetAudience;
        if (overrides.commercialArea) write['commercial_area'] = overrides.commercialArea;
        if (overrides.entityType) write['entity_type'] = overrides.entityType;
        if (typeof overrides.isLocalBusiness === 'boolean') write['is_local_business'] = overrides.isLocalBusiness;
        if (overrides.competitors.length) write['competitors'] = overrides.competitors;

        if (Object.keys(write).length === 0) {
          return json({ error: 'Aucun champ exploitable à verrouiller.' }, 400);
        }

        const writeResult = await writeIdentity({
          siteId: trackedSiteId,
          fields: write,
          source: 'user_manual',
          userId,
          forceDirectWrite: true,
          forceOverwrite: true,
        });

        const lockedCard = await resolveIdentityCard(sb, {
          domain: identityDomain,
          url: parsedIdentityUrl.toString(),
          userId,
          trackedSiteId,
        });
        if (writeResult.rejected.length) {
          lockedCard.notes.push(`Champs non enregistrés : ${writeResult.rejected.join(', ')}.`);
        }
        return json({
          success: true,
          card: lockedCard,
          locked: true,
          applied: writeResult.applied,
          options: identityOptions,
        });
      }

      // identity_resolve
      let resolved: IdentityCard;
      try {
        resolved = await resolveIdentityCard(sb, {
          domain: identityDomain,
          url: parsedIdentityUrl.toString(),
          userId,
          forceRefresh: body.force === true,
        });
      } catch (e) {
        resolved = emptyIdentityCard(identityDomain, null, [String((e as Error)?.message || e)]);
      }

      let locked = false;
      try {
        const { data: srcRow } = await sb
          .from('tracked_sites')
          .select('identity_source')
          .eq('user_id', userId)
          .eq('domain', identityDomain)
          .limit(1);
        locked = String(srcRow?.[0]?.identity_source || '') === 'user_manual';
      } catch { /* non critique */ }

      return json({ success: true, card: resolved, locked, options: identityOptions });
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

    // ── Reprise manuelle d'un job interrompu ──
    if (body.action === 'resume_job' && body.job_id) {
      const res = await resumeJobFromCheckpoint(body.job_id);
      return json({ success: res.resumed, ...res });
    }

    // ── Auto-cleanup : tente d'abord de REPRENDRE les jobs interrompus depuis
    // leur checkpoint de phase (un run tué par le wall-time laisse le job muet
    // mais parfaitement reprenable) ; on n'échoue que ceux qui n'ont plus de
    // checkpoint exploitable ou qui ont épuisé leurs reprises.
    try {
      // Un job Marina enchaîne plusieurs phases (chaque phase touche updated_at) :
      // au-delà de 6 minutes sans progression, le run a été tué → on reprend.
      const stalledSince = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      const { data: stalledJobs } = await sb
        .from('async_jobs')
        .select('id')
        .eq('function_name', 'marina')
        .eq('status', 'processing')
        .lt('updated_at', stalledSince)
        .limit(5);

      for (const stalled of stalledJobs || []) {
        const res = await resumeJobFromCheckpoint(stalled.id);
        if (!res.resumed) {
          await sb
            .from('async_jobs')
            .update({
              status: 'failed',
              error_message: res.reason === 'max_resumes_reached'
                ? 'Job interrompu : nombre maximum de reprises atteint'
                : 'Timeout: job sans progression et sans point de reprise',
              completed_at: new Date().toISOString(),
            })
            .eq('id', stalled.id)
            .eq('function_name', 'marina')
            .eq('status', 'processing');
        }
      }

      // Des slots libres ? On remplit la file au lieu d'attendre.
      await triggerNextPendingJob();

    } catch (e) {
      console.warn('[Marina] Auto-cleanup failed:', e);
    }

    // ── Watchdog appelé par le cron : la reprise ci-dessus a déjà tourné ──
    if (body.action === 'reap_jobs') {
      return json({ success: true, reaped: true });
    }






    // ── Start new pipeline ──
    const { url: targetUrl, lang, callback_url } = body;
    if (!targetUrl) return json({ error: 'url is required' }, 400);

    // Validate callback_url if provided
    if (callback_url) {
      try {
        const cbUrl = new URL(callback_url);
        if (!['http:', 'https:'].includes(cbUrl.protocol)) {
          return json({ error: 'callback_url must be http or https' }, 400);
        }
      } catch {
        return json({ error: 'callback_url is not a valid URL' }, 400);
      }
    }

    // Create async job
    const { data: job, error: jobError } = await sb
      .from('async_jobs')
      .insert({
        user_id: userId,
        function_name: 'marina',
        status: 'pending',
        input_payload: { url: targetUrl, lang: lang || null, callback_url: callback_url || null },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return json({ error: 'Failed to create job' }, 500);
    }

    // ── Queue-aware launch: jusqu'à MAX_CONCURRENT_MARINA jobs en parallèle ──
    const globalRunning = await countProcessing(sb);
    const userRunning = userId ? await countProcessing(sb, userId) : 0;
    const mustQueue = globalRunning >= MAX_CONCURRENT_MARINA
      || (userId ? userRunning >= MAX_CONCURRENT_PER_USER : false);

    if (mustQueue) {
      console.log(`[Marina] 🔄 Queue: job ${job.id} en file (global ${globalRunning}/${MAX_CONCURRENT_MARINA}, user ${userRunning}/${MAX_CONCURRENT_PER_USER})`);
      const { count } = await sb
        .from('async_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('function_name', 'marina')
        .eq('status', 'pending')
        .lt('created_at', new Date().toISOString());

      return json({ job_id: job.id, status: 'queued', queue_position: count || 1 });
    }


    // No running job — start immediately
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
}, 'marina'))
