"""Translation strings for transactional emails — i18n rollout, Phase 1.

One shared template set per email (apps/api/templates/email/*.html), not
forked per locale — a prior version of this app forked its email
implementation once already by accident (apps/api/services/email_service.py,
dead code, unused everywhere but never deleted) and that duplication is
exactly the failure mode a `{fr, en}` split per template invites again, just
for a reason that felt justified this time. A shared template calling
`{{ t('key', locale) }}` keeps one copy of the markup and one place to add a
third language later.

Register: vouvoiement throughout (see the i18n rollout plan's own note on
this) — every French string here addresses the recipient as "vous", never
"tu". "Asset" is translated as "média" in French copy (a plain, accessible
term over the industry anglicism) — the glossary choice future frontend
translation batches (Phase 2) should stay consistent with.
"""
from typing import Optional

from sqlalchemy.orm import Session

SUPPORTED_LOCALES = ("fr", "en")
DEFAULT_LOCALE = "fr"

EMAIL_STRINGS: dict[str, dict[str, str]] = {
    # ─── base.html (shared header/footer) ──────────────────────────────
    "base.footer_rights": {
        "fr": "© {year} {org_name}. Tous droits réservés.",
        "en": "© {year} {org_name}. All rights reserved.",
    },
    "base.footer_reason": {
        "fr": "Vous recevez cet email car vous avez un compte sur {org_name}.",
        "en": "You're receiving this email because you have an account on {org_name}.",
    },

    # ─── magic_code.html ────────────────────────────────────────────────
    "magic_code.subject": {
        "fr": "Votre code de connexion {org_name} : {code}",
        "en": "Your {org_name} login code: {code}",
    },
    "magic_code.heading": {
        "fr": "Votre code de connexion",
        "en": "Your login code",
    },
    "magic_code.intro": {
        "fr": "Utilisez ce code pour vous connecter à {org_name} :",
        "en": "Use this code to sign in to {org_name}:",
    },
    "magic_code.expiry": {
        "fr": "Ce code expire dans {expiry_minutes} minutes.",
        "en": "This code expires in {expiry_minutes} minutes.",
    },
    "magic_code.ignore": {
        "fr": "Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email en toute sécurité.",
        "en": "If you didn't request this code, you can safely ignore this email.",
    },
    "magic_code.text_body": {
        "fr": "Votre code de connexion {org_name} est : {code}. Ce code expire dans {expiry_minutes} minutes.",
        "en": "Your {org_name} login code is: {code}. This code expires in {expiry_minutes} minutes.",
    },

    # ─── invite.html ────────────────────────────────────────────────────
    "invite.subject": {
        "fr": "Vous êtes invité à rejoindre {org_name}",
        "en": "You've been invited to join {org_name}",
    },
    "invite.heading": {
        "fr": "Vous êtes invité !",
        "en": "You're invited!",
    },
    "invite.intro": {
        "fr": "{inviter_name} vous a invité à rejoindre {org_name}.",
        "en": "{inviter_name} has invited you to join {org_name}.",
    },
    "invite.team": {
        "fr": "Vous rejoindrez l'équipe {team_name}.",
        "en": "You'll be joining the {team_name} team.",
    },
    "invite.button": {
        "fr": "Accepter l'invitation",
        "en": "Accept Invitation",
    },
    "invite.expiry": {
        "fr": "Cette invitation expire dans {expiry_days} jours.",
        "en": "This invitation expires in {expiry_days} days.",
    },
    "invite.ignore": {
        "fr": "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.",
        "en": "If you didn't expect this invitation, you can ignore this email.",
    },
    "invite.text_body": {
        "fr": "{inviter_name} vous a invité à rejoindre {org_name}. Acceptez ici : {invite_link}",
        "en": "{inviter_name} has invited you to join {org_name}. Accept here: {invite_link}",
    },

    # ─── mention.html ───────────────────────────────────────────────────
    "mention.subject": {
        "fr": "{mentioner_name} vous a mentionné sur {asset_name}",
        "en": "{mentioner_name} mentioned you on {asset_name}",
    },
    "mention.heading": {
        "fr": "Vous avez été mentionné",
        "en": "You were mentioned",
    },
    "mention.intro": {
        "fr": "{mentioner_name} vous a mentionné dans un commentaire sur {asset_name} :",
        "en": "{mentioner_name} mentioned you in a comment on {asset_name}:",
    },
    "mention.button": {
        "fr": "Voir le commentaire",
        "en": "View Comment",
    },
    "mention.text_body": {
        "fr": "{mentioner_name} vous a mentionné sur {asset_name} : {comment_preview}\n\nVoir : {asset_link}",
        "en": "{mentioner_name} mentioned you on {asset_name}: {comment_preview}\n\nView: {asset_link}",
    },

    # ─── comment.html ───────────────────────────────────────────────────
    "comment.subject": {
        "fr": "Nouveau commentaire sur {asset_name}",
        "en": "New comment on {asset_name}",
    },
    "comment.heading": {
        "fr": "Nouveau commentaire sur {asset_name}",
        "en": "New comment on {asset_name}",
    },
    "comment.intro": {
        "fr": "{commenter_name} a commenté :",
        "en": "{commenter_name} commented:",
    },
    "comment.button": {
        "fr": "Voir le commentaire",
        "en": "View Comment",
    },
    "comment.text_body": {
        "fr": "{commenter_name} a commenté sur {asset_name} : {comment_preview}\n\nVoir : {asset_link}",
        "en": "{commenter_name} commented on {asset_name}: {comment_preview}\n\nView: {asset_link}",
    },

    # ─── assignment.html ────────────────────────────────────────────────
    "assignment.subject": {
        "fr": "Vous avez été assigné pour réviser {asset_name}{due_text}",
        "en": "You've been assigned to review {asset_name}{due_text}",
    },
    "assignment.subject_due": {
        "fr": " (à rendre le {due_date})",
        "en": " (due {due_date})",
    },
    "assignment.heading": {
        "fr": "Nouvelle affectation",
        "en": "New Assignment",
    },
    "assignment.intro": {
        "fr": "{assigner_name} vous a assigné pour réviser {asset_name}.",
        "en": "{assigner_name} has assigned you to review {asset_name}.",
    },
    "assignment.due_label": {
        "fr": "Date limite :",
        "en": "Due date:",
    },
    "assignment.project_label": {
        "fr": "Projet :",
        "en": "Project:",
    },
    "assignment.button": {
        "fr": "Réviser le média",
        "en": "Review Asset",
    },
    "assignment.text_body": {
        "fr": "{assigner_name} vous a assigné pour réviser {asset_name}.{due_suffix}\n\nVoir : {asset_link}",
        "en": "{assigner_name} assigned you to review {asset_name}.{due_suffix}\n\nView: {asset_link}",
    },
    "assignment.text_due_suffix": {
        "fr": " Date limite : {due_date}",
        "en": " Due: {due_date}",
    },

    # ─── share.html ─────────────────────────────────────────────────────
    "share.subject": {
        "fr": "{sharer_name} a partagé {asset_name} avec vous",
        "en": "{sharer_name} shared {asset_name} with you",
    },
    "share.heading": {
        "fr": "{sharer_name} a partagé « {asset_name} » avec vous",
        "en": "{sharer_name} shared \"{asset_name}\" with you",
    },
    "share.intro": {
        "fr": "Merci de laisser vos commentaires et remarques dans {org_name}.",
        "en": "Please leave your comments and notes in {org_name}.",
    },
    "share.button": {
        "fr": "Réviser maintenant",
        "en": "Review Now",
    },
    "share.footer_reason": {
        "fr": "Vous recevez cet email car {sharer_name} vous a invité à réviser du contenu sur {org_name}. Si vous ne reconnaissez pas cet email, vérifiez son origine avant d'accepter l'invitation.",
        "en": "You have received this email because {sharer_name} invited you to review content on {org_name}. If you don't recognize this email, please verify before accepting the invitation.",
    },
    "share.footer_permission": {
        "fr": "Les créateurs de liens de partage peuvent voir quand vous avez consulté ou téléchargé des médias.",
        "en": "Share link creators may be able to see when you've viewed or downloaded assets.",
    },
    "share.text_body": {
        "fr": "{sharer_name} a partagé {asset_name} avec vous.\n\nVoir : {asset_link}",
        "en": "{sharer_name} shared {asset_name} with you.\n\nView: {asset_link}",
    },

    # ─── approval.html ──────────────────────────────────────────────────
    "approval.subject": {
        "fr": "{status_emoji} {asset_name} a été {status}",
        "en": "{status_emoji} {asset_name} has been {status}",
    },
    "approval.heading": {
        "fr": "{asset_name} a été {status}",
        "en": "{asset_name} has been {status}",
    },
    "approval.intro": {
        "fr": "{reviewer_name} a {status} votre média.",
        "en": "{reviewer_name} has {status} your asset.",
    },
    "approval.note_label": {
        "fr": "Note :",
        "en": "Note:",
    },
    "approval.button": {
        "fr": "Voir le média",
        "en": "View Asset",
    },
    "approval.text_body": {
        "fr": "{reviewer_name} a {status} {asset_name}.{note_suffix}\n\nVoir : {asset_link}",
        "en": "{reviewer_name} {status} {asset_name}.{note_suffix}\n\nView: {asset_link}",
    },
    "approval.text_note_suffix": {
        "fr": " Note : {note}",
        "en": " Note: {note}",
    },
    "status.approved": {
        "fr": "approuvé",
        "en": "approved",
    },
    "status.rejected": {
        "fr": "rejeté",
        "en": "rejected",
    },

    # ─── project_added.html ─────────────────────────────────────────────
    "project_added.subject": {
        "fr": "Vous avez été ajouté à {project_name}",
        "en": "You've been added to {project_name}",
    },
    "project_added.heading": {
        "fr": "Vous avez été ajouté à un projet",
        "en": "You've been added to a project",
    },
    "project_added.intro": {
        "fr": "{adder_name} vous a ajouté au projet {project_name}.",
        "en": "{adder_name} has added you to the project {project_name}.",
    },
    "project_added.role_label": {
        "fr": "Votre rôle :",
        "en": "Your role:",
    },
    "project_added.button": {
        "fr": "Voir le projet",
        "en": "View Project",
    },
    "project_added.text_body": {
        "fr": "{adder_name} vous a ajouté à {project_name}.\n\nVoir : {project_link}",
        "en": "{adder_name} added you to {project_name}.\n\nView: {project_link}",
    },
    "role.owner": {
        "fr": "propriétaire",
        "en": "owner",
    },
    "role.editor": {
        "fr": "éditeur",
        "en": "editor",
    },
    "role.reviewer": {
        "fr": "réviseur",
        "en": "reviewer",
    },
    "role.viewer": {
        "fr": "lecteur",
        "en": "viewer",
    },
}


