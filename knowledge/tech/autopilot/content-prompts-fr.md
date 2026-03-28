# Memory: tech/autopilot/content-prompts-fr
Updated: 2026-03-28

## Prompts SEO/GEO par type de page — Parménion

### Principe
Chaque contenu créé par Parménion (ou Content Architect) utilise un prompt-template spécialisé selon le **type de page** détecté. Les templates sont stockés en BDD (`content_prompt_templates`) et modifiables via l'admin sans redéployer.

### 3 types de pages

| Type | Usage | Longueur cible |
|------|-------|----------------|
| `landing` | Pages de conversion (offre, service, solution) | 1200-2000 mots |
| `product` | Fiches produit e-commerce | 800-1500 mots |
| `article` | Blog, guides, contenu éditorial | 1800-3000 mots |

### Détection du type (combinée)

Ordre de priorité :
1. **Workbench** : `finding_category` + `target_operation` (ex: `missing_page` + `create` + contexte "blog" → article)
2. **URL patterns** : regex sur l'URL cible (`/blog/` → article, `/produit/` → product, `/offre/` → landing)
3. **Intent signals** : mots-clés dans le titre/description ("comment" → article, "prix" → product, "demo" → landing)
4. **Fallback** : si `target_operation === 'create'` → article par défaut

### Structure d'un template

| Champ | Description |
|-------|-------------|
| `system_prompt` | Rôle et mission du LLM |
| `structure_template` | Structure HTML obligatoire (H1, H2, sections) |
| `seo_rules` | Règles SEO classiques (mots-clés, maillage, longueur) |
| `geo_rules` | Règles GEO pour citation par les IA (passages citables, FAQ, E-E-A-T) |
| `tone_guidelines` | Adaptation du ton selon secteur/cible |
| `examples` | Exemples concrets par secteur (H1, intro, passage citable) |
| `detection_patterns` | Patterns URL + catégories workbench pour auto-détection |

### Règles GEO communes

- **Passage citable** : chaque H2 contient 1 paragraphe autonome de 40-80 mots
- **Réponse directe** : les 150 premiers mots répondent à l'intention principale
- **FAQ conversationnelle** : questions formulées comme un utilisateur les poserait à un LLM
- **Données factuelles** : chiffres, sources, preuves (pas de "beaucoup", "souvent")
- **Section "Erreurs à éviter"** : format négatif 2x plus cité par les LLM
- **Fraîcheur** : mentionner l'année, dater les informations
- **E-E-A-T** : expertise auteur, expérience terrain, sources

### Injection dans Parménion

Le prompt contenu (`prescribeWithDualPrompts`) :
1. Charge les templates actifs depuis `content_prompt_templates`
2. Détecte le type de chaque item via `detectPageType()`
3. Injecte le template correspondant dans le prompt LLM
4. Le LLM produit du contenu formaté selon la structure du template
