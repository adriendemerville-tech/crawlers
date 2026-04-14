# Memory: tech/geo-parity-gaps-fr
Updated: 2026-04-14

## Éléments GEO des guides non encore exposés aux utilisateurs

### 1. SpeakableSpecification JSON-LD
- **Utilisé dans** : `GuideTemplate.tsx` → `buildSpeakableJsonLd()`
- **Effet** : Indique aux assistants vocaux et moteurs IA quelles sections sont citables
- **À exposer via** : Code Architect (injection `schema_speakable` avec cssSelector personnalisé)
- **Cibles** : `h1`, titres de sections, passages clés identifiés par l'utilisateur

### 2. Passages citables GEO (`<blockquote class="citable-passage">`)
- **Utilisé dans** : `GuideTemplate.tsx` → chaque section avec `citablePassage`
- **Effet** : Maximise les chances d'extraction par ChatGPT, Gemini, Perplexity
- **À exposer via** : Content Architect (génération automatique de passages 40-80 mots), Code Architect (injection HTML `html_citable_passage`)
- **Format** : `<blockquote>` avec classe sémantique, style distinct

### 3. HowTo JSON-LD
- **Utilisé dans** : `GuideTemplate.tsx` → `buildHowToJsonLd()`
- **Effet** : Rich snippets "Étapes" dans Google + extraction structurée par IA
- **À exposer via** : Content Architect (détection de listes numérotées → proposition HowTo), Code Architect (injection schema)
- **Condition** : Sections contenant des étapes séquentielles

### 4. BreadcrumbList JSON-LD automatique
- **Utilisé dans** : `GuideTemplate.tsx` → `buildBreadcrumbJsonLd()`
- **Déjà partiellement exposé** : `render-page` edge function le fait pour le SSR
- **À vérifier** : Audit Expert devrait détecter l'absence de breadcrumbs et recommander l'injection
- **Stratège Cocoon** : Devrait vérifier la cohérence hiérarchique des breadcrumbs

### 5. Liens d'autorité externes (outbound authority links)
- **Utilisé dans** : `GuideTemplate.tsx` → section "Sources & références"
- **Effet** : Signal E-E-A-T fort (Google Search Central, Schema.org, études)
- **À exposer via** : Content Architect (suggestion automatique de 3-5 liens d'autorité par contenu généré)
- **Audit Expert** : Devrait scorer la présence/absence de liens externes autoritaires

### 6. Maillage interne latéral automatique
- **Utilisé dans** : `GuideTemplate.tsx` → section "Guides connexes" + colonne `lateral_links`
- **Déjà partiellement exposé** : Cocoon gère le maillage, Content Architect propose des liens
- **Gap** : Le Code Architect ne propose pas encore d'injection de blocs "Articles connexes" en bas de page

## Éléments déjà disponibles aux utilisateurs
- FAQPage JSON-LD → Content Architect, Code Architect, Audit Expert
- Meta title/description → tous les outils
- Open Graph → Code Architect
- Canonical URL → Audit Expert détecte les doublons
