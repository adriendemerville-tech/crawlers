# Lot 5 — Plan Autorité (backlinks propres)

Objectif : passer l'Authority Score de 6 à 20+ en 6 mois via des signaux propres (études de données, mentions presse, guest posts). Tout ce lot est **off-platform** : le code ne peut pas créer de backlinks, seulement préparer les livrables.

## 5.1 — Études de données propriétaires (3 sujets prêts à publier)

Chaque étude = 1 page pilier + 1 PDF téléchargeable + 1 pitch presse.

### Étude A — « % de sites français bloquant GPTBot / Perplexity / Claude »
- **Data source** : crawl des `robots.txt` des top 1000 sites FR (SimilarWeb / Tranco).
- **Angle presse** : *« Les médias FR bloquent-ils ChatGPT ? »* → cible : Le Monde Tech, Numerama, Frandroid, BDM.
- **Page cible** : `/etudes/blocage-gptbot-france`.
- **Livrable** : classement par secteur (média, e-commerce, SaaS, institutionnel).

### Étude B — « Baromètre GEO 2026 : quelles marques citées par ChatGPT sur 500 requêtes commerciales FR »
- **Data source** : batch d'appels ChatGPT / Perplexity via nos edge functions existantes.
- **Angle presse** : *« Le nouveau SEO : qui gagne dans les réponses IA ? »* → cible : JDN, Siècle Digital, BDM.
- **Page cible** : `/etudes/barometre-geo-2026`.

### Étude C — « Coût moyen d'une réponse ChatGPT vs 1 clic Google Ads »
- **Data source** : comparaison CPC Semrush secteur × coût inference LLM.
- **Angle presse** : *« Google Ads va-t-il mourir avec l'IA ? »* → cible : Petit Web, JDN, Alliancy.
- **Page cible** : `/etudes/cout-reponse-chatgpt-vs-google-ads`.

## 5.2 — Cibles Guest Posts (AS ≥ 40, thématique SEO/IA FR)

| Site | AS estimé | Contact | Angle proposé |
|---|---|---|---|
| abondance.com | 62 | Olivier Andrieu | « GEO : comment structurer son site pour ChatGPT » |
| webrankinfo.com | 55 | Olivier Duffez | « Les 7 signaux GEO que Google copiera en 2026 » |
| blogdumoderateur.com | 78 | rédaction | Sujet Étude A ou B |
| journaldunet.com | 82 | Frédéric Cavazza | Sujet Étude C |
| siecledigital.fr | 66 | rédaction | Étude B |
| frenchweb.fr | 58 | rédaction | Étude A |

## 5.3 — Digital PR — Pitch template (à réutiliser)

```
Objet : [Étude exclusive FR] {chiffre choc} — {sujet}

Bonjour {prénom},

Je pilote Crawlers.fr, plateforme SEO/GEO qui audite {N} sites FR.
Nous venons de terminer une étude inédite : {résumé 1 ligne + chiffre choc}.

Résultats clés :
- {stat 1}
- {stat 2}
- {stat 3}

Étude complète (embargo levé) : {lien /etudes/...}
Données brutes CSV + graphiques dispo sur demande.

Adrien de Volontat
Fondateur Crawlers.fr
```

## 5.4 — Backlinks quick wins (à faire cette semaine, sans écrire de code)

- **Product Hunt** : lancement produit → 1 backlink dofollow AS 91.
- **BetaList / AppSumo** : listings SaaS FR.
- **Awwwards / SiteInspire** : si la home passe le jury (design violet/or distinctif → chances réelles).
- **G2 / Capterra** : fiche produit → backlink + reviews.
- **Indie Hackers** : post fondateur → communauté + backlink.
- **HackerNews Show HN** : lancement d'une feature technique (ex. GEO KPIs).

## 5.5 — Suivi

Une fois les 3 études publiées et 5 guest posts obtenus, relancer un `semrush--seo_trend` mensuel pour mesurer :
- Referring domains (objectif : 102 → 200 en 6 mois)
- Authority Score (objectif : 6 → 20+)
- Keywords indexés (objectif : 8 → 100+)

## Ce que je peux coder si tu veux automatiser

1. **Crawler robots.txt** (Étude A) : edge function qui parse 1000 domaines et produit un CSV.
2. **Batch prompts ChatGPT/Perplexity** (Étude B) : réutilisation de nos skills GEO existants.
3. **Pages `/etudes/*`** : templates prêts avec JSON-LD `Dataset` + `Article` + graphiques Recharts.

Dis-moi quel angle tu veux attaquer en premier — je code l'étude choisie.
