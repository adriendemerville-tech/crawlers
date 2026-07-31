/**
 * conversion-visual-capture — Conversion Optimizer (couche visuelle)
 *
 * Capture la preuve visuelle d'une page de conversion via Pagebolt :
 *  - /v1/observe   : éléments interactifs + bounding boxes + screenshot desktop (1 seul chargement)
 *  - /v1/screenshot: rendu mobile above-the-fold (iPhone 14 Pro)
 *  - /v1/video     : screencast du parcours (optionnel, coûteux — sur demande explicite)
 *
 * Les frictions sont calculées de façon DÉTERMINISTE à partir des bounding boxes
 * (aucun appel LLM = zéro crédit consommé).
 *
 * Les médias sont stockés dans le bucket privé `conversion-captures` et exposés
 * via des URLs signées 30 jours.
 */
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';

const PAGEBOLT_API_KEY = Deno.env.get('PAGEBOLT_API_KEY');
const PAGEBOLT_BASE = 'https://pagebolt.dev/api/v1';
const BUCKET = 'conversion-captures';
const SIGNED_TTL = 60 * 60 * 24 * 30; // 30 jours

const DESKTOP_VIEWPORT = { width: 1280, height: 720 }; // défaut /v1/observe
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const MIN_TAP_TARGET = 44; // px — seuil tactile WCAG/Apple

type Rect = { x: number; y: number; w: number; h: number };
type ObservedElement = {
  role?: string;
  tag?: string;
  name?: string;
  text?: string;
  selector?: string;
  type?: string;
  rect?: Rect;
};
type Friction = {
  code: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  device: 'desktop' | 'mobile' | 'both';
  rect?: Rect | null;
};

const CTA_PATTERNS = [
  'acheter', 'commander', 'ajouter au panier', 'panier', 'reserver', 'réserver',
  'devis', 'demander', 'contact', 'essai', 'essayer', 'demarrer', 'démarrer',
  'inscription', "s'inscrire", 'inscrire', 'creer un compte', 'créer un compte',
  'telecharger', 'télécharger', 'rendez-vous', 'appeler', 'souscrire',
  'commencer', 'obtenir', 'reserver une demo', 'demo', 'démo', 'get started',
  'book', 'buy', 'start', 'sign up', 'subscribe', 'try',
];

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function isCta(el: ObservedElement): boolean {
  const label = normalize(`${el.name || ''} ${el.text || ''}`);
  if (!label) return false;
  const clickable = el.role === 'button' || el.role === 'link' || el.type === 'submit';
  if (!clickable) return false;
  return CTA_PATTERNS.some((p) => label.includes(p));
}

const FIELD_ROLES = ['textbox', 'searchbox', 'combobox', 'listbox', 'checkbox', 'radio', 'spinbutton', 'slider', 'switch'];

function isFormField(el: ObservedElement): boolean {
  if (el.role && FIELD_ROLES.includes(el.role)) return true;
  const t = (el.type || '').toLowerCase();
  return ['text', 'email', 'tel', 'password', 'number', 'date', 'url', 'search', 'textarea', 'select'].includes(t);
}

