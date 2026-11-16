"""Arma la respuesta de una caución guardada y el acumulado del historial."""

from datetime import date
from decimal import Decimal

from app.cauciones.calc import estado, evaluar, referencia
from app.cauciones.calendar import HolidayBook, load_holidays, years_covering
from app.models.caucion import Caucion


def book_for(rows: list[Caucion], hoy: date) -> HolidayBook:
    years = {hoy.year, hoy.year + 1}
    for row in rows:
        years.update(years_covering(row.fecha_inicio, row.dias))
    return load_holidays(years)


def presentar(row: Caucion, hoy: date, book: HolidayBook) -> dict:
    data = evaluar(Decimal(row.monto), Decimal(row.tna), row.dias, row.fecha_inicio, book)
    data.update(
        {
            "id": row.id,
            "persona": (row.persona or "").strip() or "Sin persona",
            "estado": estado(
                data["fecha_vencimiento"],
                data["fecha_renovacion"],
                hoy,
                row.notified_at is not None,
            ),
            "notified_at": row.notified_at,
            "created_at": row.created_at,
        }
    )
    return data


def acumulado(items: list[dict], hoy: date) -> dict:
    if not items:
        return {
            "interes_cobrado": 0.0,
            "interes_vigente": 0.0,
            "interes_total": 0.0,
            "tna_ponderada": 0.0,
            "rendimiento_capital": 0.0,
            "cantidad": 0,
        }

    cobrado = 0.0
    vigente = 0.0
    peso_tna = 0.0
    peso_dias = 0.0
    capital = 0.0
    for item in items:
        interes = float(item["interes"])
        if item["fecha_vencimiento"] <= hoy:
            cobrado += interes
        else:
            vigente += interes
        peso_tna += float(item["monto"]) * item["dias"] * float(item["tna"])
        peso_dias += float(item["monto"]) * item["dias"]
        capital += float(item["monto"])

    total = cobrado + vigente
    return {
        "interes_cobrado": round(cobrado, 2),
        "interes_vigente": round(vigente, 2),
        "interes_total": round(total, 2),
        "tna_ponderada": round(peso_tna / peso_dias, 2) if peso_dias else 0.0,
        "rendimiento_capital": round(total / capital * 100, 4) if capital else 0.0,
        "cantidad": len(items),
    }


def agrupar_por_persona(items: list[dict]) -> list[tuple[str, list[dict]]]:
    groups: dict[str, list[dict]] = {}
    labels: dict[str, str] = {}
    for item in items:
        raw = (item.get("persona") or "").strip() or "Sin persona"
        key = " ".join(raw.split()).casefold()
        groups.setdefault(key, []).append(item)
        labels.setdefault(key, raw)
    return [(labels[key], groups[key]) for key in sorted(labels, key=lambda item: labels[item].casefold())]


def por_persona(items: list[dict], hoy: date) -> list[dict]:
    return [
        {"persona": nombre, **acumulado(chunk, hoy)}
        for nombre, chunk in agrupar_por_persona(items)
    ]


def mercado() -> dict:
    return referencia()
