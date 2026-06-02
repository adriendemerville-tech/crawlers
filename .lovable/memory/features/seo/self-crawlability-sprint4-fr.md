---
name: Sprint 4 Self-Crawlability
description: Cloudflare Worker route bots IA (GPTBot/ClaudeBot/Perplexity/CCBot/Applebot-Extended) vers edge function render-page (cache 24h), Googlebot/humains gardent la SPA → pas de cloaking
type: feature
---

**Worker** `public/cloudflare-worker-logger.js` détecte UA via `AI_BOT_UA_REGEX`, si GET + route prerenderable (exclut /app/* sauf /app/eeat, assets, binaires) → fetch `render-page?route=…` avec `cf: { cacheTtl: 86400 }`, renvoie HTML enrichi avec header `X-Prerender-Bot: 1`. Fallback SPA si render-page KO.

**Routes couvertes** : voir `PUBLIC_ROUTES` dans `supabase/functions/render-page/index.ts` (30+ routes). Ajouter chaque nouvelle route publique au catalogue sinon fallback générique.

**Validation** : `curl -A "Mozilla/5.0 (compatible; GPTBot/1.0)" https://crawlers.fr/<route>` → HTML avec `<title>`/`<h1>`/JSON-LD distincts par page. Baseline 2026-06-02 : 623 mots identiques sur 10 URLs (catastrophique).

**Cible métriques** : word_count_no_js ≥500/page distincts, h1 unique ≥95%, bot_hits GPTBot/ClaudeBot +30% sur 30j.

**Doc complète** : `docs/sprint-4-self-crawlability.md`.
