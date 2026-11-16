from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.cauciones.alerts import smtp_configurado
from app.cauciones.calc import evaluar, orden_veredicto
from app.cauciones.calendar import load_holidays, years_covering
from app.cauciones.clock import ahora_art
from app.cauciones.service import acumulado, book_for, mercado, por_persona, presentar
from app.database import get_db
from app.dependencies import get_current_admin
from app.models.caucion import Caucion
from app.models.user import User
from app.schemas.caucion import (
    CaucionCalcIn,
    CaucionGuardada,
    CaucionIn,
    Comparacion,
    CompararIn,
    ListaCauciones,
    ResultadoCaucion,
)

router = APIRouter(prefix="/api/admin/cauciones", tags=["cauciones"])

def _hoy():
    return ahora_art().date()


def _get(db: Session, caucion_id: int) -> Caucion:
    row = db.query(Caucion).filter(Caucion.id == caucion_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caución no encontrada")
    return row


@router.get("", response_model=ListaCauciones)
def list_cauciones(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    hoy = _hoy()
    rows = db.query(Caucion).order_by(Caucion.fecha_inicio.desc(), Caucion.id.desc()).all()
    book = book_for(rows, hoy)
    items = [presentar(row, hoy, book) for row in rows]
    return {
        "items": items,
        "acumulado": acumulado(items, hoy),
        "por_persona": por_persona(items, hoy),
        "referencia": mercado(),
        "feriados_disponibles": book.available,
        "smtp_configurado": smtp_configurado(),
    }


@router.post("", response_model=CaucionGuardada, status_code=status.HTTP_201_CREATED)
def create_caucion(
    payload: CaucionIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = Caucion(
        persona=payload.persona,
        monto=payload.monto,
        tna=payload.tna,
        dias=payload.dias,
        fecha_inicio=payload.fecha_inicio,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    book = book_for([row], _hoy())
    return presentar(row, _hoy(), book)


@router.put("/{caucion_id}", response_model=CaucionGuardada)
def update_caucion(
    caucion_id: int,
    payload: CaucionIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = _get(db, caucion_id)
    cambia_plazo = row.fecha_inicio != payload.fecha_inicio or row.dias != payload.dias
    row.persona = payload.persona
    row.monto = payload.monto
    row.tna = payload.tna
    row.dias = payload.dias
    row.fecha_inicio = payload.fecha_inicio
    if cambia_plazo:
        row.notified_at = None
    db.commit()
    db.refresh(row)
    book = book_for([row], _hoy())
    return presentar(row, _hoy(), book)


@router.delete("/{caucion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_caucion(
    caucion_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = _get(db, caucion_id)
    db.delete(row)
    db.commit()


@router.post("/calcular", response_model=ResultadoCaucion)
def calcular(
    payload: CaucionCalcIn,
    _: User = Depends(get_current_admin),
):
    book = load_holidays(years_covering(payload.fecha_inicio, payload.dias))
    return evaluar(payload.monto, payload.tna, payload.dias, payload.fecha_inicio, book)


@router.post("/comparar", response_model=Comparacion)
def comparar(
    payload: CompararIn,
    _: User = Depends(get_current_admin),
):
    years: set[int] = set()
    for item in payload.items:
        years.update(years_covering(item.fecha_inicio, item.dias))
    book = load_holidays(years)
    items = [
        evaluar(Decimal(item.monto), Decimal(item.tna), item.dias, item.fecha_inicio, book)
        for item in payload.items
    ]
    mas_eficiente = sorted(items, key=lambda item: (orden_veredicto(item["veredicto"]), -item["tna_efectiva"], -item["interes"]))
    mas_plata = sorted(items, key=lambda item: (-item["interes"], -item["tna_efectiva"]))
    return {
        "items": items,
        "mas_eficiente": mas_eficiente,
        "mas_plata": mas_plata,
        "referencia": mercado(),
        "feriados_disponibles": book.available,
    }
