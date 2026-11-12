/**
 * Guides métier livrés avec le site. Réexport de la source partagée avec
 * le pré-rendu (supabase/functions/_shared/professionGuides.ts).
 */
export {
  PROFESSION_GUIDES,
  PROFESSION_GUIDE_SITEMAP,
  appendProfessionGuideEntries,
  getBuiltinGuideRow,
  getBuiltinPrerenderGuide,
  getProfessionGuide,
  listBuiltinGuideEntries,
} from "../../supabase/functions/_shared/professionGuides";

export type {
  ProfessionExternalLink,
  ProfessionFaq,
  ProfessionGuideSource,
  ProfessionLink,
} from "../../supabase/functions/_shared/professionGuides";
