from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth_utils import (
    create_access_token,
    create_pending_token,
    decode_token,
    generate_totp_secret,
    provisioning_uri,
    qr_svg,
    verify_password,
    verify_totp,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PendingTokenRequest,
    TokenResponse,
    TotpSetupResponse,
    TotpVerifyRequest,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _normalize_code(code: str) -> str:
    cleaned = code.strip().replace(" ", "")
    if len(cleaned) != 6 or not cleaned.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código tiene que tener 6 dígitos",
        )
    return cleaned


def _user_from_pending(token: str, purpose: str, db: Session) -> tuple[User, dict]:
    payload = decode_token(token)
    if not payload or payload.get("purpose") != purpose:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El paso de verificación expiró. Volvé a ingresar.",
        )

    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user or not user.is_active or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El paso de verificación expiró. Volvé a ingresar.",
        )
    return user, payload


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email.strip().lower()).first()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    if user.role != "admin":
        token = create_access_token(user.email, role=user.role)
        return LoginResponse(status="authenticated", access_token=token)

    if user.totp_secret:
        pending = create_pending_token(user.email, "totp_verify")
        return LoginResponse(status="totp_required", pending_token=pending)

    pending = create_pending_token(user.email, "totp_setup")
    return LoginResponse(status="totp_setup", pending_token=pending)


@router.post("/totp/setup", response_model=TotpSetupResponse)
def totp_setup(payload: PendingTokenRequest, db: Session = Depends(get_db)):
    user, _ = _user_from_pending(payload.pending_token, "totp_setup", db)
    if user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El segundo factor ya está activo",
        )

    secret = generate_totp_secret()
    uri = provisioning_uri(secret, user.email)
    pending = create_pending_token(user.email, "totp_setup", totp_secret=secret)
    return TotpSetupResponse(
        pending_token=pending,
        otpauth_uri=uri,
        secret=secret,
        qr_svg=qr_svg(uri),
    )


@router.post("/totp/verify", response_model=TokenResponse)
def totp_verify(payload: TotpVerifyRequest, db: Session = Depends(get_db)):
    code = _normalize_code(payload.code)
    token_payload = decode_token(payload.pending_token)
    if not token_payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El paso de verificación expiró. Volvé a ingresar.",
        )

    purpose = token_payload.get("purpose")
    if purpose == "totp_setup":
        user, token_payload = _user_from_pending(payload.pending_token, "totp_setup", db)
        secret = token_payload.get("totp_secret")
        if not isinstance(secret, str) or not secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primero vinculá la app autenticadora",
            )
        if user.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El segundo factor ya está activo",
            )
        if not verify_totp(secret, code):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código inválido")
        user.totp_secret = secret
        db.commit()
    elif purpose == "totp_verify":
        user, _ = _user_from_pending(payload.pending_token, "totp_verify", db)
        if not user.totp_secret or not verify_totp(user.totp_secret, code):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código inválido")
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El paso de verificación expiró. Volvé a ingresar.",
        )

    token = create_access_token(user.email, role="admin")
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
