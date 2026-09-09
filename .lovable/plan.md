# Tarification hybride du MCP Crawlers

Objectif : faire du serveur MCP une façade facturée sur le moteur Crawlers, avec trois classes d'outils (inclus dans le plan, débordement en pay-as-you-go, exclusif pay-as-you-go), une unité fractionnaire et un plafond anti-boucle.

## 1. Unité de facturation fractionnaire

Aujourd'hui le wallet est en centimes et un job coûte 10 centimes — trop grossier pour un agent qui enchaîne 30 appels.

- Nouvelle unité interne : le **micro-crédit** (1 000 micro-crédits = 1 €, soit 0,001 € l'unité).
- `dev_wallets` gagne `balance_micro bigint` alimenté par migration depuis `balance_cents * 10`. `balance_cents` reste en colonne générée/lecture seule pour ne rien casser (SDK, BillingTab, webhook Paddle).
- `dev_wallet_transactions` gagne `amount_micro`, `balance_after_micro`, et `unit` (`cents` | `micro`) pour l'historique existant.
- Les RPC `dev_wallet_credit` / `dev_wallet_debit` gardent leur signature actuelle (compatibilité webhook Paddle et `/v1/jobs`) et deux nouvelles variantes `_micro` sont ajoutées.

## 2. Grille tarifaire par outil

Table `mcp_tool_pricing` (lecture publique, écriture admin) :

| colonne | rôle |
|---|---|
| `tool_name` | identifiant de l'outil MCP |
| `class` | `plan_included` \| `overflow` \| `paid_only` \| `free` |
| `cost_micro` | coût unitaire en micro-crédits |
| `quota_key` | compteur de plan consommé si `plan_included` (ex. `crawl`, `content`, `audit`) |
| `min_plan` | plan minimum requis pour l'inclusion |
| `enabled` | activation/désactivation sans déploiement |

Ordre de grandeur visé : lecture/statut = 0 (gratuit), audit de page = 20 (0,02 €), crawl de site = 100+, appel DataForSEO = coût réel majoré, génération de correctif = 30.

Les lectures (`whoami`, `list_my_sites`, `get_site_audit`, `get_job`) restent gratuites.

## 3. Juge unique de facturation

Un seul point de passage : `mcp_authorize_call(_user_id, _tool_name, _idempotency_key)`, SECURITY DEFINER, qui dans l'ordre :

1. Résout la tarification de l'outil ; si `free` → autorise.
2. Vérifie le **plafond journalier** de l'utilisateur (table `mcp_daily_usage`, dépense max par jour, valeur par défaut configurable, override par utilisateur) → refus `daily_cap_reached`.
3. Si `plan_included` et le plan de l'utilisateur couvre l'outil : décrémente le quota de plan, aucun débit wallet.
4. Si quota épuisé et classe `overflow`, ou classe `paid_only` : débit atomique du wallet en micro-crédits → refus `insufficient_balance` avec URL de recharge si solde insuffisant.
5. Journalise dans `mcp_call_log` (outil, source de paiement, coût, clé d'idempotence) — idempotent sur `(user_id, idempotency_key)` pour qu'un retry d'agent ne facture pas deux fois.

Aucun outil MCP ne peut facturer autrement que par ce RPC.

## 4. Rattachement du wallet au compte OAuth

Le token MCP porte un `sub` Supabase Auth. Le wallet développeur est déjà keyé sur `user_id`. On vérifie que le `sub` OAuth correspond bien au même compte que la clé `crw_live_` : si le wallet n'existe pas, il est créé à zéro au premier appel, et le message d'erreur renvoie vers `/developers/profile?tab=facturation`.

## 5. Outils MCP à exposer

Boucle centrale **audit → finding → fix → re-audit**, en s'appuyant sur `/v1/jobs` déjà en place :

- Lecture (gratuit) : `whoami`, `list_my_sites`, `get_site_audit`, `get_job`, `list_tools_pricing`, `get_wallet_balance`.
- Audit court (facturé, synchrone) : `audit_page`, `check_indexability`, `analyze_schema`, `analyze_links`.
- Audit long (facturé, asynchrone `start_*` + `get_job`) : `start_site_crawl`, `start_geo_audit`, `start_competitor_matrix`.
- Données tierces (facturé au coût réel) : `keyword_research`, `serp_ranking`, `backlink_snapshot` (DataForSEO/SEMrush).
- Correctifs : `list_findings`, `get_fix` (finding normalisé + patch adapté au framework).

Findings normalisés : `id`, `url`, `severity`, `rule`, `evidence`, `explanation`, `fix_available`, `supported_frameworks`.

## 6. Affichage dans /developers

- `BillingTab` : solde en euros à deux décimales (dérivé des micro-crédits), et distinction visuelle « inclus dans votre plan » / « payé au wallet » dans l'historique.
- Nouvel onglet ou section « MCP » : grille tarifaire par outil, consommation du jour vs plafond, 30 derniers appels MCP.

## 7. Ordre d'implémentation

1. Migration : micro-crédits, `mcp_tool_pricing`, `mcp_daily_usage`, `mcp_call_log`, RPC `mcp_authorize_call` + GRANT et RLS sur chaque table.
2. Seed de la grille tarifaire.
3. Câblage du juge dans les outils MCP existants (aucun encore facturé) via un helper partagé `src/lib/mcp/billing.ts`.
4. Ajout progressif des nouveaux outils, en commençant par `audit_page`, `get_fix`, `start_site_crawl`.
5. Régénération du manifeste MCP et mise à jour de `/developers/docs`.
6. UI `/developers`.

## Points de vigilance

- Le webhook Paddle et `/v1/jobs` ne doivent pas changer de comportement : les anciennes RPC en centimes restent intactes.
- Un agent en boucle est le principal risque financier : le plafond journalier et l'idempotence sont non négociables.
- Toutes les tables nouvelles : RLS propriétaire sur `auth.uid()`, aucune écriture client directe, GRANT explicites.
