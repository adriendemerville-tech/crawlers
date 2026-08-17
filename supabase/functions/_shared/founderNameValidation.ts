/**
 * founderNameValidation — deterministic guards for founder/person detection via SERP.
 *
 * Problem it solves: SERP queries like `"domain.fr" fondateur OR CEO site:instagram.com`
 * often return a POST (e.g. /p/xxx, /reel/xxx) whose title is a sentence, not a person.
 * Without validation the pipeline stored things like
 * "🤝 Un grand merci à Avenir Rénovations Vannes ! 🤝 Je tiens ..." as founder name,
 * which the LLM then rejects → founder_authority = "unknown".
 */

const NON_PERSON_TOKENS = [
  'merci', 'bienvenue', 'nouveau', 'chantier', 'devis', 'promo', 'offre', 'recrute',
  'rénovation', 'renovation', 'travaux', 'agence', 'société', 'societe', 'entreprise',
  'sarl', 'sas', 'eurl', 'groupe', 'boutique', 'shop', 'store', 'official', 'officiel',
  'home', 'accueil', 'contact', 'facebook', 'instagram', 'linkedin', 'youtube',
];

const ROLE_WORDS = /\b(fondateur|fondatrice|founder|ceo|président|presidente|président[e]?|dirigeant[e]?|gérant[e]?|co-?founder|cto|coo)\b/i;

/** Profile URL (not a post/reel/video) for the given platform. */
export function isPersonProfileUrl(url: string, platform: string): boolean {
  const u = (url || '').toLowerCase();
  if (!u) return false;
  if (/\/(p|reel|reels|tv|explore|stories|posts|pulse|feed|shorts|watch|hashtag|company|showcase|groups|jobs)(\/|$)/.test(u)) return false;
  if (platform === 'linkedin') return /linkedin\.com\/in\//.test(u);
  if (platform === 'instagram') return /instagram\.com\/[a-z0-9._]{2,40}\/?(\?|$)/.test(u);
  if (platform === 'youtube') return /youtube\.com\/(@|c\/|channel\/|user\/)/.test(u);
  return true;
}

/**
 * Accepts only strings that plausibly are a human name:
 * 2 to 4 words, letters/hyphens/apostrophes only, no emoji, no punctuation noise,
 * no brand/company/marketing tokens, not the domain itself.
 */
export function isPlausiblePersonName(raw: string | null | undefined, domain = ''): boolean {
  if (!raw) return false;
  const name = raw.trim();
  if (name.length < 4 || name.length > 45) return false;
  // Reject emoji / symbols / sentence punctuation
  if (/[\p{Extended_Pictographic}0-9!?:;"“”•|/\\_@#*+=<>[\]{}]/u.test(name)) return false;
  if (/[.,]{1}.*[.,]/.test(name)) return false;
  if (name.includes('...') || name.includes('…')) return false;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  const lower = name.toLowerCase();
  const domainRoot = domain.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ').toLowerCase();
  if (domainRoot && lower.includes(domainRoot)) return false;
  if (domainRoot.split(' ').some(part => part.length > 3 && lower.includes(part))) return false;
  if (NON_PERSON_TOKENS.some(tok => lower.includes(tok))) return false;
  // Chaque mot commence par une majuscule, sauf les particules nobiliaires/patronymiques
  // (« Michael Di Luca », « Adrien de Volontat », « Luis van der Berg »).
  return words.every((w, i) => {
    if (!/^[\p{L}'’-]+$/u.test(w)) return false;
    if (i > 0 && i < words.length - 1 && PARTICLES.has(w.toLowerCase())) return true;
    return /^[\p{Lu}]/u.test(w);
  });
}


/** Extract a candidate person name from a SERP title, stripping role suffixes. */
export function extractPersonName(title: string | null | undefined, url = '', platform = ''): string | null {
  const fromTitle = (title || '')
    .split(/\s*[-–—|·]\s*/)[0]
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*@.*/, '')
    .replace(ROLE_WORDS, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (fromTitle) return fromTitle;
  // Fallback: LinkedIn slug → "prenom-nom-1a2b3c"
  if (platform === 'linkedin') {
    const slug = url.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
    if (slug) {
      return slug.split('-').filter(p => !/^[0-9a-f]{4,}$/i.test(p) && !/^\d+$/.test(p))
        .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
  }
  return null;
}

/**
 * Final gate: returns a validated founder name or null.
 */
export function validateFounderCandidate(
  candidate: { title?: string | null; name?: string | null; url: string; platform: string },
  domain: string,
): string | null {
  if (!isPersonProfileUrl(candidate.url, candidate.platform)) return null;
  const name = candidate.name && isPlausiblePersonName(candidate.name, domain)
    ? candidate.name.trim()
    : extractPersonName(candidate.title ?? candidate.name, candidate.url, candidate.platform);
  if (!name) return null;
  return isPlausiblePersonName(name, domain) ? name : null;
}
