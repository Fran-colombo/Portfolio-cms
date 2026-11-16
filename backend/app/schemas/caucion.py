from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class CaucionCalcIn(BaseModel):
    monto: Decimal = Field(gt=0, le=Decimal("1000000000000"))
    tna: Decimal = Field(gt=0, le=Decimal("1000"))
    dias: int = Field(ge=1, le=370)
    fecha_inicio: date


class CaucionIn(CaucionCalcIn):
    persona: str = Field(min_length=1, max_length=80)

    @field_validator("persona")
    @classmethod
    def _persona(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Falta la persona")
        return cleaned


class CompararIn(BaseModel):
    items: list[CaucionCalcIn] = Field(min_length=1, max_length=12)


class DiaParado(BaseModel):
    fecha: date
    etiqueta: str


class Referencia(BaseModel):
    fecha: str
    tna_cauciones: float
    tna_plazo_fijo: float
    inflacion_mensual: float
    inflacion_esperada_12m: float
    fuente: str


class ResultadoCaucion(BaseModel):
    monto: float
    tna: float
    dias: int
    fecha_inicio: date
    fecha_vencimiento: date
    fecha_renovacion: date
    dias_parados: int
    dias_detalle: list[DiaParado]
    resumen: str
    interes: float
    ganancia_diaria: float
    rendimiento_periodo: float
    tea: float
    tna_efectiva: float
    costo_dias_parados: float
    costo_dia_extra: float
    veredicto: str
    motivo: str
    notas: list[str]
    feriados_disponibles: bool


class CaucionGuardada(ResultadoCaucion):
    id: int
    persona: str
    estado: str
    notified_at: datetime | None
    created_at: datetime | None


class Acumulado(BaseModel):
    interes_cobrado: float
    interes_vigente: float
    interes_total: float
    tna_ponderada: float
    rendimiento_capital: float
    cantidad: int


class AcumuladoPersona(Acumulado):
    persona: str


class ListaCauciones(BaseModel):
    items: list[CaucionGuardada]
    acumulado: Acumulado
    por_persona: list[AcumuladoPersona]
    referencia: Referencia
    feriados_disponibles: bool
    smtp_configurado: bool


class Comparacion(BaseModel):
    items: list[ResultadoCaucion]
    mas_eficiente: list[ResultadoCaucion]
    mas_plata: list[ResultadoCaucion]
    referencia: Referencia
    feriados_disponibles: bool