async function pagebolt(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${PAGEBOLT_BASE}${path}`, {
      method: 'POST',
      headers: { 'x-api-key': PAGEBOLT_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function uploadBytes(
  service: ReturnType<typeof getServiceClient>,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const { error } = await service.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) {
    console.error('[conversion-visual-capture] upload error:', error.message);
    return null;
  }
  const { data } = await service.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Règles déterministes de friction visuelle. */
function detectFrictions(
  elements: ObservedElement[],
  device: 'desktop' | 'mobile',
  viewport: { width: number; height: number },
): Friction[] {
  const frictions: Friction[] = [];
  const fold = viewport.height;
  const ctas = elements.filter(isCta);
  const ctasWithRect = ctas.filter((c) => c.rect && c.rect.h > 0);
  const atfCtas = ctasWithRect.filter((c) => (c.rect!.y + c.rect!.h) <= fold);

  if (ctasWithRect.length === 0) {
    frictions.push({
      code: 'no_cta_detected',
      severity: 'critical',
      title: 'Aucun appel à l\'action identifié',
      detail: `Aucun bouton ou lien à intention commerciale n'a été détecté sur le rendu ${device}. Le visiteur n'a pas de prochaine étape explicite.`,
      device,
    });
  } else if (atfCtas.length === 0) {
    const first = ctasWithRect.reduce((a, b) => (a.rect!.y <= b.rect!.y ? a : b));
    frictions.push({
      code: 'cta_below_fold',
      severity: 'critical',
      title: 'CTA principal sous la ligne de flottaison',
      detail: `Le premier appel à l'action ("${(first.name || first.text || '').slice(0, 60)}") apparaît à ${Math.round(first.rect!.y)} px, soit ${Math.round(first.rect!.y - fold)} px sous la zone visible (${fold} px) en ${device}.`,
      device,
      rect: first.rect,
    });
  }

  if (device === 'mobile') {
    const small = ctasWithRect.filter((c) => c.rect!.h < MIN_TAP_TARGET);
    if (small.length > 0) {
      frictions.push({
        code: 'tap_target_too_small',
        severity: 'high',
        title: 'Zone tactile trop petite',
        detail: `${small.length} appel(s) à l'action mesurent moins de ${MIN_TAP_TARGET} px de haut sur mobile (le plus petit : ${Math.round(small[0].rect!.h)} px). Le taux d'erreur au tap augmente fortement sous ce seuil.`,
        device,
        rect: small[0].rect,
      });
    }
  }

  const fields = elements.filter(isFormField);
  if (fields.length > 6) {
    frictions.push({
      code: 'form_too_long',
      severity: 'high',
      title: 'Formulaire trop long',
      detail: `${fields.length} champs détectés. Au-delà de 6 champs, chaque champ supplémentaire coûte en moyenne 5 à 10 % de complétion.`,
      device,
    });
  }

  const atfLinks = elements.filter(
    (e) => e.role === 'link' && e.rect && (e.rect.y + e.rect.h) <= fold,
  );
  if (atfLinks.length > 30) {
    frictions.push({
      code: 'atf_link_overload',
      severity: 'medium',
      title: 'Dispersion de l\'attention en haut de page',
      detail: `${atfLinks.length} liens sont visibles sans défiler en ${device}. Une densité élevée de sorties dilue le chemin de conversion.`,
      device,
    });
  }

  // Recouvrement du CTA par un overlay (bannière cookies, chat, popup)
  const overlayHints = ['cookie', 'consent', 'rgpd', 'gdpr', 'accepter', 'accept all', 'chat', 'newsletter', 'popup', 'modal'];
  const overlays = elements.filter((e) => {
    const label = normalize(`${e.name || ''} ${e.text || ''} ${e.selector || ''}`);
    return e.rect && overlayHints.some((h) => label.includes(h));
  });
  if (overlays.length > 0 && atfCtas.length > 0) {
    const cta = atfCtas[0].rect!;
    const blocker = overlays.find((o) => {
      const r = o.rect!;
      return r.x < cta.x + cta.w && r.x + r.w > cta.x && r.y < cta.y + cta.h && r.y + r.h > cta.y;
    });
    if (blocker) {
      frictions.push({
        code: 'cta_obstructed',
        severity: 'critical',
        title: 'CTA masqué par un calque',
        detail: `Un élément de type overlay ("${(blocker.name || blocker.text || blocker.selector || '').slice(0, 60)}") recouvre l'appel à l'action principal en ${device}.`,
        device,
        rect: blocker.rect,
      });
    }
  }

  return frictions;
}

const SEVERITY_WEIGHT: Record<Friction['severity'], number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

