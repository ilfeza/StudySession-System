"""align workflow stages, task statuses, and chat/session insight fields

Revision ID: 20260508_06
Revises: 20260506_05
Create Date: 2026-05-08
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20260508_06'
down_revision = '20260506_05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.add_column('session_summaries', sa.Column('completion_summary', sa.Text(), nullable=False, server_default=''))
    op.add_column('session_summaries', sa.Column('contribution_summary', sa.Text(), nullable=False, server_default=''))
    op.add_column('session_summaries', sa.Column('bottleneck_summary', sa.Text(), nullable=False, server_default=''))
    op.add_column('session_summaries', sa.Column('collaboration_summary', sa.Text(), nullable=False, server_default=''))

    op.add_column('chat_messages', sa.Column('task_id', sa.Integer(), nullable=True))
    op.add_column('chat_messages', sa.Column('stage', sa.String(length=50), nullable=False, server_default=''))
    op.create_index(op.f('ix_chat_messages_task_id'), 'chat_messages', ['task_id'], unique=False)
    op.create_foreign_key(None, 'chat_messages', 'tasks', ['task_id'], ['id'], ondelete='SET NULL')

    if dialect == 'postgresql':
        op.execute("ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT")
        op.execute("ALTER TABLE session_summary_tasks ALTER COLUMN status_at_summary DROP DEFAULT")
        op.execute("ALTER TABLE session_stage_states ALTER COLUMN current_stage DROP DEFAULT")

        op.execute(
            """
            CREATE TYPE sessiontaskstatus_new AS ENUM (
                'backlog',
                'assigned',
                'in_progress',
                'blocked',
                'done'
            )
            """
        )
        op.execute(
            """
            ALTER TABLE tasks
            ALTER COLUMN status TYPE sessiontaskstatus_new
            USING (
                CASE status::text
                    WHEN 'todo' THEN 'backlog'
                    WHEN 'needs_reassignment' THEN 'backlog'
                    ELSE status::text
                END
            )::sessiontaskstatus_new
            """
        )
        op.execute(
            """
            ALTER TABLE session_summary_tasks
            ALTER COLUMN status_at_summary TYPE sessiontaskstatus_new
            USING (
                CASE status_at_summary::text
                    WHEN 'todo' THEN 'backlog'
                    WHEN 'needs_reassignment' THEN 'backlog'
                    ELSE status_at_summary::text
                END
            )::sessiontaskstatus_new
            """
        )
        op.execute("DROP TYPE sessiontaskstatus")
        op.execute("ALTER TYPE sessiontaskstatus_new RENAME TO sessiontaskstatus")
        op.execute("ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'backlog'")
        op.execute("ALTER TABLE session_summary_tasks ALTER COLUMN status_at_summary SET DEFAULT 'backlog'")

        op.execute(
            """
            CREATE TYPE sessionstage_new AS ENUM (
                'task_creation',
                'task_distribution',
                'execution',
                'review'
            )
            """
        )
        op.execute(
            """
            ALTER TABLE session_stage_states
            ALTER COLUMN current_stage TYPE sessionstage_new
            USING (
                CASE current_stage::text
                    WHEN 'discussion' THEN 'task_creation'
                    WHEN 'work' THEN 'execution'
                    WHEN 'summary' THEN 'review'
                    ELSE current_stage::text
                END
            )::sessionstage_new
            """
        )
        op.execute("DROP TYPE sessionstage")
        op.execute("ALTER TYPE sessionstage_new RENAME TO sessionstage")
        op.execute("ALTER TABLE session_stage_states ALTER COLUMN current_stage SET DEFAULT 'task_creation'")

    else:
        op.execute("UPDATE tasks SET status = 'backlog' WHERE status IN ('todo', 'needs_reassignment')")
        op.execute("UPDATE session_summary_tasks SET status_at_summary = 'backlog' WHERE status_at_summary IN ('todo', 'needs_reassignment')")
        op.execute(
            """
            UPDATE session_stage_states
            SET current_stage = CASE current_stage
                WHEN 'discussion' THEN 'task_creation'
                WHEN 'work' THEN 'execution'
                WHEN 'summary' THEN 'review'
                ELSE current_stage
            END
            """
        )

    op.alter_column('session_summaries', 'completion_summary', server_default=None)
    op.alter_column('session_summaries', 'contribution_summary', server_default=None)
    op.alter_column('session_summaries', 'bottleneck_summary', server_default=None)
    op.alter_column('session_summaries', 'collaboration_summary', server_default=None)
    op.alter_column('chat_messages', 'stage', server_default=None)


def downgrade() -> None:
    op.drop_constraint(None, 'chat_messages', type_='foreignkey')
    op.drop_index(op.f('ix_chat_messages_task_id'), table_name='chat_messages')
    op.drop_column('chat_messages', 'stage')
    op.drop_column('chat_messages', 'task_id')

    op.drop_column('session_summaries', 'collaboration_summary')
    op.drop_column('session_summaries', 'bottleneck_summary')
    op.drop_column('session_summaries', 'contribution_summary')
    op.drop_column('session_summaries', 'completion_summary')

