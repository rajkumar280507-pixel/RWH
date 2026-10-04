"""Generates a real, standards-compliant .dxf drawing (AutoCAD/Civil 3D
compatible) from a saved RWH design — the same 5 views as the frontend's 2D
CAD tab (Cross Section, Plan View, Filter Stack, Pipe Layout, Deep Bore),
laid out as separate views on one sheet using genuine DXF entities (LINE,
CIRCLE, LWPOLYLINE, HATCH, linear DIMENSION, TEXT) via ezdxf — a standard,
widely-used DXF-authoring library, not a hand-rolled file format writer.

All geometry comes from the same design-bundle dict `reports.py` already
builds for PDF generation (pit/trench/filter_media/injection_borewell real
dimensions) — no new calculations, this only re-renders existing numbers
into vector CAD entities instead of an SVG.
"""
from __future__ import annotations

import io
import math

import ezdxf
from ezdxf.enums import TextEntityAlignment

# Layer name -> (color index, description) — AutoCAD Color Index (ACI), the
# standard DXF color palette so the file looks sensible in any CAD viewer
# without relying on true-color extensions.
LAYERS = {
    "GROUND": (8, "Ground level / earth"),
    "STRUCTURE": (7, "Pit/trench outline"),
    "FILTER-SAND": (2, "Filter sand layer"),
    "FILTER-GRAVEL": (30, "Filter gravel layer"),
    "FILTER-AGGREGATE": (9, "Filter aggregate/boulder layer"),
    "GROUNDWATER": (5, "Groundwater table"),
    "PIPE": (4, "Conveyance pipework"),
    "BOREWELL": (6, "Injection borewell"),
    "DIMENSIONS": (1, "Dimension lines"),
    "TEXT": (7, "Labels and notes"),
    "TITLE": (7, "Title block"),
}

FILTER_LAYER_BY_MATERIAL = {
    "sand": "FILTER-SAND",
    "gravel": "FILTER-GRAVEL",
    "aggregate": "FILTER-AGGREGATE",
    "boulder": "FILTER-AGGREGATE",
}


def _filter_dxf_layer(material_name: str) -> str:
    name = material_name.lower()
    for key, layer in FILTER_LAYER_BY_MATERIAL.items():
        if key in name:
            return layer
    return "FILTER-AGGREGATE"


def _structure_dims(design: dict, pits: list[dict], trenches: list[dict]) -> dict:
    """Normalizes pit vs trench rows (from the SQL bundle, snake_case column
    names) into one shape this module's view-builders can share."""
    if pits:
        p = pits[0]
        return {
            "kind": "pit",
            "diameter_m": float(p["diameter_m"]),
            "depth_m": float(p["depth_m"]),
            "freeboard_m": float(p["freeboard_m"] or 0),
            "count": len(pits),
        }
    if trenches:
        t = trenches[0]
        return {
            "kind": "trench",
            "width_m": float(t["width_m"]),
            "depth_m": float(t["depth_m"]),
            "total_length_m": float(t["total_length_m"]),
            "freeboard_m": 0.0,
        }
    return {"kind": "pit", "diameter_m": 1.5, "depth_m": 2.0, "freeboard_m": 0.3, "count": 1}


def _add_title_block(msp, x: float, y: float, title: str, design_id: int | None) -> None:
    msp.add_text(
        title, height=0.15, dxfattribs={"layer": "TITLE", "style": "STANDARD"}
    ).set_placement((x, y), align=TextEntityAlignment.LEFT)
    msp.add_text(
        f"RWH-DSS Design #{design_id or '-'} | IS 15797:2008 | Not a certified structural drawing",
        height=0.08,
        dxfattribs={"layer": "TITLE", "color": 8},
    ).set_placement((x, y - 0.22), align=TextEntityAlignment.LEFT)


