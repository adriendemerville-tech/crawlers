// Crawlers Extension — Sidepanel logic
import { signIn, signOut, getSession, isAuthenticated } from './auth.js';
import { FUNCTIONS_URL, SUPABASE_ANON_KEY, APP_URL } from './config.js';

// ─── DOM refs ──────────────────────────────────────────────────
const el = {
  viewLogin: document.getElementById('view-login'),
  viewMain: document.getElementById('view-main'),
  loginForm: document.getElementById('login-form'),
  loginSubmit: document.getElementById('login-submit'),
  loginError: document.getElementById('login-error'),
  signoutBtn: document.getElementById('signout-btn'),
  currentUrl: document.getElementById('current-url'),
  modeBadge: document.getElementById('mode-badge'),
  auditBtn: document.getElementById('audit-btn'),
  auditStatus: document.getElementById('audit-status'),
  auditResults: document.getElementById('audit-results'),
  resultsContent: document.getElementById('results-content'),
  openApp: document.getElementById('open-app'),
};

// ─── State ─────────────────────────────────────────────────────
let currentTab = null;
let currentDomain = null;
let isTrackedSite = false;

// ─── Helpers ───────────────────────────────────────────────────
function show(view) {
  el.viewLogin.classList.toggle('hidden', view !== 'login');
  el.viewMain.classList.toggle('hidden', view !== 'main');
  el.signoutBtn.classList.toggle('hidden', view !== 'main');
}

function setStatus(msg, type = '') {
  el.auditStatus.className = `status ${type}`;
  el.auditStatus.innerHTML = msg;
  el.auditStatus.classList.remove('hidden');
}

function clearStatus() {
  el.auditStatus.classList.add('hidden');
  el.auditStatus.textContent = '';
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function setMode(label, klass) {
  el.modeBadge.className = `mode-badge ${klass}`;
  el.modeBadge.querySelector('.mode-label').textContent = label;
}

// ─── Get current tab + detect tracked site ─────────────────────
async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  if (!tab?.url || !/^https?:/.test(tab.url)) {
    el.currentUrl.textContent = 'URL non auditée (page interne du navigateur)';
    el.auditBtn.disabled = true;
    setMode('Indisponible', '');
    return;
  }
  el.currentUrl.textContent = tab.url;
  currentDomain = extractDomain(tab.url);
  el.auditBtn.disabled = false;
  await detectMode();
}

