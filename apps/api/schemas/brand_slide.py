from pydantic import BaseModel


class BrandStillOut(BaseModel):
    """One still, ready to render. Simplified from Transfer's own catalog
    shape: this returns one width (the largest synced) per format rather
    than a full responsive width ladder — the auth backdrop is a full-bleed
    atmosphere layer, not a page where per-breakpoint bandwidth is critical
    the way it would be on a real gallery. AVIF preferred, WebP fallback,
    same as Transfer's own <picture> element."""

    still: int
    avif_url: str
    webp_url: str


class BrandProjectOut(BaseModel):
    slug: str
    title: str
    year: str
    stills: list[BrandStillOut]


class DisabledBrandSlideOut(BaseModel):
    slug: str
    still: int

    model_config = {"from_attributes": True}


class BrandSlideToggle(BaseModel):
    slug: str
    still: int
    disabled: bool


class BrandSyncResultOut(BaseModel):
    enabled: bool
    new_projects: int = 0
    updated_projects: int = 0
    new_stills: int = 0
    warnings: list[str] = []
