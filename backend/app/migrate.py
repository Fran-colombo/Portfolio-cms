from sqlalchemy import inspect, text

from app.database import engine


def migrate() -> None:
    """Add missing columns to existing SQLite tables (safe to run on every startup)."""
    inspector = inspect(engine)
    if not inspector.has_table("projects"):
        return

    columns = {col["name"] for col in inspector.get_columns("projects")}

    if "is_incoming" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE projects ADD COLUMN is_incoming BOOLEAN NOT NULL DEFAULT 0")
            )


if __name__ == "__main__":
    migrate()
    print("Migration complete.")
