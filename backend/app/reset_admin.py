from app.auth_utils import hash_password, verify_password
from app.config import settings
from app.database import SessionLocal
from app.models.user import User


def reset_admin_password() -> None:
    db = SessionLocal()
    try:
        email = settings.admin_email
        password = settings.admin_password

        admin = db.query(User).filter(User.email == email).first()
        if not admin:
            admin = User(
                email=email,
                password_hash=hash_password(password),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            print(f"Admin user created: {email}")
        else:
            admin.password_hash = hash_password(password)
            admin.role = "admin"
            admin.is_active = True
            admin.totp_secret = None
            print(f"Admin password updated and authenticator reset for: {email}")

        db.commit()

        admin = db.query(User).filter(User.email == email).first()
        ok = verify_password(password, admin.password_hash)
        print(f"Password verification: {'OK' if ok else 'FAILED'}")
        print(f"Database: {settings.database_url}")
    finally:
        db.close()


if __name__ == "__main__":
    reset_admin_password()
