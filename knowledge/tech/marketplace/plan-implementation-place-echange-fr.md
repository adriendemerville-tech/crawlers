# Place d'échange — Plan de tâches d'implémentation (back end / front end)

Date : 2026-08-22 · Cadre de référence : `knowledge/tech/marketplace/matching-engines-backlink-instagram-fr.md`
(§ cités entre parenthèses) · Mémoire : `mem://features/marketplace/v1-core-rules-fr`

Règles transverses non négociables pour toutes les tâches ci-dessous :

- Toute écriture de prix, commission, valeur de jambe, attribut de lien, statut de commande,
  balance ou wallet passe par une **server function** `src/lib/marketplace/*.functions.ts`.
  Aucune de ces écritures depuis le client, aucune via `supabase.from(...).insert` côté navigateur.
- Isolation multi-tenant par `auth.uid()` uniquement ; le `user_id` transmis par le client est ignoré.
- Chaque `CREATE TABLE public.*` est suivi, dans la même migration, des `GRANT` puis
  `ENABLE ROW LEVEL SECURITY` puis des policies. Pas de `GRANT` à `anon` sauf la vue publique.
- Design : violet / or / noir / blanc, boutons bordure + texte (pas de fond), aucun emoji,
  aucun bleu IA. Tokens sémantiques, jamais de couleur codée en dur.
- Coût LLM : le pricing, le `sell_risk`, la valeur d'appariement et la décision d'attribut sont
  **déterministes, sans appel LLM**. Le LLM n'intervient que dans le Studio (§2.9).

---

## L0 — Validations externes (jour 1, en parallèle, aucun code)

| # | Tâche | Sortie attendue |
|---|---|---|
| L0.1 | Consultation juriste paiement / monnaie électronique sur les crédits transférables (§2.16.1) | avis écrit ; tant qu'il manque, `MARKETPLACE_CREDIT_TRANSFER` reste fermé |
| L0.2 | Consultation expert-comptable : régime TVA du troc, mandat d'auto-facturation (§2.5.2) | modèle de mandat + règle de TVA par `tax_status` |
| L0.3 | Rédaction CGVU place d'échange (plafonds, unités de temps, attribut, remboursement) | texte validé, intégré en L5 |

---

## L1a — Socle back end (chemin critique)

### Migrations (une migration par groupe, ordre imposé)

| # | Tâche | Détail |
|---|---|---|
| L1a.1 | Enums | `marketplace_asset_kind`, `marketplace_link_attribute`, `marketplace_deal_type`, `marketplace_order_status`, `marketplace_currency_kind`, `marketplace_trade_type`, `marketplace_sell_risk_class`, `marketplace_tax_status`, `marketplace_verification_method` |
| L1a.2 | `marketplace_pricing_constants` (§2.15) | versionnée, lecture `authenticated`, écriture `service_role` + admin via `has_role`. Seed L1a : paliers P1 40 € · P2 90 € · P3 150 € · P4 250 € · P5 350 €, commission 15 %, décote `link_for_link` 0.70, plafond 350 €, `sell_risk` seuil 0.20, plafonds 1 dofollow/page à vie · 20/domaine/12 mois · 3 insertions/page/12 mois |
| L1a.3 | `marketplace_link_assets` (§4.2) | `SELECT` des colonnes de signaux GSC brutes réservé au propriétaire et à `service_role` (colonnes révoquées + vue). |
| L1a.4 | Vue `marketplace_asset_public_signals` (§2.1.1) | `security_invoker=off` assumé, projection scores 0–100 + fourchettes + clusters + tendance + top pays. **Seule** source lue par les écrans acheteur. `GRANT SELECT` à `authenticated` |
| L1a.5 | `marketplace_page_sell_risk` (§2.12) | cache par page, recalcul à chaque crawl |
| L1a.6 | `marketplace_ownership_verifications`, `marketplace_ownership_claims`, `marketplace_gsc_access_log` (§4.5) | unicité domaine↔compte ; log append-only, aucune policy `UPDATE`/`DELETE` |
| L1a.7 | `marketplace_tax_profiles` (§2.5.2) | sans profil complet + mandat accepté, aucune mise en vente |

### Server functions (`src/lib/marketplace/`)

