# Bot IA ↔ Humain : modèle d'attribution Crawlers.fr

> Sprint 2 GEO — Documentation technique & SAV
> Dernière mise à jour : 2026-04-17

## 1. Pourquoi ce modèle existe

Quand un internaute lit une réponse de **ChatGPT, Claude, Perplexity, Gemini, Copilot…** et qu'il
clique sur un lien vers votre site, le navigateur transmet en général un `Referer` du type
`https://chat.openai.com/...`. Le moteur IA, lui, est passé chez vous _avant_ — souvent plusieurs
jours plus tôt — sous l'identité d'un bot (`GPTBot`, `ClaudeBot`, `PerplexityBot`, etc.).

L'objectif du modèle est de **relier la visite humaine au crawl bot d'origine** afin de mesurer
le ROI réel de votre stratégie GEO :

> « Cette visite humaine vient de ChatGPT. ChatGPT a crawlé cette URL il y a 11 jours via GPTBot.
> Donc cette URL a généré 1 visite humaine attribuée à GPTBot. »

## 2. Décisions structurelles

| Paramètre              | Valeur                                   | Pourquoi                                                   |
|------------------------|-------------------------------------------|------------------------------------------------------------|
| Fenêtre d'attribution  | **30 jours strict**                       | Au-delà, les crawls ne sont plus représentatifs            |
| Modèle d'attribution   | **Multi-touch pondéré (décroissance exp.)** | Reflète la persistance temporelle du signal               |
| Fonction de poids      | `w(d) = exp(-d / 15)` où `d` = jours      | Demi-vie ≈ 10,4 jours                                      |
| Identifiant session    | **SHA-256(UA + IP)**                       | Anonymisation RGPD-compliant                              |
| Cron de corrélation    | Toutes les **6 heures**                   | Bon compromis fraîcheur / coût compute                    |

## 3. Sources de référer reconnues

Les domaines suivants sont mappés sur une `ai_source` :

```
chat.openai.com       → chatgpt
chatgpt.com           → chatgpt
claude.ai             → claude
perplexity.ai         → perplexity
gemini.google.com     → gemini
copilot.microsoft.com → copilot
you.com               → you
bing.com/chat         → bing_chat
```

Tout autre referer non-IA est ignoré.

## 4. Pipeline technique

```
Visiteur humain
   │  (Referer: chatgpt.com)
   ▼
Cloudflare Worker (cf_shield_configs)
   │  insère row dans bot_hits avec is_ai_bot=false, is_human_sample=true
   ▼
Cron `correlate-bot-to-human-6h` (pg_cron + pg_net)
   │  appelle l'edge function `correlate-bot-to-human`
   ▼
Edge function `correlate-bot-to-human`
   │  Pour chaque visite humaine avec referer IA des 30j :
   │    1. fingerprint = sha256(UA + IP_hash)
   │    2. cherche bot_hits matching (même URL, même tracked_site, < 30j)
   │    3. calcule poids exponentiel par hit
   │    4. insère row dans `ai_attribution_events`
   ▼
Vues d'agrégation
   - v_ai_attribution_by_url     (RLS security_invoker)
   - v_ai_attribution_by_source  (RLS security_invoker)
   ▼
Edge function `geo-attribution-summary`
   │  Renvoie résumé 30j (total, by_source, top_urls, timeline)
   ▼
UI Console > GEO > AIAttributionCard
```

## 5. Schéma `ai_attribution_events`

| Colonne                  | Type        | Sens                                                    |
|--------------------------|-------------|---------------------------------------------------------|
| `tracked_site_id`        | uuid        | FK vers `tracked_sites`                                 |
| `ai_source`              | text        | chatgpt / claude / perplexity / …                       |
| `url`, `path`            | text        | Page humaine visitée                                    |
| `visited_at`             | timestamptz | Horodatage visite humaine                               |
| `session_fingerprint`    | text        | SHA-256(UA + IP)                                        |
| `attributed_count`       | int         | 1 par défaut                                            |
| `attributed_bot_hits`    | jsonb       | `[{bot_hit_id, bot_name, days_before, weight}, …]`      |
| `top_attributed_bot`     | text        | Bot avec le plus gros poids                             |
| `total_weight`           | numeric     | Somme des poids (utile pour pondérer la conversion)     |
| `attribution_window_days`| int         | 30 (constant pour Sprint 2)                             |
| `attribution_model`      | text        | `multi_touch_weighted_v1`                               |
| `referer_full`           | text        | Referer complet (pour debug)                            |
| `country`                | text        | ISO-2 si dispo                                          |

## 6. Limites connues

- **Pas de referer** : Safari ITP, applis natives ChatGPT mobile, Brave strict mode peuvent
  supprimer le referer. Ces visites ne sont **pas** attribuables (faux négatif assumé).
- **Crawl ⟂ Visite** : si un humain découvre la page hors moteur IA mais via referer IA partagé
  (ex: lien Slack/Discord copié depuis ChatGPT), l'attribution sera positive — c'est conforme à
  l'intention « le contenu IA a déclenché la visite ».
- **Ré-attribution** : une même session humaine peut être attribuée plusieurs fois si elle
  revient sur d'autres URLs. Le `session_fingerprint` permet de dédupliquer côté reporting si
  besoin.

## 7. Réponses SAV (FAQ Félix)

**Q. Pourquoi mes attributions sont à zéro alors que mon site est crawlé par GPTBot ?**
R. Vous avez du crawl bot, mais aucun humain n'est encore venu **avec un referer ChatGPT**. Le
modèle ne devine pas — il corrèle. Patientez quelques jours après la première citation effective
dans une réponse IA.

**Q. Pourquoi 30 jours et pas 90 ?**
R. Au-delà de 30 jours, le contenu en cache des LLMs est souvent rafraîchi et le lien causal
devient trop ténu. 30 jours est aussi le standard publicitaire (Google Ads, Meta).

**Q. Le `top_attributed_bot` est différent de `ai_source`. Bug ?**
R. Non. `ai_source` = moteur IA d'où vient le visiteur humain (referer). `top_attributed_bot` =
crawler qui a le plus contribué (poids maximal). Les deux peuvent diverger — par exemple un
visiteur Perplexity peut être attribué à `GPTBot` si GPTBot a crawlé la page très récemment et
PerplexityBot pas du tout.

**Q. Mes IPs sont-elles stockées en clair ?**
R. Non. Seul un hash SHA-256 (`ip_hash`) est conservé, et le fingerprint final combine UA + IP
hashée. Aucune réversibilité possible.
