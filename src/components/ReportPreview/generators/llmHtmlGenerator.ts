import { LLMAnalysisResult } from '@/types/llm';
import { TranslationKeys } from '../translations';

function generateScoreGauge(score: number): string {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const colorClass = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';

  return `
    <div class="score-gauge">
      <svg width="144" height="144" viewBox="0 0 100 100">
        <circle class="score-gauge-bg" cx="50" cy="50" r="45" />
        <circle 
          class="score-gauge-fill ${colorClass}" 
          cx="50" cy="50" r="45"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${strokeDashoffset}"
        />
      </svg>
      <div class="score-gauge-text">
        <span class="score-gauge-value ${colorClass}">${score}</span>
        <span class="score-gauge-max">/100</span>
      </div>
    </div>
  `;
}

export function generateLLMHTML(data: LLMAnalysisResult, t: TranslationKeys, language: string): string {
  // Generate compact LLM cards matching BotCard style from homepage
  const citationCards = data.citations.map((citation) => {
    const isCited = citation.cited;
    const statusClass = isCited ? 'llm-card-visible' : 'llm-card-invisible';
    const statusLabel = isCited ? t.visible : t.invisible;
    
    return `
      <div class="llm-compact-card ${statusClass}">
        <div class="llm-compact-header">
          <div class="llm-compact-info">
            <span class="llm-compact-name">${citation.provider.name}</span>
            <span class="llm-compact-company">${citation.provider.company}</span>
          </div>
          <div class="llm-compact-status ${isCited ? 'status-visible' : 'status-invisible'}">
            ${statusLabel}
          </div>
        </div>
        ${citation.summary ? `<p class="llm-compact-summary">${citation.summary}</p>` : ''}
      </div>
    `;
  }).join('');

  const coveragePercent = Math.round((data.citationRate.cited / data.citationRate.total) * 100);
  const coverageClass = coveragePercent >= 70 ? 'stat-badge-success' : coveragePercent >= 40 ? 'stat-badge-warning' : 'stat-badge-error';

  return `
    <!-- Summary Header with Score -->
    <div class="card summary-header card-shadow-lg" data-pdf-section="llm-summary">
      <div class="summary-header-content" style="flex-direction: column; align-items: center; gap: 24px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 24px; justify-content: space-between; width: 100%;">
          <div style="flex: 1; min-width: 200px;">
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 20px; background: hsla(221, 83%, 53%, 0.1); margin-bottom: 8px;">
              <span style="font-size: 14px; font-weight: 500; color: var(--primary);">${t.llm}</span>
            </div>
            <h2 class="url-title">
              ${data.domain}
            </h2>
            <div class="url-meta">
              <span class="url-meta-item">
                ${new Date(data.scannedAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
              </span>
              <span>${data.citationRate.cited}/${data.citationRate.total} ${t.llmsCite}</span>
            </div>
          </div>
          <div style="text-align: center;">
            ${generateScoreGauge(data.overallScore)}
            <p style="margin-top: 8px; font-size: 14px; font-weight: 500; color: var(--muted-foreground);">${t.overallVisibility}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Citation Rate Card -->
    <div class="card" data-pdf-section="llm-citation-rate" style="padding: 20px; margin-bottom: 24px;">
      <h3 class="section-title">
        ${t.citationRate}
      </h3>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 32px; font-weight: 700; color: var(--foreground);">
          ${data.citationRate.cited}
          <span style="font-size: 18px; color: var(--muted-foreground);">/${data.citationRate.total}</span>
        </span>
        <div class="stat-badge ${coverageClass}" style="padding: 4px 12px;">
          <span class="stat-value" style="font-size: 14px;">${coveragePercent}%</span>
          <span class="stat-label">${t.coverage}</span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${coveragePercent >= 70 ? 'progress-success' : coveragePercent >= 40 ? 'progress-warning' : 'progress-error'}" style="width: ${coveragePercent}%"></div>
      </div>
    </div>

    <!-- LLM Cards Grid - Compact style -->
    <div class="llm-grid" data-pdf-section="llm-cards">
      ${citationCards}
    </div>
  `;
}
