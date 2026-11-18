from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import get_settings

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# Migrations en synchrone (psycopg) : permet d'exécuter des scripts SQL multi-instructions.
# DATABASE_URL est lu depuis l'environnement OU le fichier .env (via pydantic-settings).
DATABASE_URL = get_settings().database_url.replace("+asyncpg", "+psycopg")
target_metadata = None  # à brancher sur Base.metadata quand les modèles ORM seront écrits


def run_migrations_online() -> None:
    engine = create_engine(DATABASE_URL, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()