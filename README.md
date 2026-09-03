# Review

*[Lire en français](README.fr.md)*

**Self-hosted media review — frame-accurate feedback, real-time collaboration, and a client-facing review experience that never leaves your own infrastructure.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](docker-compose.yml)
[![Latest release](https://img.shields.io/github/v/release/Djoko-cli/review-majid-film)](https://github.com/Djoko-cli/review-majid-film/releases)

Review gives production houses and creative teams a self-hosted platform for reviewing video, image, and audio assets with frame-accurate commenting, annotations, and approval workflows. Your media stays on your infrastructure — Postgres, Redis, and S3-compatible storage all run wherever you deploy this.

Review is a fork of [freeframe](https://github.com/Techiebutler/freeframe) (MIT), rebranded and redesigned as part of the "M family" of self-hosted tools alongside [Transfer](https://github.com/Djoko-cli/transfer-majid-film): same liquid-glass visual language, same self-hosting philosophy. See [`CHANGELOG.md`](CHANGELOG.md) for what changed since the fork.

---

## Features

- **Video review** with HLS adaptive streaming and frame-accurate timecoded comments
- **Export comments to your NLE** — DaVinci Resolve (marker EDL), Final Cut Pro (FCPXML), Premiere Pro (XML), or CSV
- **Image and audio review** with annotations and waveform visualization
- **Drawing annotations** on any frame using canvas tools
- **Threaded comments** with mentions, reactions, and attachments
- **Approval workflows** with per-reviewer status tracking
- **Version compare** — put any two versions side-by-side or under a wipe slider, with per-version comments and annotations
- **Folder organization** within projects, with per-project roles (owner/editor/reviewer/viewer)
- **Share links** for external reviewers (password-protected, expiring, with per-link light/dark appearance)
- **Guest commenting** via share links (no account required)
- **Due date tracking** with email reminders
- **Real-time updates** via Server-Sent Events
- **Password and OIDC authentication** — sign in with a real password, or against any standards-compliant OpenID Connect provider (built for a self-hosted [Pocket ID](https://github.com/pocket-id/pocket-id) instance, but provider-agnostic)
- **French and English**, throughout the app, the public share pages, and every transactional email
- **A database-backed admin console** (Settings → Admin → Config) for instance settings — auth, OIDC, email, upload limits, transcoder tuning — editable live, no `.env` editing or container restart required
- **White-label logo** — your own mark on the sidebar, sign-in screen, favicon, and share links; the "Powered by FreeFrame" badge can be switched off
- **Self-hosted** with Docker Compose — runs on any server, cloud VM, or NAS

### Frame-accurate review

Timecoded comment threads, guest replies, resolved ranges, and SMPTE timecode — reviewers mark up the exact frame they mean, not a rough timestamp.

### Compare any two versions

Put two cuts or revisions on screen at once and see exactly what changed. Video plays in frame-accurate sync with per-side audio and offset trim for re-edited cuts; images compare side-by-side or under a draggable wipe. Each version keeps its own comment thread and annotations, and the whole view is shareable by URL.

### Take comments straight into your edit

Export a version's timecoded comments as timeline markers your editor can import — DaVinci Resolve (marker EDL), Final Cut Pro (FCPXML), Premiere Pro (XML), or CSV — so notes land on the exact frame back in the timeline.

See [Export comments to an NLE](docs/comment-export.md) for the export workflow, format choices, and frame-rate troubleshooting.

### Share with clients — no accounts needed

Send a link; clients review and comment without signing up. Every link controls its own comment/download permissions, passphrase, expiration date, watermarking, and appearance.

> The feature screenshots below are inherited from upstream freeframe and predate this fork's redesign — the accent color and chrome you'll actually see are different (near-black, warm orange, frosted glass throughout). The functionality they show is current.

![Review player — frame-accurate timecoded comments, threads with guest replies, and timeline markers](docs/images/review-player.png)

![Version compare — two synced video versions side by side, each with its own timecoded comment thread, per-side audio, and frame-offset trim](docs/images/video-version-screen.png)

| Images side-by-side | Wipe slider |
|---|---|
| ![Image version compare, side-by-side — v1 and v2 of an illustration, each with its own comments](docs/images/image-version-compare-sidebyside.png) | ![Image version compare, wipe — a draggable divider reveals v1 on the left and v2 on the right](docs/images/image-version-compare-wipe.png) |

| Client view (no login) | Your share-link controls |
|---|---|
| ![Public share link — clients browse assets and comment without an account](docs/images/share-client-view.png) | ![Share link settings — permissions, passphrase, expiration, watermark](docs/images/share-link-settings.png) |

<p align="center">
  <img src="docs/images/comment-export.png" alt="Export comments menu — DaVinci Resolve (EDL), Final Cut Pro (FCPXML), Premiere Pro (XML), and CSV" width="480">
</p>

## Quick Start (Development)

**Prerequisites:** Docker and Docker Compose

```bash
git clone https://github.com/Djoko-cli/review-majid-film.git
cd review-majid-film
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

Open [http://localhost:3000](http://localhost:3000) to access Review. The first user to sign up becomes the super admin.

**Services running in dev:**

| Service     | URL                          |
|-------------|------------------------------|
| Frontend    | http://localhost:3000         |
| API         | http://localhost:8000         |
| API Docs    | http://localhost:8000/docs    |
| MinIO Console | http://localhost:9001       |

### Access from other devices on your network (LAN)

By default the dev stack is reachable only from the host machine (`localhost`). To open Review from a phone or another computer on the same network, point a few URLs at your machine's LAN IP — find it with `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux) — then recreate the containers.

In `.env` (replace `192.168.1.50` with your IP):

```env
NEXT_PUBLIC_API_URL=http://192.168.1.50:8000   # web → API (baked into the browser bundle)
FRONTEND_URL=http://192.168.1.50:3000           # links in invite/magic-code emails
CORS_ALLOW_ORIGINS=*                            # API allows the LAN browser origin
S3_PUBLIC_ENDPOINT=http://192.168.1.50:9000     # presigned upload/download URLs
MINIO_CORS_ALLOW_ORIGIN=*                       # MinIO allows the LAN browser origin
```

```bash
docker compose -f docker-compose.dev.yml up -d --force-recreate
```

Then browse to `http://192.168.1.50:3000` from any device on the network. Server-side settings (`DATABASE_URL`, `S3_ENDPOINT`, …) stay on their docker-internal hostnames — only the browser-facing URLs above change.

> The `*` wildcards are LAN-testing conveniences — don't use them in production. See [docs/deployment.md](docs/deployment.md) for a locked-down setup.

## Production Deployment

Pull-based: the image is built and published to GHCR on every release, so
the server you deploy to only ever needs two files, never the source tree.

```bash
mkdir review && cd review
curl -O https://raw.githubusercontent.com/Djoko-cli/review-majid-film/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/Djoko-cli/review-majid-film/main/.env.example
cp .env.example .env.prod
# Edit .env.prod — set your credentials, S3, email config
docker compose --env-file .env.prod -f docker-compose.yml pull
docker compose --env-file .env.prod -f docker-compose.yml up -d
# Then point a reverse proxy you run (or your NAS's own) at localhost:6200 —
# no bundled Traefik/ACME here, see docs/deployment.md
```

Release notes for each tagged version are on the [Releases page](https://github.com/Djoko-cli/review-majid-film/releases). For the full deployment guide including **SSL setup**, **bring-your-own infrastructure** (external database, Redis, S3, SMTP), scaling, and troubleshooting, see:

**[Production Deployment Guide](docs/deployment.md)**

## Architecture

```
                          ┌───────────────┐
                          │ Your reverse   │
                          │ proxy (TLS)   │
                          └───────┬───────┘
                                  │
 ┌────────────────────────────── │ ─────────────────────────────────┐
 │  review — one container       ▼                                   │
 │                          ┌───────────┐                             │
 │                          │   Caddy    │                             │
 │                          │(path split)│                             │
 │                          └─────┬─────┘                             │
 │                    ┌───────────┴───────────┐                       │
 │                    ▼                       ▼                       │
 │             ┌─────────────┐        ┌─────────────┐                 │
 │             │   Next.js    │        │   FastAPI    │                 │
 │             │   Frontend   │        │   Backend    │                 │
 │             └─────────────┘        └──────┬───────┘                 │
 │                                            │                         │
 │                     ┌──────────┬───────────┼────────────┐            │
 │                     ▼          ▼           ▼            ▼            │
 │              ┌───────────┐┌───────────┐┌───────────┐┌───────────┐   │
 │              │  Celery   ││  Celery   ││  Celery   ││  Celery   │   │
 │              │Transcoder ││  Email    ││Maintenance││   Beat    │   │
 │              └───────────┘└───────────┘└───────────┘└───────────┘   │
 └──────────────────────────┬──────────────────────────────────────────┘
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
      ┌───────────┐   ┌───────────┐   ┌───────────────┐
      │ PostgreSQL │   │   Redis    │   │  S3 Storage   │
      │            │   │           │   │ (AWS/R2/MinIO) │
      └───────────┘   └───────────┘   └───────────────┘
```

## Tech Stack

| Component    | Technology                                       |
|--------------|--------------------------------------------------|
| Frontend     | Next.js 14, React 18, Tailwind CSS, Zustand, next-intl (FR/EN) |
| Backend      | FastAPI, SQLAlchemy, Pydantic                    |
| Database     | PostgreSQL 15                                     |
| Queue        | Celery + Redis                                    |
| Transcoding  | FFmpeg (multi-bitrate HLS), CPU by default, optional NVENC/VAAPI |
| Storage      | Any S3-compatible (AWS, R2, B2, MinIO)           |
| Proxy        | Caddy, baked into the `review` image (path routing only); TLS is your own reverse proxy's job — see [docs/deployment.md](docs/deployment.md) |
| Auth         | JWT sessions — password login and OIDC (PKCE), magic-code-by-email available but off by default |

## Documentation

| Guide | Description |
|-------|-------------|
| [Production Deployment](docs/deployment.md) | SSL, bring-your-own infra, scaling, troubleshooting |
| [Architecture](docs/architecture.md) | System design, data flow, media pipeline, permissions |
| [Export comments to an NLE](docs/comment-export.md) | Export review notes for Resolve, Final Cut Pro, Premiere Pro, or CSV |
| [Changelog](CHANGELOG.md) | What changed, release by release |
| [Environment Variables](.env.example) | Full config reference with comments |

## License

MIT License — see [LICENSE](LICENSE) for details. Review is a fork of [Techiebutler/freeframe](https://github.com/Techiebutler/freeframe); upstream attribution is preserved per the original license.
