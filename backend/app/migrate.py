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

    if inspector.has_table("cauciones"):
        columns = {col["name"] for col in inspector.get_columns("cauciones")}
        if "persona" not in columns:
            _add_column("cauciones", "persona", "VARCHAR(80) NOT NULL DEFAULT ''")
        if "email" not in columns:
            _add_column("cauciones", "email", "VARCHAR(255) NOT NULL DEFAULT ''")
        if "persona_id" not in columns:
            _add_column("cauciones", "persona_id", "INTEGER")

    if inspector.has_table("otras_inversiones"):
        otras_cols = {col["name"] for col in inspector.get_columns("otras_inversiones")}
        if "moneda" not in otras_cols:
            _add_column("otras_inversiones", "moneda", "VARCHAR(3) NOT NULL DEFAULT 'ARS'")

    _link_personas()


def _clave(nombre: str) -> str:
    return " ".join((nombre or "").split()).casefold()


def _link_personas() -> None:
    """Crea un perfil por cada nombre ya cargado y lo engancha a sus cauciones."""
    inspector = inspect(engine)
    if not inspector.has_table("personas") or not inspector.has_table("cauciones"):
        return
    columns = {col["name"] for col in inspector.get_columns("cauciones")}
    if "persona_id" not in columns:
        return

    with engine.begin() as conn:
        perfiles = conn.execute(text("SELECT id, nombre, email FROM personas")).fetchall()
        por_clave: dict[str, int] = {}
        mails: dict[int, str] = {}
        for perfil in perfiles:
            por_clave[_clave(perfil.nombre)] = perfil.id
            mails[perfil.id] = (perfil.email or "").strip()

        filas = conn.execute(
            text("SELECT id, persona, email FROM cauciones WHERE persona_id IS NULL")
        ).fetchall()
        grupos: dict[str, dict] = {}
        for fila in filas:
            nombre = " ".join((fila.persona or "").split()) or "Sin persona"
            clave = _clave(nombre)
            grupo = grupos.setdefault(clave, {"nombre": nombre, "email": "", "ids": []})
            mail = (fila.email or "").strip()
            if mail and not grupo["email"]:
                grupo["email"] = mail
            grupo["ids"].append(fila.id)

        for clave, grupo in grupos.items():
            persona_id = por_clave.get(clave)
            if persona_id is None:
                result = conn.execute(
                    text(
                        "INSERT INTO personas (nombre, email, created_at) "
                        "VALUES (:nombre, :email, CURRENT_TIMESTAMP)"
                    ),
                    {"nombre": grupo["nombre"], "email": grupo["email"]},
                )
                persona_id = result.lastrowid
                por_clave[clave] = persona_id
                mails[persona_id] = grupo["email"]
            elif grupo["email"] and not mails.get(persona_id):
                conn.execute(
                    text("UPDATE personas SET email = :email WHERE id = :id"),
                    {"email": grupo["email"], "id": persona_id},
                )
                mails[persona_id] = grupo["email"]

            for fila_id in grupo["ids"]:
                conn.execute(
                    text(
                        "UPDATE cauciones SET persona_id = :persona_id "
                        "WHERE id = :id AND persona_id IS NULL"
                    ),
                    {"persona_id": persona_id, "id": fila_id},
                )


if __name__ == "__main__":
    migrate()
    print("Migration complete.")
