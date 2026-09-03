#!/bin/sh
# Starts every process this image runs, in one container. The api (gunicorn)
# is the primary process — started last via `exec`, in the foreground — so if
# it dies the whole container exits and `restart: unless-stopped` (compose)
# brings everything back up clean, same coarse-grained restart model as
# Transfer's own entrypoint.sh. `init: true` on the compose service (Docker's
# built-in tini) reaps zombies from the backgrounded processes below — no
# process supervisor needed beyond that.
set -e

echo "Running database migrations..."
(cd /workspace/apps/api && alembic upgrade head)

echo "Starting Caddy..."
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &

echo "Starting web (Next.js)..."
# 0.0.0.0, not 127.0.0.1: Next.js standalone's own redirect/absolute-URL
# construction (e.g. the /login middleware redirect) keys off this bind
# address in a way that produces a bogus http://127.0.0.1:3000/... Location
# header on a loopback bind — 0.0.0.0 is what produces a correct relative
# redirect. Harmless either way from a security standpoint: port 3000 is
# never published (see docker-compose.prod.yml), only Caddy in this same
# container/namespace can ever reach it.
HOSTNAME=0.0.0.0 PORT=3000 node /app/web/server.js &

echo "Starting Celery beat..."
celery -A apps.api.tasks.celery_app beat --loglevel=warning -s /tmp/celerybeat-schedule &

echo "Starting Celery worker (transcoding)..."
celery -A apps.api.tasks.celery_app worker -Q transcoding -c "${TRANSCODING_CONCURRENCY:-1}" --loglevel=warning &

echo "Starting Celery worker (email)..."
celery -A apps.api.tasks.celery_app worker -Q email_high,email_low -c "${EMAIL_CONCURRENCY:-2}" --loglevel=warning &

echo "Starting Celery worker (maintenance)..."
celery -A apps.api.tasks.celery_app worker -Q maintenance -c "${MAINTENANCE_CONCURRENCY:-1}" --loglevel=warning &

echo "Starting API (gunicorn)..."
cd /workspace
exec gunicorn apps.api.main:app \
    -w "${API_WORKERS:-4}" \
    -k uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --graceful-timeout 30
