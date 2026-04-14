# Memory: tech/api/iktracker-bridge-v4-fr
Updated: 2026-04-14

L'intégration avec IKtracker ('iktracker-actions') est un pont bidirectionnel complet supportant l'injection de code et la gestion de contenu (articles). Pour éviter les doublons lors de l'automatisation par Parménion, le système applique une **quadruple couche de déduplication** :

### Layers de déduplication (create-post)
1. **Layer A — Jaccard** : Similarité titre ≥ 0.45 → upsert sur le post existant
2. **Layer B — Core Topic Overlap** : ≥ 80% des core keywords partagés → upsert
3. **Layer C — Slug Similarity** : ≥ 0.70 → upsert
4. **Layer D — Topic Saturation Guard** (NOUVEAU) : Si ≥3 articles existants (publiés + brouillons) partagent ≥60% de core keywords avec le titre proposé → **blocage HTTP 409** avec message d'erreur explicite et suggestion d'utiliser `update-post`

### Semantic Gate
Le contenu généré est systématiquement filtré par la Semantic Gate pour garantir l'alignement avec l'identité du site et prévenir les hallucinations SEO.

### Editorial Guard
- Modification des propres publications de Parménion interdite
- Contenu tiers de ≥6 mois gelé pour l'automatisation
- Validation via RLS et vérification dans l'Edge Function (403 en cas de blocage)

### Authentification
Clé API via header 'x-api-key' avec bypass automatique du fair-use pour les appels système (SERVICE_ROLE).