Deno.serve(handleRequest(async (req) => {
  if (!PAGEBOLT_API_KEY) return jsonError('PAGEBOLT_API_KEY is not configured', 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Unauthorized', 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const trackedSiteId = typeof body.tracked_site_id === 'string' ? body.tracked_site_id : null;
  const pageUrl = typeof body.page_url === 'string' ? body.page_url : null;
  const analysisId = typeof body.analysis_id === 'string' ? body.analysis_id : null;
  const withVideo = body.with_video === true;

  if (!trackedSiteId || !pageUrl) return jsonError('tracked_site_id and page_url are required', 400);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(pageUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('bad protocol');
  } catch {
    return jsonError('page_url must be a valid http(s) URL', 400);
  }

  const userClient = getUserClient(authHeader);
  const service = getServiceClient();

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const { data: site } = await userClient
    .from('tracked_sites')
    .select('id, domain')
    .eq('id', trackedSiteId)
    .maybeSingle();
  if (!site) return jsonError('Site not found or access denied', 404);

  const stamp = Date.now();
  const prefix = `${user.id}/${trackedSiteId}/${stamp}`;

  // ── 1. Observation desktop : éléments + rects + screenshot, en un seul chargement ──
  const observeRes = await pagebolt('/observe', {
    url: pageUrl,
    maxElements: 150,
    includeRects: true,
    includeScreenshot: true,
    screenshotFormat: 'webp',
    blockChats: false,
    blockAds: true,
    blockTrackers: true,
  }, 90_000);

  if (!observeRes.ok) {
    const errBody = await observeRes.text();
    console.error(`[conversion-visual-capture] observe failed [${observeRes.status}]: ${errBody.slice(0, 500)}`);
    return jsonError(`Pagebolt observe failed (${observeRes.status}): ${errBody.slice(0, 300)}`, observeRes.status);
  }

  const observed = await observeRes.json();
  const desktopElements: ObservedElement[] = Array.isArray(observed.elements) ? observed.elements : [];

  let desktopUrl: string | null = null;
  const desktopB64: string | undefined =
    observed.screenshot?.base64 ?? (typeof observed.screenshot === 'string' ? observed.screenshot : undefined);
  if (typeof desktopB64 === 'string' && desktopB64.length > 100) {
    desktopUrl = await uploadBytes(service, `${prefix}/desktop.webp`, b64ToBytes(desktopB64.replace(/^data:[^,]+,/, '')), 'image/webp');
  }

  // ── 2. Rendu mobile above-the-fold ──
  let mobileUrl: string | null = null;
  const mobileRes = await pagebolt('/screenshot', {
    url: pageUrl,
    viewportDevice: 'iphone_14_pro',
    viewportMobile: true,
    format: 'webp',
    quality: 82,
    fullPage: false,
    blockAds: true,
    blockTrackers: true,
    delay: 1200,
  }, 60_000);

  if (mobileRes.ok) {
    mobileUrl = await uploadBytes(service, `${prefix}/mobile.webp`, new Uint8Array(await mobileRes.arrayBuffer()), 'image/webp');
  } else {
    console.error(`[conversion-visual-capture] mobile screenshot failed [${mobileRes.status}]: ${(await mobileRes.text()).slice(0, 300)}`);
  }

  // ── 3. Observation mobile (rects only, pas de screenshot : moins de charge) ──
  let mobileElements: ObservedElement[] = [];
  const mobileObserve = await pagebolt('/observe', {
    url: pageUrl,
    maxElements: 150,
    includeRects: true,
    viewportDevice: 'iphone_14_pro',
    blockAds: true,
    blockTrackers: true,
  }, 60_000);
  if (mobileObserve.ok) {
    const mo = await mobileObserve.json();
    mobileElements = Array.isArray(mo.elements) ? mo.elements : [];
  }

  // ── 4. Frictions déterministes ──
  const frictions = [
    ...detectFrictions(desktopElements, 'desktop', DESKTOP_VIEWPORT),
    ...detectFrictions(mobileElements.length > 0 ? mobileElements : desktopElements, 'mobile', MOBILE_VIEWPORT),
  ];

  const penalty = frictions.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  const frictionScore = Math.max(0, 100 - penalty);

  // ── 5. Screencast du parcours (optionnel) ──
  let videoUrl: string | null = null;
  if (withVideo) {
    const firstCta = desktopElements.filter(isCta).find((c) => c.selector);
    const steps: Record<string, unknown>[] = [
      { action: 'navigate', url: pageUrl, note: 'Arrivée du visiteur' },
      { action: 'wait', ms: 2500, live: true },
      { action: 'scroll', y: 700, note: 'Lecture de la proposition de valeur' },
      { action: 'wait', ms: 1800, live: true },
      { action: 'scroll', y: 1500, note: 'Recherche de l\'appel à l\'action' },
      { action: 'wait', ms: 1800, live: true },
    ];
    if (firstCta?.selector) {
      steps.push({ action: 'click', selector: firstCta.selector, note: 'Clic sur le CTA principal' });
      steps.push({ action: 'wait', ms: 3000, live: true });
    }

    const videoRes = await pagebolt('/video', {
      steps,
      viewport: { width: 1280, height: 720 },
      format: 'mp4',
      framerate: 30,
      blockBanners: false,
      blockAds: true,
      pace: 'normal',
      cursor: { style: 'classic', color: '#7C3AED', persist: true, size: 22 },
      clickEffect: { enabled: true, style: 'ripple', color: '#F59E0B' },
      frame: { enabled: true, style: 'macos', theme: 'dark', showUrl: true },
    }, 200_000);

    if (videoRes.ok) {
      videoUrl = await uploadBytes(service, `${prefix}/journey.mp4`, new Uint8Array(await videoRes.arrayBuffer()), 'video/mp4');
    } else {
      console.error(`[conversion-visual-capture] video failed [${videoRes.status}]: ${(await videoRes.text()).slice(0, 300)}`);
    }
  }

  const { data: inserted, error: insertErr } = await service
    .from('conversion_visual_captures')
    .insert({
      user_id: user.id,
      tracked_site_id: trackedSiteId,
      analysis_id: analysisId,
      page_url: pageUrl,
      desktop_screenshot_url: desktopUrl,
      mobile_screenshot_url: mobileUrl,
      video_url: videoUrl,
      frictions,
      observed_elements: {
        desktop_count: desktopElements.length,
        mobile_count: mobileElements.length,
        cta_count: desktopElements.filter(isCta).length,
        form_field_count: desktopElements.filter(isFormField).length,
      },
      friction_score: frictionScore,
      status: 'ready',
    })
    .select('id')
    .maybeSingle();

  if (insertErr) console.error('[conversion-visual-capture] insert error:', insertErr.message);

  // ── 6. Injection des frictions critiques dans le workbench Architect ──
  const workbenchItems = frictions
    .filter((f) => f.severity === 'critical' || f.severity === 'high')
    .map((f) => ({
      domain: site.domain,
      tracked_site_id: trackedSiteId,
      user_id: user.id,
      source_type: 'conversion_visual',
      source_function: 'conversion-visual-capture',
      source_record_id: `cvc_${trackedSiteId}_${pageUrl}_${f.code}_${f.device}`,
      finding_category: 'ux_optimization',
      severity: f.severity,
      title: `Conversion (${f.device}) : ${f.title}`,
      description: f.detail,
      target_url: pageUrl,
      target_selector: 'cta',
      target_operation: 'replace',
      payload: { friction_code: f.code, device: f.device, rect: f.rect ?? null, friction_score: frictionScore },
    }));

  if (workbenchItems.length > 0) {
    const { error: wbErr } = await service
      .from('architect_workbench')
      .upsert(workbenchItems, { onConflict: 'source_type,source_record_id' });
    if (wbErr) console.error('[conversion-visual-capture] workbench error:', wbErr.message);
  }

  return jsonOk({
    success: true,
    capture_id: inserted?.id ?? null,
    desktop_screenshot_url: desktopUrl,
    mobile_screenshot_url: mobileUrl,
    video_url: videoUrl,
    friction_score: frictionScore,
    frictions,
  });
}, 'conversion-visual-capture'));
