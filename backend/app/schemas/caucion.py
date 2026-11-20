from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class CaucionCalcIn(BaseModel):
    monto: Decimal = Field(gt=0, le=Decimal("1000000000000"))
    tna: Decimal = Field(gt=0, le=Decimal("1000"))
    dias: int = Field(ge=1, le=370)
    fecha_inicio: date


class CaucionIn(CaucionCalcIn):
    persona_id: int


def _nombre_limpio(value: str) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValueError("Falta el nombre")
    return cleaned


class PersonaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    email: EmailStr

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _nombre_limpio(value)


class PersonaOut(BaseModel):
    id: int
    nombre: str
    email: str


class OtraIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    moneda: Literal["ARS", "USD"] = "ARS"
    monto: Decimal = Field(ge=0, le=Decimal("1000000000000"))

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _nombre_limpio(value)

    @field_validator("moneda")
    @classmethod
    def _moneda(cls, value: str) -> str:
        return value.upper()


class OtraOut(BaseModel):
    id: int
    persona_id: int
    nombre: str
    moneda: str
    monto: float
    en_pesos: float | None
    updated_at: datetime | None


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
    persona_id: int | None
    persona: str
    email: str
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


class Patrimonio(BaseModel):
    en_cauciones: float
    en_otras: float
    en_otras_ars: float
    en_otras_usd: float
    usd_en_pesos: float
    dolar_precio: float | None
    total: float


class DolarTasa(BaseModel):
    casa: str
    nombre: str
    compra: float | None
    venta: float | None
    actualizado: datetime | None


class DolarValuacion(BaseModel):
    casa: str
    nombre: str
    lado: str
    precio: float | None
    actualizado: datetime | None


class DolarHoy(BaseModel):
    disponible: bool
    tasas: list[DolarTasa]
    valuacion: DolarValuacion
    fuente: str


class Perfil(BaseModel):
    id: int
    nombre: str
    email: str
    cauciones: list[CaucionGuardada]
    otras: list[OtraOut]
    patrimonio: Patrimonio
    acumulado: Acumulado


class ListaCauciones(BaseModel):
    items: list[CaucionGuardada]
    perfiles: list[Perfil]
    acumulado: Acumulado
    referencia: Referencia
    dolar: DolarHoy
    feriados_disponibles: bool
    smtp_configurado: bool


class ProyeccionIn(BaseModel):
    monto: Decimal = Field(gt=0, le=Decimal("1000000000000"))
    tna: Decimal = Field(gt=0, le=Decimal("1000"))
    cada: int = Field(ge=1, le=370)
    durante: int = Field(ge=1, le=1100)
    fecha_inicio: date


class Vuelta(BaseModel):
    numero: int
    fecha_inicio: date
    fecha_vencimiento: date
    fecha_renovacion: date
    dias_parados: int
    interes: float
    monto_final: float


class Proyeccion(BaseModel):
    monto_inicial: float
    tna: float
    cada: int
    durante: int
    fecha_inicio: date
    fecha_fin: date
    vueltas: int
    dias_rendidos: int
    dias_parados: int
    interes: float
    interes_sin_reinvertir: float
    monto_final: float
    detalle: list[Vuelta]
    feriados_disponibles: bool
    notas: list[str]


class Comparacion(BaseModel):
    items: list[ResultadoCaucion]
    mas_eficiente: list[ResultadoCaucion]
    mas_plata: list[ResultadoCaucion]
    referencia: Referencia
    feriados_disponibles: bool
