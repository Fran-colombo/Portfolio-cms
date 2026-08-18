from app.auth_utils import hash_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.migrate import migrate
from app.models.user import User


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    migrate()
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.admin_email).first()
        if not admin:
            admin = User(
                email=settings.admin_email,
                password_hash=hash_password(settings.admin_password),
            )
            db.add(admin)

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Database seeded successfully.")
