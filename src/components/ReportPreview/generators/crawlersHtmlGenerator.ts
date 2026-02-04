import { CrawlResult } from '@/types/crawler';
import { TranslationKeys } from '../translations';
import { icons } from '../reportStyles';

export function generateCrawlersHTML(data: CrawlResult, t: TranslationKeys, language: string): string {
  const allowed = data.bots.filter((b) => b.status === 'allowed').length;
  const blocked = data.bots.filter((b) => b.status === 'blocked').length;
  const unknown = data.bots.filter((b) => b.status === 'unknown').length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'allowed': return icons.check;
      case 'blocked': return icons.x;
      default: return icons.helpCircle;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'allowed': return 'status-allowed';
      case 'blocked': return 'status-blocked';
      default: return 'status-unknown';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'allowed': return t.allowed;
      case 'blocked': return t.blocked;
      default: return t.unknown;
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
          ${getStatusIcon(bot.status)}
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
    <div class="card summary-header card-shadow-lg">
      <div class="summary-header-content">
        <div class="url-info">
          <div class="url-icon-wrapper">
            ${icons.globe}
          </div>
          <div>
            <h2 class="url-title">
              ${data.url}
              <a href="${data.url.startsWith('http') ? data.url : `https://${data.url}`}" target="_blank" rel="noopener noreferrer">
                ${icons.externalLink}
              </a>
            </h2>
            <div class="url-meta">
              <span class="url-meta-item">
                ${icons.fileText}
                ${t.httpStatus} ${data.httpStatus}
              </span>
              <span class="url-meta-item">
                ${icons.clock}
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
    <div class="grid-3">
      ${botsCards}
    </div>
  `;
}
