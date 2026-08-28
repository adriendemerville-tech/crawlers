// Normalisation de l'autorité de domaine — pure et isomorphe.
// Mêmes formules que le bloc autorité des audits (calibrage 2026-08-08) pour
// qu'un même domaine ne reçoive pas deux scores différents selon l'outil.

/**
 * L'échelle backlinks DataForSEO est 0–1000 et logarithmique : une division
 * linéaire par 10 attribue 100/100 à tout domaine à rank 1000. Courbe calibrée :
 * 1000 → 95, 600 → 38, 300 → 11, 100 → 1,5.
 */
export function normalizeDomainRank(rawRank: number): number {
  const r = Math.max(0, rawRank || 0);
  const ratio = Math.min(1, r / 1000);
  return Math.round(95 * Math.pow(ratio, 1.8) * 10) / 10;
}

/**
 * Authority Score borné à 92 : 60 % rank normalisé + 40 % diversité des
 * domaines référents (échelle logarithmique).
 */
export function computeAuthorityScore(domainRank: number, referringDomains: number): number {
  const rankPart = Math.min(60, Math.max(0, Math.min(100, domainRank)) * 0.6);
  const diversityPart = referringDomains > 0 ? Math.min(40, Math.log10(referringDomains) * 11) : 0;
  return Math.max(0, Math.min(92, Math.round(rankPart + diversityPart)));
}
