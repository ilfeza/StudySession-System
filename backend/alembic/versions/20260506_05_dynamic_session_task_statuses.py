"""extend session task statuses for dynamic distribution

Revision ID: 20260506_05
Revises: 20260422_04
Create Date: 2026-05-06 12:40:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = '20260506_05'
down_revision = '20260422_04'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    dialect = connection.dialect.name

    if dialect == 'postgresql':
        op.execute("ALTER TYPE sessiontaskstatus ADD VALUE IF NOT EXISTS 'blocked'")
        op.execute("ALTER TYPE sessiontaskstatus ADD VALUE IF NOT EXISTS 'needs_reassignment'")


def downgrade() -> None:
    # Enum value removal is intentionally omitted because it is not portable.
    pass
