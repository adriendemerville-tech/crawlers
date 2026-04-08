## Diagnostic PageSpeed Mobile (score 64/100)

**Métriques critiques :**
- FCP : 3,8s (rouge) → cible < 1,8s
- LCP : 6,3s (rouge) → cible < 2,5s  
- Speed Index : 6,5s (rouge)
- Délai d'affichage LCP : 2 880ms (le gros du problème)

---

### Tâche 1 — Optimiser les images (gain estimé ~491 KiB)
- `llm-gemini.png` : 1174x1174 affiché 108x108 → redimensionner à 216x216 + convertir en WebP
- `console-seo-monitoring-dashboard.png` : 1920x1200 affiché 452x283 → redimensionner + WebP
- `llm-chatgpt-white.png`, `llm-claude.png`, `llm-grok.png`, `llm-perplexity.png`, `mistral.png` : toutes surdimensionnées → redimensionner à 216x216 + WebP
- Ajouter `width`/`height` explicites sur toutes les `<img>`
- Ajouter `loading="lazy"` sur les images below-the-fold

### Tâche 2 — Lazy-load des JS lourds (gain estimé ~371 KiB)
- `vendor-pdf` (140 KiB) : lazy import, non nécessaire sur la home
- `html2canvas` (46 KiB) : lazy import
- `vendor-motion` (57 KiB) : différer les animations non-critiques ou utiliser `LazyMotion` de framer-motion
- `vendor-supabase` (44 KiB) : vérifier qu'il est déjà code-split

### Tâche 3 — Optimiser le CSS critique (gain estimé ~30 KiB)
- 30 KiB de CSS inutilisé dans `index.css`
- Purger les classes Tailwind non utilisées (vérifier la config de purge)
- Inliner le CSS critique above-the-fold

### Tâche 4 — Corriger la chaîne de requêtes critiques (LCP)
- Chaîne actuelle : HTML → CSS (1,6s) → font Space Grotesk (2,8s)
- Preload la font : `<link rel="preload" href="..." as="font" crossorigin>`
- Font-display: swap pour éviter le blocage
- Corriger le preconnect Supabase (crossorigin manquant)

### Tâche 5 — Réduire les tâches longues du thread principal
- 4 tâches longues détectées
- Ajustement forcé de la mise en page dans `vendor-recharts` et `vendor-ui` (99ms)
- Différer le rendu des sections below-the-fold avec `IntersectionObserver` ou lazy components

### Tâche 6 — Zones cibles tactiles (accessibilité mobile)
- Augmenter la taille/espacement des boutons du carrousel (slides)
- Vérifier les CTA mobiles (min 48x48px)

---

**Impact estimé : Score 64 → 85-92** en appliquant les tâches 1 à 4 (les plus impactantes sur le LCP).