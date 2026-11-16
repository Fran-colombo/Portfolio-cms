from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo

    ART = ZoneInfo("America/Argentina/Buenos_Aires")
except Exception:
    ART = timezone(timedelta(hours=-3))


def ahora_art() -> datetime:
    return datetime.now(ART)
