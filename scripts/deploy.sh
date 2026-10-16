#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/var/www/gaspronal.programandoweb.net"
COMPOSE_FILE="$ROOT/docker-compose.yml"
ENV_FILE="$ROOT/.env.docker"
LOCK_DIR="/tmp/gaspronal-deploy.lock"
CANCEL_MARKER="$ROOT/backend/bootstrap/cache/.deploy-cancel-request"
ACTIVE_MARKER="$ROOT/.deploy-active"

check_cancel() {
  if [[ -f "$CANCEL_MARKER" ]]; then
    echo "[deploy] Cancelación solicitada; deteniendo la secuencia antes del siguiente paso."
    exit 130
  fi
}

cleanup() {
  rm -f "$ACTIVE_MARKER"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[deploy] Ya existe otro despliegue en ejecución."
  exit 75
fi

printf "%s\n" "$" > "$ACTIVE_MARKER"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "[deploy] No existe un repositorio Git en $ROOT."
  exit 2
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[deploy] No existe $COMPOSE_FILE."
  exit 2
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy] Falta $ENV_FILE. Copia .env.docker.example y configura sus valores."
  exit 2
fi

if [[ ! -f "$ROOT/backend/.env" ]]; then
  echo "[deploy] Falta $ROOT/backend/.env."
  exit 2
fi

if ! grep -Eq '^AGENT_SHARED_SECRET=.+$' "$ENV_FILE"; then
  echo "[deploy] Generando secreto interno para agentes..."
  if command -v php >/dev/null 2>&1; then
    SECRET="$(php -r 'echo bin2hex(random_bytes(32));')"
  elif command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 32)"
  else
    echo "[deploy] No hay PHP ni OpenSSL para generar AGENT_SHARED_SECRET."
    exit 2
  fi

  if grep -q '^AGENT_SHARED_SECRET=' "$ENV_FILE"; then
    sed -i "s/^AGENT_SHARED_SECRET=.*/AGENT_SHARED_SECRET=$SECRET/" "$ENV_FILE"
  else
    printf '\nAGENT_SHARED_SECRET=%s\n' "$SECRET" >> "$ENV_FILE"
  fi
fi

compose() {
  check_cancel
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "[deploy] Inicio: $(date -Is)"

INIT_PRIVATE_REPO_MARKER="/tmp/gaspronal-init-private-repo"
if [[ -f "$INIT_PRIVATE_REPO_MARKER" ]]; then
  echo "[deploy] Inicializando repositorio privado..."
  rm -f "$INIT_PRIVATE_REPO_MARKER"
  curl -fsSL https://raw.githubusercontent.com/programandoweb/programandoweb/master/scripts/init-private-repo-v2.sh -o /tmp/init-private-repo-v2.sh
  bash /tmp/init-private-repo-v2.sh
fi

check_cancel
echo "[deploy] Actualizando rama main..."
git -c safe.directory="$ROOT" -C "$ROOT" fetch origin main
BEFORE="$(git -c safe.directory="$ROOT" -C "$ROOT" rev-parse HEAD)"
git -c safe.directory="$ROOT" -C "$ROOT" reset --hard origin/main
AFTER="$(git -c safe.directory="$ROOT" -C "$ROOT" rev-parse HEAD)"
echo "[deploy] Revisión: $BEFORE -> $AFTER"

check_cancel
echo "[backend] Construyendo imagen PHP..."
compose build --pull backend

echo "[backend] Publicando backend..."
compose up -d --no-deps backend

echo "[backend] Verificando contenedor..."
compose ps backend

echo "[backend] Instalando dependencias PHP..."
compose exec -T backend composer install \
  --no-dev \
  --prefer-dist \
  --no-interaction \
  --optimize-autoloader

echo "[backend] Ejecutando migraciones..."
compose exec -T backend php artisan migrate --force

echo "[backend] Ejecutando seeders pendientes..."
compose exec -T backend php artisan db:seed --force

echo "[backend] Refrescando cachés..."
compose exec -T backend php artisan optimize:clear
compose exec -T backend php artisan optimize

echo "[backend] Corrigiendo permisos persistentes..."
compose exec -T -u root backend sh -lc \
  'mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache public/images/uploads/agente-contenido && chown -R www-data:www-data storage bootstrap/cache public/images/uploads && chmod -R ug+rwX storage bootstrap/cache public/images/uploads'

echo "[scheduler] Publicando scheduler de agentes..."
compose up -d --no-deps scheduler

echo "[nginx] Validando y recargando configuración..."
compose exec -T backend-nginx nginx -t
compose exec -T backend-nginx nginx -s reload

echo "[realtime] Construyendo imagen NestJS..."
compose build --pull realtime

echo "[realtime] Publicando nueva imagen..."
compose up -d --no-deps realtime

echo "[frontend] Construyendo imagen Next.js..."
compose build --pull frontend

echo "[frontend] Publicando nueva imagen..."
compose up -d --no-deps frontend

echo "[health] Backend..."
compose exec -T backend-nginx wget -q -O - http://127.0.0.1/api/v1/health
echo

echo "[health] Realtime..."
compose exec -T realtime node -e "fetch('http://127.0.0.1:4100/health').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))"

echo "[health] Frontend..."
FRONTEND_HEALTH_OK=0
for attempt in $(seq 1 30); do
  if compose exec -T frontend wget -q -O /dev/null http://127.0.0.1:3000/; then
    FRONTEND_HEALTH_OK=1
    echo "[health] Frontend disponible (intento $attempt/30)."
    break
  fi

  echo "[health] Frontend aún iniciando (intento $attempt/30)..."
  sleep 2
done

if [[ "$FRONTEND_HEALTH_OK" -ne 1 ]]; then
  echo "[health] Frontend no respondió después de 60 segundos."
  compose ps frontend
  compose logs frontend --tail=100
  exit 1
fi

check_cancel
echo "[deploy] Estado de servicios:"
compose ps

echo "[deploy] Finalizado correctamente: $(date -Is)"
