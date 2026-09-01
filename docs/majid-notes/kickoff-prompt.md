# Prompt de démarrage — review.majid.film (fork de freeframe)

> À copier-coller tel quel dans une **nouvelle session Claude Code**, démarrée
> dans un **nouveau dossier/repo**, séparé de `fork-wetransfer`
> (transfer.majid.film). Ne pas exécuter ce chantier depuis l'instance qui
> maintient Transfer.

---

## Mission

Forker [Techiebutler/freeframe](https://github.com/Techiebutler/freeframe)
(alternative auto-hébergée et open-source à Frame.io — revue collaborative de
rushs vidéo/image/audio) pour en faire **review.majid.film** : le même outil,
avec l'identité visuelle "liquid glass" de Majid (déjà en place sur
transfer.majid.film), déployé sur son NAS Synology en Docker, avec le même
niveau d'exigence d'ingénierie et le même mode de travail que sur Transfer.

Ce document contient tout ce qu'il faut pour démarrer correctement : ce
qu'est freeframe, ce que Majid attend niveau design, comment il travaille
(NAS/Docker/releases), et quelles skills invoquer pour bien mener ce
chantier.

---

## 1. Le projet source : freeframe

Recherche menée le 2026-09-01 directement sur le repo GitHub (README, arbre
de fichiers, LICENSE, issues, releases). Résumé fiable, vérifié à la source
— pas une supposition sur ce que fait "generiquement" un concurrent de
Frame.io.

### Ce que ça fait

Revue collaborative de médias : lecture vidéo en HLS adaptatif avec
commentaires timecodés à l'image près, export des commentaires vers
DaVinci Resolve (EDL), Final Cut (FCPXML), Premiere (XML), CSV ; revue
image/audio avec visualisation de forme d'onde ; annotations au dessin sur
canvas ; commentaires en fil avec mentions/réactions/pièces jointes ;
workflows d'approbation par relecteur ; comparaison de versions (côte-à-côte
ou curseur de balayage) ; organisation en dossiers ; permissions par
rôle (org/équipe/projet) ; liens de partage protégés par mot de passe et
expirants ; commentaires invités sans compte ; relances par email sur
échéance ; mises à jour temps réel (SSE) ; **marque blanche complète**
(logo, couleur d'accent, bandeau "Powered by FreeFrame" désactivable,
aperçu live des réglages de marque).

### Stack technique — **très différente de Transfer, à bien intégrer avant de foncer**

Transfer est un monolithe Node (NestJS + Next.js) avec SQLite/Prisma, une
seule image Docker. freeframe est un **monorepo pnpm/Turborepo** avec deux
mondes distincts :

- **Frontend** (`apps/web`) : Next.js 14.2 (App Router, pas de `pages/`),
  React 18, TypeScript strict, Tailwind + Radix UI (composants "à la
  shadcn", pas de kit UI packagé — donc pas de Mantine, il faudra construire
  ou porter les primitives), Zustand (état client) + SWR (fetching), hls.js
  / wavesurfer.js / fabric pour la lecture/annotation média.
- **Backend** (`apps/api`) : **FastAPI (Python)**, pas Node — SQLAlchemy 2 +
  Alembic (24 migrations), **PostgreSQL 15 uniquement** (pas de SQLite),
  Pydantic, JWT (python-jose) + bcrypt, boto3/S3.
- **Traitement asynchrone** : Celery + Redis, 5 files nommées (default,
  transcoding, email_high, email_low, maintenance) + Celery Beat pour les
  tâches planifiées (relances, nettoyage, purge des orphelins).
- **Transcodage** : FFmpeg, packagé comme librairie Python séparée
  (`packages/transcoder`), accélération matérielle optionnelle (NVENC/VAAPI),
  logiciel par défaut.
- **Stockage : S3 uniquement, pas de stockage fichier local du tout**
  (confirmé dans `docker-compose.prod.yml` et `.env.example`). Un endpoint
  S3-compatible est obligatoire — AWS S3, ou auto-hébergé (MinIO, le plus
  naturel sur un NAS).
