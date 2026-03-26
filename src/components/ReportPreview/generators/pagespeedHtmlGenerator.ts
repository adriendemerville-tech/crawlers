import { PageSpeedResult } from '@/types/pagespeed';
import { TranslationKeys } from '../translations';

function getScoreColor(score: number): string {
  if (score >= 90) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--destructive)';
}

function getScoreBg(score: number): string {
  if (score >= 90) return 'hsla(142, 76%, 36%, 0.1)';
  if (score >= 50) return 'hsla(38, 92%, 50%, 0.1)';
  return 'hsla(0, 84%, 60%, 0.1)';
}

export function generatePageSpeedHTML(data: PageSpeedResult, t: TranslationKeys): string {
  const { scores } = data;

  const scoreCards = [
    { label: t.performance, value: scores.performance },
    { label: t.accessibility, value: scores.accessibility },
    { label: t.bestPractices, value: scores.bestPractices },
    { label: t.seo, value: scores.seo },
  ].map(item => `
    <div class="card pagespeed-score-card" style="background: ${getScoreBg(item.value)};">
      <div class="pagespeed-score-value" style="color: ${getScoreColor(item.value)};">${item.value}</div>
      <div class="pagespeed-score-label">${item.label}</div>
    </div>
  `).join('');

  // Format CLS: unitless score, max 3 decimals
  const formattedCls = (() => {
    const raw = parseFloat(scores.cls);
    if (isNaN(raw)) return scores.cls;
    return raw.toFixed(3);
  })();

  const vitals = [
    { label: 'First Contentful Paint', value: scores.fcp, desc: t.fcpDesc },
    { label: 'Largest Contentful Paint', value: scores.lcp, desc: t.lcpDesc },
    { label: 'Cumulative Layout Shift', value: `${formattedCls} (score)`, desc: t.clsDesc },
    { label: 'Total Blocking Time', value: scores.tbt, desc: t.tbtDesc },
    { label: 'Speed Index', value: scores.speedIndex, desc: t.speedIndexDesc },
    { label: 'Time to Interactive', value: scores.tti, desc: t.ttiDesc },
  ];

  const vitalCards = vitals.map(v => `
    <div class="card metric-card">
      <div class="metric-header">
        <div>
          <div class="metric-label">${v.label}</div>
          <div class="metric-value">${v.value}</div>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <!-- Section title -->
    <h2 class="section-title" style="margin-bottom: 24px;">
      ${t.pagespeed}
    </h2>

    <!-- Main Scores -->
    <div class="grid-4 pagespeed-scores">
      ${scoreCards}
    </div>

    <!-- Core Web Vitals -->
    <div class="card" style="padding: 24px;">
      <h3 class="section-title">
        ${t.coreWebVitals}
      </h3>
      <div class="grid-3" style="margin-top: 16px;">
        ${vitalCards}
      </div>
    </div>
  `;
}
