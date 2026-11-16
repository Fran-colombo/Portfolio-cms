from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.cauciones.alerts import smtp_configurado
from app.cauciones.calc import evaluar, orden_veredicto
from app.cauciones.calendar import load_holidays, years_covering
from app.cauciones.clock import ahora_art
from app.cauciones.service import (
    acumulado,
    book_for,
    clave_persona,
    mercado,
    patrimonio,
    presentar,
    presentar_otra,
)
from app.database import get_db
from app.dependencies import get_current_admin
from app.models.caucion import Caucion
from app.models.persona import OtraInversion, Persona
from app.models.user import User
from app.schemas.caucion import (
    CaucionCalcIn,
    CaucionGuardada,
    CaucionIn,
    Comparacion,
    CompararIn,
    ListaCauciones,
    OtraIn,
    OtraOut,
    Perfil,
    PersonaIn,
    PersonaOut,
    ResultadoCaucion,
)

router = APIRouter(prefix="/api/admin/cauciones", tags=["cauciones"])


def _hoy():
    return ahora_art().date()


def _get_caucion(db: Session, caucion_id: int) -> Caucion:
    row = db.query(Caucion).filter(Caucion.id == caucion_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caución no encontrada")
    return row


def _get_persona(db: Session, persona_id: int) -> Persona:
    row = db.query(Persona).filter(Persona.id == persona_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona no encontrada")
    return row


def _get_otra(db: Session, otra_id: int) -> OtraInversion:
    row = db.query(OtraInversion).filter(OtraInversion.id == otra_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inversión no encontrada")
    return row


def _nombre_libre(db: Session, nombre: str, excepto: int | None = None) -> None:
    clave = clave_persona(nombre)
    for otra in db.query(Persona).all():
        if otra.id != excepto and clave_persona(otra.nombre) == clave:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una persona con ese nombre")


def _copiar_perfil(persona: Persona) -> None:
    for row in persona.cauciones:
        row.persona = persona.nombre
        row.email = persona.email or ""


def _armar(db: Session) -> dict:
    hoy = _hoy()
    personas = db.query(Persona).order_by(Persona.nombre).all()
    rows = db.query(Caucion).order_by(Caucion.fecha_inicio.desc(), Caucion.id.desc()).all()
    otras = db.query(OtraInversion).order_by(OtraInversion.nombre, OtraInversion.id).all()
    book = book_for(rows, hoy)
    items = [presentar(row, hoy, book) for row in rows]
    por_persona: dict[int, list] = defaultdict(list)
    for item in items:
        if item["persona_id"] is not None:
            por_persona[item["persona_id"]].append(item)
    otras_por: dict[int, list] = defaultdict(list)
    for otra in otras:
        otras_por[otra.persona_id].append(presentar_otra(otra))

    perfiles = []
    for persona in personas:
        chunk = por_persona.get(persona.id, [])
        otras_chunk = otras_por.get(persona.id, [])
        perfiles.append(
            {
                "id": persona.id,
                "nombre": persona.nombre,
                "email": persona.email or "",
                "cauciones": chunk,
                "otras": otras_chunk,
                "patrimonio": patrimonio(chunk, otras_chunk),
                "acumulado": acumulado(chunk, hoy),
            }
        )
    return {
        "items": items,
        "perfiles": perfiles,
        "acumulado": acumulado(items, hoy),
        "referencia": mercado(),
        "feriados_disponibles": book.available,
        "smtp_configurado": smtp_configurado(),
    }


@router.get("", response_model=ListaCauciones)
def list_cauciones(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return _armar(db)


@router.get("/personas", response_model=list[Perfil])
def list_personas(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return _armar(db)["perfiles"]


@router.post("/personas", response_model=PersonaOut, status_code=status.HTTP_201_CREATED)
def create_persona(
    payload: PersonaIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    _nombre_libre(db, payload.nombre)
    row = Persona(nombre=payload.nombre, email=str(payload.email))
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "nombre": row.nombre, "email": row.email}


@router.put("/personas/{persona_id}", response_model=PersonaOut)
def update_persona(
    persona_id: int,
    payload: PersonaIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = _get_persona(db, persona_id)
    _nombre_libre(db, payload.nombre, excepto=row.id)
    row.nombre = payload.nombre
    row.email = str(payload.email)
    _copiar_perfil(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "nombre": row.nombre, "email": row.email}


@router.get("/personas/{persona_id}/otras", response_model=list[OtraOut])
def list_otras(
    persona_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    persona = _get_persona(db, persona_id)
    ordenadas = sorted(persona.otras, key=lambda item: (item.nombre.casefold(), item.id))
    return [presentar_otra(otra) for otra in ordenadas]


@router.post("/personas/{persona_id}/otras", response_model=OtraOut, status_code=status.HTTP_201_CREATED)
def create_otra(
    persona_id: int,
    payload: OtraIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    _get_persona(db, persona_id)
    row = OtraInversion(
        persona_id=persona_id,
        nombre=payload.nombre,
        monto=payload.monto,
        updated_at=ahora_art(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return presentar_otra(row)


@router.put("/otras/{otra_id}", response_model=OtraOut)
def update_otra(
    otra_id: int,
    payload: OtraIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = _get_otra(db, otra_id)
    row.nombre = payload.nombre
    row.monto = payload.monto
    row.updated_at = ahora_art()
    db.commit()
    db.refresh(row)
    return presentar_otra(row)


@router.delete("/otras/{otra_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_otra(
    otra_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = _get_otra(db, otra_id)
    db.delete(row)
    db.commit()


@router.post("", response_model=CaucionGuardada, status_code=status.HTTP_201_CREATED)
def create_caucion(
    payload: CaucionIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    persona = _get_persona(db, payload.persona_id)
    row = Caucion(
        persona_id=persona.id,
        persona=persona.nombre,
        email=persona.email or "",
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
    row = _get_caucion(db, caucion_id)
    persona = _get_persona(db, payload.persona_id)
    cambia_plazo = row.fecha_inicio != payload.fecha_inicio or row.dias != payload.dias
    row.persona_id = persona.id
    row.persona = persona.nombre
    row.email = persona.email or ""
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
    row = _get_caucion(db, caucion_id)
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
        evaluar(item.monto, item.tna, item.dias, item.fecha_inicio, book)
        for item in payload.items
    ]
    mas_eficiente = sorted(
        items,
        key=lambda item: (orden_veredicto(item["veredicto"]), -item["tna_efectiva"], -item["interes"]),
    )
    mas_plata = sorted(items, key=lambda item: (-item["interes"], -item["tna_efectiva"]))
    return {
        "items": items,
        "mas_eficiente": mas_eficiente,
        "mas_plata": mas_plata,
        "referencia": mercado(),
        "feriados_disponibles": book.available,
    }
