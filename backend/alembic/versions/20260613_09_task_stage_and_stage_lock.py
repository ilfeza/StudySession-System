"""task created_in_stage and stage_locked

Revision ID: 20260613_09
Revises: 20260510_08
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa


revision = '20260613_09'
down_revision = '20260510_08'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('created_in_stage', sa.String(length=50), server_default='', nullable=False))
    op.add_column('session_stage_states', sa.Column('stage_locked', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column('session_stage_states', 'stage_locked')
    op.drop_column('tasks', 'created_in_stage')
