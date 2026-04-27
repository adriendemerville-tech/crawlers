# IKtracker Slug Memory — Anti-bouclage des publications

**Module** : `supabase/functions/_shared/iktracker/slugMemory.ts`
**Table** : `public.iktracker_slug_memory`
**Branchement** : `supabase/functions/iktracker-actions/index.ts` (action `create-post`)
**UI admin** : `src/components/Admin/ParmenionSlugMemory.tsx` (onglet *Mémoire slugs* du `ParmenionDashboard`)

## Objectif

Empêcher l'agent éditorial (Parménion) de republier en boucle des articles que l'admin IKtracker a déjà rejetés (blacklist) ou ignorés (skip), tout en autorisant :
- Les **mises à jour légitimes** d'un article publié (routing automatique POST → PUT)
- Les **variantes annuelles** de contenu (`bareme-2026` vs `bareme-2027` ne se bloquent pas)

Architecture conçue pour corriger les défauts du prompt initial : Levenshtein restreint au **root sans année**, **pas d'auto-blacklist** des variantes temporelles, module placé dans `_shared/` (pas `src/lib/`), `iktracker_post_id` stocké pour permettre le PUT.

## Schéma de la table

```sql
CREATE TABLE public.iktracker_slug_memory (
  slug              TEXT NOT NULL,
  domain            TEXT NOT NULL DEFAULT 'iktracker.fr',
  tracked_site_id   UUID NULL REFERENCES tracked_sites(id) ON DELETE SET NULL,
  status            TEXT NOT NULL CHECK (status IN
                      ('published','blacklisted','skipped','duplicate','error')),
  reason            TEXT NULL,
  hash_content      TEXT NULL,         -- SHA-256 du payload {title, content, excerpt}
  iktracker_post_id TEXT NULL,         -- ID renvoyé par l'API IKtracker (permet PUT)
  attempts_count    INTEGER NOT NULL DEFAULT 1,
  last_response     JSONB NULL,        -- dernier body API pour debug
  blocked_until     TIMESTAMPTZ NULL,  -- cooldown explicite (skipped = 7j)
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, domain)
);
```

**Index** : `(status, last_seen_at DESC)` et `(domain, last_seen_at DESC)`.
**Trigger** : `update_slug_memory_seen` met à jour `last_seen_at` à chaque UPDATE.

### Sémantique des statuts

| Statut | Signification | Effet sur `isBlocked` |
|---|---|---|
| `published` | Article publié avec succès (HTTP 201 ou `_upserted: true`) | Non bloquant — bascule PUT si hash différent |
| `blacklisted` | Rejet définitif admin (HTTP 409 + `error` contenant "blacklist") | **Bloque définitivement** + variantes Levenshtein ≤ 2 |
| `skipped` | Ignoré temporairement (`_skipped: true`) | Bloque pendant 7 jours (cooldown) |
| `duplicate` | Garde éditorial / topic saturation (HTTP 403/409) | Non bloquant (la dedup multi-couches existante prend le relais) |
| `error` | 5xx ou imprévu | Non bloquant (fail-safe) |

## Règles RLS

```sql
ALTER TABLE iktracker_slug_memory ENABLE ROW LEVEL SECURITY;
```

