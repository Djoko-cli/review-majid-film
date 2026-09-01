# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo today: the owner (Majid) is the only user, running this as a personal review tool. Explicitly planned to open up to small/medium teams once the first production version is stable — collaborators and clients will be added later, not architected in from day one as a multi-tenant product. Design and backend decisions should keep that growth path easy rather than assume permanent single-user scale.

## Product Purpose

A self-hosted, collaborative review tool for video/image/audio media: frame-accurate timecoded comments, drawing annotations, approval workflows, version comparison, and export of review notes to NLEs (DaVinci Resolve EDL, Final Cut FCPXML, Premiere XML, CSV). Forked from freeframe (MIT), an open-source Frame.io alternative, and rebranded as "Review."

## Positioning

A self-hosted alternative to Frame.io/hosted review tools: full ownership of unreleased media and review data (nothing leaves the owner's own Synology NAS — Postgres, Redis, and S3-compatible storage via self-hosted MinIO all run locally), no per-seat or per-storage SaaS pricing, and one cohesive "M family" identity shared with the owner's other self-hosted tool, Transfer (transfer.majid.film) — same visual language, same infrastructure philosophy, same operating discipline.

## Operating Context

- Deployed on a Synology NAS via Docker Compose, alongside Transfer.
- Storage: self-hosted MinIO (S3-compatible), not an external S3 provider.
- Email: dedicated SMTP address (not shared with Transfer's), required because login is magic-code-by-email only — no working mailer means no login at all.
- Backend stack (Postgres, Redis, Celery with FFmpeg-based transcoding) kept as-is from upstream freeframe rather than simplified, both because it's already built and tested and because it's the substrate the planned team growth will need.
- GitHub: github.com/Djoko-cli/review-majid-film (public fork), upstream tracked at Techiebutler/freeframe via the `stable` branch/tags, not `main`.

## Capabilities and Constraints

Inherited from freeframe and confirmed still relevant:
- HLS-adaptive video review, image review, audio review with waveform visualization.
- Frame-accurate timecoded comments; threaded comments with mentions, reactions, attachments; canvas drawing annotations.
- Reviewer-role approval workflows; side-by-side or swipe version comparison.
- Folder organization; role-based permissions (owner/editor/reviewer/viewer at the Project level).
- Password-protected, expiring share links; unauthenticated guest commenting via share link.
- Real-time updates via SSE; email reminders on deadlines.
- Full white-label branding already built in (org name, logos, favicon, accent color, "Powered by FreeFrame" toggle) — the mechanism Review's rebrand hooks into rather than replaces.

**Planned, not yet implemented: auth architecture change.** freeframe's current login is magic-code-by-email only (passwordless, requires SMTP to work at all). Confirmed future direction, not yet scoped or started: password + passkey login as the primary path — same principle as the sibling tool, Transfer (transfer.majid.film) — backed by a real user database (not a passwordless-only model), plus OAuth support, specifically Pocket ID (self-hosted OIDC provider, running at id.majid.film). This is a backend auth rework; do not build new features on top of the current magic-code-only flow assuming it's permanent.

Structural constraint carried forward deliberately: freeframe has **no organization/team layer** — `Project` is the permission root, and per-project roles (owner/editor/reviewer/viewer) plus share links are the only access model. The planned move from solo to small/medium teams should grow through this existing per-project model (adding ProjectMembers as needed) rather than requiring a new org/tenancy layer to be built.

Known rough edges inherited from upstream, not yet fixed, worth keeping in mind rather than assuming solid:
- Version comparison loses UI state on reload; some fps-drift reports remain unresolved.
- Upload/transcode pipeline has had several reliability fixes but multipart-upload interruption recovery is not confirmed complete.
- White-labeling is recently and actively developed but still has a known gap (single-asset share pages not showing instance branding).
- Any project *editor* (not just an admin) can currently override the instance-wide branding on that project's public share page via ProjectBranding — worth locking down if every Review link should always show identical "M family" branding.

## Brand Commitments

- Product name: **Review**.
- Visual identity: part of the "M family" of self-hosted tools alongside Transfer — same liquid-glass design language, not a standalone brand.
- MIT license and upstream attribution preserved (fork of Techiebutler/freeframe).
- Self-hosted only: no dependency on a third-party SaaS for core paths (storage, database, queue, email delivery infrastructure choice is the owner's own).

## Evidence on Hand

- The current freeframe implementation (this codebase, `apps/web`) is the incumbent functional and visual baseline — real, running, tested functionality (transcoding, NLE export, permissions, share links), currently with FreeFrame's own default (unbranded, purple-accent) visual treatment.
- The sister project Transfer (github.com/Djoko-cli/transfer-majid-film) is the canonical reference for the "liquid glass" visual system this product's redesign will adopt — exact design tokens documented in `docs/majid-notes/kickoff-prompt.md` at the repo root.
- No customer testimonials, case studies, or usage metrics exist yet — this is a pre-launch personal project; future work must not fabricate any.

## Product Principles

1. **Solo-first, team-ready** — build and design for a single user today without foreclosing a smooth move to small/medium teams later; lean on freeframe's existing per-project role model for that growth rather than replacing it.
2. **Ownership over convenience** — self-hosted end to end (NAS, MinIO, own SMTP); never introduce a hosted third-party dependency on a core path.
3. **Validation-before-delivery is the primary loop** — sharing a version, collecting timecoded feedback, and reaching approval is the flow that must work best; dailies triage and personal-archive use are secondary for now.
4. **One cohesive "M family" identity** — Review should read as the same tool family as Transfer, not a bolted-on rebrand.
5. **Preserve the engineering investment already made** — this is a fork with real, working functionality (transcoding, NLE export, permissions, approval flows); the redesign replaces the surface, not the machine underneath it.
