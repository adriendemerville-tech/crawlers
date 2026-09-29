# Image d'aperçu social (Open Graph)

- Fichier : `public/og-crawlers-1600.png`, 1600×840 px.
- Déclarations : `src/routes/__root.tsx` (`og:image`, `og:image:width` 1600, `og:image:height` 840, `twitter:image`) et `DEFAULT_OG_IMAGE` dans `src/lib/seo/pageHead.ts`.
- Pourquoi : LinkedIn Post Inspector refusait l'ancienne image en 1200×630 (« at least 1600px ») et affichait à la place un logo tiers présent sur la home.
- Mise à jour : produire un nouveau fichier sous un nouveau nom, mettre à jour les deux déclarations, publier, puis relancer https://www.linkedin.com/post-inspector/ sur https://crawlers.fr.
