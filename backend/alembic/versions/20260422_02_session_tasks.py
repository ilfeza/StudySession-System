"""extend tasks for video sessions

Revision ID: 20260422_02
Revises: 20260422_01
Create Date: 2026-04-22
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260422_02'
down_revision = '20260422_01'
branch_labels = None
depends_on = None

session_task_status = postgresql.ENUM('todo', 'in_progress', 'done', name='sessiontaskstatus', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    session_task_status.create(bind, checkfirst=True)

    op.add_column('tasks', sa.Column('session_id', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('assignee_id', sa.Integer(), nullable=True))
    op.add_column(
        'tasks',
        sa.Column(
            'status',
            session_task_status,
            nullable=False,
            server_default='todo',
        ),
    )
    op.create_index(op.f('ix_tasks_session_id'), 'tasks', ['session_id'], unique=False)
    op.create_foreign_key('fk_tasks_session_id_video_sessions', 'tasks', 'video_sessions', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_tasks_assignee_id_users', 'tasks', 'users', ['assignee_id'], ['id'], ondelete='SET NULL')
    op.execute(
        """
        UPDATE tasks
        SET status = CASE
            WHEN is_completed THEN 'done'::sessiontaskstatus
            ELSE 'todo'::sessiontaskstatus
        END
        """
    )
    op.alter_column('tasks', 'status', server_default=None)


def downgrade() -> None:
    op.drop_constraint('fk_tasks_assignee_id_users', 'tasks', type_='foreignkey')
    op.drop_constraint('fk_tasks_session_id_video_sessions', 'tasks', type_='foreignkey')
    op.drop_index(op.f('ix_tasks_session_id'), table_name='tasks')
    op.drop_column('tasks', 'status')
    op.drop_column('tasks', 'assignee_id')
    op.drop_column('tasks', 'session_id')
    bind = op.get_bind()
    session_task_status.drop(bind, checkfirst=True)
