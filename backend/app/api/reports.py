"""PDF report generation for saved RWH designs (Phase 7).

Renders `app/templates/report.html` (Jinja2) to PDF via
`app/pdf/render.render_report_pdf` (xhtml2pdf — see that module's docstring
for why WeasyPrint isn't used), generates a QR code linking back to the
design, saves both to `static/reports/`, and records the result in the
existing (previously unused) `reports` table.

Follows the same `db.execute(text(...))` raw-SQL pattern used throughout
`app/api/rwh_design.py` rather than introducing an ORM layer for this one
feature.
"""
from __future__ import annotations

import base64
import io
import re
from datetime import datetime
from pathlib import Path

import qrcode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.database.session import get_db
from app.pdf.render import PdfRenderError, render_report_pdf

router = APIRouter(prefix="/api/reports", tags=["reports"])

settings = get_settings()

BACKEND_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_DIR = BACKEND_ROOT / "app" / "templates"
REPORTS_DIR = BACKEND_ROOT / "static" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

_jinja_env = None


def _get_jinja_env():
    """Lazily builds the Jinja2 environment (import kept local so this
    module still imports cleanly even if jinja2 were ever missing)."""
    global _jinja_env
    if _jinja_env is None:
        from jinja2 import Environment, FileSystemLoader, select_autoescape

        _jinja_env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=select_autoescape(["html"]),
        )
    return _jinja_env


class ReportGenerateRequest(BaseModel):
    cad_drawing_image: str | None = None  # data URL, e.g. "data:image/png;base64,..."
    snapshot_3d_image: str | None = None  # data URL from the 3D scene's Snapshot button
    prepared_by_name: str | None = None
    prepared_by_designation: str | None = None
    reviewed_by_name: str | None = None
    reviewed_by_designation: str | None = None


def _fetch_design_bundle(db: Session, design_id: int) -> dict | None:
    """Same query shape as `rwh_design.get_design`, plus a building join for
    the report cover page (name/type), which that endpoint doesn't need."""
    design = db.execute(
        text(
            """
            SELECT d.*, b.name AS building_name, b.building_type,
                   b.centroid_lat AS building_lat, b.centroid_lon AS building_lon
            FROM rwh_designs d
            JOIN buildings b ON b.id = d.building_id
            WHERE d.id = :id
            """
        ),
        {"id": design_id},
    ).mappings().one_or_none()
    if not design:
        return None

    pits = db.execute(text("SELECT * FROM recharge_pits WHERE design_id = :id"), {"id": design_id}).mappings().all()
    trenches = db.execute(
        text("SELECT * FROM recharge_trenches WHERE design_id = :id"), {"id": design_id}
    ).mappings().all()
    borewells = db.execute(
        text("SELECT * FROM injection_borewells WHERE design_id = :id"), {"id": design_id}
    ).mappings().all()
    filter_media = db.execute(
        text("SELECT * FROM filter_media_layers WHERE design_id = :id ORDER BY layer_order"), {"id": design_id}
    ).mappings().all()
    boq = db.execute(text("SELECT * FROM boq_items WHERE design_id = :id"), {"id": design_id}).mappings().all()

    return {
        "design": dict(design),
        "pits": [dict(r) for r in pits],
        "trenches": [dict(r) for r in trenches],
        "borewells": [dict(r) for r in borewells],
        "filter_media": [dict(r) for r in filter_media],
        "boq": [dict(r) for r in boq],
    }


def _build_recommendation(design: dict, pit_count: int) -> dict:
    """Rule-based decision-support text, mirroring the logic/tone of
    `frontend/src/components/AiRecommendationPanel.jsx` so the PDF and the
    live dashboard never contradict each other. Deliberately simple
    if/else over persisted figures — not a model call.
    """
    gw = design.get("groundwater_depth_m")
    rainfall = design.get("annual_rainfall_mm")
    harvest = design.get("annual_harvest_m3")

    reasons: list[str] = []
    priority = "Medium"
    headline = ""

    gw = float(gw) if gw is not None else None
    rainfall = float(rainfall) if rainfall is not None else None

    if gw is not None:
        if gw > 15:
            priority = "High"
            headline = f"Groundwater at this site is deep ({gw:.1f} m bgl) — prioritize recharge structures here."
            reasons.append(f"Water table depth of {gw:.1f} m bgl indicates significant aquifer drawdown.")
        elif gw > 8:
            priority = "Medium"
            headline = f"Groundwater at this site is at a moderate depth ({gw:.1f} m bgl) — recharge is recommended as a preventive measure."
            reasons.append("Water table depth is within a manageable range but trending toward depletion risk without intervention.")
        else:
            priority = "Low"
            headline = f"Groundwater at this site is relatively shallow ({gw:.1f} m bgl) — levels currently appear adequate."
            reasons.append("Current water table depth suggests existing recharge is broadly keeping pace with extraction.")
    else:
        headline = "Groundwater depth was not recorded for this design; recharge priority could not be assessed."

    if rainfall is not None:
        if rainfall >= 800:
            reasons.append(f"Annual rainfall ({rainfall:.0f} mm) is favorable for rooftop harvesting and recharge.")
        elif rainfall < 500:
            reasons.append(f"Annual rainfall ({rainfall:.0f} mm) is comparatively low — size storage conservatively and treat recharge as supplementary.")
        else:
            reasons.append(f"Annual rainfall ({rainfall:.0f} mm) is moderate — a balanced harvesting-plus-recharge approach is appropriate.")

    if harvest is not None:
        harvest_f = float(harvest)
        reasons.append(
            f"Estimated annual harvest of {harvest_f:.2f} m³ could support {pit_count or 1} recharge "
            f"pit{'s' if (pit_count or 1) != 1 else ''} sized per IS 15797:2008."
        )

    return {"headline": headline, "reasons": reasons, "priority": priority}


