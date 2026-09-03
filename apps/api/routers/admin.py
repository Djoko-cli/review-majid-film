"""Admin endpoints for user management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import secrets
import string
import uuid

from ..core.errors import AppHTTPException
from ..database import get_db
from ..middleware.auth import get_current_user
from ..models.user import User, UserStatus
from ..schemas.auth import UserResponse, AdminUserResponse, UpdateUserRoleRequest, AdminResetPasswordResponse
from ..services.auth_service import hash_password
from .users import require_admin
from ..tasks.celery_app import send_task_safe
from ..tasks.cleanup_tasks import cleanup_soft_deleted
from ..schemas.admin import PurgeStartResponse

router = APIRouter(prefix="/admin", tags=["admin"])

# Unambiguous alphabet (no 0/O/1/l/I) since an admin may need to read this
# out loud or retype it for someone, not just copy-paste it.
_TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_temp_password(length: int = 16) -> str:
    return "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(length))


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserResponse])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all users in the system. Only accessible by admins."""
    if not current_user.is_superadmin:
        raise AppHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="only_admins_can_access_this_endpoint",
            message="Only admins can access this endpoint"
        )

    users = db.query(User).filter(User.deleted_at.is_(None)).all()
    return users

@router.patch("/users/{user_id}/deactivate", response_model=AdminUserResponse)
def deactivate_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate a user. Admins cannot deactivate themselves."""
    if not current_user.is_superadmin:
        raise AppHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="only_admins_can_deactivate_users",
            message="Only admins can deactivate users"
        )

    # Prevent admin from deactivating themselves
    if user_id == current_user.id:
        raise AppHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="you_cannot_deactivate_yourself",
            message="You cannot deactivate yourself"
        )

    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise AppHTTPException(status_code=404, code="user_not_found", message="User not found")

    user.status = UserStatus.deactivated
    db.commit()
    db.refresh(user)
    return user

@router.patch("/users/{user_id}/reactivate", response_model=AdminUserResponse)
def reactivate_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reactivate a deactivated user. Only accessible by admins."""
    if not current_user.is_superadmin:
        raise AppHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="only_admins_can_reactivate_users",
            message="Only admins can reactivate users"
        )

    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise AppHTTPException(status_code=404, code="user_not_found", message="User not found")

    user.status = UserStatus.active
    db.commit()
    db.refresh(user)
    return user

@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
def update_user_role(
    user_id: uuid.UUID,
    body: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Promote or demote a user to/from admin role. Only accessible by admins."""
    if not current_user.is_superadmin:
        raise AppHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="only_admins_can_change_user_roles",
            message="Only admins can change user roles"
        )

    # Prevent admin from removing their own admin role
    if user_id == current_user.id and not body.is_admin:
        raise AppHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="you_cannot_remove_your_own_admin_role",
            message="You cannot remove your own admin role"
        )

    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise AppHTTPException(status_code=404, code="user_not_found", message="User not found")

    user.is_superadmin = body.is_admin
    db.commit()
    db.refresh(user)
    return user

@router.post("/users/{user_id}/reset-password", response_model=AdminResetPasswordResponse)
def reset_user_password(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set a random temporary password for a user and return it once.

    The account-recovery path for this fork now that magic-link sign-in is
    off by default (see MAGIC_LINK_ENABLED): an admin generates a temp
    password here and hands it to the user out of band. It is never emailed
    or logged — this response is the only place it ever appears — so copy it
    before closing this dialog. Bumps token_version, same as a self-service
    password change, so any session the user was already in is invalidated.
    """
    if not current_user.is_superadmin:
        raise AppHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="only_admins_can_reset_a_user_s_password",
            message="Only admins can reset a user's password"
        )

    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise AppHTTPException(status_code=404, code="user_not_found", message="User not found")

    temp_password = _generate_temp_password()
    user.password_hash = hash_password(temp_password)
    user.token_version += 1
    db.commit()
    db.refresh(user)
    return AdminResetPasswordResponse(temporary_password=temp_password)

@router.post("/purge", response_model=PurgeStartResponse, status_code=status.HTTP_202_ACCEPTED)
def purge_now(current_user: User = Depends(require_admin)):
    """Trigger the retention-window garbage collector to run now, in the background.

    Superadmin only. Enqueues the same `cleanup_soft_deleted` task the daily beat runs, so the
    request returns immediately instead of blocking on a potentially long cascade + S3 deletes.
    Reclaimed counts are logged by the worker. If a purge is already running (e.g. the daily beat),
    the advisory lock serializes purges and this enqueued run is skipped rather than double-cascading,
    so a 202 here means "enqueued", not "a fresh run happened".
    """
    send_task_safe(cleanup_soft_deleted)
    return PurgeStartResponse(
        status="started",
        detail="Retention garbage collection is running in the background; see worker logs for reclaimed counts.",
    )
