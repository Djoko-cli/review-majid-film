import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
try:
    from ..database import Base
except ImportError:
    from database import Base


class InstanceBranding(Base):
    __tablename__ = "instance_branding"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # These two defaults must match HARDCODED_DEFAULTS in
    # apps/web/stores/branding-store.ts — a fresh instance renders whatever
    # the first GET auto-creates here, and the admin screen no longer edits
    # either field (see branding-tab.tsx), so there is no UI to fix them up
    # afterwards. Upstream's "FreeFrame"/true leaked onto the first
    # production deploy exactly that way.
    org_name: Mapped[str] = mapped_column(String(255), nullable=False, server_default="Review")
    logo_light_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    logo_dark_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    favicon_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    apple_icon_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    login_logo_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    primary_color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    powered_by_freeframe: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # NULL means "use the hardcoded 'fr' floor" (see middleware.ts's locale
    # resolution order) — an unset instance behaves identically to today,
    # no backfill needed. "fr" | "en", not enforced at the DB level (same
    # looseness as the rest of this table's string columns).
    default_locale: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
