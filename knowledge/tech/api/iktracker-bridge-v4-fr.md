# Memory: tech/api/iktracker-bridge-v4-fr
Updated: 2026-04-14

L'intégration avec IKtracker ('iktracker-actions') est un pont bidirectionnel complet supportant l'injection de code et la gestion de contenu (articles). Pour éviter les doublons lors de l'automatisation par Parménion, le système applique une **quadruple couche de déduplication** :

### Layers de déduplication (create-post)
1. **Layer A — Jaccard** : Similarité titre ≥ 0.45 → upsert sur le post existant
2. **Layer B — Core Topic Overlap** : ≥ 80% des core keywords partagés → upsert
3. **Layer C — Slug Similarity** : ≥ 0.70 → upsert
4. **Layer D — Topic Saturation Guard** : Si ≥3 articles existants (publiés + brouillons) partagent ≥60% de core keywords avec le titre proposé → **blocage HTTP 409** avec message d'erreur explicite et suggestion d'utiliser `update-post`

### Déploiement de liens Cocoon via API (cocoon-deploy-links)
Le Stratège Cocoon déclenche le déploiement des recommandations de maillage en enchaînant `cocoon-bulk-auto-linking` (génération) et `cocoon-deploy-links` (exécution). Pour IKtracker, le flux est :
1. **GET** `/posts/{slug}` → récupère le contenu HTML de l'article
2. **Injection intelligente 3 tiers** :
   - **Tier 1** : Wrap direct si l'ancre existe dans le texte (regex lookbehind/ahead)
   - **Tier 2** : Utilise le `context_sentence` pré-généré par bulk-auto-linking
   - **Tier 3** : Génère une phrase-pont via IA (Gemini Flash Lite, max 30 mots)
   - **Fallback** : Phrase générique « Pour aller plus loin… »
3. **PUT** `/posts/{slug}` → renvoie le contenu modifié avec les liens injectés

Les insertions (tiers 2+) sont placées avant la conclusion (`insertBeforeLastParagraph`) pour un placement éditorial naturel.

### Semantic Gate
Le contenu généré est systématiquement filtré par la Semantic Gate pour garantir l'alignement avec l'identité du site et prévenir les hallucinations SEO.

### Editorial Guard
- Modification des propres publications de Parménion interdite
- Contenu tiers de ≥6 mois gelé pour l'automatisation
- Validation via RLS et vérification dans l'Edge Function (403 en cas de blocage)

### Authentification
Clé API via header 'x-api-key' avec bypass automatique du fair-use pour les appels système (SERVICE_ROLE).
