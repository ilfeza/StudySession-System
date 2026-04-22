"""add session summaries

Revision ID: 20260422_03
Revises: 20260422_02
Create Date: 2026-04-22
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260422_03'
down_revision = '20260422_02'
branch_labels = None
depends_on = None

session_summary_status = postgresql.ENUM('draft', 'completed', 'skipped', name='sessionsummarystatus', create_type=False)
session_task_status = postgresql.ENUM('todo', 'in_progress', 'done', name='sessiontaskstatus', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    session_summary_status.create(bind, checkfirst=True)
    session_task_status.create(bind, checkfirst=True)

    op.create_table(
        'session_summaries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('updated_by_id', sa.Integer(), nullable=True),
        sa.Column('completed_work', sa.Text(), nullable=False, server_default=''),
        sa.Column('next_steps', sa.Text(), nullable=False, server_default=''),
        sa.Column('short_description', sa.String(length=300), nullable=False, server_default=''),
        sa.Column('status', session_summary_status, nullable=False, server_default='draft'),
        sa.Column('remind_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['video_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', name='uq_session_summary_session'),
    )
    op.create_index(op.f('ix_session_summaries_group_id'), 'session_summaries', ['group_id'], unique=False)
    op.create_index(op.f('ix_session_summaries_session_id'), 'session_summaries', ['session_id'], unique=False)

    op.create_table(
        'session_summary_participants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('summary_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('full_name_snapshot', sa.String(length=255), nullable=False),
        sa.Column('role_in_session', sa.String(length=50), nullable=False, server_default='participant'),
        sa.ForeignKeyConstraint(['summary_id'], ['session_summaries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_session_summary_participants_summary_id'), 'session_summary_participants', ['summary_id'], unique=False)

    op.create_table(
        'session_summary_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('summary_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('title_snapshot', sa.String(length=255), nullable=False),
        sa.Column('assignee_id', sa.Integer(), nullable=True),
        sa.Column('assignee_name_snapshot', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('deadline_snapshot', sa.DateTime(), nullable=True),
        sa.Column('status_at_summary', session_task_status, nullable=False, server_default='todo'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['summary_id'], ['session_summaries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_session_summary_tasks_summary_id'), 'session_summary_tasks', ['summary_id'], unique=False)

    op.alter_column('session_summaries', 'completed_work', server_default=None)
    op.alter_column('session_summaries', 'next_steps', server_default=None)
    op.alter_column('session_summaries', 'short_description', server_default=None)
    op.alter_column('session_summaries', 'status', server_default=None)
    op.alter_column('session_summary_participants', 'role_in_session', server_default=None)
    op.alter_column('session_summary_tasks', 'assignee_name_snapshot', server_default=None)
    op.alter_column('session_summary_tasks', 'status_at_summary', server_default=None)
    op.alter_column('session_summary_tasks', 'sort_order', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_session_summary_tasks_summary_id'), table_name='session_summary_tasks')
    op.drop_table('session_summary_tasks')

    op.drop_index(op.f('ix_session_summary_participants_summary_id'), table_name='session_summary_participants')
    op.drop_table('session_summary_participants')

    op.drop_index(op.f('ix_session_summaries_session_id'), table_name='session_summaries')
    op.drop_index(op.f('ix_session_summaries_group_id'), table_name='session_summaries')
    op.drop_table('session_summaries')

    bind = op.get_bind()
    session_summary_status.drop(bind, checkfirst=True)
