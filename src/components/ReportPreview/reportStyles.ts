// Shared CSS styles that mirror the homepage Tailwind design system
export const getReportStyles = () => `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  :root {
    --background: hsl(210, 20%, 98%);
    --foreground: hsl(222, 47%, 11%);
    --card: hsl(0, 0%, 100%);
    --card-foreground: hsl(222, 47%, 11%);
    --primary: hsl(221, 83%, 53%);
    --primary-foreground: hsl(210, 40%, 98%);
    --muted: hsl(210, 40%, 96%);
    --muted-foreground: hsl(215, 16%, 47%);
    --border: hsl(214, 32%, 91%);
    --success: hsl(142, 76%, 36%);
    --success-foreground: hsl(0, 0%, 100%);
    --destructive: hsl(0, 84%, 60%);
    --destructive-foreground: hsl(0, 0%, 100%);
    --warning: hsl(38, 92%, 50%);
    --warning-foreground: hsl(0, 0%, 0%);
    --radius: 0.375rem;
  }
  
  body { 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
    background: var(--background); 
    min-height: 100vh; 
    padding: 24px 16px;
    color: var(--foreground);
    line-height: 1.5;
  }
  
  @media print {
    body {
      padding: 0;
    }
    @page {
      margin: 20mm 10mm;
    }
    .card, .bot-card, .factor-card, .summary-header, .header, .footer,
    .stat-badge, .score-gauge, .section-title, .grid-2 > *, .grid-3 > *, .grid-4 > * {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
  
  .container { max-width: 1152px; margin: 0 auto; }
  
  /* Header branding */
  .header { 
    text-align: center; 
    margin-bottom: 32px; 
    padding: 24px; 
    background: linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(263, 70%, 50%) 50%, hsl(280, 65%, 60%) 100%); 
    border-radius: 16px;
    color: white;
  }
  .logo-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #fbbf24, #a855f7, #3b82f6);
    border-radius: 10px;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-icon svg {
    width: 24px;
    height: 24px;
    color: white;
  }
  .logo-text { font-size: 24px; font-weight: 700; color: white; }
  .date { color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 4px; }
  
  /* Card styles matching homepage */
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  
  .card-shadow-lg {
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }
  
  /* Summary header card */
  .summary-header {
    padding: 24px;
    margin-bottom: 24px;
  }
  
  .summary-header-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  @media (min-width: 640px) {
    .summary-header-content {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
  
  .url-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .url-icon-wrapper {
    display: flex;
    height: 48px;
    width: 48px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: hsla(221, 83%, 53%, 0.1);
  }
  
  .url-icon-wrapper svg {
    height: 24px;
    width: 24px;
    color: var(--primary);
  }
  
  .url-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--foreground);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .url-title a {
    color: var(--muted-foreground);
    text-decoration: none;
  }
  
  .url-title a:hover {
    color: var(--primary);
  }
  
  .url-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 14px;
    color: var(--muted-foreground);
    margin-top: 4px;
  }
  
  .url-meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .url-meta-item svg {
    height: 14px;
    width: 14px;
  }
  
  /* Stats badges */
  .stats-row {
    display: flex;
    gap: 16px;
  }
  
  .stat-badge {
    border-radius: 8px;
    padding: 12px 16px;
    text-align: center;
    min-width: 80px;
  }
  
  .stat-badge-success {
    background: hsla(142, 76%, 36%, 0.1);
  }
  
  .stat-badge-success .stat-value {
    color: var(--success);
  }
  
  .stat-badge-success .stat-label {
    color: var(--success);
    opacity: 0.8;
  }
  
  .stat-badge-error {
    background: hsla(0, 84%, 60%, 0.1);
  }
  
  .stat-badge-error .stat-value {
    color: var(--destructive);
  }
  
  .stat-badge-error .stat-label {
    color: var(--destructive);
    opacity: 0.8;
  }
  
  .stat-badge-warning {
    background: hsla(38, 92%, 50%, 0.1);
  }
  
  .stat-badge-warning .stat-value {
    color: var(--warning);
  }
  
  .stat-badge-warning .stat-label {
    color: var(--warning);
    opacity: 0.8;
  }
  
  .stat-value {
    font-size: 28px;
    font-weight: 700;
  }
  
  .stat-label {
    font-size: 12px;
  }
  
  /* Grid layouts */
  .grid-2 {
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr;
  }
  
  @media (min-width: 640px) {
    .grid-2 {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  .grid-3 {
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr;
  }
  
  @media (min-width: 640px) {
    .grid-3 {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (min-width: 1024px) {
    .grid-3 {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  
  .grid-4 {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (min-width: 1024px) {
    .grid-4 {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  
  /* Bot card styles */
  .bot-card {
    padding: 20px;
  }
  
  .bot-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  
  .bot-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--foreground);
  }
  
  .bot-company {
    font-size: 14px;
    color: var(--muted-foreground);
  }
  
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid;
  }
  
  .status-badge svg {
    height: 16px;
    width: 16px;
  }
  
  .status-allowed {
    background: hsla(142, 76%, 36%, 0.1);
    color: var(--success);
    border-color: hsla(142, 76%, 36%, 0.2);
  }
  
  .status-blocked {
    background: hsla(0, 84%, 60%, 0.1);
    color: var(--destructive);
    border-color: hsla(0, 84%, 60%, 0.2);
  }
  
  .status-unknown {
    background: hsla(38, 92%, 50%, 0.1);
    color: var(--warning);
    border-color: hsla(38, 92%, 50%, 0.2);
  }
  
  .bot-reason {
    background: var(--muted);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    color: var(--muted-foreground);
  }
  
  .bot-reason strong {
    color: var(--foreground);
  }
  
  /* Priority badge styles */
  .priority-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    z-index: 1;
  }
  .priority-badge-critical {
    background: hsla(0, 84%, 60%, 0.12);
    color: var(--destructive);
    border: 1px solid hsla(0, 84%, 60%, 0.25);
  }
  .priority-badge-warning {
    background: hsla(38, 92%, 50%, 0.12);
    color: var(--warning);
    border: 1px solid hsla(38, 92%, 50%, 0.25);
  }

  /* GEO factor card styles */
  .factor-card {
    padding: 16px;
  }
  
  .factor-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  
  .factor-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .factor-name {
    font-weight: 600;
    color: var(--foreground);
  }
  
  .factor-status-icon {
    display: flex;
    height: 24px;
    width: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid;
  }
  
  .factor-status-icon svg {
    height: 14px;
    width: 14px;
  }
  
  .factor-status-good {
    background: hsla(142, 76%, 36%, 0.1);
    color: var(--success);
    border-color: hsla(142, 76%, 36%, 0.2);
  }
  
  .factor-status-warning {
    background: hsla(38, 92%, 50%, 0.1);
    color: var(--warning);
    border-color: hsla(38, 92%, 50%, 0.2);
  }
  
  .factor-status-error {
    background: hsla(0, 84%, 60%, 0.1);
    color: var(--destructive);
    border-color: hsla(0, 84%, 60%, 0.2);
  }
  
  .factor-desc {
    font-size: 14px;
    color: var(--muted-foreground);
    margin-top: 4px;
  }
  
  .factor-score {
    text-align: right;
  }
  
  .factor-score-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--foreground);
  }
  
  .factor-score-max {
    font-size: 14px;
    color: var(--muted-foreground);
  }
  
  .progress-bar {
    margin-top: 12px;
    height: 8px;
    width: 100%;
    border-radius: 9999px;
    background: var(--muted);
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.5s ease;
  }
  
  .progress-success { background: var(--success); }
  .progress-warning { background: var(--warning); }
  .progress-error { background: var(--destructive); }
  
  .factor-details {
    margin-top: 12px;
    font-size: 12px;
    font-family: monospace;
    background: hsla(var(--muted), 0.5);
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--muted-foreground);
  }
  
  /* Score gauge */
  .score-gauge {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .score-gauge svg {
    transform: rotate(-90deg);
  }
  
  .score-gauge-bg {
    fill: none;
    stroke: var(--muted);
    stroke-width: 8;
  }
  
  .score-gauge-fill {
    fill: none;
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s ease;
  }
  
  .score-gauge-fill.success { stroke: var(--success); }
  .score-gauge-fill.warning { stroke: var(--warning); }
  .score-gauge-fill.error { stroke: var(--destructive); }
  
  .score-gauge-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  
  .score-gauge-value {
    font-size: 36px;
    font-weight: 700;
  }
  
  .score-gauge-value.success { color: var(--success); }
  .score-gauge-value.warning { color: var(--warning); }
  .score-gauge-value.error { color: var(--destructive); }
  
  .score-gauge-max {
    font-size: 14px;
    color: var(--muted-foreground);
  }
  
  /* LLM compact card styles - matching BotCard style */
  .llm-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (min-width: 768px) {
    .llm-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  
  .llm-compact-card {
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--border);
    transition: box-shadow 0.2s ease;
  }
  
  .llm-compact-card:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
  }
  
  .llm-card-visible {
    background: hsla(142, 76%, 36%, 0.08);
    border-color: hsla(142, 76%, 36%, 0.2);
  }
  
  .llm-card-invisible {
    background: hsla(0, 84%, 60%, 0.08);
    border-color: hsla(0, 84%, 60%, 0.2);
  }
  
  .llm-compact-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  
  .llm-compact-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  
  .llm-compact-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .llm-compact-company {
    font-size: 12px;
    color: var(--muted-foreground);
  }
  
  .llm-compact-status {
    flex-shrink: 0;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  
  .status-visible {
    background: hsla(142, 76%, 36%, 0.15);
    color: var(--success);
  }
  
  .status-invisible {
    background: hsla(0, 84%, 60%, 0.15);
    color: var(--destructive);
  }
  
  .llm-compact-summary {
    font-size: 12px;
    color: var(--muted-foreground);
    margin-top: 8px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* PageSpeed styles */
  .pagespeed-scores {
    margin-bottom: 24px;
  }
  
  .pagespeed-score-card {
    padding: 16px;
    text-align: center;
  }
  
  .pagespeed-score-value {
    font-size: 32px;
    font-weight: 700;
  }
  
  .pagespeed-score-label {
    font-size: 12px;
    color: var(--muted-foreground);
    margin-top: 4px;
  }
  
  .metric-card {
    padding: 16px;
  }
  
  .metric-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  
  .metric-icon {
    display: flex;
    height: 40px;
    width: 40px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: hsla(221, 83%, 53%, 0.1);
  }
  
  .metric-icon svg {
    height: 20px;
    width: 20px;
    color: var(--primary);
  }
  
  .metric-label {
    font-size: 13px;
    color: var(--muted-foreground);
  }
  
  .metric-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--foreground);
  }
  
  .metric-desc {
    font-size: 12px;
    color: var(--muted-foreground);
    margin-top: 8px;
  }
  
  /* Section title */
  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--foreground);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .section-title svg {
    height: 20px;
    width: 20px;
    color: var(--primary);
  }
  
  /* Info box */
  .info-box {
    border-radius: 8px;
    border: 1px solid hsla(221, 83%, 53%, 0.2);
    background: hsla(221, 83%, 53%, 0.05);
    padding: 16px;
    margin-bottom: 24px;
  }
  
  .info-box p {
    font-size: 14px;
    color: var(--foreground);
  }
  
  .info-box strong {
    font-weight: 600;
  }
  
  /* Footer */
  .footer { 
    text-align: center; 
    margin-top: 32px; 
    padding: 24px; 
    background: linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(263, 70%, 50%) 100%); 
    border-radius: 16px; 
  }
  .footer-brand { color: white; font-size: 16px; font-weight: 600; margin-bottom: 12px; }
  .footer-cta { color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 8px; }
  .footer-link { 
    color: white; 
    text-decoration: none; 
    font-weight: 600; 
    padding: 10px 20px; 
    background: rgba(255,255,255,0.2); 
    border-radius: 8px; 
    display: inline-block; 
    transition: background 0.2s;
  }
  .footer-link:hover { background: rgba(255,255,255,0.3); }
  
  @media print {
    body { background: white; padding: 0; }
    .card { box-shadow: none; border: 1px solid #e5e7eb; }
    .header, .footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export const icons = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  helpCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  alertTriangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  bot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`,
  sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  timer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="12" y2="8"/><circle cx="12" cy="14" r="8"/></svg>`,
  move: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`,
  mousePointer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>`,
  thumbsUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  xCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
};
