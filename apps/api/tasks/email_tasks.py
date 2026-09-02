"""
Celery tasks for sending emails asynchronously.

Queues:
- email_high: Magic codes, invites (immediate)
- email_low: Mentions, comments, shares (can be slightly delayed)
"""
from datetime import datetime
from pathlib import Path
from typing import Optional
from celery import shared_task
from jinja2 import Environment, FileSystemLoader

# Setup Jinja2 template environment
TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=True,
)

from ..services.branding_service import DEFAULT_ORG_NAME, resolve_org_name
from ..services.i18n_service import DEFAULT_LOCALE, t

# Every template calls {{ t('some.key', locale, ...) }} directly — one
# global rather than importing i18n_service in each template (Jinja has no
# import statement of its own).
jinja_env.globals["t"] = t


def render_template(template_name: str, locale: str = DEFAULT_LOCALE, **context) -> str:
    """Render an email template with context."""
    context.setdefault("year", datetime.now().year)
    context.setdefault("locale", locale)
    # base.html brands every email header and footer with the instance name, so
    # it must always be set. Resolving it here rather than in each send function
    # is what makes the six that never passed one (mention, comment, assignment,
    # share, approval, project_added) white-label too.
    if not context.get("org_name"):
        context["org_name"] = resolve_org_name()
    template = jinja_env.get_template(template_name)
    return template.render(**context)


def _send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """Send email using the email service."""
    # Import here to avoid circular imports
    from ..services.email_service import email_service
    return email_service.send_email(to_email, subject, html_body, text_body)


# ============================================================================
# HIGH PRIORITY EMAILS (email_high queue)
# ============================================================================

@shared_task(bind=True, queue="email_high", max_retries=3, default_retry_delay=30)
def send_magic_code_email(self, to_email: str, code: str, expiry_minutes: int = 10, org_name: Optional[str] = None, locale: str = DEFAULT_LOCALE):
    """Send magic code email - high priority, immediate delivery."""
    label = org_name or resolve_org_name()
    try:
        subject = t("magic_code.subject", locale, org_name=label, code=code)
        html_body = render_template(
            "email/magic_code.html",
            locale=locale,
            subject=subject,
            code=code,
            expiry_minutes=expiry_minutes,
            org_name=label,
        )
        text_body = t("magic_code.text_body", locale, org_name=label, code=code, expiry_minutes=expiry_minutes)
        
        success = _send_email(to_email, subject, html_body, text_body)
        if not success:
            raise Exception("Email sending failed")
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        self.retry(exc=exc)


@shared_task(bind=True, queue="email_high", max_retries=3, default_retry_delay=60)
def send_invite_email(
    self,
    to_email: str,
    inviter_name: str,
    org_name: str,
    invite_link: str,
    team_name: Optional[str] = None,
    expiry_days: int = 7,
    locale: str = DEFAULT_LOCALE,
):
    """Send organization/team invite email - high priority."""
    try:
        subject = t("invite.subject", locale, org_name=org_name)
        html_body = render_template(
            "email/invite.html",
            locale=locale,
            subject=subject,
            inviter_name=inviter_name,
            org_name=org_name,
            team_name=team_name,
            invite_link=invite_link,
            expiry_days=expiry_days,
        )
        text_body = t("invite.text_body", locale, inviter_name=inviter_name, org_name=org_name, invite_link=invite_link)
        
        success = _send_email(to_email, subject, html_body, text_body)
        if not success:
            raise Exception("Email sending failed")
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        self.retry(exc=exc)


# ============================================================================
# MEDIUM PRIORITY EMAILS (email_low queue)
# ============================================================================

@shared_task(bind=True, queue="email_low", max_retries=3, default_retry_delay=120)
def send_mention_email(
    self,
    to_email: str,
    mentioner_name: str,
    asset_name: str,
    comment_preview: str,
    asset_link: str,
    locale: str = DEFAULT_LOCALE,
):
    """Send mention notification email."""
    try:
        subject = t("mention.subject", locale, mentioner_name=mentioner_name, asset_name=asset_name)
        html_body = render_template(
            "email/mention.html",
            locale=locale,
            subject=subject,
            mentioner_name=mentioner_name,
            asset_name=asset_name,
            comment_preview=comment_preview,
            asset_link=asset_link,
        )
        text_body = t("mention.text_body", locale, mentioner_name=mentioner_name, asset_name=asset_name, comment_preview=comment_preview, asset_link=asset_link)
        
        success = _send_email(to_email, subject, html_body, text_body)
        if not success:
            raise Exception("Email sending failed")
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        self.retry(exc=exc)


