"""add analyst role

Revision ID: 20260510_08
Revises: 20260508_07
Create Date: 2026-05-10 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '20260510_08'
down_revision = '20260508_07'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'analyst'")
    else:
        # SQLite stores enum-compatible values as text in this project.
        pass


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                    ALTER TYPE userrole RENAME TO userrole_old;
                    CREATE TYPE userrole AS ENUM ('student', 'instructor', 'admin');
                    ALTER TABLE users
                        ALTER COLUMN role TYPE userrole
                        USING role::text::userrole;
                    DROP TYPE userrole_old;
                END IF;
            END $$;
            """
        )
    else:
        pass
