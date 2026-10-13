# Refonte éditoriale du rapport Marina

Objectif : un rapport présentable à un fondateur en 15-20 min, sans perdre la richesse du diagnostic. Règles valables pour tous les sites audités (rien de propre à un seul client).

## 1. Structure en 3 niveaux
- Page 1 « Décision » : synthèse d'une page maximum, 3-4 messages critiques, 3 alertes, 3 gains rapides.
- Pages « Pilotage » : sections actuelles allégées (moins de pastilles, plus d'espace, titres clairs).
- « Annexes de preuve » : tableaux bruts (pages crawlées, tests IA, liens toxiques, content gaps, sous-signaux GEO).

## 2. Sommaire et pagination
- Sommaire cliquable en tête, avec numéros de page.
- Numéro sur chaque page (à l'écran et dans le PDF, sauts de page par section).

## 3. Crédibilité des chiffres
- Suppression des gains en visites inférieurs à un seuil (ex. moins de 50/mois) : remplacés par un impact qualitatif (faible / moyen / fort) ou une fourchette.
- Légende MESURÉ / TESTÉ / DÉDUIT / ESTIMÉ au début, étiquette sur chaque donnée.
- Note de confiance des données en tête de chaque grande section.
- Contexte automatique quand un score semble contradictoire (ex. Authority Score bas avec beaucoup de liens).

## 4. Exactitude
- Pages services / offre : vérifiées sur le crawl avant toute affirmation « absente ».
- Fondateur : détecté à partir des pages À propos / équipe / schema Person ; s'il est trouvé, il est nommé et le score E-E-A-T / voix experte en tient compte.

## 5. Modules sans données
- Si un module (ex. cocon) échoue : encadré expliquant la cause réelle et une alternative manuelle, au lieu d'un trou.

## 6. Plan d'action
- Tri impact / effort, horizon 0-30 j et 30-90 j.
- Un pilote (rôle : dirigeant, rédacteur, développeur…) et un KPI par action.

## Détails techniques
- Fichier principal : `supabase/functions/marina/index.ts` (génération HTML), plus le rendu PDF du lecteur de rapport.
- Pagination PDF via CSS `@page` + `page-break` ; sommaire avec ancres et numéros calculés au rendu PDF.
- Aucune nouvelle requête IA : uniquement réorganisation et règles déterministes (coût inchangé).
- Vérification : génération d'un rapport réel sur un domaine test, puis relecture du PDF.
