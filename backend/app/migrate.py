from sqlalchemy import inspect, text

from app.database import engine


def _add_column(table: str, column: str, definition: str) -> None:
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


def migrate() -> None:
    """Add missing columns to existing SQLite tables (safe to run on every startup)."""
    inspector = inspect(engine)

    if inspector.has_table("projects"):
        columns = {col["name"] for col in inspector.get_columns("projects")}

        if "is_incoming" not in columns:
            _add_column("projects", "is_incoming", "BOOLEAN NOT NULL DEFAULT 0")

        if "category" not in columns:
            _add_column("projects", "category", "VARCHAR(100) NOT NULL DEFAULT 'General'")

    if inspector.has_table("users"):
        columns = {col["name"] for col in inspector.get_columns("users")}

        if "role" not in columns:
            _add_column("users", "role", "VARCHAR(20) NOT NULL DEFAULT 'member'")

        if "is_active" not in columns:
            _add_column("users", "is_active", "BOOLEAN NOT NULL DEFAULT 1")

        if "totp_secret" not in columns:
            _add_column("users", "totp_secret", "VARCHAR(64)")


if __name__ == "__main__":
    migrate()
    print("Migration complete.")
