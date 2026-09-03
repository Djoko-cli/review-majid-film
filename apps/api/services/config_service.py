"""Resolves and updates instance-config variables (Settings > Admin > Config).

Effective value per catalog entry = DB override (apps.api.models.config_override.
ConfigOverride) if one exists, else apps.api.config.settings' env-resolved
default — additive, an instance that never opens the admin screen behaves
exactly as it does today. Saving an override also mutates the shared
`settings` singleton in place (apply_overrides_to_settings): every existing
module that already does `from ..config import settings` and reads
`settings.X` fresh (oidc_service, email_service, storage, cleanup_tasks, ...)
picks up the change immediately, with zero changes to those call sites.
"""
import logging
from sqlalchemy.orm import Session
from cryptography.fernet import InvalidToken

from ..config import settings
from ..core.errors import AppHTTPException
from ..core.config_catalog import CATALOG, BY_KEY, ConfigType, ConfigEntry
from ..models.config_override import ConfigOverride
from ..schemas.instance_config import ConfigFieldOut, ConfigFieldIn
from .crypto_service import encrypt_password, decrypt_password

log = logging.getLogger("config_service")

# The env-resolved value of every catalog attribute, captured once on this
# process's first call to apply_overrides_to_settings — i.e. before any DB
# override has ever been applied to the shared `settings` singleton in this
# process. Needed because clearing an override must restore the original
# .env-resolved value, not just skip mutating settings.<attr> (which would
# leave it stuck at whatever the last override set it to).
_ENV_DEFAULTS: dict[str, object] | None = None


def _capture_env_defaults() -> dict[str, object]:
    global _ENV_DEFAULTS
    if _ENV_DEFAULTS is None:
        _ENV_DEFAULTS = {entry.key: getattr(settings, entry.attr) for entry in CATALOG}
    return _ENV_DEFAULTS


def _deserialize(entry: ConfigEntry, raw: str):
    if entry.type == ConfigType.boolean:
        return raw == "true"
    if entry.type in (ConfigType.number, ConfigType.filesize):
        return int(raw)
    return raw


def _validate_and_serialize(entry: ConfigEntry, value) -> str | None:
    """Returns the canonical string to store, or None meaning "clear the
    override" (blank/missing value — never stored as a literal NULL, see
    ConfigOverride's own docstring)."""
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None

    if entry.type == ConfigType.boolean:
        if not isinstance(value, bool):
            raise AppHTTPException(400, code="invalid_config_value", message=f"{entry.key} must be a boolean", key=entry.key)
        return "true" if value else "false"

    if entry.type in (ConfigType.number, ConfigType.filesize):
        if isinstance(value, bool):  # bool is an int subclass in Python — exclude explicitly
            raise AppHTTPException(400, code="invalid_config_value", message=f"{entry.key} must be a number", key=entry.key)
        if isinstance(value, int):
            return str(value)
        if isinstance(value, str) and value.strip().lstrip("-").isdigit():
            return str(int(value.strip()))
        raise AppHTTPException(400, code="invalid_config_value", message=f"{entry.key} must be a number", key=entry.key)

    if entry.type == ConfigType.enum:
        if not isinstance(value, str) or value not in (entry.choices or ()):
            raise AppHTTPException(
                400, code="invalid_config_choice",
                message=f"{entry.key} must be one of: {', '.join(entry.choices or ())}",
                key=entry.key, choices=", ".join(entry.choices or ()),
            )
        return value

    if not isinstance(value, str):
        raise AppHTTPException(400, code="invalid_config_value", message=f"{entry.key} must be a string", key=entry.key)
    return value.strip()


def get_effective_fields(db: Session) -> list[ConfigFieldOut]:
    rows = {(r.category, r.name): r for r in db.query(ConfigOverride).all()}
    out: list[ConfigFieldOut] = []
    for entry in CATALOG:
        row = rows.get((entry.category, entry.name))
        if row is not None:
            is_overridden = True
            raw: str | None = row.value
            if entry.obscured:
                try:
                    raw = decrypt_password(raw)
                except InvalidToken:
                    # JWT_SECRET rotated since this was saved — the field is
                    # still "overridden" (a row exists), just unreadable.
                    # Never 500 the whole screen over one stale secret.
                    raw = None
            value = None
            if raw is not None:
                try:
                    value = _deserialize(entry, raw)
                except (ValueError, TypeError):
                    value = None
        else:
            is_overridden = False
            value = getattr(settings, entry.attr)
        out.append(ConfigFieldOut(
            category=entry.category,
            name=entry.name,
            key=entry.key,
            type=entry.type.value,
            value=value,
            is_overridden=is_overridden,
            obscured=entry.obscured,
            locked=entry.locked,
            choices=list(entry.choices) if entry.choices else None,
        ))
    return out


def apply_overrides_to_settings(db: Session) -> None:
    """Mutates the shared `settings` singleton in place from current DB
    overrides. Call at process boot (API lifespan, Celery task before_start)
    and synchronously after every save, in the same process that just wrote
    — a long-lived process never re-reads the DB on its own otherwise."""
    env_defaults = _capture_env_defaults()
    rows = db.query(ConfigOverride).all()
    by_key = {(r.category, r.name): r for r in rows}
    for entry in CATALOG:
        row = by_key.get((entry.category, entry.name))
        if row is None:
            # No override (never set, or just cleared) — restore the
            # original env-resolved value rather than leaving settings.<attr>
            # stuck at whatever a previous override last set it to.
            setattr(settings, entry.attr, env_defaults[entry.key])
            continue
        raw = row.value
        if entry.obscured:
            try:
                raw = decrypt_password(raw)
            except InvalidToken:
                log.warning("Could not decrypt obscured config %s — leaving settings.%s unchanged", entry.key, entry.attr)
                continue
        try:
            value = _deserialize(entry, raw)
        except (ValueError, TypeError):
            log.warning("Stored value for config %s doesn't match its type — leaving settings.%s unchanged", entry.key, entry.attr)
            continue
        setattr(settings, entry.attr, value)


def save_overrides(db: Session, items: list[ConfigFieldIn]) -> None:
    """All-or-nothing: every item is validated before anything is written."""
    to_apply: list[tuple[ConfigEntry, str | None]] = []
    for item in items:
        entry = BY_KEY.get(item.key)
        if entry is None:
            raise AppHTTPException(400, code="unknown_config_key", message=f"Unknown config key: {item.key}", key=item.key)
        if entry.locked:
            raise AppHTTPException(403, code="config_field_locked", message=f"Config field is locked: {item.key}", key=item.key)
        to_apply.append((entry, _validate_and_serialize(entry, item.value)))

    touched_oidc = False
    for entry, serialized in to_apply:
        row = db.query(ConfigOverride).filter(
            ConfigOverride.category == entry.category, ConfigOverride.name == entry.name,
        ).first()
        if serialized is None:
            if row is not None:
                db.delete(row)
        else:
            stored = encrypt_password(serialized) if entry.obscured else serialized
            if row is not None:
                row.value = stored
            else:
                db.add(ConfigOverride(category=entry.category, name=entry.name, value=stored))
        if entry.category == "oidc":
            touched_oidc = True

    db.commit()
    apply_overrides_to_settings(db)
    if touched_oidc:
        from .oidc_service import reset_discovery_cache
        reset_discovery_cache()
