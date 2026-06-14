"""session participant blocked flag

Revision ID: 20260613_10
Revises: 20260613_09
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa


revision = '20260613_10'
down_revision = '20260613_09'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('session_participants', sa.Column('is_blocked', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column('session_participants', 'is_blocked')
