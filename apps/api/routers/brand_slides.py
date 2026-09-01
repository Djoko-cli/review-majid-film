import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..config import settings
from ..models.user import User
from ..models.brand_slide import BrandProject, DisabledBrandSlide
from ..routers.users import require_admin
from ..services import s3_service
from ..schemas.brand_slide import (
    BrandProjectOut,
    BrandStillOut,
    DisabledBrandSlideOut,
    BrandSlideToggle,
)

router = APIRouter(prefix="/brand", tags=["brand_slides"])

_URL_EXPIRES_IN = 24 * 3600  # public, immutable brand imagery — a generous expiry so a tab left open doesn't break


@router.get("/catalog", response_model=list[BrandProjectOut])
def get_brand_catalog(db: Session = Depends(get_db)):
    """Public (login/setup screens are unauthenticated): the synced brand
    slide catalog. Empty when sync has never run or found nothing yet — the
    caller (BrandPanel) falls back to no rotating backdrop, never an error."""
    projects = db.query(BrandProject).options(joinedload(BrandProject.stills)).all()
    out: list[BrandProjectOut] = []
    for project in projects:
        stills: list[BrandStillOut] = []
        for still in project.stills:
            widths = json.loads(still.widths_json)
            if not widths:
                continue
            width = max(widths)
            avif_key = f"brand/{project.slug}/s{still.still}-{width}.avif"
            webp_key = f"brand/{project.slug}/s{still.still}-{width}.webp"
            stills.append(BrandStillOut(
                still=still.still,
                avif_url=s3_service.generate_presigned_get_url(avif_key, expires_in=_URL_EXPIRES_IN),
                webp_url=s3_service.generate_presigned_get_url(webp_key, expires_in=_URL_EXPIRES_IN),
            ))
        if stills:
            out.append(BrandProjectOut(slug=project.slug, title=project.title, year=project.year, stills=stills))
    return out


@router.get("/disabled", response_model=list[DisabledBrandSlideOut])
def get_disabled_brand_slides(db: Session = Depends(get_db)):
    """Public — BrandPanel filters the catalog against this before its first
    render so a just-disabled still never flashes in."""
    return db.query(DisabledBrandSlide).all()


@router.put("/disabled", response_model=DisabledBrandSlideOut | None, status_code=status.HTTP_200_OK)
def toggle_disabled_brand_slide(
    body: BrandSlideToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin only: curate the rotation by excluding (or re-including) one still."""
    existing = db.query(DisabledBrandSlide).filter(
        DisabledBrandSlide.slug == body.slug, DisabledBrandSlide.still == body.still,
    ).first()
    if body.disabled:
        if existing:
            return existing
        row = DisabledBrandSlide(slug=body.slug, still=body.still)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    else:
        if existing:
            db.delete(existing)
            db.commit()
        return None


@router.post("/sync", status_code=status.HTTP_202_ACCEPTED)
def trigger_brand_sync(current_user: User = Depends(require_admin)):
    """Admin only: manually trigger a sync, rather than waiting for the nightly
    Celery Beat schedule (see tasks/brand_sync_tasks.py). Dispatched to the
    maintenance queue, not run inline: a real catalog (majid.film's is 21
    projects / ~3700 derivative files as of writing) reads and uploads each
    file one at a time and comfortably exceeds any reasonable HTTP timeout —
    confirmed by timing out the synchronous version of this endpoint against
    the real dataset before this fix."""
    if not settings.majidfilm_source_root or not settings.brand_sync_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand sync is not configured: set MAJIDFILM_SOURCE_ROOT and BRAND_SYNC_ENABLED=true.",
        )
    from ..tasks.brand_sync_tasks import sync_brand_slides
    from ..tasks.celery_app import send_task_safe
    send_task_safe(sync_brand_slides)
    return {"detail": "Sync dispatched to the maintenance queue."}
