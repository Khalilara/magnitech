"""Schéma initial Maghitech (db/schema.sql)

Revision ID: 0001_initial
Revises:
"""
from pathlib import Path

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = Path(__file__).resolve().parents[2] / "db" / "schema.sql"


def upgrade() -> None:
    # Exécution directe via psycopg (sans paramètres) : le SQL n'est pas réinterprété
    # (":param" de SQLAlchemy, "%I" de format() dans le bloc DO $$…$$).
    op.get_bind().connection.driver_connection.execute(SCHEMA.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
