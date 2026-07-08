# Vague 1 · Recommandations priorisées — 2026-07-08

Chaque reco = **But visé** (pourquoi on le fait) + **Score de gain qualité** sur 4 axes notés /10 :

- **Perf** : latence utilisateur + charge DB/edge
- **Sécu** : réduction surface d'attaque
- **Coût** : € LLM + € Supabase économisés
- **Maintenabilité** : lisibilité, dette, observabilité

**Score global** = moyenne pondérée (Perf ×1, Sécu ×1.5, Coût ×1.2, Maintenabilité ×1) / 4.7, sur 10.

Ordre = score global décroissant. Effort en jours-homme indicatif.

---

## P0 — À faire cette semaine

### 1. Batcher les updates compteurs `crawl_jobs` / `site_crawls`
**But visé** : arrêter d'exploser la DB avec 32M d'updates ligne à ligne pour incrémenter deux compteurs. Passer à un `SET x = x + N` toutes les 500 pages ou 5s côté worker.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 10 | 0 | 9 | 6 | **7.4** | 1j |

**Levier** : x100 à x500 sur le volume de calls, ~7 800s de DB récupérées sur la période.

---

### 2. Créer les 5 index composites manquants
**But visé** : passer les queries `analytics_events`, `crawl_jobs`, `parmenion_decision_log`, `strategist_recommendations` de 100-300ms à <20ms. Migration unique, zéro risque.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 9 | 0 | 6 | 5 | **5.8** | 0.5j |

**Levier** : ~5 000s de DB récupérées, dashboards Console/Admin plus fluides.

---

### 3. Refactor 12 appels LLM directs → `aiGatewayCall`
**But visé** : remettre TOUS les appels LLM sous observabilité (`ai_gateway_usage`), respecter le kill switch admin `disable_premium`, activer les fallbacks 2 niveaux, se conformer à la mémoire `combo-abc-allocation-fr`.

Fichiers : `audit-compare`, `calculate-llm-visibility`, `detect-fan-out`, `crawlQueue/finalizer`, `dataForSeoStrategic`, `strategicAudit/businessContext`, `check-llm`.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 6 | 9 | 10 | **7.2** | 1.5j |

**Levier** : ~12 flux LLM aujourd'hui invisibles → tracés, plafonnables, résilients.

---

### 4. Statuer sur les 2 tables `RLS Enabled No Policy`
**But visé** : décider intentionnel (write-only via service_role → documenter) ou oubli (→ créer les policies). Aujourd'hui tables muettes ou trou de sécu selon.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 8 | 0 | 5 | **3.6** | 0.5j |

**Levier** : lever une ambiguïté sécu, retirer 2 INFO du scanner.

---

## P1 — Backlog 2 semaines

### 5. Migrer polling `site_crawls.status` + `crawl_pages` → Supabase Realtime
**But visé** : supprimer 48M d'appels de polling. UX crawl en direct (pas de délai 3-5s), charge DB divisée.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 9 | 0 | 7 | 7 | **6.1** | 2j |

---

### 6. `ALTER FUNCTION … SET search_path = public` en batch
**But visé** : neutraliser le risque de schema shadowing sur ~majorité des fonctions. Migration unique générée depuis le linter.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 7 | 0 | 4 | **3.1** | 0.5j |

---

### 7. Restreindre les policies SELECT des 5-6 buckets publics listables
**But visé** : empêcher un anon de lister le contenu (fuite indirecte : noms de fichiers, structure). Restreindre à `owner = auth.uid()` ou aux paths publics documentés.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 8 | 0 | 4 | **3.4** | 0.5j |

---

### 8. Audit des SECURITY DEFINER exécutables par `anon`
**But visé** : pour chaque fonction, décider REVOKE / passer INVOKER / documenter comme public volontaire (ex. `get_shared_architect_recommendation`). Fermer les escalations potentielles.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 9 | 0 | 5 | **3.9** | 1j |

---

### 9. Déplacer 2 extensions `public` → `extensions`
**But visé** : hygiène schéma standard Supabase, évite les collisions de noms.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 4 | 0 | 5 | **2.3** | 0.25j |

---

### 10. Retirer les emojis des 10+ fichiers source
**But visé** : conformité contrainte projet (emojis interdits). Remplacer par icônes `lucide-react` neutres.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 7 | **1.5** | 1j |

---

## P2 — Nice-to-have (à intégrer aux audits verticaux)

### 11. Nettoyer les ~400 hardcoded colors (concentrées Cocoon)
**But visé** : conformité design system (violet/or/noir/blanc), dark mode fonctionnel. À traiter dans l'audit Cocoon (Vague 2) pour éviter double passage.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 8 | **1.7** | 2j (dans Cocoon) |

---

### 12. Ajouter ESLint `no-console` (autoriser warn/error)
**But visé** : arrêter la pollution console utilisateur + éviter les leaks de payload en prod. Sweep unique sur 15 fichiers.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 2 | 0 | 5 | **1.7** | 0.5j |

---

### 13. Réduire les `: any` TypeScript au fil des audits verticaux
**But visé** : dette de typage. Traiter opportuniste, pas de sprint dédié.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 1 | 0 | 5 | **1.4** | continu |

---

## Synthèse

| Priorité | Items | Effort total | Gain global moyen |
|---|---|---|---|
| **P0 (cette semaine)** | 4 | **3.5j** | **6.0 / 10** |
| **P1 (2 semaines)** | 6 | **5.25j** | **3.4 / 10** |
| **P2 (opportuniste)** | 3 | ~continu | **1.6 / 10** |

**Recommandation** : enchaîner P0 (1 semaine dev) → lancer Vague 2 (audit `copilot-orchestrator`) en parallèle du P1 traité en fond de tâche.
