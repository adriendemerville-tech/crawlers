# Plan : Plateforme Développeurs (api.crawlers.fr)

Nouvelle UI dédiée aux 3 APIs (Crawlers / Marina / Parménion), même backend, même `auth.users`. Pas de duplication serveur — uniquement nouvelles routes front + Stripe metered.

---

## Sprint 1 — Shell + Clés API (≈ 1 jour)

**Objectif :** un dev peut s'inscrire, générer ses 3 clés, faire son premier appel.

**Routes (front, sous-section `/developers/*` du même app pour MVP, domaine dédié en V2) :**
- `/developers` — landing dev (3 APIs, code snippets, CTA inscription)
- `/developers/signup`, `/developers/login`, `/developers/reset-password` — réutilise `AuthContext` existant
- `/developers/dashboard` — 3 cartes API (statut, jobs 24h, dernière requête)
- `/developers/profile?tab=parametres` — nom, email, mot de passe, suppression
- `/developers/profile?tab=cles-api` — générer/révoquer `crw_live_`, `mk_live_`, `prm_live_` (3 sections, copy-to-clipboard, masquage après création)
- `/developers/docs` — index unifié pointant vers `/docs/api/crawlers`, `/docs/api/marina`, `/docs/api/parmenion` + quickstart commun

**Backend :**
- Aucune nouvelle table — `crawlers_api_keys`, `marina_api_keys`, `parmenion_api_keys` existent déjà
- Edge functions `*-api-keys-create` / `*-revoke` à factoriser si pas déjà fait
- RLS : déjà OK (clés filtrées par `auth.uid()`)

**Design :**
- Skin minimaliste violet/jaune/noir/blanc, pas de sidebar Cocoon/Autopilot
- Boutons : bordure + texte (cf. règles projet), pas de fond

---

## Sprint 2 — Consommation + Webhooks (≈ 1 jour)

**Objectif :** un dev voit ce qu'il consomme et peut éviter le polling.

**Routes :**
- `/developers/profile?tab=consommation`
  - Graphes : jobs/jour × feature × API (30j), barres empilées
  - Tableau : top 10 features consommées, coût estimé
  - Filtre par clé API
- `/developers/profile?tab=webhooks`
  - Liste des webhooks (URL + secret + events)
  - Test "ping" depuis l'UI

**Backend :**
- Vue SQL agrégée `developer_usage_daily` (UNION ALL des 3 tables jobs, group by user_id, day, api, feature)
- Nouvelle table `developer_webhooks` (user_id, api, url, secret, events[], active)
- Hook dans `crawlers-api` / `marina-api` / `parmenion-api` : à chaque job completed → POST signé (HMAC SHA-256) vers webhook si configuré
- Retry exponentiel × 5, table `webhook_deliveries` pour audit

---

## Sprint 3 — Facturation Stripe metered (≈ 1.5 jour)

**Objectif :** le dev paie au volume réel sans avoir à recharger.

**Modèle :**
- Free tier : 100 jobs/mois cumulés (toutes APIs), reset le 1er du mois
- Au-delà : pay-as-you-go, prix unitaire par feature
- Option packs prépayés (1k / 10k / 100k crédits, remise dégressive) — V2

**Prix indicatifs (à valider) :**
- `geo_score`, `eeat`, `pagespeed` : 0.05 €
- `audit_expert`, `semantic_audit`, `serp_ranking` : 0.20 €
- `audit_matrix`, `competitors`, `llm_visibility` : 0.50 €
- `site_crawl` : 0.02 € / page crawlée
- Marina : 0.30 € / audit prospect
- Parménion : 2 € / cycle exécuté

**Backend :**
- Stripe metered billing (subscription items, usage records)
- Nouvelle table `developer_billing` (user_id, stripe_customer_id, stripe_subscription_id, plan, payment_method_last4)
- Edge function `report-usage-to-stripe` cron horaire : agrège les jobs `completed` depuis dernier report → `POST /v1/subscription_items/{id}/usage_records`
- Webhook Stripe : `invoice.paid`, `payment_method.attached`, `customer.subscription.updated`

**Routes :**
- `/developers/profile?tab=facturation`
  - Plan actuel + consommation du mois + estimation fin de mois
  - Méthode de paiement (Stripe Elements)
  - Historique factures (PDF Stripe)
  - Limite mensuelle (hard cap, désactive les clés au-delà)

**Provider :** Stripe (built-in Lovable Payments, pas BYOK) — éligibilité à confirmer via `recommend_payment_provider` au début du sprint.

---

## Hors-scope MVP (V2)

- Domaine dédié `api.crawlers.fr` (déploiement séparé, sous-app)
- Packs prépayés
- Quotas par clé (vs par user)
- Page statut publique (`status.crawlers.fr`)
- SDK officiel TS/Python (auto-généré depuis OpenAPI)

---

## Détails techniques

**Réutilisation maximale :**
- `AuthContext`, `useAuth`, `Profile` existants
- Edge functions `crawlers-api` / `marina-api` / `parmenion-api` : aucun changement Sprint 1-2
- Tables existantes : `crawlers_api_jobs`, `marina_jobs`, `parmenion_tasks`

**Nouveaux fichiers Sprint 1 :**
```
src/pages/developers/
  ├── DevLanding.tsx
  ├── DevDashboard.tsx
  ├── DevProfile.tsx          (router des tabs)
  ├── tabs/
  │   ├── SettingsTab.tsx
  │   └── ApiKeysTab.tsx
  └── DevLayout.tsx           (header minimal violet/noir)
```

**Sécurité :**
- Clés API affichées une seule fois à la création (hash bcrypt en DB)
- Rate limit par clé : 100 req/min (déjà en place)
- Soft delete des clés (revoked_at) pour audit

---

## Livrable par sprint

| Sprint | Demo |
|--------|------|
| 1 | Signup → générer clé → `curl POST /v1/jobs` réussit |
| 2 | Graphe consommation 7j + webhook reçoit ping signé |
| 3 | Stripe carte enregistrée + 1ère facture metered générée |

Ordre recommandé : 1 → 2 → 3 (Stripe en dernier pour itérer sur les prix après avoir vu la consommation réelle).
