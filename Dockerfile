# ============================================================
# Review — Production image
# ============================================================
# One image, one container: internal Caddy (path router) + Next.js (web) +
# FastAPI (api, via gunicorn) + Celery (worker/email_worker/
# maintenance_worker/beat) — see docker/entrypoint.sh for how they're
# supervised together, and docs/deployment.md for the full picture.
#
# Built and pushed to GHCR by .github/workflows/docker-build-push.yml.
# docker-compose.prod.yml only ever pulls this image — never `build:` it on
# the host you deploy to (see that file's own header comment).
# ============================================================

# ─── Stage: web dependencies ───────────────────────────────────────────────
FROM node:20-alpine AS web-deps
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /web
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─── Stage: web build ──────────────────────────────────────────────────────
FROM node:20-alpine AS web-builder
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /web
COPY --from=web-deps /web/node_modules ./node_modules
COPY apps/web .

# /api is always right — Caddy (baked into this same image, see below)
# always fronts web+api together. NEXT_PUBLIC_* is baked in at build time,
# same as ever with Next.js — changing the upload concurrency needs a
# rebuild, not a redeploy.
ENV NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_UPLOAD_CONCURRENCY=5
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ─── Stage: Caddy binary ────────────────────────────────────────────────────
# Only the binary is used from this stage — no version pinning to maintain
# by hand here, it always tracks whatever caddy:2-alpine resolves to.
FROM caddy:2-alpine AS caddy-bin

# ─── Stage: final runner ────────────────────────────────────────────────────
FROM python:3.11-slim AS runner
WORKDIR /workspace

# Debian/glibc base (not Alpine/musl) — psycopg2/cryptography and the
# transcoder's deps have mature manylinux wheels but historically flaky
# musl ones. This is also why Node is installed via apt below instead of
# switching the whole image to a node:*-alpine base.
ARG ENABLE_HWACCEL=false
RUN if [ "$ENABLE_HWACCEL" = "true" ]; then \
        sed -i 's/main$/main contrib non-free non-free-firmware/g' /etc/apt/sources.list 2>/dev/null || true; \
        sed -i 's/Components: main/Components: main contrib non-free non-free-firmware/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
        apt-get update && apt-get install -y --no-install-recommends \
            intel-media-va-driver-non-free libva-drm2 libva2 vainfo libmfx-gen1.2 \
        && rm -rf /var/lib/apt/lists/* ; \
    fi

# ffmpeg/imagemagick: transcoding pipeline. curl: healthcheck. gnupg: needed
# by the NodeSource bootstrap script just below.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg imagemagick curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY --from=caddy-bin /usr/bin/caddy /usr/local/bin/caddy

# ─── API + Celery (Python) ─────────────────────────────────────────────────
COPY apps/api/requirements.txt /workspace/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /workspace/apps/api/requirements.txt \
    && pip install --no-cache-dir gunicorn

COPY packages/transcoder /workspace/packages/transcoder
COPY apps/api /workspace/apps/api

# ─── Web (Next.js standalone) ──────────────────────────────────────────────
COPY --from=web-builder /web/public /app/web/public
COPY --from=web-builder /web/.next/standalone /app/web
COPY --from=web-builder /web/.next/static /app/web/.next/static

# ─── Internal router + process supervisor ──────────────────────────────────
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN adduser --disabled-password --gecos "" --no-create-home appuser
# No real $HOME (--no-create-home above) — Caddy's config autosave and
# gunicorn's arbiter control socket both fall back to paths under $HOME
# when unset, and /home/appuser doesn't exist. Point HOME at /tmp (always
# writable) instead of chasing each tool's own XDG override individually.
ENV HOME=/tmp
ENV PYTHONUNBUFFERED=1

USER appuser

# Caddy listens on 8080, not 80 — a non-root process can't bind a
# privileged port, and this container never runs as root at runtime.
EXPOSE 8080

# Checks the primary process (gunicorn/api) directly, not through Caddy —
# see entrypoint.sh for why api is "primary".
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
