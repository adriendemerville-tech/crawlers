# Benchmark SERP Multi-Providers — Documentation technique

## Objectif
Outil Pro Agency dans Console > Indexation permettant de comparer les positions SERP renvoyées par plusieurs providers pour un mot-clé donné.

## Providers supportés
1. **DataForSEO** — API `/v3/serp/google/organic/live/advanced`
2. **SerpApi** — API `serpapi.com/search.json`
3. **Serper.dev** — API `google.serper.dev/search`
4. **Bright Data** — API `api.brightdata.com/serp/req`

## Secrets nécessaires
- `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` (déjà configurés)
- `SERPAPI_KEY` (déjà configuré)
- `SERPER_API_KEY` (configuré)
- `BRIGHTDATA_API_KEY` (optionnel, à configurer si souhaité)

## Edge Function `serp-benchmark`

### Actions
| Action | Description | Paramètres |
|--------|-------------|------------|
| `benchmark` | Lance un benchmark multi-providers | `query`, `providers[]`, `location`, `target_domain`, `single_hit_penalty` |
| `list` | Liste les benchmarks précédents | `tracked_site_id?`, `limit?` |
| `get` | Récupère un benchmark par ID | `id` |

### Calcul de la position moyenne
1. Chaque provider retourne une liste de résultats organiques (URL + position)
2. Les URLs sont normalisées et dédupliquées
3. Pour chaque URL, on calcule la moyenne des positions sur les providers qui la trouvent
4. **Single-hit penalty** : si un site n'est trouvé que par 1 seul provider, on ajoute une pénalité (défaut: 20 pts) pour réduire les faux positifs / résultats anti-scraping
5. Le classement final est trié par position moyenne croissante

### Table `serp_benchmark_results`
- `providers_data` (JSONB) : données brutes par provider
- `averaged_results` (JSONB) : classement final avec positions croisées
- `single_hit_penalty` : pénalité appliquée
- RLS : chaque utilisateur ne voit que ses propres benchmarks

## UI — `SerpBenchmark.tsx`
- Intégré dans `IndexationMonitor.tsx` (Console > Indexation)
- Panneau de sélection des providers (chips colorés)
- Formulaire : mot-clé, domaine cible, localisation, single-hit penalty
- Tableau de résultats avec favicon, positions par provider, et moyenne pondérée
- Code couleur : vert (≤3), bleu (≤10), orange (≤20), rouge (>20)
- Bouton Copy pour export clipboard
- Le domaine cible est mis en surbrillance dans le tableau
