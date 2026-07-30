# Senthor — demande technique d'accès aux données (brouillon à envoyer)

Destinataire : contact@senthor.io
Objet : Crawlers x Senthor — accès programmatique aux événements de détection (partenariat d'ingestion)

---

Bonjour,

Je suis Adrien de Volontat, fondateur de Crawlers (https://crawlers.fr), une plateforme française
d'analyse SEO / GEO. Nous mesurons le crawl des bots IA (GPTBot, ClaudeBot, PerplexityBot, etc.)
sur les sites de nos clients, et nous corrélons ces passages avec le trafic humain provenant des
moteurs génératifs pour produire une attribution de visibilité IA.

Aujourd'hui notre collecte repose sur un Worker Cloudflare que nous déployons chez le client.
Cela exclut de fait tous les sites qui ne sont pas derrière Cloudflare — WordPress mutualisé,
Vercel, Nginx/Caddy auto-hébergé, Drupal. C'est exactement le périmètre que vos connecteurs
couvrent déjà, et proprement.

Nous ne sommes pas concurrents : vous détectez et contrôlez au niveau serveur, nous exploitons
le signal en aval (attribution, priorisation éditoriale, recommandations SEO/GEO). L'intégration
naturelle est donc : Senthor collecte, Crawlers analyse.

## Ce que nous cherchons

Un accès programmatique en lecture aux événements de détection, pour les domaines dont le
client Senthor nous donne explicitement l'autorisation. Deux formes possibles, l'une ou l'autre
nous convient :

**Option A — Webhook sortant (préféré)**
Vous poussez les événements vers une URL que nous fournissons, en JSON ou NDJSON, par lots.
Signature HMAC-SHA256 du corps dans un header, secret partagé par domaine.

**Option B — API pull paginée**
`GET /v1/events?domain=...&since=<ISO8601>&cursor=...&limit=500`
avec `Authorization: Bearer <api_key>`, réponse `{ events: [...], next_cursor: string|null }`.
Nous interrogerions toutes les 5 à 15 minutes.

## Schéma d'événement dont nous avons besoin

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

Précisions sur les champs qui comptent le plus pour nous :

1. **`referer`** — c'est le champ décisif. Il nous permet de distinguer une attribution
   déterministe (l'humain arrive depuis chatgpt.com / perplexity.ai) d'une simple corrélation
   temporelle. Sans lui, notre attribution reste probabiliste.
2. **`ip_hash`** — nous n'avons pas besoin de l'IP en clair. Un SHA-256 nous suffit pour
   rapprocher un passage bot et une visite humaine. C'est aussi ce que nous stockons de notre
   côté, pour des raisons RGPD.
3. **`verification_status` / `confidence`** — savez-vous distinguer un vrai GPTBot (vérifié par
   rDNS + plage ASN OpenAI) d'un scraper qui usurpe l'User-Agent ? Si oui, exposer ce verdict
   nous évite de le recalculer et améliore nettement la qualité de nos rapports.
4. **Trafic humain** — remontez-vous aussi les requêtes non-bot, même échantillonnées ?
   C'est nécessaire pour la corrélation bot -> humain. Un échantillonnage à 1/1000 suffit.
5. **`decision`** — allow / block / challenge / paywall : utile pour expliquer au client
   pourquoi un bot n'a pas indexé une page.

## Questions ouvertes

- Existe-t-il déjà une API publique ou un webhook, même non documenté ?
- Quelle granularité de rétention proposez-vous (7 j, 30 j, illimité) ?
- Comment gérez-vous le consentement : est-ce le client Senthor qui autorise un tiers depuis
  son dashboard, ou par échange de clés d'API ?
- Y a-t-il un plafond de volume ou une tarification à l'événement ?

## Ce que nous proposons en retour

- **Prescription** : recommander Senthor comme voie d'ingestion par défaut aux sites de nos
  clients qui ne sont pas sur Cloudflare, directement dans notre assistant d'activation.
  Nous fonctionnons déjà ainsi avec nos partenaires netlinking, avec apport d'affaires rémunéré.
- **Co-marketing** : nos contenus SEO/GEO sont référencés sur les requêtes de ce marché,
  et notre audience est exactement votre cible.
- **Retour terrain** : nous voyons les patterns de crawl IA sur un large parc de sites et
  pouvons vous remonter les bots émergents que vos signatures ne couvrent pas encore.

Je suis disponible pour un échange technique de 30 minutes quand vous voulez.

Bien à vous,
Adrien de Volontat
Crawlers — https://crawlers.fr

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
