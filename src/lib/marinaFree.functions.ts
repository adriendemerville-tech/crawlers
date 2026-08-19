import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { MARINA_FREE_QUOTA } from './marinaFree.constants';

// Essai gratuit de Marina sans compte : 2 rapports complets par adresse IP,
// email obligatoire (capture de lead + second garde-fou anti-abus).
// Toute la logique de quota est serveur : le client ne fait que l'afficher.


function clientIpFromHeaders(): string {
  const fwd = getRequestHeader('x-forwarded-for') || '';
  const first = fwd.split(',')[0]?.trim();
  return (
    first ||
    getRequestHeader('cf-connecting-ip') ||
    getRequestHeader('x-real-ip') ||
    'unknown'
  );
}

// L'IP n'est jamais stockée en clair : empreinte SHA-256 salée par une clé serveur.
async function hashIp(ip: string): Promise<string> {
  const pepper = (process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'marina').slice(0, 24);
  const bytes = new TextEncoder().encode(`marina-free:${pepper}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const getMarinaFreeQuota = createServerFn({ method: 'GET' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const ipHash = await hashIp(clientIpFromHeaders());
  const { count } = await supabaseAdmin
    .from('marina_free_trials')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash);
  const used = count ?? 0;
  return { quota: MARINA_FREE_QUOTA, used, remaining: Math.max(0, MARINA_FREE_QUOTA - used) };
});

export const startMarinaFreeAudit = createServerFn({ method: 'POST' })
  .inputValidator((input: { url: string; email: string; lang?: string }) => input)
  .handler(async ({ data }) => {
    const targetUrl = normalizeUrl(String(data.url || ''));
    if (!targetUrl) return { error: 'invalid_url' as const, message: 'URL invalide' };

    const email = String(data.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 160) {
      return { error: 'invalid_email' as const, message: 'Adresse email invalide' };
    }

    const lang = typeof data.lang === 'string' ? data.lang.slice(0, 5) : 'fr';
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const ipHash = await hashIp(clientIpFromHeaders());

    const { count: ipCount } = await supabaseAdmin
      .from('marina_free_trials')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash);
    if ((ipCount ?? 0) >= MARINA_FREE_QUOTA) {
      return {
        error: 'quota_exhausted' as const,
        message: `Vos ${MARINA_FREE_QUOTA} rapports gratuits ont été utilisés. Créez un compte pour continuer (5 crédits offerts = 1 rapport).`,
        remaining: 0,
      };
    }

    const { count: emailCount } = await supabaseAdmin
      .from('marina_free_trials')
      .select('id', { count: 'exact', head: true })
      .eq('email', email);
    if ((emailCount ?? 0) >= MARINA_FREE_QUOTA) {
      return {
        error: 'quota_exhausted' as const,
        message: 'Cette adresse email a déjà utilisé ses rapports gratuits. Créez un compte pour continuer.',
        remaining: 0,
      };
    }

    const launch = await launchMarinaJob(supabaseAdmin, targetUrl, lang);
    if ('error' in launch) return launch;


    // La consommation n'est comptée qu'après un lancement réussi.
    await supabaseAdmin.from('marina_free_trials').insert({
      ip_hash: ipHash,
      email,
      domain: new URL(targetUrl).hostname.replace(/^www\./, ''),
      job_id: launch.job_id,
      lang,
    });

    return {
      jobId: launch.job_id,
      status: launch.status || 'pending',
      queuePosition: launch.queue_position ?? null,
      remaining: Math.max(0, MARINA_FREE_QUOTA - ((ipCount ?? 0) + 1)),
    };
  });
