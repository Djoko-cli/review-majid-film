"""Tests for the instance-config admin console: model shape, catalog,
config_service's validation/coercion/resolution, and the router's
admin-gating and all-or-nothing save behavior."""
import pytest
from unittest.mock import MagicMock
from cryptography.fernet import InvalidToken

from apps.api.models.config_override import ConfigOverride
from apps.api.core.config_catalog import CATALOG, BY_KEY, ConfigType
from apps.api.core.errors import AppHTTPException
from apps.api.schemas.instance_config import ConfigFieldIn
from apps.api.services import config_service
from apps.api.config import settings


def test_configs_table_shape():
    cols = ConfigOverride.__table__.columns
    assert ConfigOverride.__tablename__ == "configs"
    assert "value" in cols
    assert cols["value"].nullable is False  # a row is always an explicit override, never NULL


def test_catalog_keys_are_unique():
    keys = [e.key for e in CATALOG]
    assert len(keys) == len(set(keys))


def test_catalog_by_key_matches_catalog():
    assert len(BY_KEY) == len(CATALOG)
    for entry in CATALOG:
        assert BY_KEY[entry.key] is entry


def test_catalog_enum_entries_have_choices():
    for entry in CATALOG:
        if entry.type == ConfigType.enum:
            assert entry.choices, f"{entry.key} is type enum but has no choices"


# ─── _validate_and_serialize (pure, no DB) ──────────────────────────────

def test_validate_boolean_ok():
    entry = BY_KEY["auth.magic_link_enabled"]
    assert config_service._validate_and_serialize(entry, True) == "true"
    assert config_service._validate_and_serialize(entry, False) == "false"


def test_validate_boolean_rejects_non_bool():
    entry = BY_KEY["auth.magic_link_enabled"]
    with pytest.raises(AppHTTPException) as exc:
        config_service._validate_and_serialize(entry, "true")
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "invalid_config_value"


def test_validate_number_ok():
    entry = BY_KEY["auth.access_token_expire_minutes"]
    assert config_service._validate_and_serialize(entry, 30) == "30"


def test_validate_number_rejects_bool():
    # bool is an int subclass in Python — must be rejected explicitly, not silently
    # coerced to 0/1.
    entry = BY_KEY["auth.access_token_expire_minutes"]
    with pytest.raises(AppHTTPException):
        config_service._validate_and_serialize(entry, True)


def test_validate_enum_rejects_value_outside_choices():
    entry = BY_KEY["email.provider"]
    with pytest.raises(AppHTTPException) as exc:
        config_service._validate_and_serialize(entry, "mailgun")
    assert exc.value.detail["code"] == "invalid_config_choice"


def test_validate_enum_accepts_choice():
    entry = BY_KEY["email.provider"]
    assert config_service._validate_and_serialize(entry, "smtp") == "smtp"


@pytest.mark.parametrize("blank", [None, "", "   "])
def test_validate_blank_clears_override(blank):
    entry = BY_KEY["oidc.client_id"]
    assert config_service._validate_and_serialize(entry, blank) is None


def test_validate_string_strips_whitespace():
    entry = BY_KEY["oidc.discovery_url"]
    assert config_service._validate_and_serialize(entry, "  https://id.example.com  ") == "https://id.example.com"


# ─── get_effective_fields / apply_overrides_to_settings ─────────────────

def _row(category: str, name: str, value: str) -> MagicMock:
    r = MagicMock()
    r.category = category
    r.name = name
    r.value = value
    return r


def test_get_effective_fields_no_overrides_uses_settings_defaults(mock_db):
    mock_db.all.return_value = []
    fields = config_service.get_effective_fields(mock_db)
    assert len(fields) == len(CATALOG)
    by_key = {f.key: f for f in fields}
    assert by_key["auth.magic_link_enabled"].is_overridden is False
    assert by_key["auth.magic_link_enabled"].value == settings.magic_link_enabled


def test_get_effective_fields_override_wins(mock_db):
    mock_db.all.return_value = [_row("auth", "magic_link_enabled", "false")]
    fields = config_service.get_effective_fields(mock_db)
    by_key = {f.key: f for f in fields}
    assert by_key["auth.magic_link_enabled"].is_overridden is True
    assert by_key["auth.magic_link_enabled"].value is False


def test_get_effective_fields_obscured_field_round_trips(mock_db):
    from apps.api.services.crypto_service import encrypt_password
    mock_db.all.return_value = [_row("oidc", "client_secret", encrypt_password("s3cr3t"))]
    fields = config_service.get_effective_fields(mock_db)
    by_key = {f.key: f for f in fields}
    assert by_key["oidc.client_secret"].value == "s3cr3t"
    assert by_key["oidc.client_secret"].obscured is True


def test_get_effective_fields_undecryptable_secret_is_none_not_500(mock_db, monkeypatch):
    # Simulates JWT_SECRET having rotated since this row was written — must
    # degrade to a blank field, never raise (would 500 the whole screen over
    # one stale secret alongside every unrelated field).
    monkeypatch.setattr(config_service, "decrypt_password", MagicMock(side_effect=InvalidToken))
    mock_db.all.return_value = [_row("oidc", "client_secret", "not-decryptable")]
    fields = config_service.get_effective_fields(mock_db)
    by_key = {f.key: f for f in fields}
    assert by_key["oidc.client_secret"].is_overridden is True
    assert by_key["oidc.client_secret"].value is None


