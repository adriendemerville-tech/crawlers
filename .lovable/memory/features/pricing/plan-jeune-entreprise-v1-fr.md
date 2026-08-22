---
name: Plan Jeune Entreprise — règles v1
description: Offre gratuite 12 mois, vérification SIRET+Kbis, quotas fair use F1-F10, F6 = dégradation
type: feature
---
# Plan Jeune Entreprise — règles v1

Source détaillée : `knowledge/tech/pricing/plan-jeune-entreprise-fr.md`

- **Offre** : gratuité plateforme 12 mois, réservée à la France, entreprises < 12 mois.
- **Vérification** : SIRET (API INSEE, `date_creation` < 12 mois, actif) + Kbis < 3 mois.
  Micro-entreprises → Avis SIRENE ; associations → Récépissé RNA.
- **Quotas fair use (F1-F10)** : 50 crédits/mois, crawl 5k URLs/mois, Marina 1/mois,
  audit stratégique 4/mois, dépense LLM 0,50 €/jour, stockage 500 Mo, API 300/jour,
  inactivité 60 j. F2 : **aucune limite de domaines suivis**.
- **F6 — Dépense LLM** : **dégradation d'une journée** (bascule sur le palier éco pour la
  journée, retour à la normale le lendemain). JAMAIS de blocage sec.
- **F8 — Stockage** : purge des exports > 90 jours (arbitrage non tranché : avec/sans purge).
- **Expiration** : `startup_offer_expires_at` = acceptation + 12 mois (jamais création + 12 mois),
  bascule en plan gratuit standard, données conservées.
- **Vérification côté serveur uniquement** (server function), jamais côté client.
- Schéma : `public.startup_offer_applications`, `public.startup_offer_fair_use_events`,
  bucket `startup-proofs` (RLS, PDF/image, 5 Mo).
