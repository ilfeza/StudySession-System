"""remove junk groups; add group_announcements for dashboard feed

Revision ID: 20260411_03
Revises: 20260411_02
Create Date: 2026-04-11
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '20260411_03'
down_revision = '20260411_02'
branch_labels = None
depends_on = None

# Группы с тестовыми/битыми названиями и дубликаты «Новая учебная группа»
JUNK_NAMES = (
    'Учебная группа №1',
    'Учебная группа №2',
    'Учебная группа №5',
    'Учебная группа №6',
    'учеба',
    'Новая учебная группа',
    '12',
    '1123',
)


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect != 'postgresql':
        # Локальная разработка на SQLite и т.п.: только создаём таблицу объявлений
        pass
    else:
        in_list = ', '.join(f"'{n.replace(chr(39), chr(39) + chr(39))}'" for n in JUNK_NAMES)
        cond = f'(g.name IN ({in_list}) OR g.name LIKE \'%???%\')'
        stmts = [
            f"""
            DELETE FROM chat_messages cm
            USING video_sessions vs, groups g
            WHERE cm.session_id = vs.id AND vs.group_id = g.id AND {cond}
            """,
            f"""
            DELETE FROM session_participants sp
            USING video_sessions vs, groups g
            WHERE sp.session_id = vs.id AND vs.group_id = g.id AND {cond}
            """,
            f"""
            DELETE FROM video_sessions vs
            USING groups g
            WHERE vs.group_id = g.id AND {cond}
            """,
            f"""
            DELETE FROM task_assignments ta
            USING tasks t, groups g
            WHERE ta.task_id = t.id AND t.group_id = g.id AND {cond}
            """,
            f"""
            DELETE FROM files f
            USING tasks t, groups g
            WHERE f.task_id = t.id AND t.group_id = g.id AND {cond}
            """,
            f"""
            DELETE FROM tasks t
            USING groups g
            WHERE t.group_id = g.id AND {cond}
            """,
            f"""
            DELETE FROM group_members gm
            USING groups g
            WHERE gm.group_id = g.id AND {cond}
            """,
            f"""
            DELETE FROM groups g WHERE {cond}
            """,
        ]
        for raw in stmts:
            bind.execute(text(raw))

    op.create_table(
        'group_announcements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_group_announcements_group_id'), 'group_announcements', ['group_id'], unique=False)
    op.create_index('ix_group_announcements_created_at', 'group_announcements', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_group_announcements_created_at', table_name='group_announcements')
    op.drop_index(op.f('ix_group_announcements_group_id'), table_name='group_announcements')
    op.drop_table('group_announcements')