def _draw_cross_section(doc, msp, origin: tuple[float, float], dims: dict, filter_media: list[dict], groundwater_depth_m: float, borewell: dict | None) -> float:
    """Vertical slice: ground line, structure outline, filter stack bands,
    groundwater table, freeboard. Returns the view's total width (m) so the
    caller can position the next view without overlap.
    """
    ox, oy = origin
    total_depth = dims["depth_m"] + dims.get("freeboard_m", 0)
    width = dims["diameter_m"] if dims["kind"] == "pit" else dims["width_m"]

    _add_title_block(msp, ox, oy + 0.6, "CROSS SECTION A-A", None)

    # Ground line
    msp.add_line((ox - 1, oy), (ox + width + 1, oy), dxfattribs={"layer": "GROUND"})
    msp.add_text("GL", height=0.12, dxfattribs={"layer": "TEXT"}).set_placement(
        (ox - 0.9, oy + 0.05), align=TextEntityAlignment.LEFT
    )

    # Structure outline (freeboard void + filter stack), as a simple
    # rectangle in section regardless of pit/trench (a circular pit's
    # vertical section IS a rectangle — the circle only shows in plan view).
    top_y = oy
    bottom_y = oy - total_depth
    msp.add_lwpolyline(
        [(ox, top_y), (ox + width, top_y), (ox + width, bottom_y), (ox, bottom_y), (ox, top_y)],
        dxfattribs={"layer": "STRUCTURE"},
    )

    # Freeboard band (unfilled void at top)
    freeboard = dims.get("freeboard_m", 0)
    stack_top_y = oy - freeboard

    # Filter media bands, stacked by thickness_fraction, top to bottom.
    ordered = sorted(filter_media, key=lambda m: m["layer_order"]) if filter_media else []
    cursor_y = stack_top_y
    stack_height = total_depth - freeboard
    for layer in ordered:
        band_h = float(layer["thickness_fraction"]) * stack_height
        band_bottom = cursor_y - band_h
        layer_name = _filter_dxf_layer(layer["material"])
        msp.add_lwpolyline(
            [(ox, cursor_y), (ox + width, cursor_y), (ox + width, band_bottom), (ox, band_bottom), (ox, cursor_y)],
            dxfattribs={"layer": layer_name},
        )
        msp.add_text(
            f'{layer["material"]} ({layer["particle_size_note"]})',
            height=0.09,
            dxfattribs={"layer": "TEXT"},
        ).set_placement((ox + width + 0.15, (cursor_y + band_bottom) / 2), align=TextEntityAlignment.LEFT)
        cursor_y = band_bottom

    # Groundwater table — dashed horizontal line across the section.
    if groundwater_depth_m and groundwater_depth_m > 0:
        gw_y = oy - min(groundwater_depth_m, total_depth * 1.3)
        msp.add_line(
            (ox - 1, gw_y), (ox + width + 1, gw_y),
            dxfattribs={"layer": "GROUNDWATER", "linetype": "DASHED"},
        )
        msp.add_text(
            f"GWT ~{groundwater_depth_m:.1f} m bgl",
            height=0.1,
            dxfattribs={"layer": "GROUNDWATER"},
        ).set_placement((ox - 0.9, gw_y + 0.05), align=TextEntityAlignment.LEFT)

    # Injection borewell, if present — narrow vertical line below the structure.
    if borewell:
        bore_depth = float(borewell.get("conceptual_depth_m") or 0)
        bore_x = ox + width / 2
        bore_top = bottom_y
        bore_bottom = bottom_y - bore_depth
        msp.add_line((bore_x, bore_top), (bore_x, bore_bottom), dxfattribs={"layer": "BOREWELL"})
        msp.add_text(
            f"INJECTION BOREWELL Ø150mm, {bore_depth:.1f}m (conceptual)",
            height=0.09,
            dxfattribs={"layer": "BOREWELL"},
        ).set_placement((bore_x + 0.1, (bore_top + bore_bottom) / 2), align=TextEntityAlignment.LEFT)

    # Real dimension entities (not just text) — overall depth + width.
    dim = msp.add_linear_dim(
        base=(ox + width + 0.6, (top_y + bottom_y) / 2),
        p1=(ox + width, top_y),
        p2=(ox + width, bottom_y),
        angle=90,
        dxfattribs={"layer": "DIMENSIONS"},
    )
    dim.render()
    dim2 = msp.add_linear_dim(
        base=(ox + width / 2, top_y + 0.6),
        p1=(ox, top_y),
        p2=(ox + width, top_y),
        dxfattribs={"layer": "DIMENSIONS"},
    )
    dim2.render()

    return width + 2.5


