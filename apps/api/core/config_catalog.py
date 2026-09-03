"""Static catalog of instance-config variables editable via the admin console
(Settings > Admin > Config), additive to the existing .env + apps.api.config.
Settings resolution — nothing here changes what .env-only deployments do.

Pure data, no DB/service imports (mirrors errors.py being the other lone file
in this package). `attr` names the apps.api.config.settings attribute each
entry overrides — see services/config_service.py for the actual DB-override
resolution and apply_overrides_to_settings().

Deliberately excluded (stay env-only, never surfaced here): database_url,
redis_url, jwt_secret, jwt_algorithm (infra/security bootstrap, read before
the DB is reliably reachable); s3_* (unproven live-safety, high blast radius
if changed under an in-flight upload); cors_allow_origins, frontend_url
(built once at FastAPI startup, a security boundary); transcoder_engine
(dead — nothing reads it, only one concrete transcoder class exists);
transcoding_concurrency/email_concurrency (dead in Python — the real control
is docker-compose's Celery `-c` command-line flag, baked in at container
start; making these actually live would need a `celery worker --autoscale`
re-architecture, out of scope — a visible-but-inert field would be worse
than no field at all); majidfilm_source_root/brand_sync_enabled (personal
NAS-sync config, low value, not blocking).
"""
from dataclasses import dataclass
from enum import Enum


class ConfigType(str, Enum):
    string = "string"
    number = "number"
    boolean = "boolean"
    filesize = "filesize"
    enum = "enum"


@dataclass(frozen=True)
class ConfigEntry:
    category: str
    name: str
    attr: str  # attribute name on apps.api.config.settings
    type: ConfigType
    obscured: bool = False
    locked: bool = False
    choices: tuple[str, ...] | None = None
    order: int = 0

    @property
    def key(self) -> str:
        return f"{self.category}.{self.name}"


CATALOG: list[ConfigEntry] = [
    ConfigEntry("auth", "magic_link_enabled", "magic_link_enabled", ConfigType.boolean, order=0),
    ConfigEntry("auth", "access_token_expire_minutes", "access_token_expire_minutes", ConfigType.number, order=1),
    ConfigEntry("auth", "refresh_token_expire_days", "refresh_token_expire_days", ConfigType.number, order=2),

    ConfigEntry("oidc", "enabled", "oidc_enabled", ConfigType.boolean, order=0),
    ConfigEntry("oidc", "provider_label", "oidc_provider_label", ConfigType.string, order=1),
    ConfigEntry("oidc", "discovery_url", "oidc_discovery_url", ConfigType.string, order=2),
    ConfigEntry("oidc", "client_id", "oidc_client_id", ConfigType.string, order=3),
    ConfigEntry("oidc", "client_secret", "oidc_client_secret", ConfigType.string, obscured=True, order=4),
    ConfigEntry("oidc", "redirect_uri", "oidc_redirect_uri", ConfigType.string, order=5),
    ConfigEntry("oidc", "scope", "oidc_scope", ConfigType.string, order=6),

    ConfigEntry("email", "provider", "mail_provider", ConfigType.enum, choices=("ses", "smtp"), order=0),
    ConfigEntry("email", "from_address", "mail_from_address", ConfigType.string, order=1),
    ConfigEntry("email", "from_name", "mail_from_name", ConfigType.string, order=2),
    ConfigEntry("email", "aws_access_key_id", "aws_mail_access_key_id", ConfigType.string, order=3),
    ConfigEntry("email", "aws_secret_access_key", "aws_mail_secret_access_key", ConfigType.string, obscured=True, order=4),
    ConfigEntry("email", "aws_region", "aws_mail_region", ConfigType.string, order=5),
    ConfigEntry("email", "smtp_host", "smtp_host", ConfigType.string, order=6),
    ConfigEntry("email", "smtp_port", "smtp_port", ConfigType.number, order=7),
    ConfigEntry("email", "smtp_user", "smtp_user", ConfigType.string, order=8),
    ConfigEntry("email", "smtp_password", "smtp_password", ConfigType.string, obscured=True, order=9),
    ConfigEntry("email", "smtp_use_tls", "smtp_use_tls", ConfigType.boolean, order=10),

    ConfigEntry("uploads_retention", "max_upload_bytes", "max_upload_bytes", ConfigType.filesize, order=0),
    ConfigEntry("uploads_retention", "stale_upload_timeout_hours", "stale_upload_timeout_hours", ConfigType.number, order=1),
    ConfigEntry("uploads_retention", "stuck_processing_timeout_hours", "stuck_processing_timeout_hours", ConfigType.number, order=2),
    ConfigEntry("uploads_retention", "soft_delete_retention_days", "soft_delete_retention_days", ConfigType.number, order=3),
    ConfigEntry("uploads_retention", "orphan_sweep_grace_hours", "orphan_sweep_grace_hours", ConfigType.number, order=4),
    ConfigEntry("uploads_retention", "orphan_sweep_delete", "orphan_sweep_delete", ConfigType.boolean, order=5),

    ConfigEntry("transcoder", "pipeline", "transcoder_pipeline", ConfigType.enum, choices=("Auto", "NVIDIA", "Intel", "Software"), order=0),
    ConfigEntry("transcoder", "output", "transcoder_output", ConfigType.enum, choices=("h264_8", "h265_10"), order=1),
    ConfigEntry("transcoder", "hdr", "transcoder_hdr", ConfigType.enum, choices=("convert", "preserve"), order=2),
]

BY_KEY: dict[str, ConfigEntry] = {e.key: e for e in CATALOG}

# Fixed display order — not derived from CATALOG's own ordering so a future
# insertion doesn't silently reshuffle the admin UI's category tabs.
CATEGORIES: list[str] = ["auth", "oidc", "email", "uploads_retention", "transcoder"]
