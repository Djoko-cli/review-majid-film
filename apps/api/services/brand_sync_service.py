"""Syncs the "M family" rotating brand backdrop from majid.film's own deployed
build output — the same source transfer.majid.film's BrandPanel reads, so
Review's auth screen shows the same real production photography rather than
inventing placeholder imagery. See docs/majid-notes/kickoff-prompt.md for the
design context and the sibling Transfer repo's
frontend/src/components/upload/BrandPanel.tsx + backend/src/brandSlides/ for
the reference implementation this mirrors.

Deliberate divergence from Transfer's own approach: Transfer symlinks the
discovered derivatives into a locally-served directory. FreeFrame has no
local-filesystem storage backend by design (everything is S3), so this
uploads each discovered still straight into this instance's own S3 bucket
under `brand/<slug>/s<still>-<width>.<format>` instead, and the catalog
endpoint returns presigned GET URLs exactly like every other asset in the
app — no new "serve from local disk" code path, no state that only exists on
one container when there's more than one API replica.
"""
import json
import logging
import re
from pathlib import Path
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ..config import settings
from ..models.brand_slide import BrandProject, BrandStill
from ..services import s3_service

log = logging.getLogger("brand_sync")

# Matches majid.film's own build output exactly: s<still>-<width>.avif|webp.
# Anchored so it does NOT match a stale duplicate (e.g. "s1-1280 2.avif").
_DERIVED_FILE_RE = re.compile(r"^s(\d+)-(\d+)\.(avif|webp)$")

_S3_PREFIX = "brand"


@dataclass
class BrandSyncResult:
    enabled: bool
    new_projects: int = 0
    updated_projects: int = 0
    new_stills: int = 0
    warnings: list[str] = field(default_factory=list)


def is_enabled() -> bool:
    return bool(settings.majidfilm_source_root) and settings.brand_sync_enabled


def _discover_stills(root: Path, slug: str, warnings: list[str]) -> dict[int, list[int]]:
    """still -> sorted widths that have both an avif and a webp derivative,
    read from the ALREADY-GENERATED derivatives directory — never recomputed."""
    still_dir = root / "assets" / "img" / "derived" / slug
    try:
        entries = [p.name for p in still_dir.iterdir()]
    except OSError:
        warnings.append(f"{slug}: no assets/img/derived/{slug}/ folder")
        return {}

    by_still_width: dict[int, dict[int, set[str]]] = {}
    for name in entries:
        m = _DERIVED_FILE_RE.match(name)
        if not m:
            continue
        still, width, fmt = int(m.group(1)), int(m.group(2)), m.group(3)
        by_still_width.setdefault(still, {}).setdefault(width, set()).add(fmt)

    result: dict[int, list[int]] = {}
    for still, width_map in by_still_width.items():
        complete = sorted(w for w, formats in width_map.items() if {"avif", "webp"} <= formats)
        incomplete = sorted(w for w, formats in width_map.items() if not ({"avif", "webp"} <= formats))
        if incomplete:
            warnings.append(f"{slug} s{still}: width(s) missing an avif/webp pair: {', '.join(map(str, incomplete))}")
        if complete:
            result[still] = complete
    return result


def _upload_stills(root: Path, slug: str, still_widths: dict[int, list[int]], already_uploaded: set[str]) -> None:
    """Uploads every discovered derivative not already in the bucket. Re-checked
    on every run (cheap: a set lookup, no re-upload of what's already there),
    self-healing if an object was ever removed some other way."""
    for still, widths in still_widths.items():
        for width in widths:
            for fmt in ("avif", "webp"):
                key = f"{_S3_PREFIX}/{slug}/s{still}-{width}.{fmt}"
                if key in already_uploaded:
                    continue
                source = root / "assets" / "img" / "derived" / slug / f"s{still}-{width}.{fmt}"
                body = source.read_bytes()
                content_type = "image/avif" if fmt == "avif" else "image/webp"
                s3_service.put_object(key, body, content_type=content_type, cache_control="public, max-age=31536000, immutable")


def sync_from_majidfilm(db: Session) -> BrandSyncResult:
    if not is_enabled():
        return BrandSyncResult(enabled=False)

    root = Path(settings.majidfilm_source_root)
    result = BrandSyncResult(enabled=True)

    try:
        manifest = json.loads((root / "brand-manifest.json").read_text("utf-8"))
    except OSError as e:
        result.warnings.append(f"brand-manifest.json unreadable at {root}: {e}")
        return result
    except json.JSONDecodeError as e:
        result.warnings.append(f"brand-manifest.json invalid JSON: {e}")
        return result

    already_uploaded = {key for key, _, _ in s3_service.list_keys(f"{_S3_PREFIX}/")}

    for entry in manifest:
        slug = entry.get("slug")
        title = entry.get("title")
        year = entry.get("year")
        if not (isinstance(slug, str) and isinstance(title, str) and isinstance(year, str)):
            result.warnings.append(f"Skipped a manifest entry missing slug/title/year: {entry!r}")
            continue

        still_widths = _discover_stills(root, slug, result.warnings)
        if not still_widths:
            result.warnings.append(f"{slug}: no valid derived stills found, skipping for now")
            continue

        project = db.query(BrandProject).filter(BrandProject.slug == slug).first()
        if project is None:
            project = BrandProject(slug=slug, title=title, year=year)
            db.add(project)
            db.flush()  # assigns project.id for the BrandStill rows below
            for still, widths in still_widths.items():
                db.add(BrandStill(project_id=project.id, still=still, widths_json=json.dumps(widths)))
            result.new_projects += 1
            result.new_stills += len(still_widths)
        else:
            if project.title != title or project.year != year:
                project.title = title
                project.year = year
                result.updated_projects += 1

            existing_by_still = {s.still: s for s in project.stills}
            for still, widths in still_widths.items():
                widths_json = json.dumps(widths)
                existing = existing_by_still.get(still)
                if existing is None:
                    db.add(BrandStill(project_id=project.id, still=still, widths_json=widths_json))
                    result.new_stills += 1
                elif existing.widths_json != widths_json:
                    existing.widths_json = widths_json
                # A still present in existing_by_still but no longer discovered is
                # never deleted — matches Transfer's own never-delete convention;
                # a project transiently losing a still on one run isn't touched.

        db.commit()
        _upload_stills(root, slug, still_widths, already_uploaded)

    if result.warnings or result.new_projects or result.updated_projects or result.new_stills:
        log.info(
            "Brand sync: %d new project(s), %d updated, %d new still(s)%s",
            result.new_projects, result.updated_projects, result.new_stills,
            f", {len(result.warnings)} warning(s)" if result.warnings else "",
        )
        for w in result.warnings:
            log.warning(w)

    return result
