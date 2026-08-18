from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.project import Project
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    PublishResponse,
)

router = APIRouter(prefix="/api", tags=["projects"])


def _project_to_dict(data: ProjectCreate | ProjectUpdate) -> dict:
    return {
        "title": data.title,
        "slug": data.slug,
        "short_description": data.short_description,
        "description": data.description,
        "technologies": data.technologies,
        "features": data.features,
        "demo_url": str(data.demo_url) if data.demo_url else None,
        "repository_url": str(data.repository_url) if data.repository_url else None,
        "image_url": str(data.image_url) if data.image_url else None,
        "test_guide": data.test_guide,
        "display_order": data.display_order,
        "published": data.published,
        "is_incoming": data.is_incoming,
    }


@router.get("/projects", response_model=list[ProjectResponse])
def list_published_projects(db: Session = Depends(get_db)):
    projects = (
        db.query(Project)
        .filter(Project.published.is_(True), Project.is_incoming.is_(False))
        .order_by(Project.display_order.asc(), Project.created_at.desc())
        .all()
    )
    return projects


@router.get("/projects/incoming", response_model=list[ProjectResponse])
def list_incoming_projects(db: Session = Depends(get_db)):
    projects = (
        db.query(Project)
        .filter(Project.published.is_(True), Project.is_incoming.is_(True))
        .order_by(Project.display_order.asc(), Project.created_at.desc())
        .all()
    )
    return projects


@router.get("/projects/{slug}", response_model=ProjectResponse)
def get_published_project(slug: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.slug == slug, Project.published.is_(True)).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/admin/projects", response_model=list[ProjectResponse])
def list_all_projects(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    projects = (
        db.query(Project)
        .order_by(Project.display_order.asc(), Project.created_at.desc())
        .all()
    )
    return projects


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    existing = db.query(Project).filter(Project.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists")

    project = Project(**_project_to_dict(payload))
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    slug_conflict = (
        db.query(Project)
        .filter(Project.slug == payload.slug, Project.id != project_id)
        .first()
    )
    if slug_conflict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists")

    for key, value in _project_to_dict(payload).items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    db.delete(project)
    db.commit()
    return None


@router.patch("/projects/{project_id}/publish", response_model=PublishResponse)
def toggle_publish(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project.published = not project.published
    db.commit()
    db.refresh(project)
    return PublishResponse(id=project.id, published=project.published)
