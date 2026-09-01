"""add brand slide sync tables

Revision ID: 504df232b44e
Revises: cdcf8e5a6437
Create Date: 2026-09-01 17:49:57.661699

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '504df232b44e'
down_revision: Union[str, Sequence[str], None] = 'cdcf8e5a6437'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Hand-trimmed from autogenerate's output: the raw diff also picked up
    dropping the legacy organizations/org_members/teams/team_members tables
    (no ORM model, deliberately never dropped — see docs/majid-notes and
    apps/api/models/__init__.py's absence of them) and unrelated index churn
    on asset_shares/media_files/share_links that predates this change and
    isn't part of it. Only the brand-slide-sync tables below are this
    migration's actual concern.
    """
    op.create_table('brand_projects',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('year', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_brand_projects_slug'), 'brand_projects', ['slug'], unique=True)
    op.create_table('disabled_brand_slides',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=False),
    sa.Column('still', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('slug', 'still', name='uq_disabled_brand_slide')
    )
    op.create_table('brand_stills',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('project_id', sa.UUID(), nullable=False),
    sa.Column('still', sa.Integer(), nullable=False),
    sa.Column('widths_json', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['brand_projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('project_id', 'still', name='uq_brand_still_project_number')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('brand_stills')
    op.drop_table('disabled_brand_slides')
    op.drop_index(op.f('ix_brand_projects_slug'), table_name='brand_projects')
    op.drop_table('brand_projects')
