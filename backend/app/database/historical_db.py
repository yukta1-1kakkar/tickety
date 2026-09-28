"""Independent, read-only connection factory for the old VayuSetu database."""

from __future__ import annotations

import os
import re

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine


_READ_ONLY_SQL = re.compile(r"^\s*(SELECT|WITH|SHOW|SET|EXPLAIN)\b", re.IGNORECASE)
_WRITE_SQL = re.compile(
    r"\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY)\b",
    re.IGNORECASE,
)


def _sqlalchemy_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def create_historical_engine() -> Engine:
    """Return a separate engine that rejects all application-issued writes.

    ``OLD_DATABASE_URL`` should ideally use a database role with SELECT-only
    grants. The SQL guard and PostgreSQL read-only transaction are defense in
    depth and do not rely on the new database's engine or ORM session.
    """
    raw_url = os.getenv("OLD_DATABASE_URL", "").strip()
    if not raw_url:
        raise RuntimeError("OLD_DATABASE_URL is required in backend/.env")
    if raw_url == os.getenv("DATABASE_URL", "").strip():
        raise RuntimeError("OLD_DATABASE_URL must not be the same as DATABASE_URL")

    engine = create_engine(
        _sqlalchemy_url(raw_url), pool_pre_ping=True, pool_size=1,
        max_overflow=0, pool_recycle=300,
    )

    @event.listens_for(engine, "before_cursor_execute")
    def reject_writes(_conn, _cursor, statement, _parameters, _context, _many):
        if not _READ_ONLY_SQL.match(statement) or _WRITE_SQL.search(statement):
            raise RuntimeError("Historical database client blocked a non-read-only statement")

    @event.listens_for(engine, "connect")
    def mark_session_read_only(dbapi_connection, _connection_record):
        # Set this directly through DBAPI before SQLAlchemy can enable a
        # server-side cursor. Every later transaction on this pooled session
        # inherits PostgreSQL's read-only setting.
        with dbapi_connection.cursor() as cursor:
            cursor.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
        dbapi_connection.commit()

    return engine
