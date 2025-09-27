"""Database migrations module for SQLite."""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def run_sqlite_migrations(engine: Engine | None = None) -> None:
    """Run lightweight SQLite migrations."""

    if engine is None:
        logger.info("No engine supplied for migrations; skipping")
        return

    inspector = inspect(engine)

    # Add `pinned` column to sessions table if missing
    session_columns = {column["name"] for column in inspector.get_columns("sessions")}
    if "pinned" not in session_columns:
        logger.info("Adding `pinned` column to sessions table")
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE sessions ADD COLUMN pinned BOOLEAN DEFAULT 0"))
