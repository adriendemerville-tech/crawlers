# Crawlers API — Wallet & Paiement Pay-as-you-go (Paddle)

Sprint 3 — déployé le 26/05/2026.

## Modèle économique

- Tarif unique : **0,10 € par job** (toutes features Crawlers API confondues).
- Pas d'abonnement. Le développeur recharge son wallet (top-up) à l'avance.
- Paiement via **Paddle** (sandbox en preview, live en production).

## Schéma base de données

### `dev_wallets`
| Colonne | Type | Notes |
|---|---|---|
| `user_id` | uuid (PK) | Référence l'utilisateur authentifié |
| `balance_cents` | bigint | Solde en centimes d'euro (jamais négatif) |
| `currency` | text | `'EUR'` |
| `updated_at` | timestamptz | Auto |

RLS : `select` autorisé au propriétaire (`auth.uid() = user_id`). Aucune écriture client — passage obligé par les RPC.

### `dev_wallet_transactions`
Audit log immuable (append-only). Colonnes : `id`, `user_id`, `type` (`credit` | `debit`), `amount_cents`, `balance_after_cents`, `reference` (id Paddle ou id job), `metadata` jsonb, `created_at`.

Index unique sur `(user_id, reference)` pour `type='credit'` → idempotence Paddle.

## Fonctions RPC (SECURITY DEFINER)

### `dev_wallet_credit(_user_id, _amount_cents, _reference, _metadata)`
- Idempotent : si `reference` existe déjà, retourne le solde sans rien faire.
- Appelée uniquement par l'edge function `payments-webhook` (service role).

### `dev_wallet_debit(_user_id, _amount_cents, _reference, _metadata)`
- Atomique : `UPDATE ... WHERE balance_cents >= _amount_cents RETURNING ...`.
- Renvoie `null` si solde insuffisant → l'API répond **402 Payment Required**.

## Catalogue Paddle

Produits créés via `payments--batch_create_product` :

| `external_id` | Montant | Jobs estimés |
|---|---|---|
| `topup_20` | 20 € | 200 |
| `topup_50` | 50 € | 500 |
| `topup_100` | 100 € | 1 000 |
| `topup_250` | 250 € | 2 500 |
| `topup_custom_eur` | 1 € / unité (min 5, max 10 000) | variable |

Le sandbox se synchronise automatiquement vers le live à la publication.

## Edge functions

### `payments-webhook` (Paddle → backend)
- Reçoit `transaction.completed`.
- Lit `customData.userId`, crédite le wallet via `dev_wallet_credit`.
- Idempotent grâce à `transaction.id` comme `reference`.

### `get-paddle-price`
- Helper : résout un `external_id` lisible (`topup_50`) vers un `priceId` Paddle interne (`pri_xxx`).

### `crawlers-api` — `POST /v1/jobs`
1. Authentifie la clé `crw_live_*`.
2. Appelle `dev_wallet_debit(user_id, 10, job_id)`.
3. Si solde < 10c → **402** avec `{ error: "insufficient_balance", topup_url: "/developers/profile?tab=facturation" }`.
4. Sinon enqueue le job normalement.

## Frontend

- **`src/lib/paddle.ts`** — chargement Paddle.js + résolution `priceId`.
- **`src/hooks/usePaddleCheckout.ts`** — overlay checkout, passe `customData.userId`.
- **`src/pages/developers/tabs/BillingTab.tsx`** — onglet "Facturation" dans `/developers/profile` :
  - Solde temps réel + estimation jobs restants.
  - 4 boutons preset (20/50/100/250 €) + input montant libre.
  - Historique 30 jours des transactions.

## Variables d'environnement

`.env.development` (preview) et `.env.production` (publié) contiennent :
- `VITE_PADDLE_CLIENT_TOKEN` — token sandbox / live selon environnement.
- `VITE_PADDLE_ENVIRONMENT` — `sandbox` ou `production`.

Secret backend : `PADDLE_API_KEY` + `PADDLE_WEBHOOK_SECRET` (vérification HMAC).

## Sécurité

- Aucune écriture directe sur `dev_wallets` depuis le client (RLS `INSERT/UPDATE/DELETE` refusé).
- Crédit uniquement via webhook signé Paddle.
- Débit uniquement depuis edge function `crawlers-api` (service role + idempotence via `job_id`).
