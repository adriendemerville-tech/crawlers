# 📊 Note de Présentation — Feature "Indice d'Alignement Stratégique" (IAS)

## Résumé exécutif

L'IAS est un **indicateur propriétaire** qui mesure l'écart entre le mix de trafic réel (Marque vs Hors-Marque) d'un site et le ratio optimal théorique dicté par son modèle économique. C'est un diagnostic stratégique inexistant sur le marché, positionné à l'intersection du SEO, du branding et de la business intelligence.

---

## 1. Problème adressé

Aujourd'hui, **aucun outil SEO ne contextualise le ratio Brand/Non-Brand** en fonction du business model. Un e-commerce à 80% de trafic marque est en danger (dépendance), tandis que c'est optimal pour une maison de luxe. Les outils existants (Semrush, Ahrefs) montrent les données brutes sans interprétation stratégique.

**L'IAS transforme une donnée brute en signal décisionnel.**

---

## 2. Architecture technique & Moat

| Composant | Détail |
|---|---|
| **Classification IA** | LLM (Gemini Flash Lite) classifie automatiquement le business model parmi 6 typologies |
| **Sources de données** | Google Search Console (clics réels) + DataForSEO (volume de recherche marque) |
| **Formule propriétaire** | Score de santé = `100 - |R_actuel - R_cible| × 100` + Taux de pénétration marque |
| **Historisation** | Table `ias_history` : suivi hebdomadaire pour détecter les dérives dans le temps |
| **Stack** | 84e Edge Function backend · Jauge radiale Recharts · Gating Premium via CSS blur |

**Coût marginal quasi nul** : les données GSC sont déjà collectées par le tracking existant. L'appel DataForSEO (volume marque) coûte ~0.001$/requête. La classification LLM utilise le modèle le moins cher (Flash Lite).

---

## 3. Potentiel de monétisation

**L'IAS est un levier de conversion Free → Pro :**

- **Utilisateurs Free** : voient la carte IAS **floutée avec cadenas violet** — effet "peek behind the curtain" qui crée le désir
- **Utilisateurs Pro** : accès complet + modification manuelle de la typologie + recalcul instantané
- **Rétention** : l'historisation hebdomadaire crée un **graphe d'évolution** qui incite au suivi longitudinal (habitude → rétention)

### Estimation d'impact

- Taux de conversion Free→Pro actuel : ~X%
- Uplift estimé : **+15-25%** sur les utilisateurs ayant connecté la GSC (audience qualifiée à forte intention)
- Raison : l'IAS est le **premier indicateur qui parle "business"** et non "technique" — il parle au CMO, pas au développeur

---

## 4. Positionnement concurrentiel

| Critère | Semrush | Ahrefs | SE Ranking | **Crawlers.fr (IAS)** |
|---|---|---|---|---|
| Split Brand/Non-Brand | ❌ Manuel | ❌ Manuel | ❌ Non | ✅ Automatique (LLM) |
| Ratio cible par business model | ❌ | ❌ | ❌ | ✅ 6 typologies |
| Score de santé contextualisé | ❌ | ❌ | ❌ | ✅ Propriétaire |
| Taux de pénétration marque | ❌ | ❌ | ❌ | ✅ DataForSEO |
| Historisation automatique | ❌ | ❌ | ❌ | ✅ Hebdomadaire |

**Aucun concurrent direct.** L'indicateur le plus proche est le "Brand Traffic" de Semrush, mais il ne contextualise pas par business model et ne produit pas de score actionnable.

---

## 5. Intégration dans le flywheel produit

L'IAS s'insère dans la boucle de valeur existante :

```
Audit → IAS (diagnostic) → Action Plan → Corrective Code → Mesure d'impact → Prédiction
```

Il renforce le **moat data** : chaque calcul IAS enrichit la base de benchmarks par secteur, permettant à terme de proposer des **comparaisons sectorielles** ("Votre IAS de 72 est inférieur à la médiane e-commerce de 85").

---

## 6. Métriques à suivre

- **Activation** : % d'utilisateurs GSC-connectés qui consultent l'IAS
- **Conversion** : taux de clic sur "Débloquer l'IAS" (Free → Tarifs)
- **Rétention** : fréquence de retour sur le dashboard après activation IAS
- **Expansion** : nombre de sites suivis par utilisateur Pro (l'IAS motive le multi-site)

---

## 7. Coût de développement

- **~450 lignes** de code (Edge Function + composant React)
- **0 dépendance externe** ajoutée
- **Temps de développement** : 1 session
- **ROI technique** : réutilise 100% de l'infrastructure existante (GSC, DataForSEO, LLM Gateway, tracking)

---

## Conclusion

L'IAS est une feature à **fort levier stratégique** (différenciation, conversion, rétention) pour un **coût marginal négligeable**. Elle positionne Crawlers.fr comme le seul outil qui traduit des données SEO en intelligence business contextualisée.
