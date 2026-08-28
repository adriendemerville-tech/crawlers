// Relevé d'autorité de la matrice : profil de liens (DataForSEO) + signaux
// E-E-A-T lus dans les pages réellement servies.
//
// Budget : 1 appel `backlinks/summary/live` par domaine (cible + 3 rivaux max,
// en un seul batch), 1 appel `backlinks/anchors/live` pour la cible, et 2 GET
// HTTP au plus (accueil + page « à propos » découverte dans l'accueil).
// Aucun token LLM. Une donnée absente reste `null`, jamais estimée.

import { dfsPost } from './dfs.server';
import { computeAuthorityScore, normalizeDomainRank } from './authorityScore';
import type { AuthorityReading, BacklinkProfile, Competitor, OnPageEeatReading } from './types';

/** Rivaux dont le profil de liens sert de référence de marché. */
const RIVAL_PROFILES = 3;

function toProfile(domain: string, isTarget: boolean, item: any): BacklinkProfile {
  const rankRaw = typeof item?.rank === 'number' ? item.rank : null;
  const referringDomains = typeof item?.referring_domains === 'number' ? item.referring_domains : null;
  const backlinks = typeof item?.backlinks === 'number' ? item.backlinks : null;
  const dofollow = typeof item?.referring_links_attributes?.dofollow === 'number'
    ? item.referring_links_attributes.dofollow
    : null;
  const nofollow = typeof item?.referring_links_attributes?.nofollow === 'number'
    ? item.referring_links_attributes.nofollow
    : null;
  const attrTotal = (dofollow ?? 0) + (nofollow ?? 0);
  const domainRank = rankRaw === null ? null : normalizeDomainRank(rankRaw);

  return {
    domain,
    isTarget,
    rankRaw,
    domainRank,
    authorityScore:
      domainRank === null || referringDomains === null
        ? null
        : computeAuthorityScore(domainRank, referringDomains),
    referringDomains,
    backlinks,
    dofollowRatio: attrTotal > 0 ? Math.round(((dofollow ?? 0) / attrTotal) * 100) / 100 : null,
    brokenBacklinks: typeof item?.broken_backlinks === 'number' ? item.broken_backlinks : null,
    linksPerDomain:
      backlinks !== null && referringDomains && referringDomains > 0
        ? Math.round((backlinks / referringDomains) * 10) / 10
        : null,
    dominantAnchor: null,
    dominantAnchorRatio: null,
  };
}

async function fetchProfiles(domains: { domain: string; isTarget: boolean }[]): Promise<BacklinkProfile[]> {
  const payload = domains.map((d) => ({ target: d.domain, internal_list_limit: 1, backlinks_status_type: 'live' }));
  const res = await dfsPost('backlinks/summary/live', payload);
  const tasks = res?.tasks ?? [];
  return domains.map((d, i) => {
    const item = tasks[i]?.result?.[0];
    return toProfile(d.domain, d.isTarget, item);
  });
}

/** Concentration d'ancres de la cible : signal de naturalité du profil. */
async function fetchAnchorConcentration(domain: string): Promise<{ anchor: string | null; ratio: number | null }> {
  const res = await dfsPost('backlinks/anchors/live', [
    { target: domain, limit: 100, order_by: ['backlinks,desc'], backlinks_status_type: 'live' },
  ]);
  const items: any[] = res?.tasks?.[0]?.result?.[0]?.items ?? [];
  if (items.length === 0) return { anchor: null, ratio: null };
  const total = items.reduce((s, i) => s + (i.backlinks || 0), 0);
  if (total <= 0) return { anchor: null, ratio: null };
  const top = items.reduce((a, b) => ((b.backlinks || 0) > (a.backlinks || 0) ? b : a), items[0]);
  return {
    anchor: String(top.anchor || '').slice(0, 60) || null,
    ratio: Math.round(((top.backlinks || 0) / total) * 100) / 100,
  };
}

