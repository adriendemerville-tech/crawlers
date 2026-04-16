# Benchmark SERP Multi-Providers — Documentation technique

## Objectif
Outil Pro Agency dans Console > Indexation permettant de comparer les positions SERP renvoyées par plusieurs providers pour un mot-clé donné.

## Providers supportés
1. **DataForSEO** — API `/v3/serp/google/organic/live/advanced`
2. **SerpApi** — API `serpapi.com/search.json`
3. **Serper.dev** — API `google.serper.dev/search`
4. **Bright Data** — API `api.brightdata.com/request` (zone `serp_api1crawlers`, format `raw`)

## Secrets nécessaires
- `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` (configurés)
- `SERPAPI_KEY` (configuré)
- `SERPER_API_KEY` (configuré)
- `BRIGHTDATA_API_KEY` (configuré)

## Edge Function `serp-benchmark`

### Actions
| Action | Description | Paramètres |
|--------|-------------|------------|
| `benchmark` | Lance un benchmark multi-providers | `query`, `providers[]`, `location`, `target_domain`, `single_hit_penalty` |
| `list` | Liste les benchmarks précédents | `tracked_site_id?`, `limit?` |
| `get` | Récupère un benchmark par ID | `id` |

### Appel Bright Data
L'endpoint utilisé est `https://api.brightdata.com/request` avec :
- `zone`: `serp_api1crawlers`
- `url`: URL Google Search construite dynamiquement (`q`, `gl`, `hl`, `num=30`)
- `format`: `raw`

### Modes d'analyse
- **Batch** : analyse automatique de toutes les URLs du site tracké (via données de crawl)
- **Cible** : analyse d'une URL unique saisie manuellement

### Calcul de la position moyenne
1. Chaque provider retourne une liste de résultats organiques (URL + position)
2. Les URLs sont normalisées et dédupliquées
3. Pour chaque URL, on calcule la moyenne des positions sur les providers qui la trouvent
4. **Single-hit penalty** : case à cocher (fixe +20 pts, non éditable par l'utilisateur). Si un site n'est trouvé que par 1 seul provider, la pénalité réduit les faux positifs / résultats anti-scraping
5. Le classement final est trié par position moyenne croissante

### Table `serp_benchmark_results`
- `providers_data` (JSONB) : données brutes par provider
- `averaged_results` (JSONB) : classement final avec positions croisées
- `single_hit_penalty` : pénalité appliquée (0 ou 20)
- RLS : chaque utilisateur ne voit que ses propres benchmarks

## UI

### Page publique `/app/ranking-serp` (lead magnet)
- Benchmark gratuit avec les 4 providers (DataForSEO, SerpApi, Serper, Bright Data)
- Sélecteur de localisation géographique (pays, région, département, ville)
- Checkbox single-hit penalty (fixe +20)
- Tableau top 20 avec positions par provider et moyenne pondérée
- CTA vers Pro Agency pour accès complet

### Console > Indexation — `SerpBenchmark.tsx`
- Barre d'outils : champ URL → sélecteur Batch/Cible → bouton Analyser
- Panneau de sélection des providers (chips colorés, 4 providers)
- Formulaire : mot-clé, domaine cible, localisation (pays/région/département/ville), checkbox penalty
- Tableau de résultats avec favicon, positions par provider, et moyenne pondérée
- Code couleur : vert (≤3), bleu (≤10), orange (≤20), rouge (>20)
- Bouton Copy pour export clipboard
- Le domaine cible est mis en surbrillance dans le tableau
