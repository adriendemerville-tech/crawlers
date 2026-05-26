# SAV — Routing AI (override Groq)

Ce lexique aide le SAV à répondre aux questions liées au routeur LLM admin qui bascule certaines features vers **Groq** au lieu du modèle d'origine (Gemini / Lovable AI Gateway).

## Périmètre

Trois features sont concernées (toutes admin, transparentes pour l'utilisateur final) :

| Feature | Effet visible utilisateur |
|---|---|
| `editorial_tonalizer` | Étape 4 du pipeline éditorial (tonalité finale d'un article) |
| `cocoon_anchor_variants` | Variantes d'ancres pour les liens internes Cocoon |
| `meta_alt_generator` | Génération meta description + alt images |

Toutes les autres tâches LLM (Stratège, Rédacteur, market_diagnosis, content_brief, etc.) sont **non concernées** par ce routeur.

## Réponses types

### "Mes articles ont changé de tonalité / mes ancres semblent différentes"

C'est probablement lié à un basculement Groq sur `editorial_tonalizer` ou `cocoon_anchor_variants`.
1. Vérifier en admin → **Routing AI** quelle feature est sur Groq (badge `Groq actif`).
2. Si le client préfère l'ancien rendu : désactiver le toggle de la feature concernée OU cliquer **Tout restaurer** (toggle global).
3. La propagation prend ≤ 30 s (cache router).

### "L'IA ne répond pas / réponse vide sur une étape éditoriale"

Le router fait un **fallback automatique** vers Lovable AI Gateway si Groq retourne une erreur. Si malgré tout la sortie est vide :
1. Vérifier les logs de l'edge function concernée (`editorial-tonalizer`, `cocoon-auto-linking`).
2. Vérifier que le secret `GROQ_API_KEY` n'est pas expiré (compte Groq actif).
3. En dépannage immédiat : désactiver la feature dans **Routing AI** → repasse instantanément sur le modèle d'origine.

### "Comment revenir à la configuration d'origine ?"

Admin → **Routing AI** → bouton **Tout restaurer** (bandeau Contrôle global) → toutes les features rebasculent sur leur `original_model`. Effet immédiat (≤ 30 s).

### "Combien d'économies / gain de latence ?"

- **Latence** : -6 à -15 s par appel selon la feature.
- **Coût LLM** : ~50 % d'économie sur les features routées (~0,20 €/site/mois).
- Aucun impact mesurable sur la qualité éditoriale (tâches de formatage, pas de raisonnement).

### "Une feature manque dans la liste"

Le routeur ne couvre que 3 features pour l'instant (volontairement). Pour en ajouter une :
1. Insérer une ligne dans `ai_routing_overrides`.
2. Remplacer l'appel LLM par `callRoutedAI('ma_feature', { ... })` dans l'edge function.
3. Apparaît automatiquement dans l'UI admin.

## Diagnostic rapide

| Symptôme | Cause probable | Action |
|---|---|---|
| Tonalité d'article différente | `editorial_tonalizer` sur Groq | Toggle off OU Tout restaurer |
| Ancres internes étranges | `cocoon_anchor_variants` sur Groq | Toggle off |
| Lenteur sur tonalisation | Groq désactivé, retour Gemini | Réactiver Groq |
| Erreur 401 Groq dans logs | `GROQ_API_KEY` invalide | Régénérer le secret |

## Référence technique

`knowledge/tech/ai/groq-routing-override-fr.md` (architecture, table `ai_routing_overrides`, router `_shared/aiRouter.ts`, UI `AIRoutingControl.tsx`).
