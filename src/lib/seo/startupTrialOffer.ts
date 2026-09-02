/**
 * Offre « Gratuit 12 mois — Jeunes entreprises » réutilisable dans les
 * données structurées de toutes les pages produit (schema.org Offer).
 */
export const STARTUP_TRIAL_OFFER = {
  "@type": "Offer",
  name: "Gratuit 12 mois — Jeunes entreprises",
  price: "0",
  priceCurrency: "EUR",
  description:
    "Plan Pro Agency gratuit pendant 12 mois pour les entreprises et freelances immatriculés depuis moins d'un an (vérification SIRET + Kbis).",
  availability: "https://schema.org/InStock",
  url: "https://crawlers.fr/tarifs",
  eligibleCustomerType: "https://schema.org/Business",
} as const;
