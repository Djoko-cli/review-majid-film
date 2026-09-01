import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
try:
    from ..database import Base
except ImportError:
    from database import Base


class BrandProject(Base):
    """One synced project from majid.film's brand-manifest.json (see
    services/brand_sync_service.py). `slug` is majid.film's own identifier —
    the stable join key across a resync, never regenerated."""

    __tablename__ = "brand_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    year: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    stills: Mapped[list["BrandStill"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class BrandStill(Base):
    """One still of a BrandProject. `widths` is a JSON array of ints (pixel
    widths with a synced avif+webp pair) — never recomputed here, just
    mirrored from what BrandSyncService discovered on majid.film's side."""

    __tablename__ = "brand_stills"
    __table_args__ = (UniqueConstraint("project_id", "still", name="uq_brand_still_project_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("brand_projects.id", ondelete="CASCADE"), nullable=False)
    still: Mapped[int] = mapped_column(Integer, nullable=False)
    widths_json: Mapped[str] = mapped_column(String(255), nullable=False)  # JSON-encoded list[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project: Mapped["BrandProject"] = relationship(back_populates="stills")


class DisabledBrandSlide(Base):
    """An admin-curated exclusion: this (slug, still) is synced but never
    shown in the rotation. Never deleted by sync — see BrandSyncService's
    never-delete convention; only an admin action clears this table."""

    __tablename__ = "disabled_brand_slides"
    __table_args__ = (UniqueConstraint("slug", "still", name="uq_disabled_brand_slide"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    still: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