| # | Fichier | Contenu |
|---|---|---|
| L1a.8 | `constants.server.ts` | lecture et cache mémoire de `marketplace_pricing_constants`, expose `constants_version`. Toute autre fonction lit ici, jamais de constante en dur |
| L1a.9 | `pricing.server.ts` | pricing déterministe : 5 signaux → palier P1–P5, arrondi au palier de 10 €, borne 40–350 €. Tests unitaires sur les bornes et les arrondis |
| L1a.10 | `sellRisk.server.ts` | `sell_risk` + composantes + classe + motif d'exclusion dure (pilier, page de conversion, page en momentum). Alimente `marketplace_page_sell_risk` |
| L1a.11 | `attribute.server.ts` | moteur à deux axes (§2.4.1) : `need_attribute` × `permit_attribute` → attribut figé. `sponsored` par défaut ; `dofollow` seulement si déficit net > 0 **et** `sell_risk` ≤ 0.20 **et** palier ≥ P3 **et** plafonds libres. Produit `attribute_basis` (jsonb auditable) |
| L1a.12 | `caps.server.ts` | compteurs de plafonds liés : 1 `dofollow`/page à vie, 20/domaine/12 mois glissants, 3 insertions/page/12 mois tous attributs (un `dofollow` consomme un des 3) |
| L1a.13 | `ownership.functions.ts` | vérification bloquante GSC / DNS TXT / fichier ; règle **Kbis > IP** sur les grappes de comptes (§2.2) : deux SIREN vérifiés distincts lèvent le blocage IP |
| L1a.14 | `assets.functions.ts` | opt-in/opt-out par page, lecture de mon inventaire (prix estimé, palier, classe de risque, plafonds consommés, revenus cumulés) |
| L1a.15 | Cron | recalcul `sell_risk` post-crawl (branché sur la fin de `crawl-site`), recalcul des prix estimés hebdomadaire |

### Front end L1a

| # | Fichier | Contenu |
|---|---|---|
| L1a.16 | `src/components/Console/Marketplace/MarketplaceModule.tsx` | coquille du module + 4 onglets (les 3 autres inertes en L1a) |
| L1a.17 | `ConsoleSidebar.tsx` | entrée « Place d'échange », réordonnable et masquable, persistance `user_console_preferences` |
| L1a.18 | `SellTab.tsx` | inventaire de mes pages : prix estimé, palier, classe `sell_risk` avec motif lisible, plafonds restants, toggle opt-in, revenus cumulés, message « 1 lien vendu ce mois = abonnement remboursé » |
| L1a.19 | `OwnershipVerificationCard.tsx` | parcours GSC / DNS / fichier, états `verified` / `unverified` / `revoked`, blocage explicite de la mise en vente |
| L1a.20 | `TaxProfileForm.tsx` | statut fiscal, TVA (contrôle VIES), mandat d'auto-facturation à accepter |
| L1a.21 | `useTeamPermissions` | ajout de `marketplace_manage` ; auditeur en lecture seule |

---

## L1b — Stripe Connect / wallet (parallèle, hors chemin critique)

| # | Tâche | Détail |
|---|---|---|
| L1b.1 | Migration wallet | `marketplace_wallet_entries` (tranches `held`/`available`/`cancelled`/`clawed_back`), `marketplace_wallet_debts` (dette `open` gèle vente et achat, solde jamais négatif) |
| L1b.2 | `stripeConnect.functions.ts` | onboarding vendeur, statut KYC, webhook `/api/public/stripe-connect-webhook` avec vérification de signature |
| L1b.3 | `wallet.server.ts` | séquestre, acquisition par tranches, récupération, absorption de dette avant tout passage en `available` |
| L1b.4 | Feature flag | `MARKETPLACE_CREDIT_TRANSFER` **fermé** ; comportement par défaut : soulte cash uniquement |
| L1b.5 | Front | `WalletPanel.tsx` : solde séquestré / disponible / dette, ligne « revenus place d'échange » dans le wallet existant |

Condition de sortie : KYC bloquant opérationnel avant la première mise en vente cash.

---

## L2 — Appariement, besoins, achat

