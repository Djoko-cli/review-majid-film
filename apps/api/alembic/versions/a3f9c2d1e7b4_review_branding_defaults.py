"""review branding defaults

Revision ID: a3f9c2d1e7b4
Revises: 004656f6358d
Create Date: 2026-09-05 20:05:00.000000

The instance_branding singleton row is auto-created by the first GET, from
whatever the model's defaults say — and until now those were still
upstream's ("FreeFrame", powered_by_freeframe=true) while the admin screen
had already dropped the fields that could change them (see
branding-tab.tsx). A fresh production deploy therefore rendered the
"Powered by FreeFrame" badge and used "FreeFrame" as the org name with no
way to fix it from the UI. This moves the server defaults to Review's own,
and repairs any existing row still carrying the upstream values — nothing
in this fork can set either of them back deliberately, so a row at the old
defaults can only have got there by accident.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a3f9c2d1e7b4'
down_revision: Union[str, Sequence[str], None] = '004656f6358d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('instance_branding', 'org_name', server_default='Review')
    op.alter_column('instance_branding', 'powered_by_freeframe', server_default=sa.text('false'))
    op.execute("UPDATE instance_branding SET org_name = 'Review' WHERE org_name = 'FreeFrame'")
    op.execute("UPDATE instance_branding SET powered_by_freeframe = false WHERE powered_by_freeframe = true")


def downgrade() -> None:
    """Downgrade schema."""
    # Server defaults only — the data repair above is not undone, since the
    # upstream values were never a state this fork intends to run in.
    op.alter_column('instance_branding', 'org_name', server_default='FreeFrame')
    op.alter_column('instance_branding', 'powered_by_freeframe', server_default=sa.text('true'))
