# Inventaire MCP Crawlers.fr — faits issus du code (10 oct. 2026)

## 1. Serveurs déployés

| Serveur | Fonction | Chemin | Auth | Sonde |
|---|---|---|---|---|
| A « crawlers-fr » v1.1.0 | `supabase/functions/mcp-server` (mcp-lite) | `…supabase.co/functions/v1/mcp-server` | Clé Marina (`x-marina-key` ou `Bearer marina_/mk_live_`) ou JWT de session ; 3 outils sans auth | GET 200 |
| B « crawlers-mcp » v0.2.0 | `supabase/functions/mcp` (généré depuis `src/lib/mcp/`, SDK 0.24) | `…supabase.co/functions/v1/mcp` | OAuth 2.1 (issuer Supabase, audience authenticated) | 401 sans jeton (normal) |

- `https://crawlers.fr/mcp` (cité par les CGVU) : 404. `crawlers.fr/functions/v1/*` : 406 tant que le proxy Cloudflare n'est pas redéployé.
- Serveur de référence : aucun n'est désigné dans le code. A est celui branché en connecteur et documenté sur les pages ; B est celui décrit par les CGVU et le seul avec OAuth 2.1 et grille `mcp_tool_pricing`.

## 2. Outils réellement enregistrés

### Serveur A (16)
- Gratuits, sans auth : `check_geo_score`, `check_llm_visibility`, `check_ai_crawlers`.
- Pro Agency (agency_pro ou agency_premium actif, ou admin), sans débit : `expert_seo_audit`, `strategic_ai_audit`, `generate_corrective_code`, `dry_run_script`, `fetch_serp_kpis`, `calculate_ias` (OK par clé) ; `calculate_cocoon_logic`, `measure_audit_impact`, `wordpress_sync` (JWT de session obligatoire, refusés par clé).
- Marina (auth requise) : `marina_create_report` (5 crédits, ou inclus Pro Agency/admin), `marina_get_report`, `marina_list_jobs`, `marina_export_pdf` (gratuits).

### Serveur B (14, grille `mcp_tool_pricing`, 1 micro-crédit = 0,001 €)
- Gratuits : `whoami`, `list_my_sites`, `get_site_audit`, `get_job`, `get_wallet_balance`, `list_tools_pricing`.
- Inclus Pro Agency puis wallet : `audit_page` (200/mois, 20 µ), `analyze_schema`, `check_indexability`, `analyze_links` (200/mois, 10 µ), `start_geo_audit` (30/mois, 120 µ), `start_site_crawl` (20/mois, 150 µ).
- Inclus Pro Agency+ (agency_premium) : `start_competitor_matrix` (10/mois, 200 µ).
- Toujours payant : `serp_ranking` (40 µ).
- En base mais désactivés, non enregistrés : `get_fix`, `list_findings`, `keyword_research`, `backlink_snapshot`.

## 3. Décompte fusionné
- Aucun nom commun entre A et B : 16 + 14 = **30 outils distincts** accessibles.
- `audit_site`, `crawl_site`, `ai_visibility` (pages publiques) n'existent nulle part ; `get_fix` et `list_findings` existent seulement comme lignes désactivées.
- 23 : aucune définition naturelle dans le code. Seules coïncidences arithmétiques : 14 (B) + 9 Pro (A) = 23, ou 30 − 7 (3 gratuits A + 4 Marina). Ni famille, ni module, ni sous-mode ne produit 23.

## 4. Textes à aligner
- `/seo-mcp-server`, `/geo-mcp-server` : liste d'outils fictive (`ai_visibility`, `audit_site`, `crawl_site`, `list_findings`, `get_fix`, tableau l. ~307-312) et « 16 outils » qui ignore le serveur B.
- `/seo-avec-claude` (`src/data/keywordPillars.ts`), `/aide`, `public/llms.txt` sections 16-17 : ne décrivent que A.
- `mcp-manifest.json` racine : endpoint A, 12 outils, auth bearer — obsolète.
- CGVU article 5 quater (`src/pages/CGVU.tsx`) :
  - l. 104 et 268 : « OAuth 2.1 » seul — faux pour A (clé Marina).
  - l. 263 : `https://crawlers.fr/mcp` — répond 404.
  - l. 275-280 : facturation wallet/micro-crédits/`start_*`/plafond journalier — vraie pour B seulement ; A facture Marina en crédits (5/rapport) et inclut les 9 Pro sans débit.

## Prochaine étape (après validation)
Choisir le serveur de référence (A, B ou fusion) et la règle d'accès unique ; ensuite seulement aligner pages, llms.txt, manifeste racine et CGVU.
