"""Interés de caución colocadora (BYMA, año de 365) y veredicto.

La TNA que se compara contra el mercado es la efectiva: los días en que
el vencimiento cae en fin de semana o feriado rindieron cero.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from app.cauciones.calendar import HolidayBook, idle_dates, idle_label, load_holidays, next_business_day, years_covering
from app.cauciones.market import (
    GOOD_FROM,
    HURDLE_8_TO_30,
    HURDLE_OVER_30,
    INFLATION_MONTH,
    INFLATION_YEAR_EXPECTED,
    MARKET_TNA,
    PLAZO_FIJO_TNA,
    REFERENCE_DATE,
    REFERENCE_SOURCE,
    VERDICT_ORDER,
    WEAK_BELOW,
)

MONEY = Decimal("0.01")
RATE = Decimal("0.01")
PERIOD = Decimal("0.0001")


def hoy_necesita_anios(fecha_inicio: date, dias: int) -> set[int]:
    return years_covering(fecha_inicio, dias)


def evaluar(
    monto: Decimal,
    tna: Decimal,
    dias: int,
    fecha_inicio: date,
    book: HolidayBook | None = None,
) -> dict:
    if book is None:
        book = load_holidays(years_covering(fecha_inicio, dias))

    vencimiento = fecha_inicio + timedelta(days=dias)
    renovacion = next_business_day(vencimiento, book.dates)
    parados = idle_dates(vencimiento, renovacion)
    detalle = [{"fecha": day, "etiqueta": idle_label(day, book.names)} for day in parados]
    dias_parados = len(parados)

    interes = _money(monto * tna / Decimal(100) * Decimal(dias) / Decimal(365))
    ganancia_diaria = _money(monto * tna / Decimal(100) / Decimal(365))
    rendimiento = (tna * Decimal(dias) / Decimal(365)).quantize(PERIOD, rounding=ROUND_HALF_UP)
    tea = _tea(tna, dias)
    tna_efectiva = (tna * Decimal(dias) / Decimal(dias + dias_parados)).quantize(RATE, rounding=ROUND_HALF_UP)
    costo_parados = _money(monto * MARKET_TNA / Decimal(100) * Decimal(dias_parados) / Decimal(365))
    costo_dia_extra = _money(monto * MARKET_TNA / Decimal(100) / Decimal(365))

    veredicto, motivo = _veredicto(tna_efectiva, dias)
    notas = _notas(
        tna_efectiva=tna_efectiva,
        dias=dias,
        dias_parados=dias_parados,
        rendimiento=rendimiento,
        costo_dia_extra=costo_dia_extra,
        feriados_ok=book.available,
    )

    return {
        "monto": _num(monto, MONEY),
        "tna": _num(tna, RATE),
        "dias": dias,
        "fecha_inicio": fecha_inicio,
        "fecha_vencimiento": vencimiento,
        "fecha_renovacion": renovacion,
        "dias_parados": dias_parados,
        "dias_detalle": detalle,
        "resumen": _resumen(tna, dias, tna_efectiva, detalle),
        "interes": _num(interes, MONEY),
        "ganancia_diaria": _num(ganancia_diaria, MONEY),
        "rendimiento_periodo": _num(rendimiento, PERIOD),
        "tea": _num(tea, RATE),
        "tna_efectiva": _num(tna_efectiva, RATE),
        "costo_dias_parados": _num(costo_parados, MONEY),
        "costo_dia_extra": _num(costo_dia_extra, MONEY),
        "veredicto": veredicto,
        "motivo": motivo,
        "notas": notas,
        "feriados_disponibles": book.available,
    }


def referencia() -> dict:
    return {
        "fecha": REFERENCE_DATE,
        "tna_cauciones": _num(MARKET_TNA, RATE),
        "tna_plazo_fijo": _num(PLAZO_FIJO_TNA, RATE),
        "inflacion_mensual": _num(INFLATION_MONTH, RATE),
        "inflacion_esperada_12m": _num(INFLATION_YEAR_EXPECTED, RATE),
        "fuente": REFERENCE_SOURCE,
    }


def orden_veredicto(nombre: str) -> int:
    return VERDICT_ORDER[nombre]


def estado(fecha_vencimiento: date, fecha_renovacion: date, hoy: date, avisada: bool) -> str:
    if hoy < fecha_vencimiento:
        return "vigente"
    if hoy < fecha_renovacion:
        return "parada"
    if hoy == fecha_renovacion:
        return "renovar"
    if avisada:
        return "avisada"
    return "vencida"


def _veredicto(tna_efectiva: Decimal, dias: int) -> tuple[str, str]:
    if tna_efectiva < WEAK_BELOW:
        return (
            "No conviene",
            "Tasa floja: la efectiva queda más de 1,5 puntos debajo del promedio "
            "de mercado (20,83%). La alternativa es colocar al promedio, no dejar la plata en la cuenta.",
        )
    if dias <= 7:
        if tna_efectiva >= GOOD_FROM:
            return (
                "Conviene",
                "Plazo corto y tasa por encima del mercado. Sirve para no dejar los pesos quietos.",
            )
        return (
            "Aceptable",
            "Plazo corto y tasa en línea con el mercado. Conviene colocar antes que dejar la plata al 0%.",
        )
    if dias <= 30:
        if tna_efectiva >= HURDLE_8_TO_30:
            return (
                "Conviene",
                "Este plazo paga el premio que hoy pide el tramo de 30 días (22,8% efectiva o más).",
            )
        return (
            "Poco premio",
            "Por estos días no vale la pena: renovando corto cobrás casi lo mismo y no inmovilizás.",
        )
    if tna_efectiva >= HURDLE_OVER_30:
        return (
            "Conviene",
            "El plazo largo paga al menos 3 puntos sobre el promedio (23,8% efectiva).",
        )
    return (
        "No conviene",
        "No vale el plazo: por más de 30 días hace falta 23,8% efectiva. "
        "La curva a 60 días hoy no paga mucho más.",
    )


def _notas(
    *,
    tna_efectiva: Decimal,
    dias: int,
    dias_parados: int,
    rendimiento: Decimal,
    costo_dia_extra: Decimal,
    feriados_ok: bool,
) -> list[str]:
    notas = [
        "Si pasa 1 día más después de que ya podés renovar, dejás de ganar "
        f"{_pesos(costo_dia_extra)} al promedio de mercado (20,83%)."
    ]
    inmovilizados = dias + dias_parados
    inflacion = INFLATION_MONTH * Decimal(inmovilizados) / Decimal(30)
    if rendimiento < inflacion:
        notas.append(
            "En términos reales, con la inflación de octubre (2,2% mensual) prorrateada "
            f"a los {inmovilizados} días que la plata queda afuera, este tramo no le gana a los precios."
        )
    if dias >= 30 and tna_efectiva < PLAZO_FIJO_TNA:
        notas.append(
            "Un plazo fijo de banco (20,5% a 30 días) paga más y no depende de que renueves."
        )
    if not feriados_ok:
        notas.append(
            "No pude traer todos los feriados. En los años que faltan, los días parados cuentan solo sábados y domingos."
        )
    return notas


def _resumen(tna: Decimal, dias: int, tna_efectiva: Decimal, detalle: list[dict]) -> str:
    pactado = _pct(tna)
    efectiva = _pct(tna_efectiva)
    if not detalle:
        return (
            f"Pactado {pactado} por {dias} días. El vencimiento es hábil: "
            f"se puede renovar ese día. Efectiva {efectiva}."
        )
    lista = ", ".join(item["etiqueta"] for item in detalle)
    parados = len(detalle)
    unidad = "día" if parados == 1 else "días"
    return f"Pactado {pactado} por {dias} días. Parada {parados} {unidad} ({lista}). Efectiva {efectiva}."


def _tea(tna: Decimal, dias: int) -> Decimal:
    base = 1 + float(tna) / 100 * dias / 365
    tea = (base ** (365 / dias) - 1) * 100
    return Decimal(str(tea)).quantize(RATE, rounding=ROUND_HALF_UP)


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def _num(value: Decimal, quantum: Decimal) -> float:
    return float(value.quantize(quantum, rounding=ROUND_HALF_UP))


def _pct(value: Decimal) -> str:
    quantized = value.quantize(RATE, rounding=ROUND_HALF_UP)
    return f"{quantized}%".replace(".", ",")


def _pesos(value: Decimal) -> str:
    quantized = abs(value.quantize(MONEY, rounding=ROUND_HALF_UP))
    entero, _, frac = f"{quantized:.2f}".partition(".")
    grupos: list[str] = []
    while entero:
        grupos.append(entero[-3:])
        entero = entero[:-3]
    return f"${'.'.join(reversed(grupos))},{frac}"
