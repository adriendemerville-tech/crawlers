# Memory: features/identity-card-fr

## Carte d'Identité (Mes Sites → onglet URL)
- Bouton carré "Carte d'identité" en haut de chaque onglet site, design minimaliste (bordure grise, fond transparent).
- Modal affichant la taxonomie complète de l'entité depuis la table `tracked_sites` (identity_card, client_targets, jargon_distance).
- 4 classes non encore détectées affichées avec champs vides.
- **Bouton micro** : demande autorisation navigateur, transcription vocale → résumé en classes par IA → taxonomie dynamique enrichie.
- **Mode d'emploi** (menu déroulant) avec instructions :
  - Soyez bref, faites des phrases courtes
  - Soyez précis, utilisez des mots clés, des chiffres
  - Quel est votre objectif business à court/moyen terme ?
  - Qui est votre principal concurrent SERP / concurrent général ?
  - Avec qui Crawlers ne doit pas confondre votre entreprise ? Quelle activité ?
- Le micro s'anime en rouge pendant l'enregistrement, visible même avec les instructions ouvertes.

## Crawl Multi-Pages
- Scrape le sitemap.xml comme source de données croisées (pas affiché directement en front).
- Front-end affiche uniquement les pages en ligne : index et non-index.
- Fonction index/noindex intégrée.

## Matrice d'audit (ex "Matrice CSV", ex "Matrice de Prompts")
- Renommée "Matrice d'audit" dans le header, la Console et la page /matrice.
- Moteur d'audit sur-mesure : 6 types de KPIs (balises, données structurées, performance, sécurité, prompts LLM, métriques combinées).
- Accepte .csv et .doc/.docx en import (extraction IA via Gemini).
- Pondération, seuils personnalisables, gestion de lots, score pondéré global /100.
