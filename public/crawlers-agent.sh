#!/bin/bash
# ═══════════════════════════════════════════════════════════
# crawlers.fr — Log Agent
# Streame les access logs serveur vers le dashboard crawlers.fr
#
# Usage:
#   ./crawlers-agent.sh --key=VOTRE_CLE_API --log=/var/log/nginx/access.log
#
# Installation:
#   1. chmod +x crawlers-agent.sh
#   2. cp crawlers-agent.sh /usr/local/bin/
#   3. cp crawlers-agent.service /etc/systemd/system/
#   4. Éditez le fichier .service avec votre clé API et chemin de log
#   5. systemctl enable --now crawlers-agent
# ═══════════════════════════════════════════════════════════

set -euo pipefail

API_KEY=""
LOG_FILE="/var/log/nginx/access.log"
# Configure your Crawlers API endpoint (or use default)
ENDPOINT="${CRAWLERS_ENDPOINT:-https://api.crawlers.fr/functions/v1/ingest-agent}"
BATCH_SIZE=50
FLUSH_INTERVAL=10

# Parse arguments
for arg in "$@"; do
  case $arg in
    --key=*) API_KEY="${arg#*=}" ;;
    --log=*) LOG_FILE="${arg#*=}" ;;
    --endpoint=*) ENDPOINT="${arg#*=}" ;;
    --batch=*) BATCH_SIZE="${arg#*=}" ;;
    --interval=*) FLUSH_INTERVAL="${arg#*=}" ;;
    --help)
      echo "Usage: $0 --key=API_KEY [--log=LOG_PATH] [--endpoint=URL] [--batch=50] [--interval=10]"
      exit 0
      ;;
  esac
done

if [ -z "$API_KEY" ]; then
  echo "❌ Erreur: --key=API_KEY est requis"
  echo "   Récupérez votre clé sur crawlers.fr > Console > Bot Logs > Connecteurs"
  exit 1
fi

if [ ! -f "$LOG_FILE" ]; then
  echo "❌ Erreur: Fichier de log introuvable: $LOG_FILE"
  exit 1
fi

echo "🚀 crawlers.fr agent démarré"
echo "   Log: $LOG_FILE"
echo "   Batch: $BATCH_SIZE lignes ou toutes les ${FLUSH_INTERVAL}s"
echo "   Endpoint: $ENDPOINT"

BUFFER=()
LAST_SEND=$(date +%s)

send_buffer() {
  if [ ${#BUFFER[@]} -eq 0 ]; then
    return
  fi

  local payload
  payload=$(printf '%s\n' "${BUFFER[@]}" | jq -R . | jq -sc '{"lines": .}')

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    --max-time 30)

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✅ $(date '+%H:%M:%S') — ${#BUFFER[@]} lignes envoyées"
  else
    echo "⚠️  $(date '+%H:%M:%S') — Erreur HTTP $http_code (${#BUFFER[@]} lignes)"
  fi
}

# Trap for clean exit
cleanup() {
  echo "🛑 Arrêt — envoi du buffer restant..."
  send_buffer
  exit 0
}
trap cleanup SIGTERM SIGINT

# Main loop: tail the log file and buffer lines
tail -F "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
  BUFFER+=("$line")
  NOW=$(date +%s)

  if [ ${#BUFFER[@]} -ge "$BATCH_SIZE" ] || [ $((NOW - LAST_SEND)) -ge "$FLUSH_INTERVAL" ]; then
    send_buffer
    BUFFER=()
    LAST_SEND=$NOW
  fi
done
