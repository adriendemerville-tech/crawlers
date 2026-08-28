# Project Memory

## Core
- **Security:** Multi-tenant isolation MUST use `auth.uid()`, ignore client `user_id`.
- **Database:** Base tables containing secrets have `SELECT` revoked; use secure views.
- **SSR:** Jamais `DOMPurify.sanitize` pendant le rendu serveur — voir [Sanitisation isomorphe](mem://tech/ssr/isomorphic-sanitizer-fr).
- **Tech Stack:** TS/Deno ONLY for backend/ML stack (Edge Functions). No external Python services.
- **Content:** Raw HTML/code manual editing is disabled (use injection catalog). Markdown uses `@tailwindcss/typography` (`prose` class).
- **CMS Push:** Tous les push CMS doivent envoyer du HTML. dictadevi-actions convertit défensivement Markdown→HTML via marked sur create/update-post.
- **Access:** API keys & UI global configs use read-only RLS without `user_id` filter.
- **Images:** NO_TEXT_GUARD forbids text in AI-generated images unless specifically requested.
- **SEO:** Métadonnées via `head()` TanStack + `src/lib/seo/pageHead.ts` (jamais Helmet pour title/description/canonical/og). Include `blockquote.citable-passage` for AI visibility.
- **Silos:** 4 piliers seulement (crawler, GEO, outil-crawl, comparatifs) — voir [Architecture en 4 silos](mem://tech/seo/silo-architecture-4-pillars-fr).
- **Auth:** Client-side rate limiting on login + Server-side GoTrue. OAuth disconnects must revoke tokens.
- **Queue:** Jobs prioritized by plan: agency_premium(10) > agency_pro(20) > new_user(30) > registered(40).
- **Team Roles:** owner/editor/auditor — gate actions via `useTeamPermissions().can('permission_key')`.
- **Agents:** Agent SEO autonome sur le CONTENU (publication directe, max 1/semaine, dépublication auto) ; JAMAIS sur le CODE (validation humaine obligatoire).
- **Audit:** Ne jamais conclure « contenu pauvre » sur le seul HTML servi — détecter la coquille JS (non-SSR) et remonter la cause racine.
- **Liens:** Tout contrôle de liens passe par `_shared/linkVerdictShared.ts` (hard_broken/soft_broken/blocked/ok) — jamais de seuil HTTP local.
- **Benchmarks GEO:** Le mot « site » est interdit dans les questions ; une activité mixte (prestation + e-boutique) reste un prestataire — voir [Formulation des questions de benchmark](mem://tech/geo/benchmark-question-wording-fr).
- **Carte d'identité:** Une dimension d'entreprise n'influence une question de benchmark que si elle est pertinente au croisement avec l'offre vendue — voir [Dimensions d'entreprise croisées avec l'offre](mem://tech/identity/enterprise-dimensions-cross-offer-fr).
- **Éditorial:** Une tactique SEO (balise title, maillage, schema) n'est JAMAIS un sujet d'article, sauf sur crawlers.fr — voir [Garde stratégie ≠ sujet](mem://tech/autopilot/strategy-vs-subject-guard-fr).

## Memories
- [Concurrents locaux depuis le slug](mem://tech/geo/local-competitors-from-slug-fr) — SERP « prestation + ville » prioritaire sur carte d'identité et GMB

- [Place d'échange — règles v1](mem://features/marketplace/v1-core-rules-fr) — Commission 15%, sponsored par défaut, attribut à deux axes (besoin acheteur × capacité vendeur), Stripe Connect KYC, balance d'autorité
- [Plan Jeune Entreprise v1](mem://features/pricing/plan-jeune-entreprise-v1-fr) — Gratuité 12 mois FR, vérif SIRET+Kbis, quotas F1-F10, F6 = dégradation 1j, F8 purge non tranché
- [Garde stratégie ≠ sujet](mem://tech/autopilot/strategy-vs-subject-guard-fr) — editorialSubjectGuard : requalification en mot-clé métier ou blocage de la publication
- [Formulation des questions de benchmark](mem://tech/geo/benchmark-question-wording-fr) — Interdiction du mot « site », règle de dominance service vs e-commerce, archétype piloté par la page auditée
- [Dimensions d'entreprise croisées avec l'offre](mem://tech/identity/enterprise-dimensions-cross-offer-fr) — 9 dimensions + croisement SIRENE, tri de pertinence par offre, dimensions interdites dans les questions
- [Mesure de performance terrain d'abord](mem://tech/audit/perf-measurement-field-first-fr) — CrUX p75 puis médiane de runs PSI ; aucun plafond de score sur un run isolé
- [Dofollow — facteur contextuel](mem://tech/audit/dofollow-contextual-factor-fr) — Faisceau d'indices (0/3/8 pts), autorité indépendante estimée, verdict « risque élevé à investiguer », jamais « pénalité Google »
- [Calibration du GEO par la citation réelle](mem://tech/audit/geo-citation-calibration-fr) — Modulation ±10 % du score des 10 sous-signaux par le benchmark LLM observé ; bandeau Marina sur le score déterministe, jamais la note LLM
- [Matrice concurrence — leaders lus dans la SERP](mem://tech/competitor-matrix/serp-first-leader-detection-fr) — Deux passes SERP, type `leader`, requalification des goliaths, quick wins
