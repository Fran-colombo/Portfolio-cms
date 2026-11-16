from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Caucion(Base):
    __tablename__ = "cauciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    persona_id: Mapped[int | None] = mapped_column(ForeignKey("personas.id"), nullable=True, index=True)
    persona: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    monto: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    tna: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    dias: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    perfil: Mapped[Persona | None] = relationship("Persona", back_populates="cauciones")
