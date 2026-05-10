"""add missing group visibility and invite key columns

Revision ID: 20260508_07
Revises: 20260508_06
Create Date: 2026-05-08
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql


revision = '20260508_07'
down_revision = '20260508_06'
branch_labels = None
depends_on = None


group_visibility_enum = postgresql.ENUM('public', 'private', name='groupvisibility', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('groups')}

    group_visibility_enum.create(bind, checkfirst=True)

    if 'visibility' not in columns:
        op.add_column(
            'groups',
            sa.Column(
                'visibility',
                group_visibility_enum,
                nullable=False,
                server_default='public',
            ),
        )
        op.alter_column('groups', 'visibility', server_default=None)

    if 'invite_key' not in columns:
        op.add_column('groups', sa.Column('invite_key', sa.String(length=32), nullable=True))
        bind.execute(
            text(
                """
                UPDATE groups
                SET invite_key = CONCAT('legacy-', id)
                WHERE invite_key IS NULL OR invite_key = ''
                """
            )
        )
        op.alter_column('groups', 'invite_key', nullable=False)
        op.create_unique_constraint('uq_groups_invite_key', 'groups', ['invite_key'])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('groups')}
    unique_constraints = {constraint['name'] for constraint in inspector.get_unique_constraints('groups')}

    if 'uq_groups_invite_key' in unique_constraints:
        op.drop_constraint('uq_groups_invite_key', 'groups', type_='unique')
    if 'invite_key' in columns:
        op.drop_column('groups', 'invite_key')
    if 'visibility' in columns:
        op.drop_column('groups', 'visibility')

    group_visibility_enum.drop(bind, checkfirst=True)
