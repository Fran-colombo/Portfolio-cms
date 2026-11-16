"""Feriados nacionales (ArgentinaDatos) más sábados y domingos.

No replica el calendario fino de BYMA: una jornada con negociación y sin
liquidación sigue contando como día en el que se puede colocar.
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, timedelta

logger = logging.getLogger(__name__)

_CACHE: dict[int, dict] = {}
_FRESH_SECONDS = 12 * 60 * 60
_FAILURE_SECONDS = 10 * 60
_FETCH_TIMEOUT = 4

SHORT_WEEKDAY = ("lun", "mar", "mié", "jue", "vie", "sáb", "dom")


@dataclass(frozen=True)
class HolidayBook:
    dates: frozenset[date]
    names: dict[date, str]
    available: bool


def is_business_day(day: date, holidays: frozenset[date] | set[date]) -> bool:
    return day.weekday() < 5 and day not in holidays


def next_business_day(day: date, holidays: frozenset[date] | set[date]) -> date:
    cursor = day
    for _ in range(21):
        if is_business_day(cursor, holidays):
            return cursor
        cursor += timedelta(days=1)
    return cursor


def idle_dates(maturity: date, renewal: date) -> list[date]:
    days: list[date] = []
    cursor = maturity
    while cursor < renewal:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def idle_label(day: date, names: dict[date, str]) -> str:
    short = SHORT_WEEKDAY[day.weekday()]
    holiday = names.get(day)
    if holiday:
        return f"{short} {day.day} feriado ({holiday})"
    return f"{short} {day.day}"


def load_holidays(years: set[int]) -> HolidayBook:
    dates: set[date] = set()
    names: dict[date, str] = {}
    available = True
    for year in sorted(years):
        entry = _year(year)
        dates.update(entry["dates"])
        names.update(entry["names"])
        if not entry["ok"]:
            available = False
    return HolidayBook(dates=frozenset(dates), names=names, available=available)


def years_covering(start: date, extra_days: int) -> set[int]:
    end = start + timedelta(days=extra_days + 21)
    return set(range(start.year, end.year + 1))


def _year(year: int) -> dict:
    now = time.monotonic()
    cached = _CACHE.get(year)
    if cached and cached["ok"] and now - cached["at"] < _FRESH_SECONDS:
        return cached
    if cached and not cached["ok"] and now - cached["at"] < _FAILURE_SECONDS:
        return cached

    try:
        dates, names = _fetch(year)
        entry = {"at": now, "ok": True, "dates": dates, "names": names}
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError, OSError) as exc:
        logger.warning("No se pudieron traer los feriados %s: %s", year, exc)
        if cached and cached["dates"]:
            return cached
        entry = {"at": now, "ok": False, "dates": set(), "names": {}}

    _CACHE[year] = entry
    return entry


def _fetch(year: int) -> tuple[set[date], dict[date, str]]:
    url = f"https://api.argentinadatos.com/v1/feriados/{year}"
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "portfolio-cms/cauciones", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=_FETCH_TIMEOUT) as response:
        payload = json.loads(response.read().decode())
    if not isinstance(payload, list):
        raise ValueError("respuesta de feriados inesperada")

    dates: set[date] = set()
    names: dict[date, str] = {}
    for item in payload:
        if not isinstance(item, dict) or "fecha" not in item:
            continue
        day = date.fromisoformat(str(item["fecha"])[:10])
        name = str(item.get("nombre") or "feriado").strip() or "feriado"
        dates.add(day)
        names[day] = name
    if not dates:
        raise ValueError("el calendario vino vacío")
    return dates, names
