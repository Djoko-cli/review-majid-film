import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
try:
    from ..database import Base
except ImportError:
    from database import Base


class ConfigOverride(Base):
    """One row per instance-config variable an admin has actually changed.

    Not a singleton like InstanceSettings/InstanceBranding: this table is
    genuinely multi-row, one per (category, name) pair from
    core/config_catalog.py's static CATALOG. A row's absence means "use the
    env-resolved apps.api.config.settings default", not "unset/blank" — see
    config_service.py's resolution order. `value` is always a plain string
    (JSON-free), Fernet ciphertext when the catalog entry is `obscured`.
    """
    __tablename__ = "configs"
    __table_args__ = (UniqueConstraint("category", "name", name="uq_configs_category_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
