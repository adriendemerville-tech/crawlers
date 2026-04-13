/**
 * Text utilities for the strategic audit pipeline.
 * Stop words, tokenization, metadata extraction, domain slug building.
 */

export const STOP_WORDS = new Set([
  'le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux',
  'il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou',
  'plus','vous','votre','vos','nous','notre','nos','leur','leurs','mon','ma','mes','ton','ta','tes',
  'si','mais','car','donc','ni','comme','entre','chez','vers','très','aussi','bien','encore',
  'tout','tous','même','autre','autres','chaque','quelque','quel','quelle','quels','quelles',
  'certains','plusieurs','aucun','tel','telle','tels','telles',
  'gratuit','gratuite','meilleur','meilleure','site','web','page','accueil','www','http','https',
  'bienvenue','welcome','home','officiel','official',
  'the','and','for','with','your','our','from','that','this','are','was','will','can','has','have',
  'calcul','calculer','outil','service','solution','application','app','logiciel','plateforme',
]);

/** Clean text and tokenize into meaningful words (filters stop words) */
export function cleanAndTokenize(text: string, extraExclusions?: Set<string>): string[] {
  return text.toLowerCase()
    .replace(/[|–—·:,\.!?]/g, ' ')
    .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w) && !(extraExclusions?.has(w)));
}

/** Extract Title/H1/Desc from page content context string */
export function extractMetadataTexts(pageContentContext: string): string[] {
  const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
  const h1Match = pageContentContext.match(/H1="([^"?]+)/);
  const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
  return [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
}

/** Build a set of domain-derived slugs to filter out brand terms */
export function buildDomainSlugs(domain: string): Set<string> {
  const slugs = new Set<string>();
  if (!domain) return slugs;
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  for (const part of cleanDomain.split('.')) {
    if (part.length > 2) slugs.add(part);
  }
  slugs.add(cleanDomain.replace(/\./g, ''));
  if (cleanDomain.split('.').length > 0) slugs.add(cleanDomain.split('.')[0]);
  return slugs;
}
