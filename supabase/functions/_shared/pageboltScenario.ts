/**
 * pageboltScenario.ts — Scénarios déterministes Pagebolt pour les médias LinkedIn.
 *
 * Objectif : arrêter les captures « à l'aveugle » (scroll de N pixels) et exécuter
 * un parcours EXACT sur des sélecteurs CSS réels :
 *   navigate → wait_for(ancre) → click(onglet) → wait_for(résultat) → hover → screenshot
 *
 * Un même scénario alimente deux endpoints :
 *   - /v1/sequence : jusqu'à 5 captures nettes → carrousel LinkedIn (1 requête / output)
 *   - /v1/video    : mêmes étapes sans les `screenshot` → screencast (3 requêtes)
 *
 * Provenance d'un scénario, par ordre de priorité :
 *   1. `linkedin_features_catalog.capture_scenario` (rédigé à la main dans l'admin)
 *   2. découverte automatique via /v1/inspect (sélecteurs réels de la route),
 *      pondérée par le sujet du post (titre + angle marketing de la feature)
 *   3. repli générique (navigate + scrolls)
 *
 * Limites Pagebolt respectées : 20 étapes, 5 outputs, 2 evaluate, 60 s, 15 s / étape.
 */

const PAGEBOLT_BASE = 'https://pagebolt.dev/api/v1';
export const MAX_STEPS = 20;
export const MAX_OUTPUTS = 5;

export type ScenarioStep = {
  action: 'navigate' | 'click' | 'fill' | 'select' | 'hover' | 'scroll' | 'wait' | 'wait_for' | 'screenshot';
  url?: string;
  selector?: string;
  value?: string;
  x?: number;
  y?: number;
  ms?: number;
  timeout?: number;
  name?: string;
  note?: string;
  fullPage?: boolean;
  live?: boolean;
  /** Zoom cinématique Pagebolt (clics uniquement) : { enabled, level 1.0–2.0 }. */
  zoom?: { enabled: boolean; level: number };
};


export type InspectedElement = {
  tag?: string;
  role?: string;
  text?: string;
  selector?: string;
  attributes?: Record<string, string>;
  rect?: { x: number; y: number; width: number; height: number };
};

const ALLOWED: ScenarioStep['action'][] = [
  'navigate', 'click', 'fill', 'select', 'hover', 'scroll', 'wait', 'wait_for', 'screenshot',
];

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/** Filtre et borne un scénario aux contraintes Pagebolt. Jette si structurellement invalide. */
export function sanitizeScenario(raw: unknown, fallbackUrl: string): ScenarioStep[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: ScenarioStep[] = [];
  let outputs = 0;

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const action = String(s.action ?? '') as ScenarioStep['action'];
    if (!ALLOWED.includes(action)) continue;

    if (action === 'screenshot') {
      if (outputs >= MAX_OUTPUTS) continue;
      outputs++;
      out.push({
        action,
        name: String(s.name ?? `shot-${outputs}`).slice(0, 60),
        fullPage: s.fullPage === true,
        note: s.note ? String(s.note).slice(0, 200) : undefined,
      });
      continue;
    }

    const step: ScenarioStep = { action };
    if (s.url) step.url = String(s.url);
    if (s.selector) step.selector = String(s.selector).slice(0, 400);
    if (s.value !== undefined) step.value = String(s.value).slice(0, 400);
    if (typeof s.x === 'number') step.x = s.x;
    if (typeof s.y === 'number') step.y = s.y;
    if (typeof s.ms === 'number') step.ms = Math.min(Math.max(s.ms, 200), 10_000);
    if (typeof s.timeout === 'number') step.timeout = Math.min(Math.max(s.timeout, 500), 15_000);
    if (s.note) step.note = String(s.note).slice(0, 200);
    if (s.zoom && typeof s.zoom === 'object' && action === 'click') {
      const z = s.zoom as Record<string, unknown>;
      const level = Math.min(Math.max(Number(z.level ?? 1.5) || 1.5, 1.1), 2);
      step.zoom = { enabled: z.enabled !== false, level: Number(level.toFixed(2)) };
    }


    if (action === 'navigate' && !step.url) continue;
    if (['click', 'hover', 'wait_for', 'fill', 'select'].includes(action) && !step.selector) continue;
    if (action === 'fill' && step.value === undefined) continue;
    if (action === 'wait' && !step.ms) step.ms = 1500;
    if (action === 'scroll' && step.x === undefined && step.y === undefined && !step.selector) continue;

    out.push(step);
    if (out.length >= MAX_STEPS) break;
  }

  if (out.length === 0 || out[0].action !== 'navigate') {
    out.unshift({ action: 'navigate', url: fallbackUrl });
  }
  return out.slice(0, MAX_STEPS);
}

