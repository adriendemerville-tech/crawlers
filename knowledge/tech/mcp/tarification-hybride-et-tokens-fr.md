# MCP Crawlers — tarification hybride et comptabilité des tokens

Dernière mise à jour : 2026-09-09

## Principe

Le serveur MCP est une **façade de l'API développeurs**, pas un moteur parallèle.
Toute exécution passe par `supabase/functions/crawlers-api` (jobs asynchrones
`/v1/jobs`), et la facturation utilise le **wallet développeur** déjà exposé dans
`/developers`.

Unité de compte : le **micro-crédit**. `1 000 micro-crédits = 1 €`. Les RPC
historiques du wallet travaillent en centimes ; la conversion est faite au
moment du débit (garde à conserver lors de toute évolution).

## Trois classes d'outils

| Classe | Comportement | Exemples |
| --- | --- | --- |
| `free` | Aucun débit, aucune limite tarifaire | `whoami`, `list_my_sites`, `get_site_audit`, `get_job`, `get_wallet_balance`, `list_tools_pricing`, `list_findings` |
| `overflow` | Inclus dans le plan jusqu'au quota mensuel (`quota_key`, `monthly_included`, `min_plan`), puis bascule sur le wallet | `audit_page` (20), `check_indexability` / `analyze_schema` / `analyze_links` (10), `get_fix` (30), `start_site_crawl` (150), `start_geo_audit` (120), `start_competitor_matrix` (200) |
| `paid_only` | Toujours au wallet (coût externe DataForSEO / LLM lourd) | `keyword_research` (40), `serp_ranking` (40), `backlink_snapshot` (60) |

Coûts en micro-crédits, source de vérité : table `public.mcp_tool_pricing`
(lecture publique, écriture admin) — jamais de coût codé en dur côté client.

## Juge unique d'autorisation

`public.mcp_authorize_call(user_id, tool_name, ...)` :

1. lit le tarif dans `mcp_tool_pricing` ;
2. vérifie le rang de plan (`mcp_plan_rank`) et le quota mensuel inclus ;
3. sinon débite le wallet (`dev_wallet_debit`, conversion micro → centimes) ;
4. incrémente `mcp_daily_usage` (plafond journalier anti-boucle d'agent) ;
5. renvoie `{ allowed, billed_source, cost_micro }`.

Aucun autre chemin d'autorisation ne doit exister. `src/lib/mcp/billing.ts`
contient encore un chemin mort en doublon — à supprimer.

## Comptabilité des tokens (migration `0019`)

- `crawlers_api_jobs` et `mcp_call_log` portent `input_tokens`,
  `output_tokens`, `total_tokens`.
- `ai_gateway_usage.attributed_job_id` empêche le double comptage : une ligne
  de coût LLM n'appartient qu'à un seul job.
- `public.attribute_ai_tokens(job_id, edge_function, since)` réclame les lignes
  non attribuées de l'edge function depuis le démarrage du job
  (`for update skip locked`, tolérance 5 s), reporte les totaux sur le job puis
  sur la ligne `mcp_call_log` correspondante.
- Restitution : réponse `/v1/jobs/:id` et onglet Usage de `/developers`
  (`UsageTab.tsx`).

Les tokens servent à **mesurer**, pas à facturer : le prix reste celui de
l'outil. Un appel MCP sans `metadata.job_id` n'est pas encore rattaché — limite
connue.

## Dettes ouvertes

- Pas de **remboursement wallet** si un job échoue (débit avant exécution).
- Plafond journalier non atomique (race condition possible).
- `get_fix`, `keyword_research`, `backlink_snapshot` tarifés mais moteurs non
  branchés (outils désactivés côté enregistrement).
- `/v1/wallet/balance` estime les jobs restants avec un coût fixe, incohérent
  avec la grille réelle.
