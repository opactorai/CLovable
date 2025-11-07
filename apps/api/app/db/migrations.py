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

    # Add `claude_session_id` column to sessions table if missing
    if "claude_session_id" not in session_columns:
        logger.info("Adding `claude_session_id` column to sessions table")
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE sessions ADD COLUMN claude_session_id VARCHAR(128)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_sessions_claude_session_id ON sessions(claude_session_id)"))

    # Add `status` column to sessions table if missing
    if "status" not in session_columns:
        logger.info("Adding `status` column to sessions table")
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE sessions ADD COLUMN status VARCHAR(32) DEFAULT 'active'"))

    # Add `conversation_id` column to messages table if missing
    message_columns = {column["name"] for column in inspector.get_columns("messages")}
    if "conversation_id" not in message_columns:
        logger.info("Adding `conversation_id` column to messages table")
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE messages ADD COLUMN conversation_id VARCHAR(64)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)"))

    # Add `user_message_id` column to user_requests table if missing
    try:
        user_request_columns = {column["name"] for column in inspector.get_columns("user_requests")}
        if "user_message_id" not in user_request_columns:
            logger.info("Adding `user_message_id` column to user_requests table")
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE user_requests ADD COLUMN user_message_id VARCHAR(64)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS idx_user_requests_user_message_id ON user_requests(user_message_id)"))
                connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_requests_user_message_id_unique ON user_requests(user_message_id)"))

        if "session_id" not in user_request_columns:
            logger.info("Adding `session_id` column to user_requests table")
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE user_requests ADD COLUMN session_id VARCHAR(64)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS idx_user_requests_session_id ON user_requests(session_id)"))
    except Exception:
        # Table might not exist yet
        pass

    # Add missing columns to project_service_connections table if needed
    try:
        service_columns = {column["name"] for column in inspector.get_columns("project_service_connections")}

        if "provider" not in service_columns:
            logger.info("Adding `provider` column to project_service_connections table")
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE project_service_connections ADD COLUMN provider VARCHAR(32) NOT NULL DEFAULT 'github'"))

        if "status" not in service_columns:
            logger.info("Adding `status` column to project_service_connections table")
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE project_service_connections ADD COLUMN status VARCHAR(32) DEFAULT 'connected'"))

        if "service_data" not in service_columns:
            logger.info("Adding `service_data` column to project_service_connections table")
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE project_service_connections ADD COLUMN service_data JSON"))

        if "last_sync_at" not in service_columns:
            logger.info("Adding `last_sync_at` column to project_service_connections table")
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE project_service_connections ADD COLUMN last_sync_at TIMESTAMP"))

        if "created_at" not in service_columns:
            logger.info("Adding `created_at` column to project_service_connections table")
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE project_service_connections ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))

        if "updated_at" not in service_columns:
            logger.info("Adding `updated_at` column to project_service_connections table")
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE project_service_connections ADD COLUMN updated_at TIMESTAMP"))
    except Exception:
        # Table might not exist yet
        pass
