# Plan Netlinking multi-provider

Intégration de 3 fournisseurs de backlinks avec commande via API, commission Crawlers de 10%, et branchement dans Stratège Cocoon.

## 1. Providers ciblés

| Provider | Marché | Modèle API | Auth |
|---|---|---|---|
| **Rocketlinks** | FR/EU premium | REST, catalogue + order | API key (compte partenaire) |
| **Accesslink.ai** | FR, automatisé | REST, live search + order auto | API key |
| **Getfluence** | Premium éditeurs (Figaro, Le Monde…) | REST, quote + validation | API key |

Chaque provider a son propre secret backend : `ROCKETLINKS_API_KEY`, `ACCESSLINK_API_KEY`, `GETFLUENCE_API_KEY` (à demander via `add_secret` au moment de l'activation).

## 2. Schéma base de données

**`netlinking_providers`** — catalogue statique des 3 providers (nom, slug, status, docs URL).

**`netlinking_orders`** — commandes utilisateur.
- `user_id`, `tracked_site_id`, `provider_slug`
- `target_url` (page à renforcer), `anchor_text`, `topic`
- `publisher_site` (site éditeur choisi), `publisher_metrics` jsonb (TF, CF, trafic, DR)
- `provider_order_id` (id externe), `status` (draft/pending/live/rejected/refunded)
- `cost_ht_cents` (prix provider), `commission_cents` (10% Crawlers), `total_ht_cents` (débité au wallet)
- `live_url`, `published_at`, `metadata` jsonb
- RLS : owner-only ; INSERT/UPDATE via edge function service-role uniquement.

**`netlinking_catalog_cache`** — cache résultats search (TTL 24h) pour éviter re-hitter les providers.

## 3. Edge functions

- **`netlinking-search`** (POST) — accepte `{ topic, min_metrics, budget_max, providers[] }`, appelle en parallèle les APIs providers activés, agrège + normalise (métriques, prix TTC commission incluse), cache 24h.
- **`netlinking-order`** (POST) — flow : (1) vérifie wallet ≥ total, (2) débite via `dev_wallet_debit`, (3) POST au provider, (4) enregistre `netlinking_orders`, (5) refund wallet si échec provider.
- **`netlinking-webhook`** (POST, no JWT) — reçoit callbacks providers (link_live, rejected), met à jour status + `live_url`.
- **`netlinking-monitor`** (cron hebdo) — crawl ciblé sur les `live_url` pour vérifier lien toujours présent ; alerte si perdu.

## 4. Wallet & commission

Réutilise `dev_wallets` (déjà en prod pour Crawlers API). Formule :
```
total_ht = cost_ht_provider × 1.10
commission = cost_ht_provider × 0.10
```
Le wallet est débité de `total_ht` ; `cost_ht_provider` payé au provider par carte pro Crawlers (hors flux — réconciliation manuelle mensuelle au début, automatisable ensuite via API paiement provider).

## 5. UI

- **Nouvelle page `/app/netlinking`** — recherche multi-provider, filtres (topic, TF/DR min, budget, langue), tableau résultats normalisés, bouton **Commander**.
- **Onglet "Commandes"** — historique, statuts, `live_url`, monitoring.
- **Widget dans Stratège Cocoon** — quand la recommandation contient "netlinking" / "backlinks" / "renforcer autorité", bouton **Voir sites disponibles** qui ouvre `/app/netlinking?target=/slug&topic=…` pré-rempli.

## 6. Intégration Stratège Cocoon

Nouveau skill `find_backlink_opportunities` (auto, quota Premium+) : wrapper sur `netlinking-search` qui retourne top 5 sites suggérés pour la page cible avec CTA vers la page netlinking.

## 7. Sécurité & garde-fous

- RLS stricte `auth.uid()` sur `netlinking_orders`.
- Aucune écriture wallet côté client (service-role uniquement).
- Idempotence sur `(user_id, provider_order_id)` pour éviter double-débit.
- Budget max par commande configurable (défaut 500 €), demande approbation UI au-delà.
- Gating : Premium+ pour recherche, Pro Agency+ pour commande automatique (à confirmer).

## Ordre d'exécution

1. **Sprint 1 (ce sprint)** : migration DB + edge functions `netlinking-search` / `netlinking-order` / webhook + page UI de recherche/commande, avec **Accesslink.ai** en premier (API la plus simple).
2. **Sprint 2** : ajout Rocketlinks + Getfluence dans le même edge function `netlinking-search`.
3. **Sprint 3** : monitoring hebdo + intégration Stratège Cocoon.

## Ce que je te demande avant de démarrer

- Confirmes-tu le démarrage par **Sprint 1 avec Accesslink.ai seul**, puis ajout Rocketlinks + Getfluence en Sprint 2 ? Ou tu veux les 3 dès le départ (implique de fournir 3 API keys tout de suite) ?
- Le gating **Premium+ pour recherche / Pro Agency+ pour commande** te convient, ou tu veux ouvrir la commande à tous les plans avec wallet ?
