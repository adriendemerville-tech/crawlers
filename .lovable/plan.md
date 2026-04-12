
# Plan de performance mobile — Pages Blog

## Phase 1 : Réduire le JavaScript critique (Impact LCP & FCP majeur)

### Tâche 1.1 — Lazy-load des chunks lourds non-essentiels au blog
- `vendor-pdf` (615 KiB) : import dynamique `React.lazy()`, ne charger que sur les pages qui l'utilisent (audit PDF)
- `html2canvas` (73 KiB) : idem, n'est pas utilisé sur les articles
- `vendor-recharts` (110 KiB) : idem, pas de graphiques sur les articles
- **Gain estimé : ~337 KiB de JS en moins sur les pages blog**

### Tâche 1.2 — Désactiver Supabase Realtime sur les pages blog publiques  
- Le client Supabase tente d'ouvrir un WebSocket sur chaque page, même publique → erreurs console + JS inutile
- Conditionner le channel Realtime uniquement aux pages authentifiées (dashboard)
- **Gain : supprime les erreurs console + réduit vendor-supabase actif**

### Tâche 1.3 — CSS critique inline + defer le reste
- Extraire le CSS critique (above-the-fold) du blog et l'inliner dans le `<head>` via `render-page`
- Charger `index.css` en `media="print" onload` pour débloquer le rendu
- **Gain estimé : -940ms de blocage rendu**

## Phase 2 : Optimiser le LCP (Image hero)

### Tâche 2.1 — Convertir les images blog Unsplash en WebP/AVIF optimisé
- Les images sont servies depuis Unsplash sans optimisation de taille
- Ajouter un proxy d'image ou utiliser les paramètres Unsplash (`?w=800&q=75&fm=webp`)
- Appliquer `fetchpriority="high"` et `<link rel="preload">` pour l'image hero
- **Gain estimé : -8 KiB + LCP réduit de ~2s**

### Tâche 2.2 — Preconnect correct pour Supabase
- Le preconnect vers Supabase est marqué "inutilisé" (attribut `crossorigin` manquant)
- Corriger ou supprimer le preconnect si non nécessaire sur les pages blog

## Phase 3 : Cache & headers HTTP

### Tâche 3.1 — Configurer les headers Cache-Control sur les assets statiques
- Les assets Vite (`/assets/*`) doivent avoir `Cache-Control: public, max-age=31536000, immutable` (hash dans le nom)
- Configurer via Cloudflare Page Rules ou le Worker

## Phase 4 : SEO & accessibilité

### Tâche 4.1 — Corriger le conflit canonical `?lang=en`
- L'URL canonique doit pointer vers la version sans paramètre `?lang=`
- Mettre à jour `render-page` pour générer un canonical propre

### Tâche 4.2 — Corriger le contraste des boutons "Read article"
- Augmenter le ratio de contraste des CTA dans les cartes d'articles

### Tâche 4.3 — Corriger l'ordre séquentiel des headings  
- Vérifier la hiérarchie H1 > H2 > H3 dans le composant ArticlePage

## Phase 5 : Prévention future (articles à venir)

### Tâche 5.1 — Optimisation automatique des images dans le composant ArticlePage
- Transformer automatiquement les URLs Unsplash en variantes optimisées (WebP, taille responsive)
- Ajouter `loading="lazy"` sur les images below-the-fold, `fetchpriority="high"` sur le hero
- Ajouter des attributs `width`/`height` pour éviter le CLS

### Tâche 5.2 — Audit de bundle automatisé  
- Ajouter `rollup-plugin-visualizer` au build pour monitorer la taille des chunks
- Configurer des seuils d'alerte si un chunk dépasse 100 KiB sur les routes blog

## Phase 6 : Landing page « Breathing Spiral »

### Tâche 6.1 — Créer la landing page `/landing/breathing-spiral`
- Page éditoriale expliquant le concept de Breathing Spiral : système homéostatique SEO qui oscille entre contraction (consolidation Ring 1) et expansion (Ring 2/3)
- **Schéma interactif** : animation SVG ou Canvas montrant la spirale qui "respire" (contraction sur anomalie, expansion quand maturité >70%)
- **Diagramme des signaux** : représentation visuelle des 9 facteurs du spiral_score et de leurs poids
- **Section conceptuelle** : élégance du modèle vs SEO statique — la spirale s'adapte en temps réel aux signaux terrain (GSC, GA4, concurrence, saisonnalité)
- **Angle GEO** : structurer le contenu pour maximiser la citation par les LLMs — données factuelles, tableaux comparatifs, définitions claires, JSON-LD enrichi
- **SEO on-page** : meta optimisées, FAQ schema, BreadcrumbList, canonical propre
- **CTA** : lien vers l'activation de l'Autopilot / demande de démo
- Insertion dans `seo_page_drafts` avec `page_type = 'landing'`, statut `draft` pour validation admin

---

**Objectif : Score PageSpeed mobile ≥ 90 sur toutes les pages blog**
**Estimation : 7 tâches techniques principales**