async function detectMode() {
  if (!currentDomain) return;
  setMode('Détection…', '');
  try {
    const session = await getSession();
    const res = await fetch(`${FUNCTIONS_URL}/extension-audit-router?check=1&domain=${encodeURIComponent(currentDomain)}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      isTrackedSite = !!data.is_tracked;
      if (isTrackedSite) setMode('Mode Pilote', 'pilote');
      else setMode('Mode Espion', 'espion');
    } else {
      setMode('Mode Espion', 'espion');
    }
  } catch (e) {
    setMode('Mode Espion', 'espion');
  }
}

// ─── Audit launch ─────────────────────────────────────────────
async function launchAudit() {
  if (!currentTab?.url) return;
  el.auditBtn.disabled = true;
  el.auditResults.classList.add('hidden');
  setStatus('<span class="spinner"></span> Audit en cours (Stratégique + Expert + E-E-A-T + Machine Layer + Conversion)… 60 à 90 s.');

  try {
    const session = await getSession();
    if (!session) throw new Error('Session expirée — reconnectez-vous.');

    // 1. Capture light DOM signals from the active tab
    let domSignals = null;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: extractDomSignals,
      });
      domSignals = result;
    } catch (e) {
      console.warn('[Crawlers] DOM extraction blocked:', e);
    }

    // 2. Call the audit router
    const res = await fetch(`${FUNCTIONS_URL}/extension-audit-router`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: currentTab.url,
        domain: currentDomain,
        title: currentTab.title,
        dom_signals: domSignals,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    renderResults(data);
    clearStatus();
  } catch (err) {
    setStatus(`Erreur : ${err.message}`, 'error');
  } finally {
    el.auditBtn.disabled = false;
  }
}

// Injected into the active page — extracts lightweight signals
function extractDomSignals() {
  const has = (sel) => !!document.querySelector(sel);
  const count = (sel) => document.querySelectorAll(sel).length;
  const text = (sel) => document.querySelector(sel)?.textContent?.trim()?.slice(0, 300) || null;
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
    document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || null;

  return {
    title: document.title?.slice(0, 200) || null,
    h1: text('h1'),
    h1_count: count('h1'),
    h2_count: count('h2'),
    meta_description: meta('description'),
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
    og_title: meta('og:title'),
    og_image: meta('og:image'),
    has_schema: count('script[type="application/ld+json"]') > 0,
    schema_count: count('script[type="application/ld+json"]'),
    image_count: count('img'),
    images_without_alt: count('img:not([alt])'),
    internal_links: count('a[href^="/"], a[href^="' + location.origin + '"]'),
    external_links: count('a[href^="http"]:not([href^="' + location.origin + '"])'),
    word_count: (document.body?.innerText || '').split(/\s+/).filter(Boolean).length,
    has_form: has('form'),
    has_pricing_signal: /(prix|tarif|pricing|abonn|essai gratuit|free trial|demo|devis)/i.test(document.body?.innerText?.slice(0, 5000) || ''),
    has_cart_signal: has('[class*="cart"], [class*="panier"], [id*="cart"], [class*="checkout"]'),
    has_signup_signal: has('a[href*="signup"], a[href*="register"], a[href*="inscription"]'),
    cms_hints: {
      wordpress: has('meta[name="generator"][content*="WordPress"]') || has('link[href*="wp-content"]'),
      shopify: has('meta[name="generator"][content*="Shopify"]') || /Shopify\.theme/.test(document.documentElement.innerHTML.slice(0, 50000)),
      webflow: has('html[data-wf-page]'),
      wix: has('meta[name="generator"][content*="Wix"]'),
      squarespace: /Squarespace/.test(document.documentElement.innerHTML.slice(0, 20000)),
    },
    lang: document.documentElement.lang || null,
  };
}

// ─── Render results ───────────────────────────────────────────
function renderResults(data) {
  const summary = data.summary || {};
  const findings = data.findings || [];
  const scores = data.scores || {};

  const fmtScore = (s) => (s === null || s === undefined) ? '—' : Math.round(Number(s));

  const summaryHtml = `
    <div class="summary">
      <div class="summary-card">
        <div class="num">${summary.findings_count || 0}</div>
        <div class="lbl">Findings</div>
      </div>
      <div class="summary-card">
        <div class="num">${summary.critical_count || 0}</div>
        <div class="lbl">Critiques</div>
      </div>
      <div class="summary-card">
        <div class="num">${summary.workbench_inserted || 0}</div>
        <div class="lbl">Workbench</div>
      </div>
      <div class="summary-card">
        <div class="num">${summary.identity_updated ? 'Oui' : 'Non'}</div>
        <div class="lbl">Carte ID</div>
      </div>
    </div>
    <div class="scores-grid">
      <div class="score-card"><div class="score-num">${fmtScore(scores.strategic)}</div><div class="score-lbl">Stratégique</div></div>
      <div class="score-card"><div class="score-num">${fmtScore(scores.expert)}</div><div class="score-lbl">Expert</div></div>
      <div class="score-card"><div class="score-num">${fmtScore(scores.eeat)}</div><div class="score-lbl">E-E-A-T</div></div>
      <div class="score-card"><div class="score-num">${fmtScore(scores.machine_layer)}</div><div class="score-lbl">Machine Layer</div></div>
      <div class="score-card ${scores.conversion === null ? 'muted' : ''}">
        <div class="score-num">${fmtScore(scores.conversion)}</div>
        <div class="score-lbl">Conversion${scores.conversion === null ? ' (Pilote)' : ''}</div>
      </div>
    </div>
  `;

  const findingsHtml = findings.length === 0
    ? '<p style="color: var(--text-muted); font-size: 13px;">Aucun finding remonté.</p>'
    : findings.slice(0, 12).map((f) => `
        <div class="finding ${f.severity || 'medium'}">
          <div class="finding-title">${escapeHtml(f.title || 'Finding')}</div>
          <div class="finding-meta">${escapeHtml(f.category || '')} · ${escapeHtml(f.severity || '')}</div>
        </div>
      `).join('');

  el.resultsContent.innerHTML = summaryHtml + findingsHtml;
  el.auditResults.classList.remove('hidden');

  el.openApp.href = isTrackedSite
    ? `${APP_URL}/profile?tab=tracking&domain=${encodeURIComponent(currentDomain)}`
    : `${APP_URL}/console`;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[c]));
}

// ─── Auth events ──────────────────────────────────────────────
el.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.loginError.classList.add('hidden');
  el.loginSubmit.disabled = true;
  el.loginSubmit.textContent = 'Connexion…';

  const fd = new FormData(el.loginForm);
  try {
    await signIn(fd.get('email'), fd.get('password'));
    show('main');
    await loadCurrentTab();
  } catch (err) {
    el.loginError.textContent = err.message;
    el.loginError.classList.remove('hidden');
  } finally {
    el.loginSubmit.disabled = false;
    el.loginSubmit.textContent = 'Se connecter';
  }
});

el.signoutBtn.addEventListener('click', async () => {
  await signOut();
  show('login');
});

el.auditBtn.addEventListener('click', launchAudit);

// ─── Init ─────────────────────────────────────────────────────
(async () => {
  const authed = await isAuthenticated();
  if (authed) {
    show('main');
    await loadCurrentTab();
  } else {
    show('login');
  }
})();

// React to tab changes while panel is open
chrome.tabs.onActivated.addListener(async () => {
  if (await isAuthenticated()) await loadCurrentTab();
});
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status === 'complete' && (await isAuthenticated())) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === tabId) await loadCurrentTab();
  }
});
