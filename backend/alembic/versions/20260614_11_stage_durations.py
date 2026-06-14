"""session stage durations

Revision ID: 20260614_11
Revises: 20260613_10
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa


revision = '20260614_11'
down_revision = '20260613_10'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('session_stage_states', sa.Column('stage_durations', sa.JSON(), server_default='{}', nullable=False))


def downgrade() -> None:
    op.drop_column('session_stage_states', 'stage_durations')
