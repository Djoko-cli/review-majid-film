import logging
from celery import Celery, Task
from celery.schedules import crontab
from kombu import Queue
from kombu.exceptions import OperationalError

try:
    from ..config import settings
except ImportError:
    from config import settings

_config_sync_logger = logging.getLogger("celery.config_sync")


class _ConfigSyncTask(Task):
    """Runs before every task body, in every worker process.

    A worker is a separate Python process from the API, with its own
    `apps.api.config.settings` singleton — it never sees the API's in-place
    mutation of that object on save. Re-syncing here before each task keeps
    it current, mirroring how the cleanup tasks already re-read their own
    thresholds fresh on every run rather than once at worker boot (see
    tasks/cleanup_tasks.py).

    Safe under the default `prefork` pool every worker `command:` in
    docker-compose.*.yml uses (no --pool= flag anywhere): a prefork child
    runs one task at a time to completion, so mutating the shared `settings`
    object here can never race with an in-flight task's own reads of it. If
    a worker is ever switched to a threaded/eventlet/gevent pool, concurrent
    tasks in the same process COULD interleave with this — revisit first.

    Must never raise: `before_start` raising marks the task failed before
    `run()` even executes, so a transient DB hiccup here must not fail every
    task in the fleet — same reasoning as main.py's own boot-time sync.
    """
    def before_start(self, task_id, args, kwargs):
        try:
            db = None
            try:
                from ..database import SessionLocal
            except ImportError:
                from database import SessionLocal
            try:
                from ..services.config_service import apply_overrides_to_settings
            except ImportError:
                from services.config_service import apply_overrides_to_settings
            db = SessionLocal()
            apply_overrides_to_settings(db)
        except Exception as e:
            _config_sync_logger.warning("Could not sync config overrides before task %s: %s", self.name, e)
        finally:
            if db is not None:
                db.close()
        super().before_start(task_id, args, kwargs)


celery_app = Celery(
    "freeframe",
    broker=settings.redis_url,
    backend=settings.redis_url,
    task_cls=_ConfigSyncTask,
    include=[
        "apps.api.tasks.transcode_tasks",
        "apps.api.tasks.watermark_tasks",
        "apps.api.tasks.reminder_tasks",
        "apps.api.tasks.email_tasks",
        "apps.api.tasks.cleanup_tasks",
        "apps.api.tasks.brand_sync_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=5,
    broker_pool_limit=0,  # Disable connection pooling in web process to avoid stale connections
    # Define queues
    task_queues=(
        Queue("default"),
        Queue("transcoding"),
        Queue("email_high"),   # Magic codes, invites - immediate
        Queue("email_low"),    # Mentions, comments - can be delayed
        Queue("maintenance"),  # Housekeeping - long, I/O heavy, latency-insensitive
    ),
    task_default_queue="default",
    # Route tasks to queues.
    #
    # NOTE: the housekeeping tasks below register under bare names
    # (@celery_app.task(name="reap_stale_uploads")), not dotted module paths,
    # so a glob like "apps.api.tasks.cleanup_tasks.*" would never match them.
    # Route them by their bare name. See test_celery_queue_topology.py.
    task_routes={
        "apps.api.tasks.transcode_tasks.*": {"queue": "transcoding"},
        "reap_stale_uploads": {"queue": "maintenance"},
        "send_due_date_reminders": {"queue": "maintenance"},
        "cleanup_soft_deleted": {"queue": "maintenance"},
        "requeue_stuck_processing": {"queue": "maintenance"},
        "sweep_orphan_s3": {"queue": "maintenance"},
        "sync_brand_slides": {"queue": "maintenance"},
        # Not housekeeping: this one is dispatched from a request handler and
        # is a full FFmpeg re-encode, so it belongs with the other transcoding
        # work rather than behind an hour-long bucket sweep.
        "apply_watermark": {"queue": "transcoding"},
        "apps.api.tasks.email_tasks.send_magic_code_email": {"queue": "email_high"},
        "apps.api.tasks.email_tasks.send_invite_email": {"queue": "email_high"},
        "apps.api.tasks.email_tasks.send_mention_email": {"queue": "email_low"},
        "apps.api.tasks.email_tasks.send_comment_email": {"queue": "email_low"},
        "apps.api.tasks.email_tasks.send_assignment_email": {"queue": "email_low"},
        "apps.api.tasks.email_tasks.send_share_email": {"queue": "email_low"},
        "apps.api.tasks.email_tasks.send_approval_email": {"queue": "email_low"},
        "apps.api.tasks.email_tasks.send_project_added_email": {"queue": "email_low"},
    },
    # Rate limiting for email queues (SES limits)
    task_annotations={
        "apps.api.tasks.email_tasks.*": {"rate_limit": "10/s"},  # 10 emails per second
    },
)

celery_app.conf.beat_schedule = {
    "due-date-reminders": {
        "task": "send_due_date_reminders",
        "schedule": crontab(minute="0"),  # every hour
    },
    "reap-stale-uploads": {
        "task": "reap_stale_uploads",
        "schedule": crontab(minute="0"),  # every hour
    },
    "requeue-stuck-processing": {
        "task": "requeue_stuck_processing",
        "schedule": crontab(minute="30"),  # every hour, offset from the reaper
    },
    "cleanup-soft-deleted": {
        "task": "cleanup_soft_deleted",
        "schedule": crontab(minute=0, hour=3),  # daily at 03:00 UTC
    },
    "sweep-orphan-s3": {
        "task": "sweep_orphan_s3",
        "schedule": crontab(minute=0, hour=4, day_of_week=0),  # weekly, Sunday 04:00 UTC
    },
    "sync-brand-slides": {
        "task": "sync_brand_slides",
        "schedule": crontab(minute=0, hour=2),  # daily at 02:00 UTC — before the 03:00/04:00 cleanup tasks
    },
}


import threading
import logging

_task_logger = logging.getLogger("celery.dispatch")


def _dispatch_task(task, args, kwargs):
    """Actually send the task to Celery broker (runs in background thread)."""
    try:
        task.delay(*args, **kwargs)
    except (OperationalError, ConnectionError, OSError):
        try:
            with celery_app.producer_or_acquire() as producer:
                task.apply_async(args=args, kwargs=kwargs, producer=producer)
        except Exception:
            _task_logger.warning("Failed to dispatch task %s after retry", task.name)
    except Exception:
        _task_logger.warning("Failed to dispatch task %s", task.name)


def send_task_safe(task, *args, **kwargs):
    """Send a Celery task in a background thread so it never blocks the API response.

    Broker connections can take seconds (especially with pool_limit=0).
    This ensures the API returns immediately while the task is dispatched async.
    """
    thread = threading.Thread(
        target=_dispatch_task,
        args=(task, args, kwargs),
        daemon=True,
    )
    thread.start()
