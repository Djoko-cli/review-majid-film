"""add default_locale to instance_branding

Revision ID: cbe9ccd90f52
Revises: 54ae4f87f73f
Create Date: 2026-09-02 21:19:25.291675

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'cbe9ccd90f52'
down_revision: Union[str, Sequence[str], None] = '54ae4f87f73f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('instance_branding', sa.Column('default_locale', sa.String(length=5), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('instance_branding', 'default_locale')
