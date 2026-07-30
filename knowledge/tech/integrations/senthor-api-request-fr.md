# Senthor — demande technique d'accès aux données (brouillon LinkedIn à envoyer)

Destinataire : Tristan (Senthor)
Canal : LinkedIn message

---

Salut Tristan,

Désolé pour le retard, je reviens vers toi à propos de ce projet d'intégration.

Chez Crawlers (crawlers.fr), on mesure le crawl des bots IA sur les sites de nos clients et on corrèle avec le trafic humain issu des IA génératives pour calculer un score de visibilité IA.

Aujourd'hui notre collecte passe par un Worker Cloudflare déployé chez le client. Ça marche bien, mais ça exclut tous les sites qui ne sont pas derrière Cloudflare : WordPress mutualisé, Vercel, Nginx/Caddy, Drupal. Exactement les périmètres que tes connecteurs couvrent proprement.

On n'est pas concurrents : toi tu détectes / contrôles au niveau serveur, nous on exploite le signal en aval (attribution, priorisation éditoriale, reco SEO/GEO). L'idée : Senthor collecte, Crawlers analyse.

## Ce qu'on cherche

Un accès en lecture aux événements de détection pour les domaines dont le client nous donne l'autorisation. Deux options possibles, l'une ou l'autre nous va :

**Option A — Webhook sortant (préféré)**
Tu pousses les events en JSON/NDJSON par lots vers une URL qu'on fournit, avec signature HMAC-SHA256.

**Option B — API pull paginée**
`GET /v1/events?domain=...&since=<ISO8601>&cursor=...&limit=500`
réponse : `{ events: [...], next_cursor: string|null }`. On interrogerait toutes les 5–15 min.

## Schéma d'évent dont on a besoin

```json
{
  "id": "evt_...",
  "domain": "example.com",
  "ts": "2026-07-30T10:42:11.000Z",
  "method": "GET",
  "path": "/blog/mon-article",
  "url": "https://example.com/blog/mon-article",
  "status": 200,
  "user_agent": "Mozilla/5.0 ... GPTBot/1.1",
  "ip_hash": "sha256:...",
  "country": "FR",
  "referer": "https://chatgpt.com/",
  "is_bot": true,
  "bot_name": "GPTBot",
  "bot_category": "ai_crawler",
  "verification_status": "verified",
  "verification_method": "rdns+asn",
  "confidence": 0.98,
  "decision": "allow"
}
```

Les champs qui comptent vraiment pour nous :
- **`referer`** → distingue attribution déterministe (chatgpt.com, perplexity.ai…) de corrélation temporelle.
- **`ip_hash`** → pas besoin de l'IP en clair, un SHA-256 suffit pour rapprocher bot ↔ humain (RGPD-friendly).
- **`verification_status` / `confidence`** → est-ce que tu arrives à distinguer un vrai GPTBot d'un scraper qui usurpe l'UA ?
- **trafic humain** — même échantillonné à 1/1000 — nécessaire pour faire la corrélation.
- **`decision`** (allow / block / challenge / paywall) → utile pour expliquer au client pourquoi une page n'a pas été indexée.

## Questions rapides

- Tu as déjà une API ou un webhook caché dans la doc ?
- Quelle rétention sur les events (7j, 30j, illimité) ?
- Le consentement se gère comment : dashboard client ou échange de clés API ?
- Plafond de volume ou tarif à l'évent ?

## Ce qu'on propose

- **Prescription** : on recommande Senthor comme voie d'ingestion par défaut aux sites Crawlers hors Cloudflare, directement dans notre assistant d'activation. On fonctionne déjà comme ça avec nos partenaires netlinking, avec rémunération à l'apport.
- **Co-marketing** : notre audience SEO/GEO est exactement ta cible.
- **Retour terrain** : on voit les patterns de crawl IA sur un large parc de sites, on peut te remonter les bots émergents que tes signatures ne couvrent pas encore.

Dis-moi si tu veux qu'on fasse un call de 20 min pour caler le format exact.

À plus,
Adrien

---

## Notes internes (ne pas envoyer)

- Cible d'ingestion côté Crawlers : table `bot_hits` (colonnes déjà alignées sur le schéma
demandé ci-dessus : `hit_at`, `path`, `user_agent`, `bot_family`, `bot_name`, `is_ai_bot`,
`is_human_sample`, `status_code`, `country`, `ip_hash`, `referer`, `verification_status`,
`verification_method`, `confidence_score`).
- Le schéma demandé est volontairement calqué sur la sortie de `ingest-bot-hits` pour qu'un
  futur `ingest-senthor` soit un simple mapping, sans migration.
- Si Senthor ne fournit ni webhook ni API, repli : leur proposer que leurs connecteurs
  poussent en double vers notre endpoint public `ingest-bot-hits` avec le secret par site.
