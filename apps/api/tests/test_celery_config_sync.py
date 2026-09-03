"""_ConfigSyncTask.before_start re-syncs admin-config DB overrides into this
worker process's own `settings` singleton before every task body runs (see
config_service.apply_overrides_to_settings's docstring — a worker is a
separate process from the API, with its own copy of that object). Must
never raise: a DB hiccup here must not fail every task in the fleet."""
from unittest.mock import MagicMock, patch

from apps.api.tasks.celery_app import celery_app, _ConfigSyncTask


def test_celery_app_uses_config_sync_task_class():
    # Celery wraps the passed task_cls in its own app-bound subclass, so
    # celery_app.Task is never literally _ConfigSyncTask — confirm it's
    # actually in the bases, i.e. task_cls= really took effect.
    assert issubclass(celery_app.Task, _ConfigSyncTask)


def test_before_start_syncs_config_from_a_fresh_db_session():
    task = _ConfigSyncTask()
    task.name = "some.task"
    fake_db = MagicMock()
    with patch("apps.api.database.SessionLocal", return_value=fake_db), \
         patch("apps.api.services.config_service.apply_overrides_to_settings") as apply_mock:
        task.before_start("task-id", (), {})
    apply_mock.assert_called_once_with(fake_db)
    fake_db.close.assert_called_once()


def test_before_start_never_raises_when_the_db_is_unreachable():
    task = _ConfigSyncTask()
    task.name = "some.task"
    with patch("apps.api.database.SessionLocal", side_effect=RuntimeError("db down")):
        task.before_start("task-id", (), {})  # must not raise


def test_before_start_never_raises_when_sync_itself_fails():
    task = _ConfigSyncTask()
    task.name = "some.task"
    fake_db = MagicMock()
    with patch("apps.api.database.SessionLocal", return_value=fake_db), \
         patch("apps.api.services.config_service.apply_overrides_to_settings", side_effect=RuntimeError("boom")):
        task.before_start("task-id", (), {})  # must not raise
    fake_db.close.assert_called_once()  # still cleaned up despite the failure
