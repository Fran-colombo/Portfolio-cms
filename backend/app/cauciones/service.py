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


COLOCADAS = {"vigente", "parada", "renovar", "avisada"}


def presentar(row: Caucion, hoy: date, book: HolidayBook) -> dict:
    data = evaluar(Decimal(row.monto), Decimal(row.tna), row.dias, row.fecha_inicio, book)
    perfil = row.perfil
    nombre = (perfil.nombre if perfil else (row.persona or "")).strip() or "Sin persona"
    mail = ((perfil.email if perfil else row.email) or "").strip()
    data.update(
        {
            "id": row.id,
            "persona_id": row.persona_id,
            "persona": nombre,
            "email": mail,
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


def patrimonio(items: list[dict], otras: list[dict], dolar_precio: float | None = None) -> dict:
    en_cauciones = sum(float(item["monto"]) for item in items if item.get("estado") in COLOCADAS)
    en_otras_ars = 0.0
    en_otras_usd = 0.0
    for item in otras:
        monto = float(item["monto"])
        if (item.get("moneda") or "ARS").upper() == "USD":
            en_otras_usd += monto
        else:
            en_otras_ars += monto
    usd_en_pesos = round(en_otras_usd * dolar_precio, 2) if dolar_precio and en_otras_usd else 0.0
    en_otras = round(en_otras_ars + usd_en_pesos, 2)
    return {
        "en_cauciones": round(en_cauciones, 2),
        "en_otras": en_otras,
        "en_otras_ars": round(en_otras_ars, 2),
        "en_otras_usd": round(en_otras_usd, 2),
        "usd_en_pesos": usd_en_pesos,
        "dolar_precio": dolar_precio,
        "total": round(en_cauciones + en_otras, 2),
    }


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


def clave_persona(nombre: str) -> str:
    return " ".join((nombre or "").split()).casefold()


def agrupar_por_persona(items: list[dict]) -> list[tuple[str, list[dict]]]:
    groups: dict[str, list[dict]] = {}
    labels: dict[str, str] = {}
    for item in items:
        raw = (item.get("persona") or "").strip() or "Sin persona"
        key = clave_persona(raw)
        groups.setdefault(key, []).append(item)
        labels.setdefault(key, raw)
    return [(labels[key], groups[key]) for key in sorted(labels, key=lambda item: labels[item].casefold())]


def por_persona(items: list[dict], hoy: date) -> list[dict]:
    grouped = []
    for nombre, chunk in agrupar_por_persona(items):
        email = next((item.get("email") or "" for item in chunk if item.get("email")), "")
        grouped.append({"persona": nombre, "email": email, **acumulado(chunk, hoy)})
    return grouped


def mercado() -> dict:
    return referencia()


def presentar_otra(row, dolar_precio: float | None = None) -> dict:
    moneda = ((getattr(row, "moneda", None) or "ARS")).upper()
    monto = float(row.monto)
    en_pesos = None
    if moneda == "USD" and dolar_precio:
        en_pesos = round(monto * dolar_precio, 2)
    elif moneda == "ARS":
        en_pesos = monto
    return {
        "id": row.id,
        "persona_id": row.persona_id,
        "nombre": row.nombre,
        "moneda": moneda,
        "monto": monto,
        "en_pesos": en_pesos,
        "updated_at": row.updated_at,
    }
