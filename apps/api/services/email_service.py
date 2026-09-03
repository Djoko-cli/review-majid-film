import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import boto3
from botocore.exceptions import ClientError
from ..config import settings


def mail_is_configured(s=settings) -> bool:
    """Whether the configured mailer can actually send.

    Email is REQUIRED for login (magic codes) and invites, so the app warns at
    startup when it's not set up. `smtp` needs a host; `ses` may authenticate via
    an IAM role, so we can't reliably detect it and assume it's configured.
    """
    provider = (s.mail_provider or "").lower()
    if provider == "smtp":
        return bool(s.smtp_host)
    return provider == "ses"


class EmailService:
    """
    Email service that supports both AWS SES and standard SMTP.
    Auto-detects based on mail_provider setting in config.
    """
    
    @property
    def provider(self) -> str:
        """Resolved per call, not snapshotted at init, so an admin-config
        override (Settings > Admin > Config) takes effect on the next send
        instead of needing a worker restart — same reasoning as from_name."""
        return settings.mail_provider

    @property
    def from_address(self) -> str:
        return settings.mail_from_address

    @property
    def from_name(self) -> str:
        """Display name on the From line of every email.

        MAIL_FROM_NAME wins when an operator has set it. Left unset, this
        follows the instance branding, so a white-labelled instance doesn't
        announce itself as FreeFrame in the recipient's inbox. Resolved per
        send rather than at init so a branding change takes effect without a
        worker restart.
        """
        from .branding_service import resolve_org_name
        return (settings.mail_from_name or "").strip() or resolve_org_name()
    
    def _get_ses_client(self):
        """Create AWS SES client."""
        return boto3.client(
            "ses",
            aws_access_key_id=settings.aws_mail_access_key_id,
            aws_secret_access_key=settings.aws_mail_secret_access_key,
            region_name=settings.aws_mail_region,
        )
    
    def _send_via_ses(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """Send email via AWS SES."""
        if not settings.aws_mail_access_key_id or not settings.aws_mail_secret_access_key:
            raise ValueError("AWS SES credentials not configured")
        
        ses = self._get_ses_client()
        
        body = {"Html": {"Charset": "UTF-8", "Data": html_body}}
        if text_body:
            body["Text"] = {"Charset": "UTF-8", "Data": text_body}
        
        try:
            ses.send_email(
                Source=f"{self.from_name} <{self.from_address}>",
                Destination={"ToAddresses": [to_email]},
                Message={
                    "Subject": {"Charset": "UTF-8", "Data": subject},
                    "Body": body,
                },
            )
            return True
        except ClientError as e:
            print(f"SES error: {e.response['Error']['Message']}")
            return False
    
    def _send_via_smtp(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """Send email via SMTP server."""
        if not settings.smtp_host:
            raise ValueError("SMTP host not configured")
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.from_address}>"
        msg["To"] = to_email
        
        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        try:
            if settings.smtp_use_tls:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)
            
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            
            server.sendmail(self.from_address, [to_email], msg.as_string())
            server.quit()
            return True
        except Exception as e:
            print(f"SMTP error: {e}")
            return False
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send email using configured provider (SES or SMTP).
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML content of the email
            text_body: Optional plain text fallback
            
        Returns:
            True if sent successfully, False otherwise
        """
        if self.provider == "ses":
            return self._send_via_ses(to_email, subject, html_body, text_body)
        elif self.provider == "smtp":
            return self._send_via_smtp(to_email, subject, html_body, text_body)
        else:
            raise ValueError(f"Unknown mail provider: {self.provider}")
    

# Singleton instance
email_service = EmailService()
