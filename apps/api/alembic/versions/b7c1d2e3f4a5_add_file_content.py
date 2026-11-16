"""add files.content for ephemeral-workspace deployments

Revision ID: b7c1d2e3f4a5
Revises: 99298a6f0965
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7c1d2e3f4a5'
down_revision: Union[str, None] = '99298a6f0965'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('files', sa.Column('content', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('files', 'content')
