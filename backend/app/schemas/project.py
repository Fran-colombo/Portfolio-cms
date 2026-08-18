from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class ProjectBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    short_description: str = ""
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    demo_url: HttpUrl | None = None
    repository_url: HttpUrl | None = None
    image_url: HttpUrl | None = None
    test_guide: list[str] = Field(default_factory=list)
    display_order: int = 0
    published: bool = False
    is_incoming: bool = False


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    pass


class ProjectResponse(BaseModel):
    id: int
    title: str
    slug: str
    short_description: str
    description: str
    technologies: list[str]
    features: list[str]
    demo_url: str | None
    repository_url: str | None
    image_url: str | None
    test_guide: list[str]
    display_order: int
    published: bool
    is_incoming: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PublishResponse(BaseModel):
    id: int
    published: bool