- **Auth** : entièrement maison (pas Auth.js/Clerk) — JWT + connexion par
  code magique envoyé par email. **L'email est une dépendance dure du
  login**, pas une option : sans SMTP configuré, personne ne peut se
  connecter. Premier compte créé = super-admin (bootstrap).
- **Déploiement** : pas une image unique — 4 Dockerfiles (`apps/api/`
  et `apps/web/`, chacun en version dev + prod), l'image `api` étant
  réutilisée telle quelle pour les 4 rôles Celery (seule la commande change).
  `docker-compose.prod.yml` fourni de base avec **Traefik** (reverse-proxy +
  Let's Encrypt automatique), Postgres, Redis, la flotte api/worker/
  email_worker/maintenance_worker/beat, et web.

**Conséquence directe pour le déploiement NAS** : ce n'est pas un simple
copier-coller du `Dockerfile`/`docker-compose.yml` de Transfer. Il faut
Postgres + Redis + un stockage S3 (MinIO auto-hébergé sur le NAS étant
l'option la plus cohérente avec "tout reste chez moi") en plus des images
web/api. C'est un empreinte de service nettement plus lourde que Transfer
(un seul conteneur SQLite). Le `docker-compose.prod.yml` du repo est déjà un
bon point de départ, réaliste — il vaut mieux l'adapter (brancher MinIO,
brancher les volumes NAS, remplacer Traefik par le reverse-proxy déjà en
place sur le NAS s'il y en a un, etc.) que le réécrire from scratch.

### Licence

MIT, vérifiée verbatim (`Copyright (c) 2026 Techiebutler`). Aucune obligation
copyleft/AGPL — seule obligation : conserver la notice de copyright dans les
copies. Fork libre, y compris fermeture du code ou usage commercial.

### Santé du projet (à connaître avant de s'engager)

Très actif mais maintenu quasi seul (377 commits par un seul auteur,
`ravirajsinh45`, sur un historique dominé à plus de 80% par cette personne —
un vrai risque de bus factor). 23 releases sémantiques réelles, cadence
hebdomadaire à bimensuelle, `CHANGELOG.md` tenu à jour, dernière release
`v1.12.0` le 2026-08-29. Le projet recommande explicitement de suivre la
branche/les tags `stable` en production plutôt que `main` ("active
development, may be unreleased or unstable").

Points faibles connus, à tester particulièrement soigneusement après le
fork plutôt qu'à supposer solides :
- comparaison de versions : perte d'état au rechargement (#299), dérive de
  fps (#183), zéro couverture de tests sur cette fonctionnalité ;
- pipeline upload/transcodage : plusieurs issues ouvertes sur la fiabilité
  (complétions perdues #273, upload multipart non reprenable #241, dispatch
  de threads non borné #274, fichiers watermark orphelins en S3 #247) ;
- la marque blanche (fonctionnalité récente, justement ce qui intéresse ce
  chantier) fuit encore par endroits dans la nav client et les liens de
  partage (#276, #308) ;
- logging/observabilité en prod admis comme faible par défaut (#262) ;
- pas de support de déploiement en sous-chemin (basePath) pour l'instant
  (#281).

Rien de rédhibitoire, mais ne pas prendre pour acquis que "marque blanche"
et "upload" sont déjà bulletproof — les tester en conditions réelles tôt.

---

## 2. Le système de design "liquid glass" à reprendre

Transfer (`transfer-majid-film`, repo GitHub privé
`Djoko-cli/transfer-majid-film`) est la référence vivante et canonique de ce
langage visuel. **Le clonner (ou le parcourir en lecture seule via `gh`)
localement pour aller lire directement les fichiers ci-dessous est plus
fiable que de recopier ce résumé** — ce résumé donne les valeurs exactes
pour démarrer vite, mais le code source fait foi en cas de doute ou pour
tout ce qui n'est pas listé ici.

```bash
git clone https://github.com/Djoko-cli/transfer-majid-film.git reference-transfer
```

### Jetons de base (vérifiés dans `frontend/src/styles/mantine.style.ts`)

- Couleur d'accent unique : `#ff7a00` (orange), à partir de laquelle une
  échelle Mantine à 10 nuances est générée automatiquement par mélange vers
  le blanc (nuances claires) / vers le noir (nuances foncées).
- Palette "dark" custom (pas l'échelle grise par défaut de Mantine, un
  quasi-noir) :
  `["#C1C2C5","#A6A7AB","#909296","#5C5F66","#2E2E2E","#1F1F1F","#141414","#050505","#030303","#000000"]`
  — `dark[0]` (`#C1C2C5`) = texte principal, `dark[7]` (`#050505`) = fond de
  page.
- `primaryColor: "accent"`, `defaultRadius: "md"`.
- Police : Rubik auto-hébergée (fichiers woff2 locaux, poids 300 à 600
  seulement — **pas** de Google Fonts CDN). Les titres en `weight={900}`
  reposent volontairement sur le gras synthétique du navigateur (aucun
  fichier 900 n'existe) : c'est cohérent partout dans l'app, pas un raccourci
  à corriger — à reproduire tel quel si Rubik est repris.
- Le mode clair existe dans le code mais est actuellement forcé en sombre
  partout sur Transfer — un choix délibéré, pas un oubli. À trancher
  indépendamment pour review.majid.film : la vidéo/l'image en revue tire
  probablement encore plus parti d'un fond sombre neutre qu'un site de
  transfert de fichiers, donc partir sombre par défaut ici aussi est
  probablement le bon réflexe, mais ce n'est plus un legacy à respecter, ça
  peut être décidé librement.

### La recette "verre" (réutilisée partout : cartes, header/footer, menus,
### modales — voir `AuthGlassLayout.tsx`, `TransferCard.tsx`,
### `Header.tsx`/`Footer.tsx`, et les overrides Menu/Notification/Modal dans
### `mantine.style.ts`)

```css
background: linear-gradient(160deg,
  rgba(10, 10, 10, 0.5) 0%,
  rgba(10, 10, 10, 0.6) 55%,
  rgba(10, 10, 10, 0.54) 100%);
backdrop-filter: blur(22px) saturate(160%);   /* 18px sur les barres header/footer, 22px sur cartes/menus */
-webkit-backdrop-filter: blur(22px) saturate(160%);
border: 1px solid rgba(255, 255, 255, 0.22);
box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
border-radius: 28px;   /* constante CARD_RADIUS pour les cartes ; radius "md" ailleurs */
```

Texte posé directement sur une photo (pas sur une carte verre) : halo au
lieu d'un fond, `text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7)`.

Fichiers de référence précis à ouvrir dans `reference-transfer/frontend/src/` :
- `styles/mantine.style.ts` — tous les jetons ci-dessus, verbatim, plus les
  overrides de composants Mantine (Menu/Notification/Button/Modal).
- `components/auth/AuthGlassLayout.tsx` — la mise en page canonique "carte
  verre centrée sur un fond photo".
- `components/upload/TransferCard.tsx`,
  `components/upload/SplitTransferLayout.tsx` — variante en split asymétrique.
- `components/header/Header.tsx`, `components/footer/Footer.tsx` — barres
  translucides flottantes.
- `components/upload/BrandPanel.tsx`, `components/upload/GlintBorder.tsx`,
  `components/upload/liquidGlassKeyframes.tsx` — rotation de fond photo,
  liseré scintillant, `@keyframes` partagées.
- `components/core/AnimatedHeight.tsx` — transitions de hauteur fluides
  pilotées par `ResizeObserver`, à réutiliser dès qu'un contenu change de
  taille sur place (liste de fichiers qui grandit, zone qui se substitue à
  une autre). Démarre à `height: "auto"` (pas `0`) pour ne jamais faire
  s'effondrer puis rebondir un contenu déjà réel côté serveur avant que le
  JS ne le mesure — leçon tirée d'un vrai bug sur Transfer, pas un choix de
  style gratuit.

### Piège d'hydratation SSR à éviter dès le premier jour

Tout état client dérivé de `localStorage`/un cookie/`window` doit démarrer,
au premier rendu, sur une valeur identique à celle rendue côté serveur
(ne jamais lire la vraie valeur de `localStorage` dans l'initialiseur paresseux
d'un `useState` — ce code s'exécute aussi côté serveur et n'y a pas accès),
puis se résoudre à la vraie valeur dans un `useEffect` après montage. Pour
tout ce qui doit être correct dès le tout premier octet servi pour un
visiteur qui revient (typiquement : "déjà connecté", "déjà accepté les
CGU"), préférer un vrai cookie à `localStorage`, précisément parce qu'un
cookie est lisible côté serveur (`getCookie` dans `getInitialProps`) alors
que `localStorage` ne l'est jamais. Transfer a eu un vrai bug utilisateur
pour avoir raté ça une fois — ne pas le reproduire.

Freeframe étant Next.js App Router (Server Components) plutôt que Pages
Router, l'implémentation technique de ce garde-fou sera différente
(pas de `getInitialProps`), mais le **principe** — jamais de désaccord entre
premier rendu serveur et premier rendu client sur un état persistant —
s'applique identiquement.

---

## 3. Conventions NAS / Docker / releases à reprendre (adapter, pas copier
## bêtement — voir section 1 sur les différences de stack)

Toujours dans `reference-transfer` :

- **Utilisateur d'exécution PUID/PGID** (`scripts/docker/create-user.sh`) :
  au démarrage du conteneur, crée un utilisateur/groupe correspondant aux
  variables d'env `PUID`/`PGID` (celles du compte NAS de Majid, pas
  1000:1000 par défaut), `chown` les répertoires de données applicatives
  vers cet UID:GID, puis relance le process applicatif via `su-exec` sous
  cet utilisateur — jamais en root. C'est ce qui garantit que les fichiers
  écrits par le conteneur appartiennent ensuite au vrai compte NAS de
  l'admin, pas à un UID de conteneur opaque. **Applicable ici** à chaque
  image custom construite pour ce projet (web, api), même si freeframe
  n'a pas ce mécanisme nativement.
- **Montages NAS réels** (`docker-compose.yml`) : bind-mounts vers de vrais
  chemins `/volume1/<Partage>` (pas des volumes nommés) pour tout ce que
  l'admin doit pouvoir parcourir/sauvegarder directement depuis File
  Station de DSM. Piège Synology déjà rencontré et résolu sur Transfer : un
  ACL Synology actif sur un chemin peut silencieusement neutraliser un
  simple `chown`/`chmod` — si un montage nécessite l'écriture, prévoir de
  devoir accorder l'accès explicitement via l'onglet Permissions de File
  Station (ou `synoacltool`, dont la syntaxe exacte varie selon la version
  de DSM — à vérifier via `synoacltool -h` plutôt qu'à deviner).
- **Publication d'image sur GHCR** : `ghcr.io/djoko-cli/<nom-repo>` (paquet
  privé), construite par un workflow GitHub Actions déclenché sur
  `release: types: [published]` (pas à chaque push sur main).
  `docker/metadata-action` pour les tags semver (`{version}`/
  `{major}.{minor}`/`{major}`), plus `latest` pour une release non
  pré-release. Ici, il faudra très probablement **deux images** (web + api,
  l'api étant réutilisée pour les workers Celery), donc deux jobs de build
  en parallèle dans le même workflow plutôt qu'un seul.
- **Process de release réel** : `git tag -a vX.Y.Z -m "X.Y.Z"` →
  `git push origin vX.Y.Z` → `gh release create vX.Y.Z --title "X.Y.Z"
  --notes-file <fichier>`. Notes de release en français, groupées par thème
  (`## Thème` par domaine fonctionnel), une ligne par changement visible
  côté utilisateur, écrites pour être lues sur GitHub — pas une liste brute
  de messages de commit.
- **Stratégie de fork/upstream** : freeframe recommande lui-même de suivre
  `stable` plutôt que `main` en production — donc, à l'image de ce que
  Transfer fait avec `smp46/pingvin-share-x` comme remote `upstream`,
  ajouter `upstream` pointant vers `Techiebutler/freeframe` et tirer
  périodiquement depuis leurs tags `stable`/releases plutôt que depuis leur
  `main` en mouvement permanent.
- **Commits directement sur `main`**, pas de branche/PR, pour ce type de
  projet perso — mais seulement une fois le changement réellement vérifié,
  pas de façon spéculative. Messages de commit en prose : ligne de résumé à
  l'impératif, puis un corps qui explique le problème, l'approche, et
  comment c'est vérifié (ce qui a été concrètement contrôlé, jamais un
  "devrait marcher").

---

## 4. Règles de fonctionnement avec Majid (à respecter dès le premier
## message, pas seulement une fois "amené à vitesse")

- **Committer et pousser au fil de l'eau**, changement vérifié par
  changement vérifié — ne jamais laisser s'accumuler du travail non commité.
- **Ne jamais déclencher un build/déploiement d'image Docker sans une
  confirmation explicite et fraîche de Majid, style "ok build"** — à chaque
  fois, sans exception, même pour un changement minime ou déjà approuvé
  plusieurs fois par le passé. Préparer les notes de release et tagger est
  très bien à faire sur simple demande ; ce qui déclenche réellement le
  build (la création de la GitHub Release) attend ce feu vert explicite.
- **Vérifier en direct dans un navigateur avant d'annoncer un changement
  terminé** — pas seulement relire le diff. Pour tout ce qui est visuel,
  contrôler à la fois le changement lui-même et l'absence de régression
  visuelle adjacente.
- Majid est technique, auto-héberge sur un NAS Synology via Docker Compose,
  à l'aise avec SSH/l'inspection directe de base de données si besoin, et
  préfère des explications d'ingénierie directes plutôt que des formulations
  prudentes — dire ce qui a été effectivement vérifié, sans enrober.

---

## 5. Points à trancher explicitement avec Majid avant de foncer dans le
## code (ne pas décider seul, poser la question en une fois, groupée)

1. **Nom du produit et branding** — "review.majid.film" est le domaine visé,
   mais quel nom affiché dans l'app (logo, `<title>`, emails) ? Faut-il
   reprendre la même identité de marque "M" que Transfer (cohérence d'une
   famille d'outils majid.film) ou une identité propre à cet outil ?
2. **Stockage S3** — MinIO auto-hébergé sur le NAS (tout reste chez lui,
   cohérent avec sa philosophie sur Transfer) vs un fournisseur S3-compatible
   externe (Backblaze B2, Scaleway, etc., moins de charge sur le NAS mais
   moins "tout est chez moi"). Recommandation par défaut : MinIO
   auto-hébergé, à confirmer.
3. **Conserver Postgres + Redis + Celery tel quel**, ou simplifier pour un
   usage mono-utilisateur/petite équipe (freeframe est conçu pour des
   "production houses" avec plusieurs relecteurs — le besoin réel de Majid
   est probablement plus petit) ? Recommandation par défaut : garder la
   stack telle quelle au démarrage (elle est déjà écrite, testée, réduire la
   marge d'erreur), simplifier seulement si des frictions réelles
   apparaissent à l'usage.
4. **Email/SMTP** — réutiliser la même config que Transfer
   (`transfer@majid.film` ou une adresse dédiée type `review@majid.film`) ?
   Le login par code magique en dépend entièrement, donc ce point bloque le
   premier lancement, pas un "à faire plus tard".

---

## 6. Premiers pas concrets suggérés

1. Faire un vrai fork GitHub de `Techiebutler/freeframe` (préserve la
   généalogie du fork, l'attribution MIT, et le lien `upstream` — ne pas
   juste copier les fichiers dans un nouveau repo vide).
2. Cloner le fork localement, ajouter `upstream` vers
   `Techiebutler/freeframe`, confirmer quel tag `stable` récent sert de
   point de départ.
3. Lire `AGENTS.md`, `docs/architecture.md`, `docs/deployment.md`,
   `CHANGELOG.md` du repo freeframe en entier avant toute modification —
   c'est un projet inconnu, ne pas improviser sur une architecture
   FastAPI/Celery/S3 pas encore lue en détail.
4. Faire tourner `docker-compose.dev.yml` tel quel en local d'abord (Postgres
   + Redis + MinIO + api + workers + web), sans aucune modification, pour
   confirmer que la base fonctionne avant d'y toucher.
5. Une fois l'orientation confirmée, lancer `/impeccable init` pour poser
   un `PRODUCT.md` propre à ce nouveau projet (ce n'est pas un simple
   correctif sur une surface existante, c'est un vrai nouveau chantier — le
   flux `init` → `new-work` de la skill s'applique pleinement ici,
   contrairement à une retouche ponctuelle).

---

## 7. Skills à invoquer, et pourquoi

- **`impeccable`** — central pour ce chantier : c'est la skill qui a
  construit tout le langage "liquid glass" sur Transfer. Lancer
  `/impeccable init` en tout début (nouveau produit, nouvelle surface),
  puis s'appuyer sur son mode **Redesign** documenté (`reference/new-work.md`)
  pour traiter l'UI existante de freeframe comme preuve/anti-référence :
  garder la vérité produit, le contenu, les affordances, mais remplacer
  entièrement l'habillage visuel par le monde "liquid glass" — pas de
  "moitié verre, moitié shadcn par défaut".
- **Une skill de prise en main de codebase inconnue** (type "apprendre une
  codebase" / "prime a codebase") — freeframe est un monorepo à deux
  langages avec une architecture non triviale (Celery/Alembic/S3/HLS) ;
  vaut le coup de la lire sérieusement avant de modifier quoi que ce soit,
  plutôt que d'avancer par sondages ponctuels.
- **Planification/découpage de tâches** (type "spec-driven-development" /
  "planning-and-task-breakdown", selon ce qui est disponible dans cette
  session) — un fork + reskin + redéploiement complet est un chantier avec
  beaucoup de pièces mobiles (S3, auth email, transcodage, branding, NAS) ;
  vaut mieux un plan écrit et validé avec Majid avant de foncer dans le code,
  à l'image du fonctionnement `EnterPlanMode` déjà en usage sur Transfer
  pour les chantiers de cette taille.
- **Sécurité/durcissement** (type "security-and-hardening") — ce produit
  gère des comptes, des liens de partage protégés par mot de passe, et des
  médias potentiellement sensibles de production (rushs non publiés) ; une
  passe sécurité dédiée est justifiée avant toute mise en production
  réelle, pas juste "au cas où".
- **CI/CD** (type "ci-cd-and-automation") — pour construire le workflow
  GitHub Actions à deux images (web + api) déclenché sur release, sur le
  modèle de celui de Transfer.
- **Gestion de version/releases** (type "git-workflow-and-versioning") —
  pour installer dès le départ la même discipline de tags semver + notes de
  release françaises que sur Transfer, plutôt que de l'improviser à la
  première release venue.

Vérifier au démarrage de la nouvelle session, via la commande `/` ou la
liste de skills disponibles, lesquelles de ces catégories existent
réellement sous ces noms exacts dans cet environnement — cette liste donne
l'intention et la justification de chaque catégorie, pas des noms de
fichiers garantis stables d'un environnement à l'autre.

---

## Résumé pour qui n'a que 30 secondes

Fork MIT de freeframe (Next.js/FastAPI/Postgres/Redis/S3, actif mais
maintenu par une seule personne), à re-habiller intégralement avec le
design "liquid glass" de Majid (glass-card recipe et jetons exacts ci-dessus,
copiables depuis `transfer-majid-film`), déployé sur le même NAS Synology
avec la même discipline (commits fréquents, jamais de build sans feu vert
explicite, vérification live). Empreinte infra sensiblement plus lourde que
Transfer (Postgres+Redis+S3+Celery vs un seul conteneur SQLite) — cadrer les
attentes de Majid là-dessus dès le premier échange plutôt que de découvrir
la surprise en cours de route. Quatre décisions à lui poser avant de coder
(section 5). `/impeccable init` en tout premier réflexe de code.
