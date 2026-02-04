import { GeoResult } from '@/types/geo';
import { TranslationKeys } from '../translations';
import { icons } from '../reportStyles';

function generateScoreGauge(score: number, label: string): string {
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

export function generateGeoHTML(data: GeoResult, t: TranslationKeys, language: string): string {
  const passedFactors = data.factors.filter(f => f.status === 'good').length;
  const totalFactors = data.factors.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return icons.check;
      case 'warning': return icons.alertTriangle;
      default: return icons.x;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'good': return 'factor-status-good';
      case 'warning': return 'factor-status-warning';
      default: return 'factor-status-error';
    }
  };

  const getProgressClass = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'progress-success';
    if (percentage >= 50) return 'progress-warning';
    return 'progress-error';
  };

  const factorCards = data.factors.map((factor) => `
    <div class="card factor-card">
      <div class="factor-header">
        <div style="flex: 1;">
          <div class="factor-title-row">
            <span class="factor-name">${factor.name}</span>
            <div class="factor-status-icon ${getStatusClass(factor.status)}">
              ${getStatusIcon(factor.status)}
            </div>
          </div>
          <p class="factor-desc">${factor.description}</p>
        </div>
        <div class="factor-score">
          <span class="factor-score-value">${factor.score}</span>
          <span class="factor-score-max">/${factor.maxScore}</span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${getProgressClass(factor.score, factor.maxScore)}" style="width: ${(factor.score / factor.maxScore) * 100}%"></div>
      </div>
      ${factor.details ? `<p class="factor-details">${factor.details}</p>` : ''}
    </div>
  `).join('');

  return `
    <!-- Summary Header with Score -->
    <div class="card summary-header card-shadow-lg">
      <div class="summary-header-content" style="flex-direction: column; align-items: center; gap: 24px;">
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 24px; justify-content: space-between; width: 100%;">
            <div style="flex: 1; min-width: 200px;">
              <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 20px; background: hsla(221, 83%, 53%, 0.1); margin-bottom: 8px;">
                ${icons.sparkles}
                <span style="font-size: 14px; font-weight: 500; color: var(--primary);">${t.geo}</span>
              </div>
              <h2 class="url-title">
                ${data.url}
                <a href="${data.url}" target="_blank" rel="noopener noreferrer">
                  ${icons.externalLink}
                </a>
              </h2>
              <div class="url-meta">
              <span class="url-meta-item">
                ${icons.clock}
                ${new Date(data.scannedAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
              </span>
                <span>${passedFactors}/${totalFactors} ${t.checksPassed}</span>
              </div>
            </div>
            ${generateScoreGauge(data.totalScore, t.score)}
          </div>
        </div>
      </div>
    </div>

    <!-- Info box -->
    <div class="info-box">
      <p><strong>GEO (Generative Engine Optimization)</strong> ${t.whatIsGeo}</p>
    </div>

    <!-- Factor Cards Grid -->
    <div class="grid-2">
      ${factorCards}
    </div>
  `;
}
