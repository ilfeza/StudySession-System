"""add session stage state

Revision ID: 20260422_01
Revises: 20260411_03
Create Date: 2026-04-22
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = '20260422_01'
down_revision = '20260411_03'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'session_stage_states',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('current_stage', sa.Enum('discussion', 'work', 'summary', name='sessionstage'), nullable=False),
        sa.Column('stage_started_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['video_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', name='uq_session_stage_state_session'),
    )
    op.create_index(op.f('ix_session_stage_states_session_id'), 'session_stage_states', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_session_stage_states_session_id'), table_name='session_stage_states')
    op.drop_table('session_stage_states')
    op.execute('DROP TYPE IF EXISTS sessionstage')

