import { LLMAnalysisResult, SentimentType } from '@/types/llm';
import { TranslationKeys } from '../translations';
import { icons } from '../reportStyles';

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

function getSentimentLabel(sentiment: SentimentType, t: TranslationKeys): string {
  const labels: Record<SentimentType, string> = {
    positive: t.sentimentPositive,
    mostly_positive: t.sentimentMostlyPositive,
    neutral: t.sentimentNeutral,
    mixed: t.sentimentMixed,
    negative: t.sentimentNegative,
  };
  return labels[sentiment] || t.sentimentNeutral;
}

function getSentimentIcon(sentiment: SentimentType): string {
  switch (sentiment) {
    case 'positive': return icons.checkCircle;
    case 'mostly_positive': return icons.thumbsUp;
    case 'neutral': return icons.minus;
    case 'mixed': return icons.scale;
    case 'negative': return icons.xCircle;
    default: return icons.minus;
  }
}

export function generateLLMHTML(data: LLMAnalysisResult, t: TranslationKeys): string {
  const citationCards = data.citations.map((citation) => `
    <div class="card llm-card">
      <div class="llm-header">
        <div>
          <div class="llm-provider">${citation.provider.name}</div>
          <div class="llm-company">${citation.provider.company}</div>
        </div>
        <div class="llm-cited">${citation.cited ? '✅' : '❌'}</div>
      </div>
      <div class="llm-sentiment sentiment-${citation.sentiment}">
        ${getSentimentIcon(citation.sentiment)}
        ${getSentimentLabel(citation.sentiment, t)}
      </div>
      ${citation.summary ? `<p class="llm-summary">${citation.summary}</p>` : ''}
      <div class="llm-recommends ${citation.recommends ? 'yes' : 'no'}">
        ${citation.recommends ? icons.thumbsUp : icons.minus}
        ${t.recommends}: ${citation.recommends ? t.yes : t.no}
      </div>
    </div>
  `).join('');

  const coveragePercent = Math.round((data.citationRate.cited / data.citationRate.total) * 100);
  const coverageClass = coveragePercent >= 70 ? 'stat-badge-success' : coveragePercent >= 40 ? 'stat-badge-warning' : 'stat-badge-error';

  return `
    <!-- Summary Header with Score -->
    <div class="card summary-header card-shadow-lg">
      <div class="summary-header-content" style="flex-direction: column; align-items: center; gap: 24px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 24px; justify-content: space-between; width: 100%;">
          <div style="flex: 1; min-width: 200px;">
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 20px; background: hsla(221, 83%, 53%, 0.1); margin-bottom: 8px;">
              ${icons.brain}
              <span style="font-size: 14px; font-weight: 500; color: var(--primary);">${t.llm}</span>
            </div>
            <h2 class="url-title">
              ${data.domain}
              <a href="${data.url}" target="_blank" rel="noopener noreferrer">
                ${icons.externalLink}
              </a>
            </h2>
            <div class="url-meta">
              <span class="url-meta-item">
                ${icons.clock}
                ${new Date(data.scannedAt).toLocaleTimeString()}
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
    <div class="card" style="padding: 20px; margin-bottom: 24px;">
      <h3 class="section-title">
        ${icons.brain}
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
      <p style="margin-top: 12px; font-size: 14px; color: var(--muted-foreground);">${t.citationRateDesc}</p>
    </div>

    <!-- LLM Cards Grid -->
    <div class="grid-2">
      ${citationCards}
    </div>
  `;
}