- **SELECT** : admins uniquement (`has_role(auth.uid(), 'admin')`)
- **DELETE** : admins uniquement (purge manuelle depuis l'UI)
- **INSERT / UPDATE** : aucune policy `authenticated` → **service-role exclusif**

Conséquence : l'agent ne peut pas contourner la mémoire depuis le client. Toutes les écritures passent par `slugMemory.recordResult()` exécuté côté edge function avec le client service-role singleton (`getServiceClient()`).

## API du module (`slugMemory.ts`)

### `isBlocked(slug, domain = 'iktracker.fr'): Promise<BlockedResult>`

Pré-check à appeler **avant** tout POST `/posts`. Bloque dans 4 cas :

1. Slug exact en `blacklisted`
2. Slug exact en `skipped` ET `last_seen_at + 7j > now()`
3. Slug exact avec `blocked_until > now()`
4. **Variante** d'un slug blacklisté détectée par Levenshtein ≤ 2 sur le root normalisé

Retour : `{ blocked, reason, status, matched_slug?, blocked_until? }`. Fail-open en cas d'erreur SQL (mieux vaut tenter que bloquer silencieusement).

### `shouldUsePut(slug, newHash, domain): Promise<{ postId, previousHash } | null>`

Routing automatique POST → PUT. Renvoie le `iktracker_post_id` si :
- Le slug est en `published` ET
- `hash_content` stocké ≠ nouveau hash (contenu réellement modifié)

Sinon `null` (pas de bascule).

### `hashContent(payload): Promise<string>`

SHA-256 hex de `{title, content, excerpt}` sérialisé de façon stable. Utilisé pour détecter qu'un PUT est légitime (changement réel) et pour stocker le hash après publication.

### `recordResult({ slug, domain, trackedSiteId, httpStatus, responseBody, contentHash })`

À appeler **après chaque** appel API. Mapping HTTP → statut :

| HTTP | Body | Statut persisté |
|---|---|---|
| 201 | — | `published` (+ hash + `iktracker_post_id`) |
| 200 | `_upserted: true` | `published` |
| 200 | `_skipped: true` | `skipped` (+ `blocked_until = now+7j`) |
| 403 | `_editorial_guard: true` | `duplicate` |
| 409 | `error` contient "blacklist" | `blacklisted` |
| 409 | autre | `duplicate` |
| 5xx | — | `error` (non bloquant) |

`attempts_count` est incrémenté à chaque appel (lecture-écriture, pas de fonction SQL atomique car contention faible).

## Détection des variantes (anti-rephrase)

### `normalizeRoot(slug)`

Strippe accents, années (`\b(199\d|20\d{2})\b`) et caractères non-alphanumériques. Exemple :
```
"frais-reels-ou-forfait-independants-2026" → "frais reels ou forfait independants"
```

### `isTemporalSlug(slug)`

`true` si le slug contient un token année. Sert à neutraliser la détection de variantes pour le contenu annuel.

### Logique de blocage par variante

Pour chaque slug `blacklisted` en base :
1. Si l'un est temporel et pas l'autre → **on ne bloque pas** (intent différent)
2. Si les deux sont temporels mais années différentes → **on ne bloque pas** (`bareme-2026` ≠ `bareme-2027`)
3. Sinon, comparaison Levenshtein sur les roots → bloque si distance ≤ 2

Roots de moins de 5 caractères : ignorés (trop de faux positifs).

## Branchement dans `iktracker-actions`

Fonction `createPost(apiKey, body)` — séquence d'exécution :

1. **Pré-check `isBlocked`** → si bloqué, retourne `{ status: 409, _slug_memory_blocked: true, _matched_slug, _memory_status, _blocked_until }` sans appel API
2. **Routing PUT** : `hashContent(body)` puis `shouldUsePut(slug, hash)` → si match, `PUT /posts/:slug` + `recordResult` avec nouveau hash
3. **Dedup multi-couches existante** (jaccard, core_topic, synonym, slug similarity, topic saturation) — inchangée
4. **POST final** `/posts` → `recordResult` avec verdict + hash

Tous les appels au module sont en `try/catch` **fail-open** : si la table est down, la production de contenu n'est pas bloquée, mais aucun verdict n'est persisté pour cet appel.

## UI admin (`ParmenionSlugMemory.tsx`)

Onglet *Mémoire slugs* dans `ParmenionDashboard` (entre *Intégrations* et *Stats*). Accès admin uniquement.

- Lecture directe via RLS (pas d'edge function), tri `last_seen_at DESC`, limite 500
- Filtres : texte (slug / domaine / raison) + statut avec compteurs
- Colonnes : slug, domaine, badge statut, raison, tentatives, dernière activité
- Action **Purger** (DELETE direct via RLS admin) avec `AlertDialog` de confirmation → l'agent pourra retenter ce slug

## Cas d'usage typiques

| Scénario | Comportement |
|---|---|
| Agent tente de republier un slug déjà rejeté | Bloqué en 409 sans appel API IKtracker |
| Agent reformule le titre mais slug très proche d'un blacklisté | Bloqué (Levenshtein root ≤ 2) |
| Agent publie `bareme-kilometrique-2027` alors que `bareme-kilometrique-2026` est blacklisté | **Autorisé** (variante annuelle légitime) |
| Agent met à jour un article publié avec nouveau contenu | Bascule auto en PUT, hash mis à jour |
| Agent renvoie exactement le même contenu sur un slug publié | `shouldUsePut` retourne `null` → POST normal (et IKtracker répondra `_upserted: true` qui sera persisté) |
| Admin purge un slug depuis l'UI | Mémoire effacée, l'agent peut retenter au prochain cycle |

## Limites connues

- `attempts_count` n'est pas atomique (pas de race-condition critique vu la fréquence)
- `last_response` peut grossir → purge manuelle possible si volumétrie excessive
- Le module ne couvre que `create-post` — `update-page`, `update-post`, `create-page` n'utilisent pas la mémoire (ils visent un `page_key` ou `slug` connu, pas de risque de boucle)
- Domaine par défaut codé en dur sur `iktracker.fr` ; passer le paramètre `domain` explicitement si extension future à d'autres targets Parménion