def _image_to_data_uri(image_bytes: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"


_DATA_URL_RE = re.compile(r"^data:image/(png|jpe?g|webp);base64,", re.IGNORECASE)


def _sanitize_data_url(value: str | None) -> str | None:
    """Accepts only well-formed base64 image data URLs from the client;
    anything else is dropped rather than embedded verbatim into the PDF."""
    if not value or not isinstance(value, str):
        return None
    if not _DATA_URL_RE.match(value):
        return None
    return value


@router.post("/{design_id}/generate")
def generate_report(design_id: int, payload: ReportGenerateRequest, db: Session = Depends(get_db)):
    bundle = _fetch_design_bundle(db, design_id)
    if bundle is None:
        raise HTTPException(404, "Design not found")

    design = bundle["design"]
    boq = bundle["boq"]
    boq_total = sum(float(item.get("amount_inr") or 0) for item in boq)

    recommendation = _build_recommendation(design, len(bundle["pits"]))

    verification_url = f"{settings.frontend_url.rstrip('/')}/reports?design_id={design_id}"

    qr_img = qrcode.make(verification_url)
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_bytes = qr_buffer.getvalue()
    qr_code_data_uri = _image_to_data_uri(qr_bytes)

    generated_at = datetime.utcnow()
    timestamp = generated_at.strftime("%Y%m%d%H%M%S")

    building = {
        "name": design.get("building_name"),
        "building_type": design.get("building_type"),
    }

    context = {
        "design": design,
        "building": building,
        "pits": bundle["pits"],
        "trenches": bundle["trenches"],
        "borewells": bundle["borewells"],
        "filter_media": bundle["filter_media"],
        "boq": boq,
        "boq_total": boq_total,
        "recommendation": recommendation,
        "generated_at": generated_at.strftime("%Y-%m-%d %H:%M UTC"),
        "generated_at_date": generated_at.strftime("%Y-%m-%d"),
        "cad_drawing_image": _sanitize_data_url(payload.cad_drawing_image),
        "snapshot_3d_image": _sanitize_data_url(payload.snapshot_3d_image),
        "qr_code_data_uri": qr_code_data_uri,
        "verification_url": verification_url,
        "prepared_by_name": payload.prepared_by_name,
        "prepared_by_designation": payload.prepared_by_designation,
        "reviewed_by_name": payload.reviewed_by_name,
        "reviewed_by_designation": payload.reviewed_by_designation,
    }

    template = _get_jinja_env().get_template("report.html")
    html_string = template.render(**context)

    try:
        pdf_bytes = render_report_pdf(html_string)
    except PdfRenderError as exc:
        raise HTTPException(500, f"Failed to render PDF report: {exc}") from exc

    pdf_filename = f"report_design{design_id}_{timestamp}.pdf"
    qr_filename = f"qr_design{design_id}_{timestamp}.png"
    pdf_path = REPORTS_DIR / pdf_filename
    qr_path = REPORTS_DIR / qr_filename
    pdf_path.write_bytes(pdf_bytes)
    qr_path.write_bytes(qr_bytes)

    # Stored relative to the backend root so it's portable across machines
    # and directly resolvable under the /static mount in main.py.
    file_path_rel = f"static/reports/{pdf_filename}"
    qr_path_rel = f"static/reports/{qr_filename}"

    result = db.execute(
        text(
            "INSERT INTO reports (design_id, file_path, qr_code_path, generated_at) "
            "VALUES (:design_id, :file_path, :qr_code_path, :generated_at)"
        ),
        {
            "design_id": design_id,
            "file_path": file_path_rel,
            "qr_code_path": qr_path_rel,
            "generated_at": generated_at,
        },
    )
    db.commit()
    report_id = result.lastrowid

    return {
        "id": report_id,
        "design_id": design_id,
        "file_path": file_path_rel,
        "qr_code_path": qr_path_rel,
        "generated_at": generated_at.isoformat(),
        "download_url": f"/api/reports/{design_id}/download",
        "qr_code_url": f"/{qr_path_rel}",
        "verification_url": verification_url,
    }


@router.get("/{design_id}")
def get_report(design_id: int, db: Session = Depends(get_db)):
    """Latest generated report for a design, or {"report": null} if none
    has been generated yet — deliberately 200-with-null rather than 404 so
    the frontend can render an idle "Generate" state without error handling.
    """
    row = db.execute(
        text(
            "SELECT * FROM reports WHERE design_id = :id ORDER BY generated_at DESC LIMIT 1"
        ),
        {"id": design_id},
    ).mappings().one_or_none()
    if not row:
        return {"report": None}

    report = dict(row)
    return {
        "report": {
            **report,
            "download_url": f"/api/reports/{design_id}/download",
            "qr_code_url": f"/{report['qr_code_path']}" if report.get("qr_code_path") else None,
        }
    }


@router.get("/{design_id}/download")
def download_report(design_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        text(
            "SELECT * FROM reports WHERE design_id = :id ORDER BY generated_at DESC LIMIT 1"
        ),
        {"id": design_id},
    ).mappings().one_or_none()
    if not row:
        raise HTTPException(404, "No report has been generated for this design yet")

    pdf_path = BACKEND_ROOT / row["file_path"]
    if not pdf_path.exists():
        raise HTTPException(404, "Report file is missing from disk; regenerate the report")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"rwh-design-{design_id}-report.pdf",
    )
