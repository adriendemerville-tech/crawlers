# Intégration Crawlers.fr ↔ Dictadevi

Document à transmettre à l'équipe Lovable / Crawlers.fr (moteur Parménion) pour configurer la connexion CMS vers Dictadevi.

---

## 1. Type d'API

**API REST custom** (option 2 du questionnaire).

- ❌ Pas un WordPress (pas de `/wp-json/wp/v2`)
- ❌ Pas un miroir d'IKtracker
- ✅ API REST maison déjà déployée en production

---

## 2. URL de base

```
https://dictadevi.io/api/v1
```

Health check public (sans auth) pour valider la connexion :
```
GET https://dictadevi.io/api/v1/health
```

---

## 3. Authentification

Header HTTP sur toutes les routes (sauf `/health`) :

```http
Authorization: Bearer dk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- Préfixe de clé : `dk_`
- Génération : admin Dictadevi → `/admin/blog-api` → bouton **« Générer une clé »**
- À stocker côté Crawlers dans `cms_connections.api_key`
- Les clés sont révocables côté admin (soft delete via `revoked_at`)

---

## 4. Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Health check (public, sans auth) |
| `GET` | `/api/v1/posts` | Liste paginée. Query : `status`, `slug`, `limit`, `offset` |
| `GET` | `/api/v1/posts/:slug` | Récupère un article |
| `POST` | `/api/v1/posts` | Crée un article |
| `PUT` | `/api/v1/posts/:slug` | Met à jour un article |
| `DELETE` | `/api/v1/posts/:slug` | Supprime un article |
| `GET` | `/api/v1/pages/:key` | Récupère le contenu d'une page statique (CMS) |

---

## 5. Schéma d'un article (`blog_posts`)

```json
{
  "slug": "plombier-paris-15",
  "title": "Plombier Paris 15ème — Dépannage 24/7",
  "content": "Contenu markdown ou HTML…",
  "excerpt": "Résumé court (optionnel)",
  "meta_title": "Plombier Paris 15 | Dictadevi",
  "meta_description": "Description SEO < 160 caractères",
  "canonical_url": "https://dictadevi.io/blog/plombier-paris-15",
  "robots": "index,follow",
  "image_url": "https://…/cover.jpg",
  "category": "paris-15",
  "tags": ["plomberie", "paris", "urgence"],
  "author_name": "Équipe Dictadevi",
  "article_type": "LocalBusiness",
  "semantic_ring": 1,
  "schema_org": { "@context": "https://schema.org", "@type": "Article" },
  "status": "published",
  "published_at": "2025-04-23T10:00:00Z"
}
```

### Champs particuliers

- **`semantic_ring`** : `1` (priorité haute), `2` (moyenne), `3` (longue traîne) — utilisé pour la pondération SEO interne et la priorité dans les sitemaps.
- **`category`** : sert de zone géographique / clé de regroupement pour les sitemaps zonés.
- **`schema_org`** : objet JSON-LD libre, injecté tel quel dans la page.
- **`status`** : `draft` ou `published`. Seuls les `published` apparaissent en front et dans les sitemaps.

---

## 6. Exemples cURL

### Créer un article
```bash
curl -X POST https://dictadevi.io/api/v1/posts \
  -H "Authorization: Bearer dk_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "plombier-paris-15",
    "title": "Plombier Paris 15ème",
    "content": "…",
    "category": "paris-15",
    "semantic_ring": 1,
    "status": "published"
  }'
```

### Mettre à jour
```bash
curl -X PUT https://dictadevi.io/api/v1/posts/plombier-paris-15 \
  -H "Authorization: Bearer dk_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{ "meta_description": "Nouvelle description SEO" }'
```

### Lister les articles publiés d'une zone
```bash
curl "https://dictadevi.io/api/v1/posts?status=published&limit=50&offset=0" \
  -H "Authorization: Bearer dk_xxxxx"
```

---

## 7. Sitemaps & ressources GEO (publics, sans auth)

À déclarer dans Crawlers pour que Parménion exploite l'écosystème SEO/GEO :

| URL | Contenu |
|---|---|
| `https://dictadevi.io/sitemap.xml` | Sitemap maître (index) |
| `https://dictadevi.io/sitemap-blog.xml` | Articles publiés |
| `https://dictadevi.io/sitemap-static.xml` | Pages statiques |
| `https://dictadevi.io/api/sitemap-zone?zone=XXX` | Sitemap par zone géographique / catégorie |
| `https://dictadevi.io/sitemap-llm.xml` | Ressources dédiées AI crawlers |
| `https://dictadevi.io/llms.txt` | Index llms.txt |
| `https://dictadevi.io/llms-full.txt` | Contenu complet pour LLM |
| `https://dictadevi.io/knowledge.json` | Knowledge graph structuré |
| `https://dictadevi.io/rss.xml` | Flux RSS |

---

## 8. Conventions & règles SEO côté Dictadevi

- 1 article = 1 slug unique (kebab-case, ASCII).
- `meta_title` ≤ 60 caractères, `meta_description` ≤ 160.
- Une seule balise `<h1>` par article (générée à partir de `title`).
- `canonical_url` recommandé si l'article est syndiqué.
- Les images doivent être hébergées (URL absolue dans `image_url`).
- Les `tags` et `category` sont libres mais **doivent rester stables** (Parménion les utilise pour le maillage interne).

---

## 9. Récap pour la config Crawlers.fr

| Champ Crawlers | Valeur Dictadevi |
|---|---|
| `cms_type` | `custom_rest` |
| `base_url` | `https://dictadevi.io/api/v1` |
| `auth_type` | `bearer` |
| `api_key` | `dk_…` (généré depuis `/admin/blog-api`) |
| `health_endpoint` | `/health` |
| `posts_endpoint` | `/posts` |
| `post_by_slug_endpoint` | `/posts/{slug}` |
| `pages_endpoint` | `/pages/{key}` |
| `sitemap_url` | `https://dictadevi.io/sitemap.xml` |
| `llm_sitemap_url` | `https://dictadevi.io/sitemap-llm.xml` |

---

**Contact technique** : équipe Dictadevi via l'admin → `/admin/blog-api` (génération/révocation de clés, monitoring du nombre d'articles).
