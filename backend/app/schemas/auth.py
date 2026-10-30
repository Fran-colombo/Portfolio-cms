from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    status: Literal["authenticated", "totp_setup", "totp_required"]
    access_token: str | None = None
    pending_token: str | None = None
    token_type: str = "bearer"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PendingTokenRequest(BaseModel):
    pending_token: str


class TotpSetupResponse(BaseModel):
    pending_token: str
    otpauth_uri: str
    secret: str
    qr_svg: str


class TotpVerifyRequest(BaseModel):
    pending_token: str
    code: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool
    totp_enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: Literal["member", "admin"] = "member"


class UserUpdate(BaseModel):
    password: str | None = Field(default=None, min_length=8)
    role: Literal["member", "admin"] | None = None
    is_active: bool | None = None
