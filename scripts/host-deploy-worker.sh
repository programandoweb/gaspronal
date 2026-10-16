#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=/var/www/gaspronal.programandoweb.net
REQUEST="$ROOT/backend/bootstrap/cache/host-deployment-request"
LOCK=/tmp/gaspronal-deployment-dispatch.lock
LOG_DIR="$ROOT/backend/storage/logs"
mkdir -p "$LOG_DIR"
exec 9>"$LOCK"
flock -n 9 || exit 0
[[ -s "$REQUEST" ]] || exit 0
ID="$(head -n 1 "$REQUEST" | tr -cd '0-9')"
rm -f "$REQUEST"
[[ "$ID" =~ ^[0-9]+$ ]] || exit 1
cd "$ROOT"
compose() { docker compose --env-file .env.docker "$@"; }
report() {
  compose exec -T backend php artisan deployment:host-status "$ID" "$1" "${@:2}" 2>/dev/null || true
}
report running
LOG="$LOG_DIR/deployment-host-$ID.log"
set +e
(
  cd /var/www/gaspronal.programandoweb.net &&
  git pull origin main &&
  sudo bash scripts/deploy.sh
) > "$LOG" 2>&1
RESULT=$?
set -e
if grep -q 'Cancelación solicitada' "$LOG" || [[ "$RESULT" -eq 130 ]]; then
  STATUS=cancelled
elif [[ "$RESULT" -eq 0 ]]; then
  STATUS=succeeded
else
  STATUS=failed
fi
# backend can briefly restart during deployment, so retry until healthy.
for attempt in $(seq 1 25); do
  if compose exec -T backend php artisan deployment:host-status "$ID" "$STATUS" --output-file="/var/www/html/storage/logs/deployment-host-$ID.log" >/dev/null 2>&1; then
    break
  fi
  sleep 3
done
exit "$RESULT"
