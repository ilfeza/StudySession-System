"""add session templates and group materials

Revision ID: 20260422_04
Revises: 20260422_03
Create Date: 2026-04-22
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260422_04'
down_revision = '20260422_03'
branch_labels = None
depends_on = None

group_material_kind = postgresql.ENUM('pdf', 'link', name='groupmaterialkind', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    group_material_kind.create(bind, checkfirst=True)

    op.add_column('video_sessions', sa.Column('template_key', sa.String(length=50), nullable=False, server_default=''))
    op.alter_column('video_sessions', 'template_key', server_default=None)

    op.create_table(
        'group_materials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('uploaded_by_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('kind', group_material_kind, nullable=False),
        sa.Column('url', sa.Text(), nullable=False, server_default=''),
        sa.Column('original_name', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('stored_name', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('mime_type', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('size_bytes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stored_name'),
    )
    op.create_index(op.f('ix_group_materials_group_id'), 'group_materials', ['group_id'], unique=False)
    op.alter_column('group_materials', 'url', server_default=None)
    op.alter_column('group_materials', 'original_name', server_default=None)
    op.alter_column('group_materials', 'stored_name', server_default=None)
    op.alter_column('group_materials', 'mime_type', server_default=None)
    op.alter_column('group_materials', 'size_bytes', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_group_materials_group_id'), table_name='group_materials')
    op.drop_table('group_materials')
    op.drop_column('video_sessions', 'template_key')
    bind = op.get_bind()
    group_material_kind.drop(bind, checkfirst=True)
