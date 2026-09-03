from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..routers.users import require_admin
from ..schemas.instance_config import ConfigFieldOut, ConfigBulkUpdate
from ..services import config_service

router = APIRouter(prefix="/instance/config", tags=["instance_config"])


@router.get("", response_model=list[ConfigFieldOut])
def get_instance_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin only: every catalog variable's effective value in one call
    (~30 fields total — not worth per-category lazy loading)."""
    return config_service.get_effective_fields(db)


@router.patch("", response_model=list[ConfigFieldOut])
def update_instance_config(
    body: ConfigBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin only: bulk save, all-or-nothing (one invalid item rejects the
    whole batch, nothing is written). Applies live to this process's shared
    settings object before returning."""
    config_service.save_overrides(db, body.items)
    return config_service.get_effective_fields(db)
