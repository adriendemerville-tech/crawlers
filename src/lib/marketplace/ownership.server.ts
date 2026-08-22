/**
 * ownership.server.ts (L1a.13 / L1a.14)
 *
 * Vérification bloquante de propriété du domaine (§2.9). Deux méthodes en v1 :
 *  - `dns_txt` : enregistrement TXT `crawlers-marketplace=<token>` à la racine,
 *    résolu via DNS-over-HTTPS (le runtime serverless n'a pas de résolveur natif) ;
 *  - `gsc` : la propriété est déjà connectée à Search Console pour ce compte.
 *
 * Aucun actif ne passe en `verified` sans déclaration de propriété acceptée
 * (`marketplace_ownership_claims`), qui vaut engagement contractuel horodaté.
 */

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const TXT_PREFIX = 'crawlers-marketplace=';

export function normalizeDomain(input: string): string {
  const raw = input.trim().toLowerCase();
  const withoutScheme = raw.replace(/^https?:\/\//, '');
  return withoutScheme.replace(/\/.*$/, '').replace(/^www\./, '');
}

/** Token déterministe par (user, domaine) : régénérable, jamais deviné. */
export async function buildToken(userId: string, domain: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${normalizeDomain(domain)}:marketplace`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkDnsTxt(domain: string, token: string): Promise<{ ok: boolean; found: string[] }> {
  const name = normalizeDomain(domain);
  const res = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`Résolution DNS indisponible (${res.status})`);
  const payload = (await res.json()) as { Answer?: Array<{ data?: string }> };
  const found = (payload.Answer ?? [])
    .map((a) => (a.data ?? '').replace(/^"|"$/g, ''))
    .filter((d) => d.startsWith(TXT_PREFIX));
  return { ok: found.some((d) => d.slice(TXT_PREFIX.length).trim() === token), found };
}

export async function recordClaim(
  sb: { from: (t: string) => any },
  params: { userId: string; domain: string; claimText: string; claimVersion: number; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  const { error } = await sb.from('marketplace_ownership_claims').insert({
    user_id: params.userId,
    domain: normalizeDomain(params.domain),
    claim_text: params.claimText,
    claim_version: params.claimVersion,
    ip: params.ip ?? null,
    user_agent: params.userAgent ?? null,
  });
  if (error) throw new Error(`Déclaration de propriété non enregistrée : ${error.message}`);
}

export async function hasAcceptedClaim(
  sb: { from: (t: string) => any },
  params: { userId: string; domain: string },
): Promise<boolean> {
  const { data } = await sb
    .from('marketplace_ownership_claims')
    .select('id')
    .eq('user_id', params.userId)
    .eq('domain', normalizeDomain(params.domain))
    .limit(1);
  return Boolean(data && data.length > 0);
}

export interface VerifyResult {
  status: 'verified' | 'unverified';
  method: 'dns_txt' | 'gsc';
  token: string;
  message: string;
}

export async function verifyOwnership(
  sb: { from: (t: string) => any },
  params: { userId: string; domain: string; method: 'dns_txt' | 'gsc' },
): Promise<VerifyResult> {
  const domain = normalizeDomain(params.domain);
  const token = await buildToken(params.userId, domain);

  if (!(await hasAcceptedClaim(sb, { userId: params.userId, domain }))) {
    return {
      status: 'unverified',
      method: params.method,
      token,
      message: 'Déclaration de propriété non acceptée',
    };
  }

  let ok = false;
  let message = '';

  if (params.method === 'dns_txt') {
    try {
      const check = await checkDnsTxt(domain, token);
      ok = check.ok;
      message = ok
        ? 'Enregistrement TXT trouvé'
        : `Enregistrement TXT ${TXT_PREFIX}${token} absent de la zone ${domain}`;
    } catch (e) {
      message = (e as Error).message;
    }
  } else {
    const { data: site } = await sb
      .from('tracked_sites')
      .select('id, gsc_property, gsc_connected')
      .eq('user_id', params.userId)
      .eq('domain', domain)
      .maybeSingle();
    ok = Boolean(site?.gsc_connected && site?.gsc_property);
    message = ok
      ? 'Propriété Search Console confirmée pour ce compte'
      : 'Aucune propriété Search Console connectée pour ce domaine';
  }

  const status: 'verified' | 'unverified' = ok ? 'verified' : 'unverified';
  const now = new Date().toISOString();

  const { error } = await sb.from('marketplace_ownership_verifications').upsert(
    {
      user_id: params.userId,
      domain,
      method: params.method,
      token,
      status,
      verified_at: ok ? now : null,
      last_checked_at: now,
      last_error: ok ? null : message,
    },
    { onConflict: 'user_id,domain,method' },
  );
  if (error) throw new Error(`Vérification non enregistrée : ${error.message}`);

  if (ok) {
    await sb
      .from('marketplace_link_assets')
      .update({ ownership_status: 'verified' })
      .eq('user_id', params.userId)
      .eq('domain', domain);
  }

  return { status, method: params.method, token, message };
}