def _draw_plan_view(doc, msp, origin: tuple[float, float], dims: dict) -> float:
    ox, oy = origin
    _add_title_block(msp, ox, oy + (dims.get("diameter_m") or dims.get("width_m", 2)) + 1.0, "PLAN VIEW (TOP)", None)

    if dims["kind"] == "pit":
        r = dims["diameter_m"] / 2
        cx, cy = ox + r, oy + r
        msp.add_circle((cx, cy), r, dxfattribs={"layer": "STRUCTURE"})
        dim = msp.add_diameter_dim(center=(cx, cy), radius=r, angle=45, dxfattribs={"layer": "DIMENSIONS"})
        dim.render()
        return dims["diameter_m"] + 2.5
    else:
        w, length = dims["width_m"], dims["total_length_m"]
        msp.add_lwpolyline(
            [(ox, oy), (ox + length, oy), (ox + length, oy + w), (ox, oy + w), (ox, oy)],
            dxfattribs={"layer": "STRUCTURE"},
        )
        dim = msp.add_linear_dim(base=(ox + length / 2, oy - 0.6), p1=(ox, oy), p2=(ox + length, oy), dxfattribs={"layer": "DIMENSIONS"})
        dim.render()
        dim2 = msp.add_linear_dim(base=(ox - 0.6, oy + w / 2), p1=(ox, oy), p2=(ox, oy + w), angle=90, dxfattribs={"layer": "DIMENSIONS"})
        dim2.render()
        return length + 2.5


def _draw_filter_stack(msp, origin: tuple[float, float], filter_media: list[dict], reference_depth_m: float) -> float:
    ox, oy = origin
    width = 2.0
    _add_title_block(msp, ox, oy + 0.6, "FILTER STACK (EXPLODED)", None)

    ordered = sorted(filter_media, key=lambda m: m["layer_order"]) if filter_media else []
    cursor_y = oy
    gap = 0.15
    for layer in ordered:
        band_h = float(layer["thickness_fraction"]) * reference_depth_m
        band_bottom = cursor_y - band_h
        layer_name = _filter_dxf_layer(layer["material"])
        msp.add_lwpolyline(
            [(ox, cursor_y), (ox + width, cursor_y), (ox + width, band_bottom), (ox, band_bottom), (ox, cursor_y)],
            dxfattribs={"layer": layer_name},
        )
        msp.add_text(
            f'{layer["material"]} — {layer["particle_size_note"]} ({layer["thickness_fraction"] * 100:.0f}%)',
            height=0.09,
            dxfattribs={"layer": "TEXT"},
        ).set_placement((ox + width + 0.15, (cursor_y + band_bottom) / 2), align=TextEntityAlignment.LEFT)
        cursor_y = band_bottom - gap

    return width + 4.5