def t(key: str, locale: str, **kwargs) -> str:
    """Looks up `key` for `locale`, falling back to DEFAULT_LOCALE and then
    the raw key itself (never raises) — an unrecognized key surfaces as a
    visible-but-harmless string in the rendered email rather than a 500,
    the same convention next-intl uses for a missing frontend key."""
    resolved_locale = locale if locale in SUPPORTED_LOCALES else DEFAULT_LOCALE
    entry = EMAIL_STRINGS.get(key)
    if not entry:
        return key
    template = entry.get(resolved_locale) or entry.get(DEFAULT_LOCALE) or entry.get("en") or key
    return template.format(**kwargs) if kwargs else template


def resolve_recipient_locale(user, db: Session) -> str:
    """Fallback chain for who's actually reading this email: their own
    saved preference (User.preferences.locale) -> this instance's default
    (InstanceBranding.default_locale) -> the hardcoded 'fr' floor. `user`
    is Optional[User] but left untyped here to avoid a models import cycle
    with tasks/email_tasks.py; callers pass whatever User row they already
    have (or None — an invite's recipient isn't a User yet)."""
    if user is not None:
        preferences = getattr(user, "preferences", None) or {}
        locale = preferences.get("locale")
        if locale in SUPPORTED_LOCALES:
            return locale

    from ..models.instance_branding import InstanceBranding

    branding = db.query(InstanceBranding).first()
    if branding and branding.default_locale in SUPPORTED_LOCALES:
        return branding.default_locale

    return DEFAULT_LOCALE
