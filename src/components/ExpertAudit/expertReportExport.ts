import { ExpertAuditResult } from '@/types/expertAudit';
import { generateRadialChartSVG } from './AuditRadialChart';
import { supabase } from '@/integrations/supabase/client';
export const expertReportTranslations = {
  fr: {
    title: "Rapport d'Audit Expert",
    download: 'Télécharger .pdf',
    share: 'Lien temporaire',
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
    strategic: 'Audit Stratégique',
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
    share: 'Temporary link',
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
    strategic: 'Strategic Audit',
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
    share: 'Enlace temporal',
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
    strategic: 'Auditoría Estratégica',
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

export interface WhiteLabelBranding {
  logoUrl?: string | null;
  primaryColor?: string | null;
}

// Reusable i18n labels for the HTML report content
function getReportLabels(language: string) {
  const l = {
    fr: {
      priority: 'Priorité', recommendation: 'Recommandation', brokenLinksDetected: 'Liens cassés détectés',
      brokenOf: 'lien(s) cassé(s) sur', checked: 'vérifiés', noBrokenLinks: 'Aucun lien cassé détecté',
      contentQuality: 'Signaux de Qualité du Contenu', freshness: 'Preuve de Vie (Freshness)',
      currentYear: 'Année courante', conversionFriction: 'Friction de Conversion',
      forms: 'Formulaires', fieldsPerForm: 'Champs / formulaire',
      marketVolume: 'Volume marché / mois', keywordsRanked: 'Mots-clés classés', avgPosition: 'Position moyenne',
      topKeywords: 'Top mots-clés (volume, difficulté, position)',
      keyword: 'Mot-clé', volume: 'Volume', difficulty: 'Difficulté', position: 'Position',
      noKeywordData: "Aucune donnée de mots-clés n'a été fournie pour ce rapport.",
      quickWins: 'Quick wins (positions 11–20)', contentGaps: 'Gaps de contenu (opportunités)',
      keywordRecommendations: 'Recommandations mots-clés',
      archetype: 'Archétype', clarity: 'Clarté', perceivedValues: 'Valeurs perçues',
      brandAuthority: 'Autorité de Marque', entityStrength: "Force de l'entité",
      competitiveLandscape: 'Écosystème Concurrentiel',
      role: 'Rôle', actor: 'Acteur', analysis: 'Analyse',
      directCompetitor: 'Concurrent direct',
      socialSignals: 'Signaux Sociaux & Autorité', recognition: 'Reconnaissance',
      overallSentiment: 'Sentiment global', hallucinationRisk: 'Risque hallucination',
      platform: 'Plateforme', presence: 'Présence',
      marketIntelligence: 'Intelligence de Marché', sophisticationLevel: 'Niveau de sophistication',
      llmVisibility: 'Visibilité LLM', cited: 'Cité', invisible: 'Invisible', summary: 'Résumé',
      geoReadiness: 'Préparation GEO', citability: 'Citabilité', aiAccess: 'Accessibilité IA', aiFormats: 'Formats IA',
      titleH1: 'Cohérence Title/H1', contentFreshness: 'Fraîcheur', missingFormats: 'Formats manquants',
      executiveRoadmap: 'Feuille de Route Exécutive',
      quotabilityIndex: 'Indice de Citabilité', summaryResilience: 'Résilience au Résumé',
      originalH1: 'H1 original', llmSummary: 'Résumé LLM',
      lexicalFootprint: 'Empreinte Lexicale', jargon: 'Jargon', concrete: 'Concret',
      expertiseSentiment: "Sentiment d'Expertise (E-E-A-T)",
      expertiseLabels: ['', 'Générique / IA', 'Peu incarné', 'Modéré', 'Expérimenté', 'Expert de terrain'],
      redTeam: 'Red Team : Objections Non Adressées',
      redTeamNote: "Analyse adversariale : objections qu'un prospect sceptique soulèverait.",
      action: 'Action', objective: 'Objectif',
    },
    en: {
      priority: 'Priority', recommendation: 'Recommendation', brokenLinksDetected: 'Broken Links Detected',
      brokenOf: 'broken link(s) out of', checked: 'checked', noBrokenLinks: 'No broken links detected',
      contentQuality: 'Content Quality Signals', freshness: 'Freshness Signals',
      currentYear: 'Current year', conversionFriction: 'Conversion Friction',
      forms: 'Forms', fieldsPerForm: 'Fields / form',
      marketVolume: 'Market volume / month', keywordsRanked: 'Keywords ranked', avgPosition: 'Average position',
      topKeywords: 'Top keywords (volume, difficulty, position)',
      keyword: 'Keyword', volume: 'Volume', difficulty: 'Difficulty', position: 'Position',
      noKeywordData: 'No keyword data was provided for this report.',
      quickWins: 'Quick wins (positions 11–20)', contentGaps: 'Content gaps (opportunities)',
      keywordRecommendations: 'Keyword recommendations',
      archetype: 'Archetype', clarity: 'Clarity', perceivedValues: 'Perceived values',
      brandAuthority: 'Brand Authority', entityStrength: 'Entity Strength',
      competitiveLandscape: 'Competitive Landscape',
      role: 'Role', actor: 'Actor', analysis: 'Analysis',
      directCompetitor: 'Direct Competitor',
      socialSignals: 'Social Signals & Authority', recognition: 'Recognition',
      overallSentiment: 'Sentiment', hallucinationRisk: 'Hallucination Risk',
      platform: 'Platform', presence: 'Presence',
      marketIntelligence: 'Market Intelligence', sophisticationLevel: 'Sophistication',
      llmVisibility: 'LLM Visibility', cited: 'Cited', invisible: 'Invisible', summary: 'Summary',
      geoReadiness: 'GEO Readiness', citability: 'Citability', aiAccess: 'AI Access', aiFormats: 'AI Formats',
      titleH1: 'Title/H1', contentFreshness: 'Freshness', missingFormats: 'Missing',
      executiveRoadmap: 'Executive Roadmap',
      quotabilityIndex: 'Quotability Index', summaryResilience: 'Summary Resilience',
      originalH1: 'Original H1', llmSummary: 'LLM Summary',
      lexicalFootprint: 'Lexical Footprint', jargon: 'Jargon', concrete: 'Concrete',
      expertiseSentiment: 'Expertise Sentiment (E-E-A-T)',
      expertiseLabels: ['', 'Generic / AI', 'Shallow', 'Moderate', 'Experienced', 'Field expert'],
      redTeam: 'Red Team: Unaddressed Objections',
      redTeamNote: 'Adversarial analysis: objections a skeptical prospect would raise.',
      action: 'Action', objective: 'Objective',
    },
    es: {
      priority: 'Prioridad', recommendation: 'Recomendación', brokenLinksDetected: 'Enlaces rotos detectados',
      brokenOf: 'enlace(s) roto(s) de', checked: 'verificados', noBrokenLinks: 'Ningún enlace roto detectado',
      contentQuality: 'Señales de Calidad del Contenido', freshness: 'Señales de Frescura',
      currentYear: 'Año actual', conversionFriction: 'Fricción de Conversión',
      forms: 'Formularios', fieldsPerForm: 'Campos / formulario',
      marketVolume: 'Volumen de mercado / mes', keywordsRanked: 'Palabras clave posicionadas', avgPosition: 'Posición media',
      topKeywords: 'Palabras clave principales (volumen, dificultad, posición)',
      keyword: 'Palabra clave', volume: 'Volumen', difficulty: 'Dificultad', position: 'Posición',
      noKeywordData: 'No se proporcionaron datos de palabras clave para este informe.',
      quickWins: 'Quick wins (posiciones 11–20)', contentGaps: 'Brechas de contenido (oportunidades)',
      keywordRecommendations: 'Recomendaciones de palabras clave',
      archetype: 'Arquetipo', clarity: 'Claridad', perceivedValues: 'Valores percibidos',
      brandAuthority: 'Autoridad de Marca', entityStrength: 'Fuerza de la entidad',
      competitiveLandscape: 'Ecosistema Competitivo',
      role: 'Rol', actor: 'Actor', analysis: 'Análisis',
      directCompetitor: 'Competidor directo',
      socialSignals: 'Señales Sociales y Autoridad', recognition: 'Reconocimiento',
      overallSentiment: 'Sentimiento general', hallucinationRisk: 'Riesgo de alucinación',
      platform: 'Plataforma', presence: 'Presencia',
      marketIntelligence: 'Inteligencia de Mercado', sophisticationLevel: 'Nivel de sofisticación',
      llmVisibility: 'Visibilidad LLM', cited: 'Citado', invisible: 'Invisible', summary: 'Resumen',
      geoReadiness: 'Preparación GEO', citability: 'Citabilidad', aiAccess: 'Acceso IA', aiFormats: 'Formatos IA',
      titleH1: 'Title/H1', contentFreshness: 'Frescura', missingFormats: 'Faltantes',
      executiveRoadmap: 'Hoja de Ruta Ejecutiva',
      quotabilityIndex: 'Índice de Citabilidad', summaryResilience: 'Resiliencia al Resumen',
      originalH1: 'H1 original', llmSummary: 'Resumen LLM',
      lexicalFootprint: 'Huella Léxica', jargon: 'Jerga', concrete: 'Concreto',
      expertiseSentiment: 'Sentimiento de Expertise (E-E-A-T)',
      expertiseLabels: ['', 'Genérico / IA', 'Poco encarnado', 'Moderado', 'Experimentado', 'Experto de campo'],
      redTeam: 'Red Team: Objeciones No Abordadas',
      redTeamNote: 'Análisis adversarial: objeciones que un prospecto escéptico plantearía.',
      action: 'Acción', objective: 'Objetivo',
    },
  };
  return l[language as keyof typeof l] || l.fr;
}

export function generateExpertReportHTML(
  result: ExpertAuditResult,
  auditMode: 'technical' | 'strategic',
  t: ExpertReportI18n,
  language: string,
  branding?: WhiteLabelBranding
): string {
  const rl = getReportLabels(language);
  const now = new Date(result.scannedAt).toLocaleDateString(
    language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
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
    // Recompute totalScore from sub-scores to guarantee consistency
    const computedTotal = scores.performance.score + scores.technical.score + scores.semantic.score + scores.aiReady.score + scores.security.score;
    const insights = result.insights;
    const crawlersData = result.rawData?.crawlersData;
    const jsonLd = insights?.jsonLdValidation;
    const contentDensity = insights?.contentDensity;
    const linkProfile = insights?.linkProfile;
    const semanticConsistency = insights?.semanticConsistency;

    // Narrative translations
    const nt = language === 'es' ? {
      sectionTitle: 'La Técnica al servicio de la Adquisición (SEO & IA)',
      bloc1: 'Puerta de Entrada & Accesibilidad', bloc2: 'Lenguaje Semántico & Comprensión', bloc3: 'Formato & Extracción',
      robotsTxt: 'Robots.txt', aiBots: 'Bots IA', https: 'HTTPS', safeBrowsing: 'Safe Browsing',
      titleTag: 'Title', metaDesc: 'Meta Desc', h1: 'H1', match: 'Title/H1', schema: 'Schema.org', jsonLd: 'JSON-LD',
      words: 'palabras', textRatio: 'Texto/HTML', links: 'Enlaces', int: 'int.', ext: 'ext.',
      permissive: 'Permisivo', restrictive: 'Restrictivo', chars: 'car.',
    } : language === 'en' ? {
      sectionTitle: 'How Technical SEO Powers Acquisition (SEO & AI)',
      bloc1: 'Bot Gateway & Accessibility', bloc2: 'Semantic Language & Comprehension', bloc3: 'Formatting & Knowledge Extraction',
      robotsTxt: 'Robots.txt', aiBots: 'AI Bots', https: 'HTTPS', safeBrowsing: 'Safe Browsing',
      titleTag: 'Title', metaDesc: 'Meta Desc', h1: 'H1', match: 'Title/H1', schema: 'Schema.org', jsonLd: 'JSON-LD',
      words: 'words', textRatio: 'Text/HTML', links: 'Links', int: 'int.', ext: 'ext.',
      permissive: 'Permissive', restrictive: 'Restrictive', chars: 'chars',
    } : {
      sectionTitle: "La Technique au service de l'Acquisition (SEO & IA)",
      bloc1: "Porte d'Entrée & Accessibilité", bloc2: 'Langage Sémantique & Compréhension', bloc3: 'Formatage & Extraction',
      robotsTxt: 'Robots.txt', aiBots: 'Bots IA', https: 'HTTPS', safeBrowsing: 'Safe Browsing',
      titleTag: 'Title', metaDesc: 'Meta Desc', h1: 'H1', match: 'Title/H1', schema: 'Schema.org', jsonLd: 'JSON-LD',
      words: 'mots', textRatio: 'Texte/HTML', links: 'Liens', int: 'int.', ext: 'ext.',
      permissive: 'Permissif', restrictive: 'Restrictif', chars: 'car.',
    };

    // Compute bloc scores
    const bloc1Items = [scores.aiReady.hasRobotsTxt, scores.aiReady.robotsPermissive, scores.security.isHttps, scores.security.safeBrowsingOk];
    const aiBotsAllowed = crawlersData ? crawlersData.allowedCount : (scores.aiReady.allowsAIBots ? Object.values(scores.aiReady.allowsAIBots).filter(Boolean).length : 0);
    const aiBotsTotal = crawlersData ? crawlersData.bots.length : 6;
    const bloc1Score = Math.round(((bloc1Items.filter(Boolean).length / bloc1Items.length) * 60 + (aiBotsAllowed / Math.max(aiBotsTotal, 1)) * 40));

    const bloc2Items = [
      scores.semantic.hasTitle && scores.semantic.titleLength <= 70,
      scores.semantic.hasMetaDesc, scores.semantic.hasUniqueH1,
      (semanticConsistency?.titleH1Similarity ?? 0) >= 30,
      scores.aiReady.hasSchemaOrg, jsonLd?.valid ?? false,
    ];
    const bloc2Score = Math.round((bloc2Items.filter(Boolean).length / bloc2Items.length) * 100);

    const wordCountOk = scores.semantic.wordCount >= 500;
    const densityOk = (contentDensity?.ratio ?? 0) >= 15;
    const hasLinks = (linkProfile?.total ?? 0) > 0;
    const bloc3Score = Math.round(([wordCountOk, densityOk, hasLinks].filter(Boolean).length / 3) * 100);

    const statusIcon = (ok: boolean | null) => ok === true ? '✅' : ok === false ? '❌' : '⚠️';
    const gaugeColor = (s: number) => s >= 75 ? '#166534' : s >= 45 ? '#92400e' : '#991b1b';
    const gaugeBg = (s: number) => s >= 75 ? '#dcfce7' : s >= 45 ? '#fef3c7' : '#fee2e2';

    const statusRow = (label: string, ok: boolean | null, detail?: string) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
        <span style="color: #6b7280;">${label}</span>
        <span style="display: flex; align-items: center; gap: 6px;">
          ${detail ? `<span style="font-family: monospace; color: #334155; font-size: 11px;">${detail}</span>` : ''}
          <span style="font-size: 13px;">${statusIcon(ok)}</span>
        </span>
      </div>`;

    const miniGauge = (score: number) => {
      const r = 18;
      const circ = 2 * Math.PI * r;
      const clampedScore = Math.max(0, Math.min(100, score));
      const offset = circ - (clampedScore / 100) * circ;
      return `
      <div style="text-align: center; min-width: 52px;">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="${r}" fill="${gaugeBg(score)}" stroke="none" />
          <circle cx="24" cy="24" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="5" />
          <circle cx="24" cy="24" r="${r}" fill="none" stroke="${gaugeColor(score)}" stroke-width="5" stroke-linecap="round"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 24 24)" />
          <text x="24" y="25" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="${gaugeColor(score)}">${score}%</text>
        </svg>
      </div>`;
    };

    const narrativeBloc = (title: string, color: string, bgColor: string, score: number, rows: string) => `
      <div style="background: ${bgColor}; padding: 14px 16px; border-radius: 10px; border-left: 3px solid ${color}; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 13px; font-weight: 600; color: ${color};">${title}</div>
          ${miniGauge(score)}
        </div>
        ${rows}
      </div>`;

    // Performance details from rawData (null-safe defaults)
    const psiPerf = scores.performance.psiPerformance ?? 0;
    const lcp = scores.performance.lcp ?? 0;
    const cls = scores.performance.cls ?? 0;
    const tbt = scores.performance.tbt ?? 0;
    const fcp = (result.rawData as any)?.fcp ?? 0;
    const si = (result.rawData as any)?.speedIndex ?? 0;

    // Broken links
    const brokenCount = scores.technical.brokenLinksCount ?? 0;
    const brokenChecked = scores.technical.brokenLinksChecked ?? 0;

    // Load previous audit data from localStorage for progression overlay
    const prevTechKey = `crawlers_prev_audit_${result.domain}_technical`;
    let prevTechData = null;
    try { const raw = localStorage.getItem(prevTechKey); if (raw) prevTechData = JSON.parse(raw); } catch {}

    content = `
      <!-- Radial Quality Score Chart -->
      ${generateRadialChartSVG(result, 'technical', language, prevTechData)}




      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 24px; break-inside: avoid; page-break-inside: avoid;">
        ${[
          { s: scores.performance, l: t.performance },
          { s: scores.technical, l: t.technical },
          { s: scores.semantic, l: t.semantic },
          { s: scores.aiReady, l: t.aiReady },
          { s: scores.security, l: t.security },
        ].map(({ s, l }) => `
          <div style="text-align: center; padding: 10px 4px; background: ${getScoreBg(s.score, s.maxScore)}; border-radius: 10px;">
            <div style="font-size: 20px; font-weight: bold; color: ${getScoreColor(s.score, s.maxScore)};">${s.score}/${s.maxScore}</div>
            <div style="color: ${getScoreColor(s.score, s.maxScore)}; font-size: 10px; margin-top: 2px;">${l}</div>
          </div>
        `).join('')}
      </div>

      ${result.introduction ? `
        <div style="background: #f8fafc; padding: 16px; border-radius: 10px; margin-bottom: 20px; border-left: 3px solid #7c3aed;">
          <p style="color: #374151; line-height: 1.6; margin: 0 0 8px 0; font-size: 12px;">${result.introduction.presentation}</p>
          <p style="color: #374151; line-height: 1.6; margin: 0 0 8px 0; font-size: 12px;">${result.introduction.strengths}</p>
          <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 12px;">${result.introduction.improvement}</p>
        </div>
      ` : ''}

      <!-- Performance & Core Web Vitals -->
      <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">${language === 'fr' ? 'Performance & Core Web Vitals' : 'Performance & Core Web Vitals'}</div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid;">
        <div style="padding: 10px; background: ${psiPerf >= 90 ? '#dcfce7' : psiPerf >= 50 ? '#fef3c7' : '#fee2e2'}; border-radius: 10px; text-align: center;">
          <div style="font-size: 11px; color: #6b7280;">Score PSI</div>
          <div style="font-size: 20px; font-weight: 700; color: ${psiPerf >= 90 ? '#166534' : psiPerf >= 50 ? '#92400e' : '#991b1b'};">${psiPerf}%</div>
        </div>
        <div style="padding: 10px; background: ${lcp <= 2500 ? '#dcfce7' : lcp <= 4000 ? '#fef3c7' : '#fee2e2'}; border-radius: 10px; text-align: center;">
          <div style="font-size: 11px; color: #6b7280;">LCP</div>
          <div style="font-size: 20px; font-weight: 700; color: ${lcp <= 2500 ? '#166534' : '#92400e'};">${lcp >= 1000 ? (lcp / 1000).toFixed(1) + 's' : Math.round(lcp) + 'ms'}</div>
        </div>
        <div style="padding: 10px; background: ${cls <= 0.1 ? '#dcfce7' : cls <= 0.25 ? '#fef3c7' : '#fee2e2'}; border-radius: 10px; text-align: center;">
          <div style="font-size: 11px; color: #6b7280;">CLS</div>
          <div style="font-size: 20px; font-weight: 700; color: ${cls <= 0.1 ? '#166534' : '#92400e'};">${cls.toFixed(2)}</div>
        </div>
        <div style="padding: 10px; background: ${tbt <= 200 ? '#dcfce7' : tbt <= 600 ? '#fef3c7' : '#fee2e2'}; border-radius: 10px; text-align: center;">
          <div style="font-size: 11px; color: #6b7280;">TBT</div>
          <div style="font-size: 20px; font-weight: 700; color: ${tbt <= 200 ? '#166534' : '#92400e'};">${tbt >= 1000 ? (tbt / 1000).toFixed(1) + 's' : Math.round(tbt) + 'ms'}</div>
        </div>
      </div>

      <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">${nt.sectionTitle}</div>

      ${narrativeBloc(nt.bloc1, '#7c3aed', '#faf5ff', bloc1Score, [
        statusRow(nt.robotsTxt, scores.aiReady.hasRobotsTxt, scores.aiReady.robotsPermissive ? nt.permissive : scores.aiReady.hasRobotsTxt ? nt.restrictive : undefined),
        statusRow(nt.aiBots, aiBotsAllowed > 0, `${aiBotsAllowed}/${aiBotsTotal}`),
        statusRow(nt.https, scores.security.isHttps),
        statusRow(nt.safeBrowsing, scores.security.safeBrowsingOk),
      ].join(''))}

      ${narrativeBloc(nt.bloc2, '#d97706', '#fffbeb', bloc2Score, [
        statusRow(nt.titleTag, scores.semantic.hasTitle && scores.semantic.titleLength <= 70, scores.semantic.hasTitle ? `${scores.semantic.titleLength} ${nt.chars}` : undefined),
        statusRow(nt.metaDesc, scores.semantic.hasMetaDesc, scores.semantic.hasMetaDesc ? `${scores.semantic.metaDescLength} ${nt.chars}` : undefined),
        statusRow(nt.h1, scores.semantic.hasUniqueH1),
        statusRow(nt.match, semanticConsistency ? semanticConsistency.titleH1Similarity >= 30 : null, semanticConsistency ? `${semanticConsistency.titleH1Similarity}%` : undefined),
        statusRow(nt.schema, scores.aiReady.hasSchemaOrg, scores.aiReady.schemaTypes.length > 0 ? scores.aiReady.schemaTypes.slice(0, 2).join(', ') : undefined),
        statusRow(nt.jsonLd, jsonLd?.valid ?? false, jsonLd ? `${jsonLd.count} script${jsonLd.count > 1 ? 's' : ''}` : undefined),
      ].join(''))}

      ${narrativeBloc(nt.bloc3, '#059669', '#f0fdf4', bloc3Score, [
        statusRow(`${nt.words}`, wordCountOk, `~${scores.semantic.wordCount} ${nt.words}`),
        statusRow(nt.textRatio, densityOk, contentDensity ? `${contentDensity.ratio}%` : undefined),
        statusRow(nt.links, hasLinks, linkProfile ? `${linkProfile.internal} ${nt.int} / ${linkProfile.external} ${nt.ext}` : undefined),
      ].join(''))}

      <!-- Broken Links -->
      ${brokenCount > 0 ? `
        <div style="background: #fef2f2; padding: 14px 16px; border-radius: 10px; border-left: 3px solid #dc2626; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: #dc2626; margin-bottom: 4px;">${rl.brokenLinksDetected}</div>
          <div style="font-size: 12px; color: #991b1b;">${brokenCount} ${rl.brokenOf} ${brokenChecked} ${rl.checked}</div>
        </div>
      ` : `
        <div style="background: #f0fdf4; padding: 10px 16px; border-radius: 10px; border-left: 3px solid #059669; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #166534;">${rl.noBrokenLinks} (${brokenChecked} ${rl.checked})</div>
        </div>
      `}

      ${/* NEW: 3 Technical Metrics in PDF */(() => {
        const html = result.rawData?.htmlAnalysis as any;
        const techSections: string[] = [];

        if (html?.darkSocial) {
          const ds = html.darkSocial;
          const scoreColor = ds.score >= 80 ? '#166534' : ds.score >= 50 ? '#92400e' : '#991b1b';
          techSections.push(`
            <div style="background: #f0f9ff; padding: 14px 16px; border-radius: 10px; border-left: 3px solid #0ea5e9; margin-bottom: 10px; break-inside: avoid;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 13px; font-weight: 600; color: #0c4a6e;">Dark Social Readiness</div>
                <span style="font-size: 16px; font-weight: 700; color: ${scoreColor};">${ds.score}/100</span>
              </div>
              ${statusRow('og:title', !!ds.ogTitle, ds.ogTitle ? String(ds.ogTitle).substring(0, 50) : '—')}
              ${statusRow('og:description', !!ds.ogDescription, ds.ogDescription ? String(ds.ogDescription).substring(0, 50) + '…' : '—')}
              ${statusRow('og:image', !!ds.ogImage)}
              ${statusRow('twitter:card', !!ds.twitterCard, ds.twitterCard || '—')}
            </div>`);
        }

        if (html?.freshnessSignals) {
          const fs = html.freshnessSignals;
          const labelBgs: Record<string, string> = { fresh: '#dcfce7', acceptable: '#fef3c7', stale: '#fee2e2' };
          const labelColors: Record<string, string> = { fresh: '#166534', acceptable: '#92400e', stale: '#991b1b' };
          techSections.push(`
            <div style="background: #f0fdf4; padding: 14px 16px; border-radius: 10px; border-left: 3px solid #059669; margin-bottom: 10px; break-inside: avoid;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 13px; font-weight: 600; color: #065f46;">${rl.freshness}</div>
                <span style="padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${labelBgs[fs.label] || '#f3f4f6'}; color: ${labelColors[fs.label] || '#374151'};">${fs.label}</span>
              </div>
              ${statusRow('Score', fs.score >= 50, fs.score + '/100')}
              ${statusRow('Last-Modified', !!fs.lastModifiedDate, fs.lastModifiedDate || '—')}
              ${statusRow(rl.currentYear, fs.hasCurrentYearMention, fs.currentYearFound || '—')}
            </div>`);
        }

        if (html?.conversionFriction) {
          const cf = html.conversionFriction;
          const frictionBgs: Record<string, string> = { low: '#dcfce7', optimal: '#dcfce7', high: '#fee2e2' };
          const frictionColors: Record<string, string> = { low: '#166534', optimal: '#166534', high: '#991b1b' };
          techSections.push(`
            <div style="background: #faf5ff; padding: 14px 16px; border-radius: 10px; border-left: 3px solid #7c3aed; margin-bottom: 10px; break-inside: avoid;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 13px; font-weight: 600; color: #5b21b6;">${rl.conversionFriction}</div>
                <span style="padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${frictionBgs[cf.frictionLevel] || '#f3f4f6'}; color: ${frictionColors[cf.frictionLevel] || '#374151'};">${cf.frictionLevel}</span>
              </div>
              ${statusRow(rl.forms, cf.formsCount > 0, String(cf.formsCount))}
              ${statusRow(rl.fieldsPerForm, (cf.avgFieldsPerForm ?? 0) <= 3, (cf.avgFieldsPerForm ?? 0).toFixed(1))}
              ${statusRow('CTAs', cf.ctaCount > 0, String(cf.ctaCount))}
              ${statusRow('CTA above fold', cf.ctaAboveFold)}
            </div>`);
        }

        return techSections.length > 0 ? `<div style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 18px 0 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">${rl.contentQuality}</div>${techSections.join('')}` : '';
      })()}


      ${result.recommendations?.length > 0 ? `
        <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 18px 0 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">${t.recommendations}</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb; width: 70px;">${rl.priority}</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">${rl.recommendation}</th>
            </tr>
          </thead>
          <tbody>
            ${result.recommendations.slice(0, 8).map(rec => `
              <tr>
                <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">
                  <span style="padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; ${
                    rec.priority === 'critical' ? 'background: #fee2e2; color: #991b1b;' :
                    rec.priority === 'important' ? 'background: #fef3c7; color: #92400e;' :
                    'background: #dcfce7; color: #166534;'
                  }">${rec.priority === 'critical' ? t.critical : rec.priority === 'important' ? t.important : t.optional}</span>
                </td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">
                  <div style="color: #1f2937; font-weight: 500;">${rec.title}</div>
                  <div style="color: #6b7280; font-size: 11px; margin-top: 2px;">${rec.description || ''}</div>
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
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${rl.marketVolume}</div>
              <div style="font-weight: 700; color: #0f172a;">${renderNumber(ms.total_market_volume)}</div>
            </div>
            <div style="padding: 12px; background: #f8fafc; border-radius: 10px; text-align: center;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${rl.keywordsRanked}</div>
              <div style="font-weight: 700; color: #0f172a;">${renderNumber(ms.keywords_ranked)}/${renderNumber(ms.keywords_analyzed)}</div>
            </div>
            <div style="padding: 12px; background: #f8fafc; border-radius: 10px; text-align: center;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${rl.avgPosition}</div>
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
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${rl.topKeywords}</div>
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
                <thead style="background: #f9fafb;">
                  <tr>
                    <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${rl.keyword}</th>
                    <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${rl.volume}</th>
                    <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${rl.difficulty}</th>
                    <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${rl.position}</th>
                  </tr>
                </thead>
                <tbody>
                  ${kp.main_keywords
                    .slice(0, 6)
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
          : `<p style="color: #374151; line-height: 1.6; margin: 0;">${rl.noKeywordData}</p>`;

      const quickWins =
        kp?.quick_wins?.length
          ? `
            <div style="margin-top: 14px;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">${rl.quickWins}</div>
              <ul style="margin: 0; padding-left: 18px; color: #334155; line-height: 1.7;">
                ${kp.quick_wins
                  .slice(0, 4)
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
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">${rl.contentGaps}</div>
              <ul style="margin: 0; padding-left: 18px; color: #334155; line-height: 1.7;">
                ${kp.content_gaps
                  .slice(0, 4)
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
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">${rl.keywordRecommendations}</div>
              <ul style="margin: 0; padding-left: 18px; color: #0f172a; line-height: 1.7;">
                ${kp.recommendations.slice(0, 4).map((r: any) => `<li>${r}</li>`).join('')}
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

    // Helper for section cards
    const sectionCard = (title: string, color: string, bgGradient: string, innerHtml: string, lightTitle = false) => `
      <div style="background: ${bgGradient}; padding: 20px; border-radius: 12px; margin-bottom: 16px; border-left: 4px solid ${color}; break-inside: avoid; page-break-inside: avoid;">
        <div style="font-size: 15px; color: ${color}; margin: 0 0 12px 0; font-weight: ${lightTitle ? '500' : '700'};">${title}</div>
        ${innerHtml}
      </div>
    `;
    const textBlock = (text: string) => `<p style="color: #374151; line-height: 1.7; margin: 0 0 8px 0;">${text}</p>`;
    const labelValue = (label: string, value: string) => `<div style="margin-bottom: 6px;"><span style="font-size: 12px; font-weight: 600; color: #0f172a; text-transform: uppercase; letter-spacing: 0.03em;">${label} : </span><span style="color: #374151; font-weight: 400;">${value}</span></div>`;
    // No truncation — texts may already be AI-summarized before calling this function

    // ═══════════════════════════════════════════════════════════
    // STRATEGIC PDF — Ordre aligné avec StrategicInsights.tsx (Premium 2026)
    // ═══════════════════════════════════════════════════════════

    const strategicSections: string[] = [];

    // Radial Quality Score Chart
    // Load previous audit data from localStorage for progression overlay
    const prevStratKey = `crawlers_prev_audit_${result.domain}_strategic`;
    let prevStratData = null;
    try { const raw = localStorage.getItem(prevStratKey); if (raw) prevStratData = JSON.parse(raw); } catch {}
    strategicSections.push(generateRadialChartSVG(result, 'strategic', language, prevStratData));

    if (strategic?.introduction) {
      strategicSections.push(sectionCard(t.introduction, '#7c3aed', '#faf5ff',
        `${textBlock(strategic.introduction.presentation || '')}${textBlock(strategic.introduction.strengths || '')}${textBlock(strategic.introduction.improvement || '')}`));
    }

    // 1. Synthèse Exécutive
    if (strategic?.executive_summary || strategic?.executiveSummary) {
      strategicSections.push(sectionCard(t.executiveSummary, '#059669', 'linear-gradient(135deg, #f0fdf4, #ecfeff)', textBlock(strategic?.executive_summary || strategic?.executiveSummary || '')));
    }

    // 2. Autorité de Marque (Brand DNA)
    if (strategic?.brand_authority) {
      strategicSections.push(sectionCard(
        rl.brandAuthority,
        '#7c3aed', '#faf5ff',
        `${labelValue(rl.entityStrength, strategic.brand_authority.entity_strength || '—')}
         ${labelValue('Thought Leadership', (strategic.brand_authority.thought_leadership_score || 0) + '/100')}
         ${textBlock(strategic.brand_authority.dna_analysis || '')}`));
    }

    // 3. Intelligence Marché & Psychologie
    if (strategic?.market_intelligence) {
      const mi = strategic.market_intelligence;
      strategicSections.push(sectionCard(
        rl.marketIntelligence,
        '#d97706', 'linear-gradient(135deg, #fffbeb, #fef3c7)',
        `${mi.sophistication ? `${labelValue(rl.sophisticationLevel, (mi.sophistication.level ?? '—') + '/5')}${textBlock(mi.sophistication.description || '')}` : ''}
         ${mi.semantic_gap ? `${labelValue('Position vs Leader', (mi.semantic_gap.current_position ?? '—') + ' → ' + (mi.semantic_gap.leader_position ?? '—'))}${labelValue('Gap', (mi.semantic_gap.gap_distance != null ? mi.semantic_gap.gap_distance + ' pts' : '—'))}${textBlock(mi.semantic_gap.closing_strategy || '')}` : ''}
         ${textBlock(mi.positioning_verdict || '')}`
      ));
    }

    // 4. Écosystème Concurrentiel
    if (strategic?.competitive_landscape) {
      const cl = strategic.competitive_landscape;
      const actorRow = (role: string, actor: any) => actor ? `<tr><td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a;">${role}</td><td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155;">${actor.name || '—'}</td><td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #6b7280; font-size: 13px;">${actor.analysis || '—'}</td></tr>` : '';
      strategicSections.push(sectionCard(
        rl.competitiveLandscape,
        '#dc2626', 'linear-gradient(135deg, #fef2f2, #fff7ed)',
        `<table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;"><thead style="background: #f9fafb;"><tr><th style="padding: 10px 12px; text-align: left; font-size: 12px;">${rl.role}</th><th style="padding: 10px 12px; text-align: left; font-size: 12px;">${rl.actor}</th><th style="padding: 10px 12px; text-align: left; font-size: 12px;">${rl.analysis}</th></tr></thead><tbody>${actorRow('Leader', cl.leader)}${actorRow(rl.directCompetitor, cl.direct_competitor)}${actorRow('Challenger', cl.challenger)}${actorRow('Inspiration', cl.inspiration_source)}</tbody></table>`
      ));
    }

    // 5. Sentiment d'Expertise (E-E-A-T) & Red Team
    if (strategic?.expertise_sentiment) {
      const es = strategic.expertise_sentiment;
      const stars = Array.from({ length: 5 }, (_, i) => `<span style="font-size: 20px; color: ${i < es.rating ? '#f59e0b' : '#d1d5db'};">★</span>`).join('');
      strategicSections.push(sectionCard(
        rl.expertiseSentiment,
        '#7c3aed', '#faf5ff',
        `<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">${stars}<span style="font-size: 13px; font-weight: 500; color: #374151;">${rl.expertiseLabels[es.rating] || ''}</span></div>
        <p style="color: #6b7280; font-style: italic; font-size: 13px; border-left: 2px solid #7c3aed; padding-left: 10px;">${es.justification || ''}</p>`
      ));
    }

    if (strategic?.red_team?.flaws?.length) {
      const flawsHtml = strategic.red_team.flaws.map((f: string) => `<div style="display: flex; gap: 8px; padding: 8px 12px; background: rgba(220,38,38,0.05); border: 1px solid rgba(220,38,38,0.15); border-radius: 8px; margin-bottom: 6px;"><span style="color: #dc2626; font-size: 14px;">⚠️</span><span style="color: #374151; font-size: 13px;">${f}</span></div>`).join('');
      strategicSections.push(sectionCard(
        rl.redTeam,
        '#dc2626', '#fef2f2',
        `${flawsHtml}<p style="font-size: 11px; color: #6b7280; font-style: italic; margin-top: 6px;">${rl.redTeamNote}</p>`
      ));
    }

    // 6. Analyse stratégique des mots-clés (DataForSEO)
    strategicSections.push(keywordsSection);

    // 7. Score AEO (computed from result data)
    if (result.scores && result.rawData) {
      const aeoLabel = language === 'fr' ? 'Score AEO (Answer Engine Optimization)' : language === 'es' ? 'Score AEO (Answer Engine Optimization)' : 'AEO Score (Answer Engine Optimization)';
      const html_analysis = result.rawData?.htmlAnalysis || {} as any;
      const relevantSchemaTypes = ['FAQPage', 'FAQ', 'Article', 'NewsArticle', 'BlogPosting', 'HowTo', 'QAPage', 'Organization', 'WebSite', 'WebPage', 'LocalBusiness'];
      const safeSchemaTypes = (result.scores.aiReady.schemaTypes || []).filter(Boolean) as string[];
      const hasRelevantSchema = result.scores.aiReady.hasSchemaOrg && safeSchemaTypes.some((t: string) => relevantSchemaTypes.some(r => t.toLowerCase().includes(r.toLowerCase())));
      const h1Contents: string[] = (html_analysis as any).h1Contents || [];
      const hasInterrogativeHn = h1Contents.some((h: string) => /(\?|comment|quel|quelle|pourquoi|how|what|why|when|where|which|who)/i.test(h));
      const hasInvertedPyramid = (result.scores.semantic.wordCount || 0) >= 100;
      const hasExtractable = ((html_analysis as any).tableCount || 0) + ((html_analysis as any).listCount || 0) >= 1;
      const hasFastTTFB = (result.scores.performance.fcp || 0) > 0 && (result.scores.performance.fcp || 0) < 1200;
      const contentOk = (result.scores.semantic.wordCount || 0) > 50;
      const hasEEAT = (html_analysis as any).hasAuthorBio || (html_analysis as any).hasExpertCitations || (html_analysis as any).hasSameAsLinks;
      const hasSemanticLinks = (result.insights?.linkProfile?.internal || 0) >= 2;
      const criteria = [hasRelevantSchema, hasInterrogativeHn, hasInvertedPyramid, hasExtractable, hasFastTTFB, contentOk, hasEEAT, hasSemanticLinks];
      const aeoScore = Math.round((criteria.filter(Boolean).length / criteria.length) * 100);
      const aeoColor = aeoScore >= 70 ? '#166534' : aeoScore >= 40 ? '#92400e' : '#991b1b';
      const aeoBg = aeoScore >= 70 ? '#dcfce7' : aeoScore >= 40 ? '#fef3c7' : '#fee2e2';
      const criteriaRows = [
        { label: 'Schema.org', passed: hasRelevantSchema, tip: language === 'fr' ? 'Ajoutez FAQPage, Article ou HowTo en JSON-LD pour structurer vos réponses.' : 'Add FAQPage, Article or HowTo in JSON-LD to structure your answers.' },
        { label: language === 'fr' ? 'Titres interrogatifs' : 'Interrogative headings', passed: hasInterrogativeHn, tip: language === 'fr' ? 'Reformulez vos H2/H3 comme des questions : "Comment…?", "Pourquoi…?"' : 'Rephrase H2/H3 as questions: "How…?", "Why…?"' },
        { label: language === 'fr' ? 'Pyramide inversée' : 'Inverted pyramid', passed: hasInvertedPyramid, tip: language === 'fr' ? 'Répondez à la question principale dès les 100 premiers mots.' : 'Answer the main question within the first 100 words.' },
        { label: language === 'fr' ? 'Formats extractibles' : 'Extractable formats', passed: hasExtractable, tip: language === 'fr' ? 'Ajoutez des tableaux, listes à puces ou encadrés de définition.' : 'Add tables, bullet lists or definition boxes.' },
        { label: 'TTFB / FCP', passed: hasFastTTFB, tip: language === 'fr' ? 'Visez un FCP < 1.2s. Activez le cache, compressez les images en WebP.' : 'Target FCP < 1.2s. Enable caching, compress images to WebP.' },
        { label: 'DOM', passed: contentOk, tip: language === 'fr' ? 'Le contenu principal doit être visible sans JavaScript (SSR ou pré-rendu).' : 'Main content must be visible without JavaScript (SSR or pre-rendering).' },
        { label: 'E-E-A-T', passed: hasEEAT, tip: language === 'fr' ? 'Ajoutez une bio auteur, des citations d\'experts et un schéma Person/Organization.' : 'Add author bio, expert citations and Person/Organization schema.' },
        { label: language === 'fr' ? 'Maillage sémantique' : 'Semantic links', passed: hasSemanticLinks, tip: language === 'fr' ? 'Liez au moins 2-3 pages internes avec des ancres descriptives.' : 'Link at least 2-3 internal pages with descriptive anchors.' },
      ];
      strategicSections.push(sectionCard(
        aeoLabel, '#0891b2', 'linear-gradient(135deg, #ecfeff, #f0fdfa)',
        `<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
          <div style="padding: 12px 20px; background: ${aeoBg}; border-radius: 12px; text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: ${aeoColor};">${aeoScore}/100</div>
          </div>
          <p style="font-size: 11px; color: #6b7280; flex: 1;">Score calculé sur ${criteria.length} critères techniques et éditoriaux vérifiant la compatibilité du contenu avec les moteurs de réponse IA (Position Zéro, SGE, assistants vocaux).</p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 4px;">${criteriaRows.map(c =>
          `<div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; font-size: 12px; background: ${c.passed ? 'rgba(220,252,231,0.3)' : 'rgba(254,226,226,0.3)'}; border-radius: 6px;"><span style="font-size: 13px; flex-shrink: 0; margin-top: 1px;">${c.passed ? '✅' : '❌'}</span><div><span style="color: #374151; font-weight: 600;">${c.label}</span>${!c.passed ? `<div style="font-size: 11px; color: #92400e; margin-top: 2px;">→ ${c.tip}</div>` : ''}</div></div>`
        ).join('')}</div>`
      ));
    }

    // 8. Visibilité LLMs
    if (strategic?.llm_visibility_raw) {
      const llm = strategic.llm_visibility_raw;
      const citedCount = llm.citationRate?.cited || 0;
      const totalCount = llm.citationRate?.total || 0;
      const citationRows = llm.citations?.slice(0, 5).map((c: any) => `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${c.provider?.name || '—'}</td><td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;"><span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; ${c.cited ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">${c.cited ? rl.cited : rl.invisible}</span></td><td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;"><span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; ${c.sentiment === 'positive' || c.sentiment === 'mostly_positive' ? 'background: #dcfce7; color: #166534;' : c.sentiment === 'neutral' ? 'background: #f3f4f6; color: #374151;' : 'background: #fee2e2; color: #991b1b;'}">${c.sentiment || '—'}</span></td><td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #6b7280; font-size: 12px;">${c.summary || ''}</td></tr>`).join('') || '';
      strategicSections.push(sectionCard(
        rl.llmVisibility,
        '#8b5cf6', 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
        `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">
          <div style="padding: 12px; background: rgba(255,255,255,0.7); border-radius: 10px; text-align: center;"><div style="font-size: 12px; color: #6b7280;">Score</div><div style="font-weight: 700; font-size: 20px; color: #0f172a;">${llm.overallScore || 0}/100</div></div>
          <div style="padding: 12px; background: rgba(255,255,255,0.7); border-radius: 10px; text-align: center;"><div style="font-size: 12px; color: #6b7280;">Citations</div><div style="font-weight: 700; font-size: 20px; color: #0f172a;">${citedCount}/${totalCount}</div></div>
          <div style="padding: 12px; background: rgba(255,255,255,0.7); border-radius: 10px; text-align: center;"><div style="font-size: 12px; color: #6b7280;">Sentiment</div><div style="font-weight: 700; color: #0f172a;">${llm.overallSentiment || '—'}</div></div>
        </div>
        ${textBlock(llm.coreValueSummary || '')}
        ${citationRows ? `<table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;"><thead style="background: #f9fafb;"><tr><th style="padding: 8px 12px; text-align: left; font-size: 12px;">LLM</th><th style="padding: 8px 12px; text-align: left; font-size: 12px;">Citation</th><th style="padding: 8px 12px; text-align: left; font-size: 12px;">Sentiment</th><th style="padding: 8px 12px; text-align: left; font-size: 12px;">${rl.summary}</th></tr></thead><tbody>${citationRows}</tbody></table>` : ''}`
      ));
    }

    // 9. Sentiment & Polarité (Conversational Intent)
    if (strategic?.social_signals?.sentiment || (strategic as any)?.conversational_intent) {
      const rawIntent = (strategic as any)?.conversational_intent;
      const sent = strategic?.social_signals?.sentiment;
      const conversationalRatio = rawIntent?.ratio ?? (() => {
        const geoFormats = strategic?.geo_readiness?.ai_favored_formats;
        const formatScore = geoFormats?.format_score ?? 30;
        return Math.min(100, Math.round(formatScore * 0.8 + (geoFormats?.has_faq ? 15 : 0)));
      })();
      const intentLabel = language === 'fr' ? 'Intention Conversationnelle & Sentiment' : language === 'es' ? 'Intención Conversacional y Sentimiento' : 'Conversational Intent & Sentiment';
      strategicSections.push(sectionCard(
        intentLabel,
        '#6366f1', 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
        `${labelValue(language === 'fr' ? 'Ratio conversationnel' : 'Conversational ratio', conversationalRatio + '%')}
         ${sent ? `${labelValue(rl.overallSentiment, sent.overall_polarity || '—')}${labelValue(rl.hallucinationRisk, sent.hallucination_risk || '—')}` : ''}`
      ));
    }

    // 10. Autorité Sociale & Humaine
    if (strategic?.social_signals) {
      const ss = strategic.social_signals;
      const proofRows = ss.proof_sources?.map((s: any) => `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; text-transform: capitalize;">${s.platform}</td><td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;"><span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; ${s.presence_level === 'strong' ? 'background: #dcfce7; color: #166534;' : s.presence_level === 'moderate' ? 'background: #fef3c7; color: #92400e;' : 'background: #fee2e2; color: #991b1b;'}">${s.presence_level}</span></td><td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #6b7280; font-size: 13px;">${s.analysis || ''}</td></tr>`).join('') || '';
      const tl = ss.thought_leadership;
      strategicSections.push(sectionCard(
        rl.socialSignals,
        '#2563eb', 'linear-gradient(135deg, #eff6ff, #f0f9ff)',
        `${tl ? `${labelValue('E-E-A-T', (tl.eeat_score || 0) + '/10')}${labelValue(rl.recognition, tl.entity_recognition || '—')}${textBlock(tl.analysis || '')}` : ''}
         ${proofRows ? `<table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;"><thead style="background: #f9fafb;"><tr><th style="padding: 8px 12px; text-align: left; font-size: 12px;">${rl.platform}</th><th style="padding: 8px 12px; text-align: left; font-size: 12px;">${rl.presence}</th><th style="padding: 8px 12px; text-align: left; font-size: 12px;">${rl.analysis}</th></tr></thead><tbody>${proofRows}</tbody></table>` : ''}`
      ));
    }

    // 11. Sémantique IA (GEO Readiness)
    if (strategic?.geo_readiness) {
      const gr = strategic.geo_readiness;
      const formats = gr.ai_favored_formats;
      strategicSections.push(sectionCard(
        rl.geoReadiness,
        '#0891b2', 'linear-gradient(135deg, #ecfeff, #f0fdfa)',
        `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">
          <div style="padding: 12px; background: rgba(255,255,255,0.7); border-radius: 10px; text-align: center;"><div style="font-size: 12px; color: #6b7280;">${rl.citability}</div><div style="font-weight: 700; font-size: 20px; color: #0f172a;">${gr.citability_score || 0}/100</div></div>
          <div style="padding: 12px; background: rgba(255,255,255,0.7); border-radius: 10px; text-align: center;"><div style="font-size: 12px; color: #6b7280;">${rl.aiAccess}</div><div style="font-weight: 700; font-size: 20px; color: #0f172a;">${gr.ai_accessibility_score || 0}/100</div></div>
          <div style="padding: 12px; background: rgba(255,255,255,0.7); border-radius: 10px; text-align: center;"><div style="font-size: 12px; color: #6b7280;">${rl.aiFormats}</div><div style="font-weight: 700; font-size: 20px; color: #0f172a;">${formats?.format_score || 0}/100</div></div>
        </div>
        ${gr.semantic_coherence ? labelValue(rl.titleH1, gr.semantic_coherence.title_h1_alignment + '% — ' + gr.semantic_coherence.verdict) : ''}
        ${gr.content_freshness ? labelValue(rl.contentFreshness, gr.content_freshness.verdict || '—') : ''}
        ${gr.eeat_signals ? labelValue('E-E-A-T', gr.eeat_signals.verdict || '—') : ''}
        ${gr.knowledge_graph_readiness ? labelValue('Knowledge Graph', gr.knowledge_graph_readiness.verdict || '—') : ''}
        ${formats?.missing_formats?.length ? `<div style="margin-top: 8px;"><span style="font-size: 12px; color: #6b7280;">${rl.missingFormats} : </span>${formats.missing_formats.map((f: string) => `<span style="display: inline-block; padding: 2px 8px; background: #fee2e2; color: #991b1b; border-radius: 6px; font-size: 11px; margin: 2px;">${f}</span>`).join('')}</div>` : ''}`,
        true
      ));
    }

    // 12. Indice de Citabilité & Résilience au Résumé
    if (strategic?.quotability?.quotes?.length) {
      const quotesHtml = strategic.quotability.quotes.map((q: string) => `<blockquote style="border-left: 3px solid #6366f1; padding: 8px 12px; margin: 6px 0; background: #f8fafc; font-style: italic; color: #374151; font-size: 13px;">"${q}"</blockquote>`).join('');
      strategicSections.push(sectionCard(
        rl.quotabilityIndex,
        '#6366f1', '#f5f3ff',
        `${labelValue('Score', (strategic.quotability.score || 0) + '/100')}${quotesHtml}`
      ));
    }

    if (strategic?.summary_resilience) {
      const sr = strategic.summary_resilience;
      const barColor = sr.score >= 80 ? '#166534' : sr.score >= 50 ? '#92400e' : '#991b1b';
      strategicSections.push(sectionCard(
        rl.summaryResilience,
        '#059669', '#f0fdf4',
        `${labelValue('Score', sr.score + '/100')}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
          <div style="padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px;"><div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">${rl.originalH1}</div><div style="font-size: 13px; color: #0f172a; font-weight: 500;">${sr.originalH1 || '—'}</div></div>
          <div style="padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px;"><div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">${rl.llmSummary}</div><div style="font-size: 13px; color: #0f172a; font-weight: 500;">${sr.llmSummary || '—'}</div></div>
        </div>
        <div style="margin-top: 8px; height: 6px; background: #e5e7eb; border-radius: 99px; overflow: hidden;"><div style="height: 100%; width: ${sr.score}%; background: ${barColor}; border-radius: 99px;"></div></div>`
      ));
    }

    // 13. Empreinte Lexicale
    if (strategic?.lexical_footprint) {
      const lf = strategic.lexical_footprint;
      strategicSections.push(sectionCard(
        rl.lexicalFootprint,
        '#d97706', '#fffbeb',
        `${labelValue('Score', (lf.score != null ? lf.score : '—') + '/100')}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
          <div style="padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px; text-align: center;"><div style="font-size: 11px; color: #6b7280;">${rl.jargon}</div><div style="font-size: 20px; font-weight: 700; color: #92400e;">${lf.jargonRatio != null ? (lf.jargonRatio <= 1 ? Math.round(lf.jargonRatio * 100) : Math.round(lf.jargonRatio)) : '—'}%</div></div>
          <div style="padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px; text-align: center;"><div style="font-size: 11px; color: #6b7280;">${rl.concrete}</div><div style="font-size: 20px; font-weight: 700; color: #166534;">${lf.concreteRatio != null ? (lf.concreteRatio <= 1 ? Math.round(lf.concreteRatio * 100) : Math.round(lf.concreteRatio)) : '—'}%</div></div>
        </div>
        <p style="font-size: 10px; color: #9ca3af; margin-top: 6px; font-style: italic;">Ratio = proportion de termes techniques (Jargon) vs factuels (Concret) dans le contenu analysé. Réf. : 10-25% Jargon / 40-60% Concret pour un site B2B.</p>`
      ));
    }

    // 14. Brand Identity (standard format fallback)
    if (strategic?.brand_identity && !strategic?.brand_authority) {
      strategicSections.push(`
        <div style="background: #faf5ff; padding: 24px; border-radius: 12px; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid;">
          <h3 style="font-size: 16px; color: #7c3aed; margin: 0 0 16px 0;">${t.brandIdentity}</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <div><div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${rl.archetype}</div><div style="font-weight: 600; color: #1f2937;">${strategic.brand_identity.archetype}</div></div>
            <div><div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${rl.clarity}</div><div style="font-weight: 600; color: #1f2937;">${strategic.brand_identity.clarity_score}/100</div></div>
          </div>
          <div style="margin-top: 12px;"><div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${rl.perceivedValues}</div>
            <div>${strategic.brand_identity.perceived_values.map((v: string) => `<span style="display: inline-block; padding: 4px 8px; background: #e9d5ff; color: #7c3aed; border-radius: 6px; font-size: 12px; margin: 2px;">${v}</span>`).join('')}</div>
          </div>
        </div>
      `);
    }

    // 15. Feuille de Route Exécutive 2026
    if (strategic?.executive_roadmap?.length) {
      strategicSections.push(`
        <h3 style="font-size: 18px; color: #1f2937; margin: 24px 0 16px 0;">${rl.executiveRoadmap}</h3>
        ${(strategic.executive_roadmap as any[]).slice(0, 4).map((item: any, i: number) => `
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span style="font-size: 13px; font-weight: 700; color: white; background: #6366f1; border-radius: 50%; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;">${i + 1}</span>
              <strong style="color: #0f172a; font-size: 15px;">${item.title || ''}</strong>
              <span style="margin-left: auto; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; ${item.priority === 'Prioritaire' ? 'background: #fee2e2; color: #991b1b;' : item.priority === 'Important' ? 'background: #fef3c7; color: #92400e;' : 'background: #dcfce7; color: #166534;'}">${item.priority || ''}</span>
              ${item.expected_roi ? `<span style="padding: 2px 10px; border-radius: 12px; font-size: 11px; background: #ede9fe; color: #6d28d9;">ROI ${item.expected_roi}</span>` : ''}
            </div>
            <p style="color: #374151; line-height: 1.7; margin: 0 0 8px 0; font-size: 14px;">${item.prescriptive_action || ''}</p>
            ${item.strategic_rationale ? `<p style="color: #6b7280; font-size: 13px; font-style: italic; margin: 0;">${item.strategic_rationale || ''}</p>` : ''}
          </div>
        `).join('')}
      `);
    } else if (strategic?.strategic_roadmap?.length > 0) {
      strategicSections.push(`
        <h3 style="font-size: 18px; color: #1f2937; margin-bottom: 16px;">${t.roadmap}</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <thead><tr style="background: #f9fafb;"><th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">${rl.priority}</th><th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">${rl.action}</th><th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">${rl.objective}</th></tr></thead>
          <tbody>
            ${strategic.strategic_roadmap.map((item: any) => `<tr><td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><span style="padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; ${item.priority === 'Prioritaire' ? 'background: #fee2e2; color: #991b1b;' : item.priority === 'Important' ? 'background: #fef3c7; color: #92400e;' : 'background: #dcfce7; color: #166534;'}">${item.priority}</span></td><td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.action_concrete}</td><td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">${item.strategic_goal}</td></tr>`).join('')}
          </tbody>
        </table>
      `);
    }

    content = strategicSections.join('\n');
  }

  const isWhiteLabel = branding?.logoUrl || branding?.primaryColor;
  const brandColor = branding?.primaryColor || '#7c3aed';
  const headerGradient = isWhiteLabel
    ? `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`
    : 'linear-gradient(135deg, #7c3aed, #2563eb)';

  const crawlersLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="36" height="36" style="vertical-align: middle; margin-right: 8px;">
    <defs>
      <linearGradient id="rptBg" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#d4a853"/>
        <stop offset="30%" stop-color="#8b5cf6"/>
        <stop offset="70%" stop-color="#7c3aed"/>
        <stop offset="100%" stop-color="#3b5998"/>
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="10" fill="url(#rptBg)"/>
    <g transform="translate(8.4, 8.4) scale(1.3)" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M12 8V4H8"/>
      <rect x="4" y="8" width="16" height="12" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M9 13v2"/>
      <path d="M15 13v2"/>
    </g>
  </svg>`;

  const logoHtml = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="Logo" style="max-height: 40px; margin-bottom: 8px;" />`
    : `${crawlersLogoSvg} Crawlers.fr`;

  const footerHtml = isWhiteLabel
    ? `<div class="footer" style="background: ${headerGradient};">
        <div class="footer-brand" style="color: white; font-size: 16px; font-weight: 600;">${branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="max-height: 24px;" />` : ''}</div>
      </div>`
    : `<div class="footer">
        <div class="footer-brand">${t.poweredBy}</div>
        <a href="https://crawlers.fr/audit-expert" class="footer-link">crawlers.fr/audit-expert</a>
      </div>`;

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${auditMode === 'technical' ? t.technicalAudit : t.strategic}_${result.domain}_${new Date().toISOString().slice(0, 10)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f3f4f6; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; padding: 28px; background: ${headerGradient}; border-radius: 20px; break-inside: avoid; page-break-inside: avoid; }
    .header-site { font-size: 26px; font-weight: 700; color: white; margin-bottom: 6px; word-break: break-all; }
    .header-audit-type { color: rgba(255,255,255,0.9); font-size: 15px; font-weight: 500; margin-bottom: 14px; }
    .header-brand { display: inline-flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.7); font-size: 12px; }
    .header-brand svg { vertical-align: middle; }
    .date { color: rgba(255,255,255,0.6); font-size: 11px; margin-top: 8px; }
    .content { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .footer { text-align: center; margin-top: 40px; padding: 24px; background: ${headerGradient}; border-radius: 16px; break-inside: avoid; page-break-inside: avoid; }
    .footer-brand { color: white; font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .footer-link { color: white; text-decoration: none; font-weight: 500; padding: 10px 20px; background: rgba(255,255,255,0.2); border-radius: 10px; display: inline-block; }
    /* ═══ ANTI PAGE-BREAK: prevent ANY card from being split across pages ═══ */
    div[style*="border-radius"], div[style*="break-inside"], table, .score-box,
    div[style*="border-left:"], div[style*="margin-bottom"], div[style*="padding:"],
    blockquote { break-inside: avoid !important; page-break-inside: avoid !important; }
    tr { break-inside: avoid !important; page-break-inside: avoid !important; }
    h3 { break-after: avoid !important; page-break-after: avoid !important; }
    /* Force each section card to start on a new page if it would be split */
    .content > div { break-inside: avoid !important; page-break-inside: avoid !important; }
    @page { margin: 15mm 10mm; }
    @media print {
      body { background: white; padding: 0; }
      .container { max-width: 100%; }
      .content { box-shadow: none; padding: 20px; }
      .content > div, .content > table, .content > h3 + div { break-inside: avoid !important; page-break-inside: avoid !important; }
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
    <div class="header" data-pdf-section="header">
      <div class="header-site">${result.domain || result.url}</div>
      <div class="header-audit-type">${auditMode === 'technical' ? t.technicalAudit : t.strategic}</div>
      <div class="header-brand">${isWhiteLabel && branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="max-height: 18px;" />` : `${crawlersLogoSvg} Crawlers.fr`}</div>
      <div class="date">${t.generatedAt} ${now}</div>
    </div>
    <div class="content" data-pdf-section="content">
      ${content}
    </div>
    ${footerHtml}
  </div>
</body>
</html>`;
}

export async function generateExpertPDF(result: ExpertAuditResult, auditMode: 'technical' | 'strategic', t: ExpertReportI18n, branding?: WhiteLabelBranding, language: string = 'fr') {
  const htmlContent = generateExpertReportHTML(result, auditMode, t, language, branding);
  const { generateSectionBasedPDF } = await import('@/utils/sectionBasedPdfExport');

  const urlForFilename = result.url || result.domain || '';
  const domain = (() => { try { const u = urlForFilename.includes('.') ? urlForFilename : 'report'; return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, ''); } catch { return urlForFilename.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_') || 'report'; } })();
  const auditType = auditMode === 'technical' ? 'audittechnique' : 'auditstrategique';

  await generateSectionBasedPDF({
    htmlContent,
    filename: `${domain}-${auditType}.pdf`,
  });
}

/**
 * Extract all long text fields from a strategic analysis for AI summarization.
 */
export function extractStrategicTexts(result: ExpertAuditResult): Record<string, string> {
  const s = result.strategicAnalysis;
  if (!s) return {};
  const texts: Record<string, string> = {};
  const add = (key: string, val: any) => {
    if (typeof val === 'string' && val.length > 80) texts[key] = val;
  };
  add('executive_summary', s.executive_summary || s.executiveSummary);
  add('intro_presentation', s.introduction?.presentation);
  add('intro_strengths', s.introduction?.strengths);
  add('intro_improvement', s.introduction?.improvement);
  add('dna_analysis', s.brand_authority?.dna_analysis);
  add('tl_analysis', s.social_signals?.thought_leadership?.analysis);
  add('reputation_vibration', s.social_signals?.sentiment?.reputation_vibration);
  s.social_signals?.proof_sources?.forEach((src: any, i: number) => {
    add(`social_proof_${i}_analysis`, src.analysis);
  });
  add('soph_description', s.market_intelligence?.sophistication?.description);
  add('closing_strategy', s.market_intelligence?.semantic_gap?.closing_strategy);
  add('positioning_verdict', s.market_intelligence?.positioning_verdict);
  add('coreValueSummary', s.llm_visibility_raw?.coreValueSummary);
  s.llm_visibility_raw?.citations?.forEach((c: any, i: number) => {
    add(`llm_citation_${i}_summary`, c.summary);
  });
  // Competitive landscape
  const cl = s.competitive_landscape;
  if (cl) {
    add('cl_leader_analysis', cl.leader?.analysis);
    add('cl_direct_analysis', cl.direct_competitor?.analysis);
    add('cl_challenger_analysis', cl.challenger?.analysis);
    add('cl_inspiration_analysis', cl.inspiration_source?.analysis);
  }
  // GEO readiness
  add('geo_performance_impact', s.geo_readiness?.performance_impact);
  // Executive roadmap
  s.executive_roadmap?.forEach((item: any, i: number) => {
    add(`roadmap_${i}_action`, item.prescriptive_action);
    add(`roadmap_${i}_rationale`, item.strategic_rationale);
  });
  return texts;
}

/**
 * Apply AI summaries back into a deep-cloned result object.
 */
export function applySummaries(result: ExpertAuditResult, summaries: Record<string, string>): ExpertAuditResult {
  const r = JSON.parse(JSON.stringify(result)) as ExpertAuditResult;
  const s = r.strategicAnalysis;
  if (!s) return r;
  const get = (key: string) => summaries[key];
  if (get('executive_summary')) { s.executive_summary = get('executive_summary'); if (s.executiveSummary) s.executiveSummary = get('executive_summary'); }
  if (s.introduction) {
    if (get('intro_presentation')) s.introduction.presentation = get('intro_presentation')!;
    if (get('intro_strengths')) s.introduction.strengths = get('intro_strengths')!;
    if (get('intro_improvement')) s.introduction.improvement = get('intro_improvement')!;
  }
  if (s.brand_authority && get('dna_analysis')) s.brand_authority.dna_analysis = get('dna_analysis')!;
  if (s.social_signals?.thought_leadership && get('tl_analysis')) s.social_signals.thought_leadership.analysis = get('tl_analysis')!;
  if (s.social_signals?.sentiment && get('reputation_vibration')) s.social_signals.sentiment.reputation_vibration = get('reputation_vibration')!;
  s.social_signals?.proof_sources?.forEach((src: any, i: number) => {
    if (get(`social_proof_${i}_analysis`)) src.analysis = get(`social_proof_${i}_analysis`);
  });
  if (s.market_intelligence?.sophistication && get('soph_description')) s.market_intelligence.sophistication.description = get('soph_description')!;
  if (s.market_intelligence?.semantic_gap && get('closing_strategy')) s.market_intelligence.semantic_gap.closing_strategy = get('closing_strategy')!;
  if (s.market_intelligence && get('positioning_verdict')) s.market_intelligence.positioning_verdict = get('positioning_verdict')!;
  if (s.llm_visibility_raw && get('coreValueSummary')) s.llm_visibility_raw.coreValueSummary = get('coreValueSummary')!;
  s.llm_visibility_raw?.citations?.forEach((c: any, i: number) => {
    if (get(`llm_citation_${i}_summary`)) c.summary = get(`llm_citation_${i}_summary`);
  });
  // Competitive landscape
  const cl = s.competitive_landscape;
  if (cl) {
    if (get('cl_leader_analysis') && cl.leader) cl.leader.analysis = get('cl_leader_analysis')!;
    if (get('cl_direct_analysis') && cl.direct_competitor) cl.direct_competitor.analysis = get('cl_direct_analysis')!;
    if (get('cl_challenger_analysis') && cl.challenger) cl.challenger.analysis = get('cl_challenger_analysis')!;
    if (get('cl_inspiration_analysis') && cl.inspiration_source) cl.inspiration_source.analysis = get('cl_inspiration_analysis')!;
  }
  // GEO readiness
  if (s.geo_readiness && get('geo_performance_impact')) s.geo_readiness.performance_impact = get('geo_performance_impact')!;
  // Executive roadmap
  s.executive_roadmap?.forEach((item: any, i: number) => {
    if (get(`roadmap_${i}_action`)) item.prescriptive_action = get(`roadmap_${i}_action`);
    if (get(`roadmap_${i}_rationale`)) item.strategic_rationale = get(`roadmap_${i}_rationale`);
  });
  return r;
}

/**
 * Summarize a strategic audit result via AI, returning a new result with condensed texts.
 * Falls back to the original result on error.
 */
export async function summarizeStrategicResult(result: ExpertAuditResult, language: string): Promise<ExpertAuditResult> {
  const texts = extractStrategicTexts(result);
  if (Object.keys(texts).length === 0) return result;
  try {
    const { data, error } = await supabase.functions.invoke('summarize-report', {
      body: { texts, language },
    });
    if (error) { console.error('Summarize error:', error); return result; }
    return applySummaries(result, data.summaries || {});
  } catch (e) {
    console.error('Summarize failed:', e);
    return result;
  }
}