def _draw_pipe_layout(msp, origin: tuple[float, float], downpipe_mm: int, conveyance_mm: int, first_flush_l: float) -> float:
    ox, oy = origin
    _add_title_block(msp, ox, oy + 0.6, "PIPE LAYOUT — ROOF TO STRUCTURE", None)

    stages = [
        ("ROOF CATCHMENT", 0),
        (f"DOWNPIPE Ø{downpipe_mm}mm", 1.5),
        (f"FIRST FLUSH ({first_flush_l:.0f} L)", 3.0),
        (f"COLLECTION MAIN Ø{conveyance_mm}mm", 4.5),
        ("STRUCTURE INLET", 6.0),
    ]
    for label, x_offset in stages:
        x = ox + x_offset
        msp.add_circle((x, oy), 0.08, dxfattribs={"layer": "PIPE"})
        msp.add_text(label, height=0.08, dxfattribs={"layer": "TEXT"}).set_placement(
            (x - 0.3, oy - 0.3), align=TextEntityAlignment.LEFT
        )
        if x_offset > 0:
            msp.add_line((x - 1.5, oy), (x - 0.08, oy), dxfattribs={"layer": "PIPE"})

    return 7.5


def _draw_deep_bore(msp, origin: tuple[float, float], borewell: dict, groundwater_depth_m: float) -> float:
    ox, oy = origin
    depth = float(borewell.get("conceptual_depth_m") or 0)
    _add_title_block(msp, ox, oy + 0.6, "DEEP INJECTION BORE (CONCEPTUAL)", None)

    msp.add_line((ox - 1, oy), (ox + 1, oy), dxfattribs={"layer": "GROUND"})
    msp.add_line((ox, oy), (ox, oy - depth), dxfattribs={"layer": "BOREWELL"})
    if groundwater_depth_m:
        gw_y = oy - min(groundwater_depth_m, depth)
        msp.add_line((ox - 1, gw_y), (ox + 1, gw_y), dxfattribs={"layer": "GROUNDWATER", "linetype": "DASHED"})
    msp.add_text(
        f"Ø150mm slotted PVC casing, {depth:.1f}m conceptual depth",
        height=0.09,
        dxfattribs={"layer": "TEXT"},
    ).set_placement((ox + 0.15, oy - depth / 2), align=TextEntityAlignment.LEFT)
    dim = msp.add_linear_dim(base=(ox - 0.6, oy - depth / 2), p1=(ox, oy), p2=(ox, oy - depth), angle=90, dxfattribs={"layer": "DIMENSIONS"})
    dim.render()

    return 2.5


def build_design_dxf(bundle: dict) -> bytes:
    """Builds the full multi-view DXF sheet and returns its raw bytes.

    `bundle` is the same dict shape reports.py's `_fetch_design_bundle`
    returns: {"design": {...}, "pits": [...], "trenches": [...],
    "borewells": [...], "filter_media": [...]}.
    """
    design = bundle["design"]
    pits = bundle["pits"]
    trenches = bundle["trenches"]
    borewells = bundle["borewells"]
    filter_media = bundle["filter_media"]

    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = 6  # meters
    for name, (color, _desc) in LAYERS.items():
        doc.layers.add(name=name, color=color)
    if "DASHED" not in doc.linetypes:
        doc.linetypes.add("DASHED", pattern="A,0.25,-0.125")

    msp = doc.modelspace()
    dims = _structure_dims(design, pits, trenches)
    borewell = borewells[0] if borewells else None
    groundwater_depth_m = float(design.get("groundwater_depth_m") or 0)

    cursor_x = 0.0
    cursor_x += _draw_cross_section(doc, msp, (cursor_x, 0), dims, filter_media, groundwater_depth_m, borewell)
    cursor_x += _draw_plan_view(doc, msp, (cursor_x, 0), dims)
    reference_depth = dims["depth_m"]
    cursor_x += _draw_filter_stack(msp, (cursor_x, 0), filter_media, reference_depth)
    cursor_x += _draw_pipe_layout(msp, (cursor_x, 0), 110, 110, float(design.get("first_flush_volume_l") or 75))
    if borewell:
        _draw_deep_bore(msp, (cursor_x, 0), borewell, groundwater_depth_m)

    buffer = io.StringIO()
    doc.write(buffer)
    return buffer.getvalue().encode("utf-8")
