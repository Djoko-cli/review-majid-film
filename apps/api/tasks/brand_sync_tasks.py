import logging

from .celery_app import celery_app
from ..database import SessionLocal
from ..services.brand_sync_service import sync_from_majidfilm

log = logging.getLogger("celery.brand_sync")


@celery_app.task(name="sync_brand_slides")
def sync_brand_slides():
    """Nightly resync of the "M family" rotating brand backdrop from
    majid.film. A no-op (not an error) whenever MAJIDFILM_SOURCE_ROOT /
    BRAND_SYNC_ENABLED aren't set — see brand_sync_service.is_enabled()."""
    db = SessionLocal()
    try:
        result = sync_from_majidfilm(db)
        if result.enabled:
            log.info(
                "sync_brand_slides: %d new project(s), %d updated, %d new still(s), %d warning(s)",
                result.new_projects, result.updated_projects, result.new_stills, len(result.warnings),
            )
    finally:
        db.close()