const PROOF_RE = /(t[ée]moignage|avis client|[ée]tude de cas|cas client|r[ée]f[ée]rence client|nos clients|retour d.exp[ée]rience|portfolio|r[ée]alisation)/i;
const LEGAL_RE = /(mentions[- ]l[ée]gales|cgv|cgu|politique de confidentialit[ée]|privacy)/i;
const ABOUT_RE = /(a-propos|à-propos|apropos|about|qui-sommes-nous|notre-histoire|equipe|team)/i;
const CONTACT_RE = /(contact|nous-ecrire|nous-contacter)/i;
const IDENT_RE = /\b(SIREN|SIRET|RCS|TVA\s?intracommunautaire|VAT\s?number)\b/i;
const PHONE_RE = /(\+33\s?\d|0[1-9](?:[\s.-]?\d{2}){4})/;
const ADDRESS_RE = /\b\d{5}\b\s+[A-Za-zÀ-ÿ]/;
const AUTHOR_RE = /(écrit par|r[ée]dig[ée] par|auteur\s*:|by\s+[A-Z][a-z]+\s+[A-Z]|fondateur|founder|CEO|dirigeant)/i;
const DATE_RE = /(mis à jour le|publi[ée] le|datePublished|dateModified|\b20\d{2}-\d{2}-\d{2}\b)/i;

async function getHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersBot/1.0; +https://crawlers.fr)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 400000);
  } catch {
    return null;
  }
}

function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/** Signaux E-E-A-T lus dans le HTML servi (aucune interprétation, du binaire). */
export async function readOnPageEeat(targetUrl: string): Promise<OnPageEeatReading> {
  const empty: OnPageEeatReading = {
    url: targetUrl,
    fetched: false,
    hasOrganizationSchema: false,
    hasPersonSchema: false,
    hasAuthorMention: false,
    hasAboutLink: false,
    hasContactLink: false,
    hasLegalLink: false,
    hasCompanyIdentifier: false,
    hasPhoneOrAddress: false,
    hasProof: false,
    hasDate: false,
    https: targetUrl.startsWith('https://'),
    aboutUrl: null,
    aboutWordCount: null,
  };

  const html = await getHtml(targetUrl);
  if (!html) return empty;

  const text = textOf(html);
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const aboutHref = links.find((h) => ABOUT_RE.test(h));
  const aboutUrl = aboutHref ? absolutize(aboutHref, targetUrl) : null;

  let aboutWordCount: number | null = null;
  if (aboutUrl) {
    const aboutHtml = await getHtml(aboutUrl);
    if (aboutHtml) aboutWordCount = textOf(aboutHtml).split(' ').filter(Boolean).length;
  }

  return {
    ...empty,
    fetched: true,
    hasOrganizationSchema: /"@type"\s*:\s*"?(Organization|LocalBusiness|Corporation|ProfessionalService)/i.test(html),
    hasPersonSchema: /"@type"\s*:\s*"?(Person|ProfilePage)/i.test(html),
    hasAuthorMention: AUTHOR_RE.test(text),
    hasAboutLink: !!aboutHref,
    hasContactLink: links.some((h) => CONTACT_RE.test(h)),
    hasLegalLink: links.some((h) => LEGAL_RE.test(h)) || LEGAL_RE.test(text),
    hasCompanyIdentifier: IDENT_RE.test(text),
    hasPhoneOrAddress: PHONE_RE.test(text) || ADDRESS_RE.test(text),
    hasProof: PROOF_RE.test(text),
    hasDate: DATE_RE.test(html),
    aboutUrl,
    aboutWordCount,
  };
}

/** Étape « autorité » du moteur : profil de liens + signaux E-E-A-T. */
export async function readAuthority(
  targetUrl: string,
  domain: string,
  competitors: Competitor[],
): Promise<AuthorityReading> {
  // Les leaders donnent la référence d'autorité du marché.
  const rivals = [...competitors]
    .sort((a, b) => (a.type === 'leader' ? 0 : 1) - (b.type === 'leader' ? 0 : 1))
    .map((c) => c.domain)
    .filter((d, i, arr) => d && d !== domain && arr.indexOf(d) === i)
    .slice(0, RIVAL_PROFILES);

  const [profiles, anchors, onPage] = await Promise.all([
    fetchProfiles([{ domain, isTarget: true }, ...rivals.map((d) => ({ domain: d, isTarget: false }))]),
    fetchAnchorConcentration(domain),
    readOnPageEeat(targetUrl),
  ]);

  const target = profiles.find((p) => p.isTarget) ?? null;
  if (target) {
    target.dominantAnchor = anchors.anchor;
    target.dominantAnchorRatio = anchors.ratio;
  }

  return {
    measuredAt: new Date().toISOString(),
    target,
    rivals: profiles.filter((p) => !p.isTarget),
    onPage,
  };
}
