import io
from datetime import datetime, timedelta, timezone

import bcrypt
import pyotp
import qrcode
import qrcode.image.svg
from jose import JWTError, jwt

from app.config import settings

PENDING_TOKEN_MINUTES = 5
TOTP_ISSUER = "Conkreto"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str, *, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload = {
        "sub": subject,
        "role": role,
        "purpose": "access",
        "totp": role == "admin",
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_pending_token(subject: str, purpose: str, *, totp_secret: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=PENDING_TOKEN_MINUTES)
    payload = {"sub": subject, "purpose": purpose, "exp": expire}
    if totp_secret:
        payload["totp_secret"] = totp_secret
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        return payload if isinstance(subject, str) else None
    except JWTError:
        return None


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=TOTP_ISSUER)


def verify_totp(secret: str, code: str) -> bool:
    if not secret:
        return False
    try:
        return bool(pyotp.TOTP(secret).verify(code, valid_window=1))
    except (TypeError, ValueError):
        return False


def qr_svg(data: str) -> str:
    image = qrcode.make(
        data,
        image_factory=qrcode.image.svg.SvgPathImage,
        box_size=8,
        border=2,
    )
    buffer = io.BytesIO()
    image.save(buffer)
    svg = buffer.getvalue().decode("utf-8")
    if svg.startswith("<?xml"):
        svg = svg.split("?>", 1)[1].strip()
    return svg
