"""add configs table

Revision ID: 004656f6358d
Revises: cbe9ccd90f52
Create Date: 2026-09-03 16:02:50.894909

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004656f6358d'
down_revision: Union[str, Sequence[str], None] = 'cbe9ccd90f52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "configs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category", "name", name="uq_configs_category_name"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("configs")