def test_apply_overrides_to_settings_mutates_shared_singleton(mock_db, monkeypatch):
    monkeypatch.setattr(settings, "oidc_provider_label", "Pocket ID")
    mock_db.all.return_value = [_row("oidc", "provider_label", "Custom Label")]
    config_service.apply_overrides_to_settings(mock_db)
    assert settings.oidc_provider_label == "Custom Label"


def test_apply_overrides_to_settings_restores_env_default_when_override_cleared(mock_db, monkeypatch):
    """Regression: clearing an override (row deleted) must restore the
    original .env-resolved value, not leave settings.<attr> stuck at
    whatever the last-applied override set it to — apply_overrides_to_settings
    used to just `continue` when no row existed, silently no-op-ing a clear."""
    monkeypatch.setattr(config_service, "_ENV_DEFAULTS", None)  # force a fresh capture
    monkeypatch.setattr(settings, "oidc_enabled", False)  # the true env default

    mock_db.all.return_value = [_row("oidc", "enabled", "true")]
    config_service.apply_overrides_to_settings(mock_db)
    assert settings.oidc_enabled is True  # override applied

    mock_db.all.return_value = []  # override cleared (row deleted)
    config_service.apply_overrides_to_settings(mock_db)
    assert settings.oidc_enabled is False  # back to the real env default, not stuck at True


def test_apply_overrides_to_settings_bad_decrypt_leaves_setting_unchanged(mock_db, monkeypatch):
    monkeypatch.setattr(settings, "oidc_client_secret", "original")
    monkeypatch.setattr(config_service, "decrypt_password", MagicMock(side_effect=InvalidToken))
    mock_db.all.return_value = [_row("oidc", "client_secret", "garbage")]
    config_service.apply_overrides_to_settings(mock_db)  # must not raise
    assert settings.oidc_client_secret == "original"


# ─── save_overrides: all-or-nothing ──────────────────────────────────────

def test_save_overrides_all_or_nothing_writes_nothing_on_one_bad_item(mock_db):
    items = [
        ConfigFieldIn(key="auth.magic_link_enabled", value=False),
        ConfigFieldIn(key="does.not_exist", value="x"),
    ]
    with pytest.raises(AppHTTPException) as exc:
        config_service.save_overrides(mock_db, items)
    assert exc.value.detail["code"] == "unknown_config_key"
    mock_db.add.assert_not_called()
    mock_db.delete.assert_not_called()
    mock_db.commit.assert_not_called()


def test_save_overrides_creates_new_row(mock_db, monkeypatch):
    mock_db.first.return_value = None  # no existing row for this key
    monkeypatch.setattr(config_service, "apply_overrides_to_settings", MagicMock())
    config_service.save_overrides(mock_db, [ConfigFieldIn(key="auth.magic_link_enabled", value=False)])
    mock_db.add.assert_called_once()
    added = mock_db.add.call_args[0][0]
    assert added.category == "auth"
    assert added.name == "magic_link_enabled"
    assert added.value == "false"
    mock_db.commit.assert_called_once()


def test_save_overrides_encrypts_obscured_values(mock_db, monkeypatch):
    mock_db.first.return_value = None
    monkeypatch.setattr(config_service, "apply_overrides_to_settings", MagicMock())
    config_service.save_overrides(mock_db, [ConfigFieldIn(key="oidc.client_secret", value="s3cr3t")])
    added = mock_db.add.call_args[0][0]
    assert added.value != "s3cr3t"  # stored ciphertext, never plaintext
    from apps.api.services.crypto_service import decrypt_password
    assert decrypt_password(added.value) == "s3cr3t"


def test_save_overrides_blank_deletes_existing_row(mock_db, monkeypatch):
    existing = _row("oidc", "client_id", "abc")
    mock_db.first.return_value = existing
    monkeypatch.setattr(config_service, "apply_overrides_to_settings", MagicMock())
    config_service.save_overrides(mock_db, [ConfigFieldIn(key="oidc.client_id", value="")])
    mock_db.delete.assert_called_once_with(existing)
    mock_db.add.assert_not_called()


def test_save_overrides_resets_oidc_discovery_cache_only_when_oidc_touched(mock_db, monkeypatch):
    mock_db.first.return_value = None
    monkeypatch.setattr(config_service, "apply_overrides_to_settings", MagicMock())
    reset = MagicMock()
    monkeypatch.setattr("apps.api.services.oidc_service.reset_discovery_cache", reset)

    config_service.save_overrides(mock_db, [ConfigFieldIn(key="auth.magic_link_enabled", value=False)])
    reset.assert_not_called()

    config_service.save_overrides(mock_db, [ConfigFieldIn(key="oidc.provider_label", value="X")])
    reset.assert_called_once()


# ─── Router: admin-gating ────────────────────────────────────────────────

def test_get_instance_config_requires_admin(client, auth_headers, mock_db, test_user):
    test_user.is_superadmin = False
    r = client.get("/instance/config", headers=auth_headers)
    assert r.status_code == 403


def test_patch_instance_config_requires_admin(client, auth_headers, mock_db, test_user):
    test_user.is_superadmin = False
    r = client.patch("/instance/config", headers=auth_headers, json={"items": []})
    assert r.status_code == 403


def test_get_instance_config_admin_ok(client, auth_headers, mock_db, test_user):
    test_user.is_superadmin = True
    mock_db.all.return_value = []
    r = client.get("/instance/config", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == len(CATALOG)


def test_patch_instance_config_unknown_key_rejected(client, auth_headers, mock_db, test_user):
    test_user.is_superadmin = True
    r = client.patch(
        "/instance/config", headers=auth_headers,
        json={"items": [{"key": "not.a_real_key", "value": "x"}]},
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "unknown_config_key"