| # | Tâche | Détail |
|---|---|---|
| L2.1 | Migrations | `marketplace_needs` (dérivé de `architect_workbench` / E-E-A-T, `need_primary`/`need_secondary`), `marketplace_matches`, `marketplace_match_values`, `marketplace_buyer_limits` |
| L2.2 | `needs.server.ts` | dérivation déterministe des besoins depuis le workbench ; aucun LLM |
| L2.3 | `matching.server.ts` | `compat_score` + « pourquoi ce match » explicable (facteurs listés, pas de score opaque) |
| L2.4 | `buyerLimits.server.ts` | fenêtres **glissantes** : 4 liens / 30 j, 2 / 7 j, 2 par vendeur / 12 mois, ratio d'ancres exactes, cohérence thématique, `buy_risk`, `next_allowed_at` |
| L2.5 | `matchValue.server.ts` | valeur d'appariement page (face vendeur / face acheteur) et domaine (potentiel de vente, besoin d'achat, solde) ; cache TTL 24 h site-scoped |
| L2.6 | Front `OpportunitiesTab.tsx` | appariements entrants triés par `compat_score`, explication du match |
| L2.7 | Front `BuyTab.tsx` | parcours 4 temps : besoins détectés → **étape bloquante « Mon objectif »** → actifs filtrés par attribut réellement obtenable → panier |
| L2.8 | Front `ObjectiveConfirmCard.tsx` | objectif pré-rempli depuis `need_primary` + justification, à confirmer ou corriger ; écrit `need_objective`, `need_objective_source`, `need_objective_confirmed_at`. Sans confirmation : ajout au panier impossible. Annonce l'attribut applicable avant paiement, sans hiérarchie implicite |

---

## L3 — Commande, Studio, commission

| # | Tâche | Détail |
|---|---|---|
| L3.1 | Migrations | `marketplace_orders` (schéma canonique §4.3, contraintes `price_cents + soulte_cents ≤ 35000` et multiples de 1000), `marketplace_exchanges`, `marketplace_payouts`, `marketplace_content_variants`, `marketplace_link_revisions`, `marketplace_feedback`, `marketplace_invoices`, `marketplace_disputes` |
| L3.2 | `orders.functions.ts` | figeage serveur : prix, commission 15 %, attribut, `attribute_basis`, `constants_version`, `escrow_cents`, `commitment_months` (12 lien · 1 post/Reel · 0 story). Immuable après `frozen_at` |
| L3.3 | `barter.server.ts` | recherche de boucle `link_chain` **prioritaire**, `link_for_link` en dernier recours (décote 0.70, `publish_after` +21 j, quota trimestriel), détection de cycles non déclarés |
| L3.4 | `commission.server.ts` | cash retenu sur le flux ; **crédits obligatoires sur le troc**, par jambe, avec contrôle des soldes avant figeage et taux crédit-euro figé |
| L3.5 | `invoices.server.ts` | pièces figées à l'émission (jambe, soulte, commission, avoir), série continue par mandant, exigibilité = 1ʳᵉ preuve de publication |
| L3.6 | `studio.functions.ts` | 3 variantes (éditoriale / utilitaire GEO / action) via le Gateway, brief figé, coût tracé. **Prompt unique, une seule passe par variante** pour borner le coût. Test d'homogénéité stylistique inter-livrables avant ouverture au volume |
| L3.7 | `disputes.functions.ts` | arbitrage humain, SLA 5 j (`acknowledged_at`, `due_at`), décisions `upheld` / `cancelled_no_fee` / `prorata_refund` / `forced_execution` ; aucune décision ne crée de commission ni ne modifie un prix figé |
| L3.8 | Front `OrdersTab.tsx` | cycle de vie, révisions, feedback bilatéral, validations |
| L3.9 | Front `LinkInsertionPreview.tsx` | diff avant/après, surbrillance du paragraphe, bascule mobile/desktop, panneau de feedback, historique |
| L3.10 | Front `StudioVariantPicker.tsx` | le vendeur valide, l'acheteur choisit la version finale |

---

## L4 — Vérification de publication et de maintien

