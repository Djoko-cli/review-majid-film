"""add oauth identities table

Revision ID: 54ae4f87f73f
Revises: 504df232b44e
Create Date: 2026-09-01 21:21:21.927513

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '54ae4f87f73f'
down_revision: Union[str, Sequence[str], None] = '504df232b44e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Hand-trimmed from autogenerate's output, same reason as
    504df232b44e_add_brand_slide_sync_tables.py: the raw diff also picked up
    dropping the legacy organizations/org_members/teams/team_members tables
    and unrelated index churn on asset_shares/media_files/share_links that
    predates this change. Only oauth_identities is this migration's concern.
    """
    op.create_table('oauth_identities',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('provider', sa.String(length=64), nullable=False),
    sa.Column('provider_user_id', sa.String(length=255), nullable=False),
    sa.Column('provider_username', sa.String(length=255), nullable=True),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('provider', 'provider_user_id', name='uq_oauth_identity_provider_sub')
    )
    op.create_index(op.f('ix_oauth_identities_user_id'), 'oauth_identities', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_oauth_identities_user_id'), table_name='oauth_identities')
    op.drop_table('oauth_identities')
