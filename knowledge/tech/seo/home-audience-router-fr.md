# Aiguillage d'audience sur la home

Doc technique de l'écran d'accueil `AudienceRouter` affiché au premier passage sur `/`.

Dernière mise à jour : 2026-09-09.

---

## 1. Principe

La home conserve une **URL unique** (`/`). Un écran client-only s'affiche par-dessus le
premier écran pour les nouveaux visiteurs, pose la question :

> « Pourquoi avez-vous besoin de Crawlers ? »

Selon la réponse, le visiteur est orienté :

- **profil dirigeant / TPE-PME** → redirection vers `/audit-geo-seo` (offre Parménion 59 €) ;
- **profil SEO/GEO / réponse vide** → l'écran disparaît et la home classique est visible.

Le choix est persisté pour ne pas réapparaître aux visites suivantes.

---

## 2. Architecture

| Fichier | Rôle |
| --- | --- |
| `src/components/Home/AudienceRouter.tsx` | Overlay client-only, saisie texte, dictée vocale, classification locale, persistence. |
| `src/pages/Index.tsx` | Rend la home SSR + `<AudienceRouter />` en fin de body. |
| `src/routes/index.tsx` | `head()` inchangé : title/description/JSON-LD servis côté serveur. |

Invariants :

- **Aucun impact SEO** : l'overlay n'est jamais rendu côté serveur. Le HTML de `/` garde
tous ses titres, contenus, liens internes et données structurées.
- **Aucun appel LLM** : la classification est déterministe et locale (signaux lexicaux).
- **Pas de redirection côté serveur** : `crawlers.fr` reste la home.

---

## 3. Classification

La fonction `classifyAudience(answer)` compare deux listes de signaux normalisés :

- `BUSINESS_SIGNALS` : vocabulaire commercial (`client`, `devis`, `chiffre`, `TPE`, `PME`,
`visible`, `aide`, `démarrer`…) ;
- `PRO_SIGNALS` : vocabulaire métier (`SEO`, `GEO`, `crawl`, `canonical`, `SERP`,
`Search Console`, `backlink`, `migration`…).

Score simple : +1 par mot, +2 par expression. Le profil avec le score le plus élevé l'emporte.
Égalité ou champ vide → `pro` (on affiche la home complète, aucune perte de contenu).

---

## 4. Persistence

Le choix est stocké dans **deux couches** :

1. **Cookie** `crawlers_audience_choice` : 90 jours, `SameSite=Lax`, accessible au SSR
   (même si le composant ne l'exploite pas côté serveur, le cookie est disponible pour
   d'éventuelles évolutions).
2. **localStorage** `crawlers_audience_choice` : fallback si le cookie est absent.

Lecture : `localStorage` d'abord, puis cookie.
Écriture : les deux en parallèle.

---

## 5. Dictée vocale

Un bouton `Micro` est présent dans la barre de saisie.

- Utilise l'API Web Speech du navigateur (`SpeechRecognition` / `webkitSpeechRecognition`).
- Langue forcée en `fr-FR`.
- Résultats **intermédiaires** affichés en direct, résultats **finaux** validés dans le textarea.
- État d'écoute matérialisé par une bordure violette et une icône pulsante.
- Si l'API n'est pas disponible, le bouton est sans effet mais ne bloque pas la saisie manuelle.
- L'écoute est coupée automatiquement à la soumission (`submit`).

Aucun audio n'est envoyé au serveur : tout se passe dans le navigateur.

---

## 6. UX / animation

- Apparition : `animate-fade-in`.
- Soumission : délai de 2 s pendant lesquels le logo Crawlers pulse avec le texte
  « Crawlers réfléchit… ».
- Lien de sortie : « Voir le site sans répondre » applique le choix `pro`.

---

## 7. Vérification

```bash
# Le graphe home reste présent dans le HTML servi
curl -s http://localhost:8080/ | grep -o 'application/ld+json'

# Le choix est persisté (cookie)
curl -s -b 'crawlers_audience_choice=pro' http://localhost:8080/ > /dev/null
```

Points de vigilance :

- Ne jamais rendre `AudienceRouter` côté serveur.
- Ne jamais ajouter de `noindex` ou de redirection 301/302 sur `/`.
- Maintenir la liste de signaux à jour quand de nouvelles offres ou vocabulaires apparaissent.
