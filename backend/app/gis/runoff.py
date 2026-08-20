"""Runoff coefficient and hydrologic-soil-group lookups used by the RWH
design engine. Values are standard textbook/CGWB-manual ranges (CPHEEO
Manual on Water Supply and Treatment; CGWB Master Plan for Artificial
Recharge to Ground Water, 2020) — treat them as engineering defaults, not a
substitute for a site-specific study.
"""
from __future__ import annotations

# (material -> (typical coefficient, [min, max])); slope adds a small bump
# because steeper roofs shed water faster with less local ponding/absorption.
ROOF_MATERIAL_RUNOFF_COEFFICIENTS: dict[str, tuple[float, tuple[float, float]]] = {
    "rcc_flat": (0.80, (0.75, 0.85)),
    "rcc_sloped": (0.85, (0.80, 0.90)),
    "gi_sheet": (0.90, (0.85, 0.95)),
    "tiled": (0.80, (0.75, 0.85)),
    "asbestos_sheet": (0.80, (0.75, 0.85)),
    "thatched": (0.65, (0.55, 0.70)),
    "green_roof": (0.40, (0.25, 0.50)),
}

DEFAULT_RUNOFF_COEFFICIENT = 0.80


def get_runoff_coefficient(roof_material: str, slope_percent: float | None = None) -> float:
    key = (roof_material or "").strip().lower().replace(" ", "_")
    base, (lo, hi) = ROOF_MATERIAL_RUNOFF_COEFFICIENTS.get(key, (DEFAULT_RUNOFF_COEFFICIENT, (0.7, 0.85)))
    if slope_percent is None:
        return base
    # Linear nudge toward the top of the material's range as slope rises
    # from 0% (flat) to 15%+ (steep); capped at the documented max.
    slope_factor = min(max(slope_percent, 0.0), 15.0) / 15.0
    return round(min(base + slope_factor * (hi - base), hi), 3)


# Soil type -> (Hydrologic Soil Group, typical permeability mm/hr).
# HSG follows the standard USDA/NRCS A-D infiltration classification, cross
# referenced against the soil_zones.hydrologic_group seed values.
SOIL_TYPE_TO_HSG: dict[str, tuple[str, float]] = {
    "sandy": ("A", 30.0),
    "sandy_loam": ("A", 25.0),
    "loamy_sand": ("A", 20.0),
    "loam": ("B", 12.0),
    "silt_loam": ("B", 8.0),
    "sandy_clay_loam": ("C", 5.0),
    "clay_loam": ("C", 4.0),
    "silty_clay": ("D", 1.5),
    "clay": ("D", 1.0),
    "clayey": ("D", 1.0),
}

DEFAULT_HSG = "B"
DEFAULT_PERMEABILITY_MM_HR = 12.0


def get_hydrologic_soil_group(soil_type: str) -> tuple[str, float]:
    key = (soil_type or "").strip().lower().replace(" ", "_")
    return SOIL_TYPE_TO_HSG.get(key, (DEFAULT_HSG, DEFAULT_PERMEABILITY_MM_HR))


def is_clayey(soil_type: str) -> bool:
    key = (soil_type or "").strip().lower()
    return "clay" in key
