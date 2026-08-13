---
name: Audit Marina par type de page (archétypes)
description: Section « Audit par type de page » de Marina — segmentation des pages crawlées par gabarit, conclusion intermédiaire par type puis synthèse business
type: feature
---
Marina produit une section « Audit par type de page » (`data-marina-block="archetypes"`, périmètre site), générée par `supabase/functions/_shared/pageArchetypes.ts` — 100 % déterministe, 0 token LLM.

Principe : les pages du dernier crawl sont regroupées par gabarit via patterns d'URL (accueil, agence/point de vente, produit, service, conversion/devis, avis, éditorial, listing, institutionnel, légal), avec repli sur `page_intent` du crawl puis « Autres pages ». Chaque groupe reçoit un rôle : `core_business`, `auxiliary_pillar`, `support`, `functional`.

Par groupe : objectif visé, périmètre mesuré (pages, score SEO moyen, mots, liens internes), puis trois listes déterministes — ce qui fonctionne / ce qui échoue / comment optimiser — et un verdict `strong | ok | weak` (weak si ≥3 échecs, pages non indexables, ou score SEO moyen < 45).

Conclusion intermédiaire imposée en fin de section, reprise aussi dans « Conclusion et priorités » : « À périmètre constant, les pages les plus importantes pour le business sont celles de type X et Y… Les pages Z, piliers auxiliaires, jouent / ne jouent pas leur rôle… Le problème principal est : … ». Le problème principal est le blocage le plus lourd sur les types business (non-indexabilité > cannibalisation > contenu léger > sous-maillage).

Fusion multipages : bloc `archetypes` mutualisé, placé juste après `crawl` dans `siteOrder` de `src/lib/marina/mergeReports.ts`. Seuil minimum : 3 pages crawlées, sinon la section est omise.

Pondération du mix (bloc `archetype-mix`) : `buildMix()` compare la part de chaque gabarit à une fourchette de référence (`MIX_TARGETS`) et rend un arbitrage déterministe — `balanced` (ratio correct), `expand` (créer plus de pages), `prune` (élaguer/fusionner quand la sur-représentation s'accompagne de thin content ou de quasi-doublons), `differentiate` (volume suffisant, différencier plutôt que créer), plus les gabarits absents à créer (conversion, avis, éditorial, service). Base de calcul : sitemap récupéré par `supabase/functions/_shared/sitemapUrls.ts` (index suivi, max 8 sous-sitemaps, 5000 URL, timeout 8 s) recoupé avec le crawl ; si le sitemap est indisponible, les parts sont calculées sur le crawl seul et annoncées comme indicatives. La synthèse rappelle systématiquement que ces arbitrages de volume rejoignent le module Cocoon (élagage, cannibalisation, création de piliers).
