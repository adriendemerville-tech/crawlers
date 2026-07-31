/**
 * pageboltCapture — capture visuelle réutilisable (Pagebolt)
 *
 * Fournit une capture desktop + mobile déterministe d'une URL publique,
 * stockée dans un bucket privé et exposée via URL signée.
 *
 * Aucun appel LLM : coût = 2 requêtes Pagebolt maximum.
 * Utilisé par : marina (rapport prospect) et site-visual-capture (PDF d'audit).
 */

const PAGEBOLT_BASE = 'https://pagebolt.dev/api/v1';

export const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

export type VisualCapture = {
  url: string;
  domain: string;
  desktop_url: string | null;
  mobile_url: string | null;
  captured_at: string;
  errors: string[];
};

export type CaptureOptions = {
  url: string;
  /** Client Supabase service role (storage.upload + createSignedUrl). */
  service: any;
  bucket: string;
  /** Préfixe de chemin dans le bucket, sans slash final. */
  pathPrefix: string;
  /** Durée de vie de l'URL signée, en secondes. Défaut : 30 jours. */
  signedTtl?: number;
  /** Capture mobile en plus du desktop. Défaut : true. */
  includeMobile?: boolean;
  /** Timeout par requête Pagebolt, en ms. Défaut : 45 000. */
  timeoutMs?: number;
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function safeDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return String(rawUrl || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  }
}

function slug(value: string): string {
  return (value || 'capture').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function pageboltScreenshot(
  apiKey: string,
  url: string,
  viewport: { width: number; height: number },
  fullPage: boolean,
  timeoutMs: number,
): Promise<Uint8Array | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${PAGEBOLT_BASE}/screenshot`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        viewport,
        full_page: fullPage,
        format: 'jpeg',
        quality: 72,
        wait_until: 'networkidle',
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn('[pageboltCapture] screenshot HTTP', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      const b64 = json?.screenshot || json?.image || json?.data?.screenshot || json?.data?.image;
      if (typeof b64 === 'string' && b64.length > 100) {
        return b64ToBytes(b64.replace(/^data:image\/\w+;base64,/, ''));
      }
      const remote = json?.url || json?.data?.url;
      if (typeof remote === 'string') {
        const bin = await fetch(remote);
        if (bin.ok) return new Uint8Array(await bin.arrayBuffer());
      }
      console.warn('[pageboltCapture] unexpected JSON payload keys:', Object.keys(json || {}).join(','));
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.warn('[pageboltCapture] screenshot failed:', err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function upload(
  service: any,
  bucket: string,
  path: string,
  bytes: Uint8Array,
  signedTtl: number,
): Promise<string | null> {
  const { error } = await service.storage.from(bucket).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) {
    console.error('[pageboltCapture] upload error:', error.message);
    return null;
  }
  const { data } = await service.storage.from(bucket).createSignedUrl(path, signedTtl);
  return data?.signedUrl ?? null;
}

/**
 * Capture desktop (+ mobile) d'une URL. Ne jette jamais : renvoie les erreurs
 * dans `errors` pour rester non bloquant dans les pipelines.
 */
export async function captureSiteVisual(opts: CaptureOptions): Promise<VisualCapture> {
  const {
    url, service, bucket, pathPrefix,
    signedTtl = 60 * 60 * 24 * 30,
    includeMobile = true,
    timeoutMs = 45_000,
  } = opts;

  const domain = safeDomain(url);
  const result: VisualCapture = {
    url, domain, desktop_url: null, mobile_url: null,
    captured_at: new Date().toISOString(), errors: [],
  };

  const apiKey = Deno.env.get('PAGEBOLT_API_KEY');
  if (!apiKey) {
    result.errors.push('PAGEBOLT_API_KEY absent');
    return result;
  }

  const stamp = Date.now();
  const base = `${pathPrefix.replace(/\/+$/, '')}/${slug(domain)}-${stamp}`;

  const [desktopBytes, mobileBytes] = await Promise.all([
    pageboltScreenshot(apiKey, url, DESKTOP_VIEWPORT, true, timeoutMs),
    includeMobile
      ? pageboltScreenshot(apiKey, url, MOBILE_VIEWPORT, false, timeoutMs)
      : Promise.resolve(null),
  ]);

  if (desktopBytes) {
    result.desktop_url = await upload(service, bucket, `${base}-desktop.jpg`, desktopBytes, signedTtl);
    if (!result.desktop_url) result.errors.push('upload desktop échoué');
  } else {
    result.errors.push('capture desktop échouée');
  }

  if (includeMobile) {
    if (mobileBytes) {
      result.mobile_url = await upload(service, bucket, `${base}-mobile.jpg`, mobileBytes, signedTtl);
      if (!result.mobile_url) result.errors.push('upload mobile échoué');
    } else {
      result.errors.push('capture mobile échouée');
    }
  }

  return result;
}

/** Bloc HTML "preuve visuelle" pour les rapports (Marina, rapports partagés). */
export function buildVisualEvidenceHtml(capture: VisualCapture | null, lang = 'fr'): string {
  if (!capture || (!capture.desktop_url && !capture.mobile_url)) return '';

  const t = lang === 'en'
    ? { title: 'Visual evidence', sub: 'Real rendering captured during the audit', desktop: 'Desktop rendering (full page)', mobile: 'Mobile rendering (above the fold)', at: 'Captured at' }
    : lang === 'es'
    ? { title: 'Prueba visual', sub: 'Renderizado real capturado durante la auditoría', desktop: 'Renderizado escritorio (página completa)', mobile: 'Renderizado móvil (primer pantalla)', at: 'Capturado el' }
    : { title: 'Preuve visuelle', sub: 'Rendu réel capturé pendant l\'audit', desktop: 'Rendu desktop (page entière)', mobile: 'Rendu mobile (au-dessus de la ligne de flottaison)', at: 'Capturé le' };

  const at = new Date(capture.captured_at).toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US');

  const desktopBlock = capture.desktop_url
    ? `<figure style="margin:0;flex:2 1 420px;">
        <img src="${capture.desktop_url}" alt="${t.desktop} — ${capture.domain}" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;display:block;" />
        <figcaption style="font-size:12px;color:#6b7280;margin-top:6px;">${t.desktop}</figcaption>
      </figure>` : '';

  const mobileBlock = capture.mobile_url
    ? `<figure style="margin:0;flex:1 1 200px;max-width:260px;">
        <img src="${capture.mobile_url}" alt="${t.mobile} — ${capture.domain}" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;display:block;" />
        <figcaption style="font-size:12px;color:#6b7280;margin-top:6px;">${t.mobile}</figcaption>
      </figure>` : '';

  return `<div class="section">
    <h2>${t.title}</h2>
    <p style="font-size:13px;color:#6b7280;margin-top:-6px;">${t.sub} — ${capture.domain} · ${t.at} ${at}</p>
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-top:12px;">
      ${desktopBlock}
      ${mobileBlock}
    </div>
  </div>`;
}
