# Review

*[Read in English](README.en.md)*

**Revue de médias auto-hébergée — retours précis à l'image près, collaboration en temps réel, et une expérience de revue pour vos clients qui ne quitte jamais votre propre infrastructure.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](docker-compose.yml)
[![Latest release](https://img.shields.io/github/v/release/Djoko-cli/review-majid-film)](https://github.com/Djoko-cli/review-majid-film/releases)

Review offre aux boîtes de production et aux équipes créatives une plateforme auto-hébergée pour la revue de vidéos, d'images et de fichiers audio, avec commentaires précis à l'image près, annotations et workflows d'approbation. Vos médias restent sur votre propre infrastructure — Postgres, Redis et le stockage compatible S3 tournent où vous déployez l'application.

Review est un fork de [freeframe](https://github.com/Techiebutler/freeframe) (MIT), rebrandé et redessiné dans le cadre de la « famille M » d'outils auto-hébergés, aux côtés de [Transfer](https://github.com/Djoko-cli/transfer-majid-film) : même langage visuel « verre liquide », même philosophie d'auto-hébergement. Voir [`CHANGELOG.md`](CHANGELOG.md) pour ce qui a changé depuis le fork.

---

## Fonctionnalités

- **Revue vidéo** avec streaming adaptatif HLS et commentaires horodatés précis à l'image près
- **Export des commentaires vers votre NLE** — DaVinci Resolve (marker EDL), Final Cut Pro (FCPXML), Premiere Pro (XML), ou CSV
- **Revue d'images et d'audio** avec annotations et visualisation de forme d'onde
- **Annotations dessinées** sur n'importe quelle image via des outils canvas
- **Commentaires en fil de discussion** avec mentions, réactions et pièces jointes
- **Workflows d'approbation** avec suivi du statut par relecteur
- **Comparaison de versions** — deux versions côte à côte ou sous un curseur de balayage, chacune avec ses propres commentaires et annotations
- **Organisation en dossiers** au sein des projets, avec des rôles par projet (propriétaire/éditeur/relecteur/spectateur)
- **Liens de partage** pour les relecteurs externes (protégés par mot de passe, expirables, avec apparence claire/sombre propre à chaque lien)
- **Commentaires invités** via les liens de partage (aucun compte requis)
- **Suivi des échéances** avec rappels par email
- **Mises à jour en temps réel** via Server-Sent Events
- **Authentification par mot de passe et OIDC** — connexion avec un vrai mot de passe, ou via n'importe quel fournisseur OpenID Connect conforme aux standards (conçu pour une instance auto-hébergée de [Pocket ID](https://github.com/pocket-id/pocket-id), mais agnostique du fournisseur)
- **Français et anglais**, dans toute l'application, les pages de partage publiques, et chaque email transactionnel
- **Une console d'administration en base de données** (Réglages → Admin → Config) pour les paramètres d'instance — authentification, OIDC, email, limites d'upload, réglages du transcodeur — modifiables en direct, sans édition de `.env` ni redémarrage de conteneur
- **Logo en marque blanche** — votre propre identité sur la barre latérale, l'écran de connexion, le favicon et les liens de partage ; le badge « Powered by FreeFrame » peut être désactivé
- **Auto-hébergé** avec Docker Compose — fonctionne sur n'importe quel serveur, VM cloud, ou NAS

### Revue précise à l'image près

Fils de commentaires horodatés, réponses des invités, plages résolues, et timecode SMPTE — les relecteurs pointent exactement l'image qu'ils visent, pas un horodatage approximatif.

### Comparer deux versions

Affichez deux montages ou révisions à l'écran en même temps et voyez exactement ce qui a changé. La vidéo est lue en synchronisation précise à l'image près, avec audio par côté et ajustement d'offset pour les montages remaniés ; les images se comparent côte à côte ou sous un balayage (wipe) déplaçable. Chaque version garde son propre fil de commentaires et ses propres annotations, et toute la vue est partageable par URL.

### Faites passer les commentaires directement dans votre montage

Exportez les commentaires horodatés d'une version comme marqueurs de timeline importables par votre monteur — DaVinci Resolve (marker EDL), Final Cut Pro (FCPXML), Premiere Pro (XML), ou CSV — pour que les notes atterrissent sur l'image exacte, de retour dans la timeline.

Voir [Exporter les commentaires vers un NLE](docs/comment-export.md) pour le détail du workflow d'export, les choix de format, et le dépannage lié à la cadence d'images.

### Partagez avec vos clients — sans compte nécessaire

Envoyez un lien ; vos clients relisent et commentent sans créer de compte. Chaque lien contrôle ses propres permissions de commentaire/téléchargement, son mot de passe, sa date d'expiration, son filigrane et son apparence.

> Les captures d'écran ci-dessous sont héritées de freeframe (le projet d'origine) et datent d'avant la refonte de ce fork — la couleur d'accent et l'habillage que vous verrez réellement sont différents (noir profond, orange chaleureux, verre dépoli partout). Les fonctionnalités montrées, elles, sont à jour.

![Lecteur Review — commentaires horodatés précis à l'image près, fils avec réponses d'invités, et marqueurs de timeline](docs/images/review-player.png)

![Comparaison de versions — deux versions vidéo synchronisées côte à côte, chacune avec son propre fil de commentaires horodatés, son audio par côté, et son ajustement d'offset](docs/images/video-version-screen.png)

| Images côte à côte | Curseur de balayage |
|---|---|
| ![Comparaison de versions d'image, côte à côte — v1 et v2 d'une illustration, chacune avec ses propres commentaires](docs/images/image-version-compare-sidebyside.png) | ![Comparaison de versions d'image, balayage — un séparateur déplaçable révèle v1 à gauche et v2 à droite](docs/images/image-version-compare-wipe.png) |

| Vue client (sans connexion) | Vos réglages de lien de partage |
|---|---|
| ![Lien de partage public — les clients parcourent les médias et commentent sans compte](docs/images/share-client-view.png) | ![Réglages du lien de partage — permissions, mot de passe, expiration, filigrane](docs/images/share-link-settings.png) |

<p align="center">
  <img src="docs/images/comment-export.png" alt="Menu d'export des commentaires — DaVinci Resolve (EDL), Final Cut Pro (FCPXML), Premiere Pro (XML), et CSV" width="480">
</p>

## Démarrage rapide (développement)

**Prérequis :** Docker et Docker Compose

```bash
git clone https://github.com/Djoko-cli/review-majid-film.git
cd review-majid-film
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

Ouvrez [http://localhost:3000](http://localhost:3000) pour accéder à Review. Le premier compte créé devient super-administrateur.

**Services actifs en développement :**

| Service     | URL                          |
|-------------|------------------------------|
| Frontend    | http://localhost:3000         |
| API         | http://localhost:8000         |
| Docs API    | http://localhost:8000/docs    |
| Console MinIO | http://localhost:9001       |

### Accès depuis d'autres appareils du réseau (LAN)

Par défaut, la pile de développement n'est accessible que depuis la machine hôte (`localhost`). Pour ouvrir Review depuis un téléphone ou un autre ordinateur du même réseau, pointez quelques URLs vers l'IP LAN de votre machine — trouvez-la avec `ipconfig getifaddr en0` (macOS) ou `hostname -I` (Linux) — puis recréez les conteneurs.

Dans `.env` (remplacez `192.168.1.50` par votre IP) :

```env
NEXT_PUBLIC_API_URL=http://192.168.1.50:8000   # web → API (intégré au bundle du navigateur)
FRONTEND_URL=http://192.168.1.50:3000           # liens dans les emails d'invitation/code magique
CORS_ALLOW_ORIGINS=*                            # l'API autorise l'origine du navigateur LAN
S3_PUBLIC_ENDPOINT=http://192.168.1.50:9000     # URLs présignées d'upload/téléchargement
MINIO_CORS_ALLOW_ORIGIN=*                       # MinIO autorise l'origine du navigateur LAN
```

```bash
docker compose -f docker-compose.dev.yml up -d --force-recreate
```

Ensuite, naviguez vers `http://192.168.1.50:3000` depuis n'importe quel appareil du réseau. Les réglages côté serveur (`DATABASE_URL`, `S3_ENDPOINT`, …) restent sur leurs noms d'hôte internes à Docker — seules les URLs exposées au navigateur ci-dessus changent.

> Les jokers `*` sont des facilités de test LAN — ne les utilisez pas en production. Voir [docs/deployment.md](docs/deployment.md) pour une configuration verrouillée.

## Déploiement en production

Basé sur le pull : l'image est construite et publiée sur GHCR à chaque
release, donc le serveur sur lequel vous déployez n'a jamais besoin que de
deux fichiers, jamais de l'arborescence source.

```bash
mkdir review && cd review
curl -O https://raw.githubusercontent.com/Djoko-cli/review-majid-film/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/Djoko-cli/review-majid-film/main/.env.example
cp .env.example .env.prod
# Modifiez .env.prod — vos identifiants, S3, config email
docker compose --env-file .env.prod -f docker-compose.yml pull
docker compose --env-file .env.prod -f docker-compose.yml up -d
# Puis pointez un reverse proxy que vous gérez (ou celui de votre NAS) vers localhost:6200 —
# aucun Traefik/ACME embarqué ici, voir docs/deployment.md
```

Les notes de version de chaque version taguée sont sur la [page des Releases](https://github.com/Djoko-cli/review-majid-film/releases). Pour le guide de déploiement complet — **configuration SSL**, **infrastructure externe** (base de données, Redis, S3, SMTP externes), montée en charge, et dépannage — voir :

**[Guide de déploiement en production](docs/deployment.md)** *(en anglais)*

## Architecture

```
                          ┌───────────────┐
                          │  Votre reverse │
                          │ proxy (TLS)   │
                          └───────┬───────┘
                                  │
 ┌────────────────────────────── │ ─────────────────────────────────┐
 │  review — un seul conteneur   ▼                                   │
 │                          ┌───────────┐                             │
 │                          │   Caddy    │                             │
 │                          │(répartition│                             │
 │                          │ par chemin)│                             │
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
      │ PostgreSQL │   │   Redis    │   │  Stockage S3  │
      │            │   │           │   │ (AWS/R2/MinIO) │
      └───────────┘   └───────────┘   └───────────────┘
```

## Stack technique

| Composant    | Technologie                                       |
|--------------|--------------------------------------------------|
| Frontend     | Next.js 14, React 18, Tailwind CSS, Zustand, next-intl (FR/EN) |
| Backend      | FastAPI, SQLAlchemy, Pydantic                    |
| Base de données | PostgreSQL 15                                 |
| File d'attente | Celery + Redis                                  |
| Transcodage  | FFmpeg (HLS multi-bitrate), CPU par défaut, NVENC/VAAPI en option |
| Stockage     | Tout service compatible S3 (AWS, R2, B2, MinIO)  |
| Proxy        | Caddy, intégré à l'image `review` (répartition par chemin uniquement) ; le TLS est la responsabilité de votre propre reverse proxy — voir [docs/deployment.md](docs/deployment.md) |
| Auth         | Sessions JWT — connexion par mot de passe et OIDC (PKCE), code magique par email disponible mais désactivé par défaut |

## Documentation

| Guide | Description |
|-------|-------------|
| [Déploiement en production](docs/deployment.md) | SSL, infrastructure externe, montée en charge, dépannage *(en anglais)* |
| [Architecture](docs/architecture.md) | Conception du système, flux de données, pipeline média, permissions *(en anglais)* |
| [Exporter les commentaires vers un NLE](docs/comment-export.md) | Export des notes de revue pour Resolve, Final Cut Pro, Premiere Pro, ou CSV *(en anglais)* |
| [Changelog](CHANGELOG.md) | Ce qui a changé, version par version *(en anglais)* |
| [Variables d'environnement](.env.example) | Référence complète de configuration, commentée *(en anglais)* |

## Licence

Licence MIT — voir [LICENSE](LICENSE) pour le détail. Review est un fork de [Techiebutler/freeframe](https://github.com/Techiebutler/freeframe) ; l'attribution amont est préservée conformément à la licence d'origine.