/** Découverte automatique : /v1/inspect renvoie les sélecteurs réels de la route. */
export async function inspectRoute(
  apiKey: string,
  url: string,
  authState: Record<string, unknown> | null,
  timeoutMs = 45_000,
): Promise<InspectedElement[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${PAGEBOLT_BASE}/inspect`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        width: 1280,
        height: 720,
        darkMode: true,
        blockBanners: true,
        blockChats: true,
        waitUntil: 'networkidle2',
        ...(authState ? { authState } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`inspect ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    return Array.isArray(data.elements) ? (data.elements as InspectedElement[]) : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Construit un scénario adapté AU SUJET DU POST : les mots du titre et de l'angle
 * marketing servent à scorer les onglets/boutons de la page, on filme donc la partie
 * de l'outil dont parle réellement le post.
 */
export function buildScenarioFromInspection(
  url: string,
  subject: string,
  elements: InspectedElement[],
  maxShots = 4,
): ScenarioStep[] {
  const keywords = norm(subject)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);

  const clickable = elements.filter((e) => {
    const role = norm(e.role);
    const tag = norm(e.tag);
    return (
      e.selector &&
      norm(e.text).length > 1 &&
      (role === 'button' || role === 'tab' || tag === 'button' || (tag === 'a' && !norm(e.attributes?.href).startsWith('http')))
    );
  });

  const scored = clickable
    .map((e) => {
      const label = norm(e.text);
      const score = keywords.reduce((acc, k) => acc + (label.includes(k) ? 2 : 0), 0)
        + (norm(e.role) === 'tab' ? 1 : 0);
      return { el: e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, maxShots - 1));

  const anchor = elements.find((e) => e.selector && norm(e.tag) === 'h1')?.selector;

  const steps: ScenarioStep[] = [{ action: 'navigate', url }];
  if (anchor) steps.push({ action: 'wait_for', selector: anchor, timeout: 12_000 });
  steps.push({ action: 'wait', ms: 2500, live: true });
  steps.push({ action: 'screenshot', name: 'vue-ensemble' });

  let shots = 1;
  for (const { el } of scored) {
    if (shots >= maxShots || steps.length >= MAX_STEPS - 3) break;
    steps.push({ action: 'hover', selector: el.selector! });
    steps.push({ action: 'click', selector: el.selector! });
    steps.push({ action: 'wait', ms: 2200, live: true });
    shots++;
    steps.push({ action: 'screenshot', name: `etape-${shots}`, note: String(el.text ?? '').slice(0, 120) });
  }

  if (shots < 2) {
    steps.push({ action: 'scroll', y: 800 }, { action: 'wait', ms: 1800, live: true });
    steps.push({ action: 'screenshot', name: 'detail' });
  }

  return sanitizeScenario(steps, url);
}

/** Repli si l'inspection échoue : parcours neutre mais toujours déterministe. */
export function fallbackScenario(url: string): ScenarioStep[] {
  return [
    { action: 'navigate', url },
    { action: 'wait', ms: 3500, live: true },
    { action: 'screenshot', name: 'vue-ensemble' },
    { action: 'scroll', y: 700 },
    { action: 'wait', ms: 1800, live: true },
    { action: 'screenshot', name: 'section-2' },
    { action: 'scroll', y: 1500 },
    { action: 'wait', ms: 1800, live: true },
    { action: 'screenshot', name: 'section-3' },
  ];
}

/** Étapes pour /v1/video : les screenshots ne sont pas supportés, on les remplace par une pause filmée. */
export function toVideoSteps(scenario: ScenarioStep[]): ScenarioStep[] {
  const out: ScenarioStep[] = [];
  for (const s of scenario) {
    if (s.action === 'screenshot') {
      out.push({ action: 'wait', ms: 1600, live: true, note: s.note ?? s.name });
      continue;
    }
    out.push(s.action === 'wait' ? { ...s, live: true } : s);
    if (out.length >= MAX_STEPS) break;
  }
  return out.slice(0, MAX_STEPS);
}

/** Étapes pour /v1/sequence : garantit au moins une capture. */
export function toSequenceSteps(scenario: ScenarioStep[]): ScenarioStep[] {
  const steps = scenario.map((s) => {
    const { live: _live, ...rest } = s;
    return rest;
  });
  if (!steps.some((s) => s.action === 'screenshot')) {
    steps.push({ action: 'screenshot', name: 'vue-ensemble' });
  }
  return steps.slice(0, MAX_STEPS);
}

export type SequenceOutput = { name: string; type: string; format: string; data: string };

/** Exécute /v1/sequence et renvoie les captures décodées. */
export async function runSequence(
  apiKey: string,
  steps: ScenarioStep[],
  authState: Record<string, unknown> | null,
  timeoutMs = 90_000,
): Promise<{ outputs: SequenceOutput[]; stepResults: unknown[] }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${PAGEBOLT_BASE}/sequence`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steps,
        viewport: { width: 1280, height: 720 },
        darkMode: true,
        blockBanners: true,
        deviceScaleFactor: 2,
        ...(authState ? { authState } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Pagebolt sequence ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = await res.json();
    const outputs: SequenceOutput[] = Array.isArray(data.outputs) ? data.outputs : [];
    const failed = (Array.isArray(data.step_results) ? data.step_results : []).filter(
      (r: Record<string, unknown>) => r.status && r.status !== 'ok',
    );
    if (failed.length > 0) console.warn('[pageboltScenario] steps en échec:', JSON.stringify(failed).slice(0, 500));
    if (outputs.length === 0) throw new Error('Pagebolt sequence: aucune capture produite');
    return { outputs, stepResults: data.step_results ?? [] };
  } finally {
    clearTimeout(timer);
  }
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/^data:[^,]+,/, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
