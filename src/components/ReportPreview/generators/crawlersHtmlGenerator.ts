import { CrawlResult } from '@/types/crawler';
import { TranslationKeys } from '../translations';

export function generateCrawlersHTML(data: CrawlResult, t: TranslationKeys, language: string): string {
  const allowed = data.bots.filter((b) => b.status === 'allowed').length;
  const blocked = data.bots.filter((b) => b.status === 'blocked').length;
  const unknown = data.bots.filter((b) => b.status === 'unknown').length;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'allowed': return `✓ ${t.allowed}`;
      case 'blocked': return `✗ ${t.blocked}`;
      default: return `? ${t.unknown}`;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'allowed': return 'status-allowed';
      case 'blocked': return 'status-blocked';
      default: return 'status-unknown';
    }
  };


  const botsCards = data.bots.map((bot) => `
    <div class="card bot-card">
      <div class="bot-card-header">
        <div>
          <div class="bot-name">${bot.name}</div>
          <div class="bot-company">${bot.company}</div>
        </div>
        <div class="status-badge ${getStatusClass(bot.status)}">
          ${getStatusLabel(bot.status)}
        </div>
      </div>
      ${bot.reason ? `
        <div class="bot-reason">
          <strong>${t.reason} :</strong> ${bot.reason}
          ${bot.lineNumber ? `<span style="margin-left: 4px; opacity: 0.75; font-size: 12px;">(${t.line} ${bot.lineNumber})</span>` : ''}
        </div>
      ` : ''}
    </div>
  `).join('');

  return `
    <!-- Summary Header -->
    <div class="card summary-header card-shadow-lg" data-pdf-section="crawlers-summary">
      <div class="summary-header-content">
        <div class="url-info">
          <div>
            <h2 class="url-title">
              ${data.url}
            </h2>
            <div class="url-meta">
              <span class="url-meta-item">
                ${t.httpStatus} ${data.httpStatus}
              </span>
              <span class="url-meta-item">
                ${new Date(data.scannedAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
              </span>
            </div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-badge stat-badge-success">
            <div class="stat-value">${allowed}</div>
            <div class="stat-label">${t.allowed}</div>
          </div>
          <div class="stat-badge stat-badge-error">
            <div class="stat-value">${blocked}</div>
            <div class="stat-label">${t.blocked}</div>
          </div>
          ${unknown > 0 ? `
            <div class="stat-badge stat-badge-warning">
              <div class="stat-value">${unknown}</div>
              <div class="stat-label">${t.unknown}</div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Bot Cards Grid -->
    <div class="grid-3" data-pdf-section="crawlers-bots">
      ${botsCards}
    </div>
  `;
}
