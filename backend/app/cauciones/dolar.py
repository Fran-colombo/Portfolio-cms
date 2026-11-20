"""Cotizaciones del dólar (dolarapi.com) para valuación de Otras en USD."""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

_URL = "https://dolarapi.com/v1/dolares"
_CACHE: dict | None = None
_CACHE_AT = 0.0
_FRESH_SECONDS = 60
_FAILURE_SECONDS = 30
_FETCH_TIMEOUT = 4

# Blue venta: valuación del efectivo en dólares al precio de reposición.
_VALUATION_CASA = "blue"
_VALUATION_SIDE = "venta"
_SHOWN = ("oficial", "blue", "bolsa")


def cotizaciones() -> dict:
    """Devuelve blue, MEP/bolsa y oficial. Cachea un minuto."""
    global _CACHE, _CACHE_AT
    now = time.monotonic()
    if _CACHE is not None:
        ttl = _FRESH_SECONDS if _CACHE.get("disponible") else _FAILURE_SECONDS
        if now - _CACHE_AT < ttl:
            return _CACHE

    try:
        payload = _fetch()
        rates = []
        by_casa: dict[str, dict] = {}
        for item in payload:
            casa = (item.get("casa") or "").strip().lower()
            if casa not in _SHOWN:
                continue
            rate = {
                "casa": casa,
                "nombre": item.get("nombre") or casa.capitalize(),
                "compra": float(item["compra"]) if item.get("compra") is not None else None,
                "venta": float(item["venta"]) if item.get("venta") is not None else None,
                "actualizado": item.get("fechaActualizacion"),
            }
            by_casa[casa] = rate
            rates.append(rate)

        valuation = by_casa.get(_VALUATION_CASA) or {}
        precio = valuation.get(_VALUATION_SIDE)
        result = {
            "disponible": precio is not None and precio > 0,
            "tasas": rates,
            "valuacion": {
                "casa": _VALUATION_CASA,
                "nombre": valuation.get("nombre") or "Blue",
                "lado": _VALUATION_SIDE,
                "precio": precio,
                "actualizado": valuation.get("actualizado"),
            },
            "fuente": "dolarapi.com",
        }
    except Exception:
        logger.exception("No se pudo traer el dólar")
        result = {
            "disponible": False,
            "tasas": [],
            "valuacion": {
                "casa": _VALUATION_CASA,
                "nombre": "Blue",
                "lado": _VALUATION_SIDE,
                "precio": None,
                "actualizado": None,
            },
            "fuente": "dolarapi.com",
        }

    _CACHE = result
    _CACHE_AT = now
    return result


def precio_valuacion() -> float | None:
    data = cotizaciones()
    if not data["disponible"]:
        return None
    return data["valuacion"]["precio"]


def _fetch() -> list:
    request = urllib.request.Request(_URL, headers={"User-Agent": "portfolio-cms/cauciones"})
    with urllib.request.urlopen(request, timeout=_FETCH_TIMEOUT) as response:
        body = response.read().decode("utf-8")
    data = json.loads(body)
    if not isinstance(data, list):
        raise ValueError("Respuesta inesperada de dolarapi")
    return data
