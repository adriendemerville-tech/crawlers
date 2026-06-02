#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Deploy Cloudflare Worker `crawlers-logger` via Cloudflare API
#
# Prérequis (variables d'environnement) :
#   CF_API_TOKEN       Token API Cloudflare avec permission
#                      "Account → Workers Scripts → Edit"
#   CF_ACCOUNT_ID      ID du compte Cloudflare
#   CF_WORKER_NAME     Nom du Worker (défaut: crawlers-logger)
#   CRAWLERS_SECRET    (optionnel) met à jour la var d'env du Worker
#
# Usage :
#   ./scripts/deploy-cf-worker.sh
#   ./scripts/deploy-cf-worker.sh public/cloudflare-worker-logger.js
# ──────────────────────────────────────────────────────────────
set -euo pipefail

WORKER_FILE="${1:-public/cloudflare-worker-logger.js}"
WORKER_NAME="${CF_WORKER_NAME:-crawlers-logger}"

: "${CF_API_TOKEN:?CF_API_TOKEN manquant}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID manquant}"

if [[ ! -f "$WORKER_FILE" ]]; then
  echo "❌ Fichier introuvable : $WORKER_FILE" >&2
  exit 1
fi

API="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${WORKER_NAME}"

echo "→ Upload $WORKER_FILE vers $WORKER_NAME…"

# Metadata : module ES6 (export default { fetch })
METADATA='{"main_module":"worker.js","compatibility_date":"2024-09-01"}'

RESPONSE=$(curl -sS -X PUT "$API" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -F "metadata=${METADATA};type=application/json" \
  -F "worker.js=@${WORKER_FILE};type=application/javascript+module")

SUCCESS=$(echo "$RESPONSE" | grep -o '"success":[a-z]*' | head -1 | cut -d: -f2)

if [[ "$SUCCESS" != "true" ]]; then
  echo "❌ Échec du déploiement :" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

echo "✓ Worker déployé"

# Mise à jour optionnelle du secret CRAWLERS_SECRET
if [[ -n "${CRAWLERS_SECRET:-}" ]]; then
  echo "→ Mise à jour du secret CRAWLERS_SECRET…"
  curl -sS -X PUT "${API}/secrets" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"name\":\"CRAWLERS_SECRET\",\"text\":\"${CRAWLERS_SECRET}\",\"type\":\"secret_text\"}" \
    > /dev/null
  echo "✓ Secret mis à jour"
fi

# Vérification post-deploy
echo "→ Vérification GPTBot sur https://crawlers.fr/guides…"
TITLE=$(curl -sS -A "Mozilla/5.0 (compatible; GPTBot/1.0)" https://crawlers.fr/guides \
  | grep -oE '<title>[^<]*</title>' | head -1 || true)
echo "  $TITLE"

echo "✅ Déploiement terminé"
