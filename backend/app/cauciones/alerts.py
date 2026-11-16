"""Aviso por mail el primer día hábil en que se puede volver a colocar."""

from __future__ import annotations

import logging
import smtplib
import threading
from datetime import datetime, timezone
from email.message import EmailMessage

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.cauciones.calendar import is_business_day
from app.cauciones.clock import ART, ahora_art
from app.cauciones.service import agrupar_por_persona, book_for, presentar
from app.config import settings
from app.database import SessionLocal
from app.models.caucion import Caucion

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None
_lock = threading.Lock()


def smtp_configurado() -> bool:
    return bool(settings.smtp_host.strip() and settings.smtp_from.strip() and _destino())


def _destino() -> str:
    return (settings.caucion_alert_email or settings.admin_email or "").strip()


def send_due_alerts(*, catch_up: bool = False) -> None:
    if not _lock.acquire(blocking=False):
        return
    try:
        _send_due(catch_up=catch_up)
    finally:
        _lock.release()


def _send_due(*, catch_up: bool) -> None:
    now = ahora_art()
    today = now.date()

    db = SessionLocal()
    try:
        rows = db.query(Caucion).filter(Caucion.notified_at.is_(None)).all()
        book = book_for(rows, today)
        if not is_business_day(today, book.dates):
            return

        include_today = not (catch_up and now.hour < 9)
        due: list[tuple[Caucion, dict]] = []
        for row in rows:
            presented = presentar(row, today, book)
            renewal = presented["fecha_renovacion"]
            if include_today and renewal <= today:
                due.append((row, presented))
            elif not include_today and renewal < today:
                due.append((row, presented))
        if not due:
            return
        if not smtp_configurado():
            logger.warning("Hay cauciones para avisar y el SMTP no está configurado")
            return

        _deliver(due)
        stamp = datetime.now(timezone.utc)
        for row, _presented in due:
            row.notified_at = stamp
        db.commit()
        logger.info("Aviso de cauciones enviado (%s)", len(due))
    except Exception:
        db.rollback()
        logger.exception("No se pudo enviar el aviso de cauciones")
    finally:
        db.close()


def _deliver(due: list[tuple[Caucion, dict]]) -> None:
    message = EmailMessage()
    cantidad = len(due)
    message["Subject"] = (
        "Caución para renovar hoy" if cantidad == 1 else f"{cantidad} cauciones para renovar hoy"
    )
    message["From"] = settings.smtp_from.strip()
    message["To"] = _destino()

    presented = [item for _row, item in due]
    lines = ["Hoy ya podés volver a colocar estas cauciones.", ""]
    for persona, items in agrupar_por_persona(presented):
        lines.append(persona)
        interes = 0.0
        for item in items:
            interes += float(item["interes"])
            lines.append(
                f"- {_pesos(item['monto'])} al {_pct(item['tna'])} por {item['dias']} días. "
                f"Venció el {_fecha(item['fecha_vencimiento'])}. "
                f"Interés cobrado: {_pesos(item['interes'])}. "
                f"{item['resumen']}"
            )
            lines.append(f"  Si pasa un día más sin colocar, dejás de ganar {_pesos(item['costo_dia_extra'])}.")
        lines.append(f"Interés de {persona} en estas cauciones: {_pesos(interes)}.")
        lines.append("")
    lines.append("El aviso está separado por persona.")
    message.set_content("\n".join(lines))

    host = settings.smtp_host.strip()
    port = settings.smtp_port
    if port == 465:
        smtp = smtplib.SMTP_SSL(host, port, timeout=20)
    else:
        smtp = smtplib.SMTP(host, port, timeout=20)
    try:
        smtp.ehlo()
        if port != 465:
            smtp.starttls()
            smtp.ehlo()
        if settings.smtp_user.strip():
            smtp.login(settings.smtp_user.strip(), settings.smtp_password)
        smtp.send_message(message)
    finally:
        smtp.quit()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    scheduler = BackgroundScheduler(timezone=ART)
    scheduler.add_job(
        send_due_alerts,
        CronTrigger(hour=9, minute=0, timezone=ART),
        id="cauciones-alert",
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    threading.Thread(
        target=lambda: send_due_alerts(catch_up=True),
        daemon=True,
        name="cauciones-catchup",
    ).start()


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None


def _pesos(value: float) -> str:
    quantized = abs(round(float(value) + 1e-9, 2))
    entero, _, frac = f"{quantized:.2f}".partition(".")
    grupos: list[str] = []
    while entero:
        grupos.append(entero[-3:])
        entero = entero[:-3]
    return f"${'.'.join(reversed(grupos))},{frac}"


def _pct(value: float) -> str:
    return f"{value:.2f}%".replace(".", ",")


def _fecha(value) -> str:
    return value.strftime("%d/%m/%Y")
