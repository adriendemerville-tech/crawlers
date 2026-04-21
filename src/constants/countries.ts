/**
 * ISO 3166-1 alpha-3 country codes supported by GSC.
 * Subset of most common markets for SEO tracking.
 */
export const GSC_COUNTRIES = [
  { code: 'fra', label: 'France', flag: 'FR' },
  { code: 'deu', label: 'Allemagne', flag: 'DE' },
  { code: 'gbr', label: 'Royaume-Uni', flag: 'GB' },
  { code: 'usa', label: 'États-Unis', flag: 'US' },
  { code: 'esp', label: 'Espagne', flag: 'ES' },
  { code: 'ita', label: 'Italie', flag: 'IT' },
  { code: 'bel', label: 'Belgique', flag: 'BE' },
  { code: 'che', label: 'Suisse', flag: 'CH' },
  { code: 'can', label: 'Canada', flag: 'CA' },
  { code: 'nld', label: 'Pays-Bas', flag: 'NL' },
  { code: 'prt', label: 'Portugal', flag: 'PT' },
  { code: 'lux', label: 'Luxembourg', flag: 'LU' },
  { code: 'aut', label: 'Autriche', flag: 'AT' },
  { code: 'pol', label: 'Pologne', flag: 'PL' },
  { code: 'bra', label: 'Brésil', flag: 'BR' },
  { code: 'mar', label: 'Maroc', flag: 'MA' },
  { code: 'tun', label: 'Tunisie', flag: 'TN' },
  { code: 'dza', label: 'Algérie', flag: 'DZ' },
  { code: 'sen', label: 'Sénégal', flag: 'SN' },
  { code: 'civ', label: "Côte d'Ivoire", flag: 'CI' },
  { code: 'jpn', label: 'Japon', flag: 'JP' },
  { code: 'aus', label: 'Australie', flag: 'AU' },
  { code: 'ind', label: 'Inde', flag: 'IN' },
  { code: 'chn', label: 'Chine', flag: 'CN' },
] as const;

export type GscCountryCode = typeof GSC_COUNTRIES[number]['code'];

export function getCountryLabel(code: string): string {
  return GSC_COUNTRIES.find(c => c.code === code)?.label ?? code.toUpperCase();
}

export function getCountryFlag(code: string): string {
  const c = GSC_COUNTRIES.find(c => c.code === code);
  if (!c) return '';
  return c.flag
    .split('')
    .map(char => String.fromCodePoint(0x1F1E6 + char.charCodeAt(0) - 65))
    .join('');
}
