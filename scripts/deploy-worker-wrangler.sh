#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Déploiement local du Worker via Wrangler
#
# Prérequis : CF_API_TOKEN (+ CF_ACCOUNT_ID) exportés,
#             ou `npx wrangler login` déjà effectué.
#
# Usage :
#   ./scripts/deploy-worker-wrangler.sh          # deploy one-shot
#   ./scripts/deploy-worker-wrangler.sh --watch  # redeploy à chaque save
# ─────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--watch" ]]; then
  echo "→ Mode watch : redéploiement à chaque modification de public/cloudflare-worker-logger.js"
  # Nécessite `entr` (brew install entr / apt install entr)
  if ! command -v entr >/dev/null 2>&1; then
    echo "❌ Installe 'entr' pour le mode watch (brew install entr)" >&2
    exit 1
  fi
  echo public/cloudflare-worker-logger.js wrangler.toml | tr ' ' '\n' \
    | entr -r npx wrangler deploy
else
  npx wrangler deploy
fi
