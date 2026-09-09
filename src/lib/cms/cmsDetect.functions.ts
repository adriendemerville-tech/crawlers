import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { detectPlatform, type PlatformDetection } from './platformFingerprints';

const PRIVATE_HOST =
  /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

function normalizeTarget(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (PRIVATE_HOST.test(url.hostname)) return null;
  if (!url.hostname.includes('.')) return null;
  return url;
}

async function fetchOnce(url: string): Promise<{ html: string; headers: string[] } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'CrawlersBot/1.0 (+https://crawlers.fr/bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const headers: string[] = [];
    res.headers.forEach((v, k) => headers.push(`${k}: ${v}`));
    // 400 Ko suffisent : les empreintes vivent dans le <head> et les premiers scripts.
    const body = await res.text();
    return { html: body.slice(0, 400_000), headers };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Détecte la plateforme d'un site à partir de son nom de domaine, afin de
 * n'afficher à l'utilisateur que la bonne voie de connexion.
 * Aucun appel LLM : uniquement des empreintes HTML / en-têtes.
 */
export const detectSitePlatform = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().min(3).max(300) }).parse(data))
  .handler(async ({ data }): Promise<PlatformDetection & { url: string | null; reachable: boolean }> => {
    const target = normalizeTarget(data.url);
    if (!target) {
      return { platform: null, confidence: 'none', signals: [], runnersUp: [], url: null, reachable: false };
    }

    let page = await fetchOnce(target.toString());
    if (!page && target.protocol === 'https:') {
      target.protocol = 'http:';
      page = await fetchOnce(target.toString());
    }
    if (!page) {
      return {
        platform: null,
        confidence: 'none',
        signals: [],
        runnersUp: [],
        url: target.toString(),
        reachable: false,
      };
    }

    const detection = detectPlatform(page.html, page.headers);
    return { ...detection, url: target.toString(), reachable: true };
  });