@shared_task(bind=True, queue="email_low", max_retries=3, default_retry_delay=120)
def send_comment_email(
    self,
    to_email: str,
    commenter_name: str,
    asset_name: str,
    comment_preview: str,
    asset_link: str,
    locale: str = DEFAULT_LOCALE,
):
    """Send new comment notification email."""
    try:
        subject = t("comment.subject", locale, asset_name=asset_name)
        html_body = render_template(
            "email/comment.html",
            locale=locale,
            subject=subject,
            commenter_name=commenter_name,
            asset_name=asset_name,
            comment_preview=comment_preview,
            asset_link=asset_link,
        )
        text_body = t("comment.text_body", locale, commenter_name=commenter_name, asset_name=asset_name, comment_preview=comment_preview, asset_link=asset_link)
        
        success = _send_email(to_email, subject, html_body, text_body)
        if not success:
            raise Exception("Email sending failed")
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        self.retry(exc=exc)


@shared_task(bind=True, queue="email_low", max_retries=3, default_retry_delay=120)
def send_assignment_email(
    self,
    to_email: str,
    assigner_name: str,
    asset_name: str,
    asset_link: str,
    due_date: Optional[str] = None,
    project_name: Optional[str] = None,
    locale: str = DEFAULT_LOCALE,
):
    """Send assignment notification email."""
    try:
        due_text = t("assignment.subject_due", locale, due_date=due_date) if due_date else ""
        subject = t("assignment.subject", locale, asset_name=asset_name, due_text=due_text)
        html_body = render_template(
            "email/assignment.html",
            locale=locale,
            subject=subject,
            assigner_name=assigner_name,
            asset_name=asset_name,
            asset_link=asset_link,
            due_date=due_date,
            project_name=project_name,
        )
        due_suffix = t("assignment.text_due_suffix", locale, due_date=due_date) if due_date else ""
        text_body = t("assignment.text_body", locale, assigner_name=assigner_name, asset_name=asset_name, due_suffix=due_suffix, asset_link=asset_link)
        
        success = _send_email(to_email, subject, html_body, text_body)
        if not success:
            raise Exception("Email sending failed")
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        self.retry(exc=exc)


@shared_task(bind=True, queue="email_low", max_retries=3, default_retry_delay=120)
def send_share_email(
    self,
    to_email: str,
    sharer_name: str,
    asset_name: str,
    asset_link: str,
    permission: Optional[str] = None,
    message: Optional[str] = None,
    locale: str = DEFAULT_LOCALE,
):
    """Send asset shared notification email."""
    try:
        subject = t("share.subject", locale, sharer_name=sharer_name, asset_name=asset_name)
        html_body = render_template(
            "email/share.html",
            locale=locale,
            subject=subject,
            sharer_name=sharer_name,
            asset_name=asset_name,
            asset_link=asset_link,
            permission=permission,
            message=message,
        )
        text_body = t("share.text_body", locale, sharer_name=sharer_name, asset_name=asset_name, asset_link=asset_link)
        
        success = _send_email(to_email, subject, html_body, text_body)
        if not success:
            raise Exception("Email sending failed")
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        self.retry(exc=exc)


@shared_task(bind=True, queue="email_low", max_retries=3, default_retry_delay=120)
def send_approval_email(
    self,
    to_email: str,
    reviewer_name: str,
    asset_name: str,
    status: str,  # "approved" or "rejected"
    asset_link: str,
    note: Optional[str] = None,
    locale: str = DEFAULT_LOCALE,
):
    """Send approval/rejection notification email."""
    try:
        status_emoji = "✅" if status == "approved" else "❌"
        status_label = t(f"status.{status}", locale)
        subject = t("approval.subject", locale, status_emoji=status_emoji, asset_name=asset_name, status=status_label)
        html_body = render_template(
            "email/approval.html",
            locale=locale,
            subject=subject,
            reviewer_name=reviewer_name,
            asset_name=asset_name,
            status=status,
            asset_link=asset_link,
            note=note,
        )
        note_suffix = t("approval.text_note_suffix", locale, note=note) if note else ""
        text_body = t("approval.text_body", locale, reviewer_name=reviewer_name, status=status_label, asset_name=asset_name, note_suffix=note_suffix, asset_link=asset_link)
        
        success = _send_email(to_email, subject, html_body, text_body)
        if not success:
            raise Exception("Email sending failed")
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        self.retry(exc=exc)


@shared_task(bind=True, queue="email_low", max_retries=3, default_retry_delay=120)
def send_project_added_email(
    self,
    to_email: str,
    adder_name: str,
    project_name: str,
    project_link: str,
    org_name: Optional[str] = None,
    role: Optional[str] = None,
    locale: str = DEFAULT_LOCALE,
):
    """Send project added notification email."""
    try:
        subject = t("project_added.subject", locale, project_name=project_name)
        html_body = render_template(
            "email/project_added.html",
            locale=locale,
            subject=subject,
            adder_name=adder_name,
            project_name=project_name,
            project_link=project_link,
            org_name=org_name,
            role=role,
        )
        text_body = t("project_added.text_body", locale, adder_name=adder_name, project_name=project_name, project_link=project_link)
        
        success = _send_email(to_email, subject, html_body, text_body)
        if not success:
            raise Exception("Email sending failed")
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        self.retry(exc=exc)
