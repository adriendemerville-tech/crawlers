# Règles techniques

- Image d'aperçu social : `public/og-crawlers-1600.png` (1600×840), déclarée dans `__root.tsx` (og:image + width/height) et `DEFAULT_OG_IMAGE` de `src/lib/seo/pageHead.ts` — LinkedIn rejette les images de moins de 1600 px de large et se rabat sur une autre image de la page ; renommer le fichier à chaque changement pour contourner le cache des réseaux.