| # | Tâche | Détail |
|---|---|---|
| L4.1 | Migration | `marketplace_verifications` (§2.13), machine à états de jambe `published` → `verified` → `maintained` / `broken` → `resolved` / `refunded` |
| L4.2 | `verification.server.ts` | contrôle par crawl, `linkedin_api`, `meta_api`. **Escalade de rendu obligatoire avant tout verdict négatif** (coquille JS / blocage de crawl ne valent pas rupture) ; passage par `_shared/linkVerdictShared.ts` pour tout verdict de lien |
| L4.3 | Cron | contrôle J+1, J+7 puis mensuel jusqu'à `commitment_ends_at` |
| L4.4 | Remboursement | prorata sur le reliquat d'engagement, support de remboursement = `buyer_payment_support` (jamais de cash remboursé en crédits) |
| L4.5 | Balance | migration `marketplace_balance_events` / `marketplace_site_balances` / `marketplace_link_queue` ; événements inverses (`reversal_of`) sur jambe annulée ; amortissement 24 mois recalculable à 100 % |
| L4.6 | Front | statut de vérification par commande, preuve et capture, historique des contrôles |

---

## L5 — Surfaces publiques et intégrations éditoriales

| # | Tâche | Détail |
|---|---|---|
| L5.1 | `src/routes/marketplace-backlinks.tsx` | satellite du **pilier GEO** (pas de 5ᵉ silo), `head()` via `pageHead.ts` (titre < 60, description < 160, og/twitter, JSON-LD `Service` + `FAQPage`), H1 unique, SSR complet, FAQ en `<details>` natif, `blockquote.citable-passage`, CTA double |
| L5.2 | `/collab-instagram` | satellite secondaire, même gabarit |
| L5.3 | Maillage | référencement depuis le hub GEO, `SiloNav` mis à jour |
| L5.4 | `/tarifs` | mention marketplace par plan payant + précision sur l'usage des crédits gagnés |
| L5.5 | Audit stratégique | bloc Marché & Autorité passé du constat à la proposition ; nouveau bloc « Valeur d'appariement » (page + domaine) ; pages proposées filtrées par `sell_risk` |
| L5.6 | Rapports Marina | section Autorité : 2–3 propositions de liens concrètes ; rapport page = valeur d'appariement ; rapport multipages = valeur globale + pages les moins risquées. Badges « mesuré » / « estimé » centrés, espaces normaux, aucun emoji |
| L5.7 | Home | bloc court, un seul CTA vers la landing |
| L5.8 | Bloc « Ma balance » | produit de rétention (§2.14) dans la console |
| L5.9 | CGVU | intégration du texte L0.3, unités de temps des plafonds explicitées |

---

## L6 — Collab Instagram (v1.5)

| # | Tâche | Détail |
|---|---|---|
| L6.1 | Migration | `marketplace_social_assets` |
| L6.2 | OAuth Meta | connexion, révocation avec révocation de token côté fournisseur |
| L6.3 | Métriques | ingestion, pricing social par palier |
| L6.4 | Front | `CollabBriefPreview.tsx` (maquette post/story, légende, mention de conformité, feedback) |
| L6.5 | Vérification | contrôle de publication et de maintien via API Meta |

---

## Ordre d'exécution et dépendances

```text
L0  ──────────────────────────────────────────────►  (validations, jour 1)
L1a ──► L2 ──► L3 ──► L4 ──► L5 ──► L6
L1b ──────────────┘  (rejoint L3 pour l'encaissement)
```

- L2 dépend de L1a (actifs, `sell_risk`, attribut, vue publique).
- L3 dépend de L1a + L2, et de L1b pour l'encaissement cash uniquement.
- L1b ne dépend d'aucun autre lot ; le flag crédit-à-crédit ne s'ouvre qu'après L0.1.
- L5.5 et L5.6 dépendent de L2.5 (valeur d'appariement).

## Définition de « terminé » par lot

1. Migration appliquée avec `GRANT` + RLS + policies, vérifiée par un scan de sécurité.
2. Toute écriture sensible passe par une server function ; aucun chemin client équivalent.
3. Tests unitaires sur les fonctions déterministes (pricing, `sell_risk`, attribut, plafonds,
   fenêtres glissantes, prorata).
4. Écrans conformes à la charte (bordure + texte, pas d'emoji, pas de bleu IA) et gatés par
   `marketplace_manage`.
5. `head()` propre et unique sur toute nouvelle route publique.
6. Aucun appel LLM ajouté hors Studio.
