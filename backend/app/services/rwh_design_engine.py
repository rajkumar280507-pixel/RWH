"""RWH design engine: turns rooftop + site parameters into a complete
recharge structure design — runoff/harvest/recharge volumes, adaptive pit or
trench sizing, injection-borewell trigger, filter media stack, and BOQ.

This module is pure computation (no DB, no FastAPI) so it can be unit
tested and reused by the report generator / drawing generator without
pulling in the web stack. `app/api/rwh_design.py` calls `compute_design()`
and hands the result to `app/repositories/design_repository.py` to persist.

Every numeric default here is a documented engineering approximation, not a
substitute for a site-specific geotechnical/hydrogeological investigation —
see the `warnings` list on the output, which is populated whenever an
assumption materially affects the recommendation.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.gis.runoff import get_hydrologic_soil_group, get_runoff_coefficient, is_clayey

# ---------------------------------------------------------------------------
# Constants (engineering defaults — see module docstring)
# ---------------------------------------------------------------------------
SMALL_ROOF_AREA_THRESHOLD_SQM = 150.0
SMALL_ROOF_HSG = ("A", "B")

PIT_MIN_DIAMETER_M = 1.5
PIT_MAX_DIAMETER_M = 2.5
PIT_PRACTICAL_MAX_DEPTH_M = 3.0
PIT_MIN_SEPARATION_ABOVE_GWT_M = 3.0
PIT_FREEBOARD_M = 0.3

TRENCH_WIDTH_M = 1.0
TRENCH_PRACTICAL_MAX_DEPTH_M = 2.5
TRENCH_MAX_SEGMENT_LENGTH_M = 12.0

BOREWELL_GW_DEPTH_TRIGGER_M = 8.0
BOREWELL_HSG_TRIGGER = ("C", "D")

RECHARGE_EFFICIENCY = 0.85  # fraction of harvested runoff that actually reaches the structure
FIRST_FLUSH_LOSS_FRACTION = 0.02  # diverted before entering the system, per event

# Recharge pits/trenches are NOT sized to hold a whole year's runoff at once —
# they drain continuously by infiltration between storms. The physical
# structure is sized to buffer one representative heavy storm event; annual
# rainfall only feeds the *informational* annual water-balance figures
# (harvest/recharge totals, expected GW rise). 50 mm is a commonly used
# conservative design-storm depth in Indian municipal RWH guidelines
# (e.g. Chennai Metrowater); override per-site with real IDF data when available.
DEFAULT_DESIGN_STORM_MM = 50.0

# --- Hydraulic design constants -----------------------------------------
# Peak rainfall intensity for pipe sizing. Rational-method practice for
# Indian urban RWH commonly designs the roof drainage for a short-duration
# intensity well above the daily design storm; 75 mm/hr is a widely used
# figure in CPHEEO/IS 1742 style rainwater-pipe tables. Override per site
# from local IDF curves when available.
DESIGN_RAINFALL_INTENSITY_MM_HR = 75.0

# Commercially available uPVC rainwater pipe sizes (mm nominal bore).
STANDARD_PIPE_SIZES_MM = [75, 90, 110, 125, 160, 200, 250, 315]

# Full-bore velocity assumed for gravity rainwater downpipes (m/s). Kept
# conservative: high enough to be self-cleansing, low enough to avoid
# scouring and noise.
PIPE_DESIGN_VELOCITY_M_S = 1.2

# First-flush diversion: volume discarded before harvesting, per m² of roof.
# IS 15797 / CGWB practice is ~0.5-1.0 mm of rainfall depth over the roof.
FIRST_FLUSH_MM = 0.5

# Specific yield (drainable porosity) used to convert a recharge volume into
# an expected water-table rise. Typical range 0.10-0.25 for weathered
# formations; 0.15 is a mid-range default. Site-specific pumping-test values
# should replace this for any real submission.
DEFAULT_SPECIFIC_YIELD = 0.15
# Radius of influence assumed when spreading recharged volume over an area
# to estimate a water-table rise.
RECHARGE_INFLUENCE_RADIUS_M = 15.0

# Excavation is over-dug beyond the net structure volume for working space
# and side batter.
EXCAVATION_OVERBREAK_FACTOR = 1.15

# Filter media stack: (name, thickness_fraction, particle_size_note, bulk_density_kg_m3, porosity, hydraulic_conductivity_mm_hr)
FILTER_MEDIA_STACK = [
    {
        "layer_order": 1,
        "material": "Coarse sand",
        "thickness_fraction": 0.25,
        "particle_size_note": "1.5-2.0 mm",
        "bulk_density_kg_m3": 1600.0,
        "porosity": 0.35,
        "hydraulic_conductivity_mm_hr": 3000.0,
    },
    {
        "layer_order": 2,
        "material": "Graded gravel",
        "thickness_fraction": 0.25,
        "particle_size_note": "5-10 mm",
        "bulk_density_kg_m3": 1500.0,
        "porosity": 0.40,
        "hydraulic_conductivity_mm_hr": 12000.0,
    },
    {
        "layer_order": 3,
        "material": "Coarse aggregate / boulders",
        "thickness_fraction": 0.50,
        "particle_size_note": "50-200 mm, clean and durable",
        "bulk_density_kg_m3": 1450.0,
        "porosity": 0.45,
        "hydraulic_conductivity_mm_hr": 36000.0,
    },
]

# Illustrative unit rates (INR) — a Schedule-of-Rates stand-in. Replace with
# the current state PWD/CPWD SOR before using these figures for a real
# tender estimate; that's why every BOQ response also carries `rates_note`.
UNIT_RATES_INR = {
    "excavation_m3": 220.0,
    "coarse_sand_m3": 1450.0,
    "graded_gravel_m3": 1300.0,
    "boulders_m3": 950.0,
    "pvc_inlet_pipe_m": 320.0,
    "overflow_pipe_m": 280.0,
    "rcc_cover_slab_no": 3500.0,
    "inspection_chamber_no": 6500.0,
    "brick_masonry_lining_m3": 4200.0,
    "first_flush_diverter_no": 2800.0,
    "leaf_screen_no": 450.0,
    "slotted_casing_m": 850.0,
}


@dataclass
class RwhDesignInput:
    roof_area_sqm: float
    roof_material: str
    roof_slope_percent: float | None
    annual_rainfall_mm: float
    groundwater_depth_m: float
    soil_type: str
    available_open_area_sqm: float | None = None
    population: int | None = None
    per_capita_demand_lpd: float = 135.0  # CPHEEO urban domestic norm
    storage_days: float = 2.0
    distance_to_inlet_m: float = 10.0
    allow_shallow_override: bool = False  # explicit operator override of the 3m separation rule
    design_storm_mm: float = DEFAULT_DESIGN_STORM_MM  # used to physically size the structure, not annual_rainfall_mm


@dataclass
class RwhDesignResult:
    inputs: RwhDesignInput = field(repr=False)
    runoff_coefficient: float = 0.0
    hydrologic_soil_group: str = "B"
    permeability_mm_hr: float = 0.0
    catchment_area_sqm: float = 0.0
    gross_annual_runoff_m3: float = 0.0
    annual_harvest_m3: float = 0.0
    annual_recharge_target_m3: float = 0.0
    design_storm_volume_m3: float = 0.0
    storage_tank_m3: float | None = None
    structure_type: str = "recharge_pit"
    pit: dict | None = None
    trench: dict | None = None
    injection_borewell: dict | None = None
    filter_media: list[dict] = field(default_factory=list)
    boq: list[dict] = field(default_factory=list)
    estimated_cost_inr: float = 0.0
    warnings: list[str] = field(default_factory=list)
    # Hydraulic design outputs a civil engineer would expect to see stated.
    peak_rainfall_intensity_mm_hr: float = 0.0
    peak_discharge_lps: float = 0.0
    downpipe_diameter_mm: int = 0
    downpipe_count: int = 0
    conveyance_pipe_diameter_mm: int = 0
    overflow_pipe_diameter_mm: int = 0
    first_flush_volume_l: float = 0.0
    desilting_chamber_m3: float = 0.0
    infiltration_rate_m3_per_hr: float = 0.0
    time_to_empty_hr: float = 0.0
    excavation_volume_m3: float = 0.0
    expected_gw_rise_m: float = 0.0
    # Step-by-step working: [{step, quantity, formula, substitution, result, unit, reference}]
    calculation_sheet: list[dict] = field(default_factory=list)


def compute_design(inputs: RwhDesignInput) -> RwhDesignResult:
    result = RwhDesignResult(inputs=inputs)
    warnings = result.warnings

    # 1. Runoff coefficient + hydrology
    result.runoff_coefficient = get_runoff_coefficient(inputs.roof_material, inputs.roof_slope_percent)
    hsg, permeability = get_hydrologic_soil_group(inputs.soil_type)
    result.hydrologic_soil_group = hsg
    result.permeability_mm_hr = permeability

    # 2. Catchment / harvest / recharge volumes
    result.catchment_area_sqm = round(inputs.roof_area_sqm, 2)
    result.gross_annual_runoff_m3 = round(
        inputs.roof_area_sqm * (inputs.annual_rainfall_mm / 1000.0) * result.runoff_coefficient, 2
    )
    result.annual_harvest_m3 = round(result.gross_annual_runoff_m3 * (1 - FIRST_FLUSH_LOSS_FRACTION), 2)

    # 3. Storage tank sizing (domestic demand), only if population is given —
    #    the remainder of the harvest is what gets targeted at recharge.
    storage_allocation_m3 = 0.0
    if inputs.population:
        demand_m3 = (inputs.population * inputs.per_capita_demand_lpd * inputs.storage_days) / 1000.0
        result.storage_tank_m3 = round(min(demand_m3, result.annual_harvest_m3 * 0.25), 2)
        storage_allocation_m3 = result.storage_tank_m3

    result.annual_recharge_target_m3 = round(
        max(result.annual_harvest_m3 - storage_allocation_m3, 0.0) * RECHARGE_EFFICIENCY, 2
    )

    # 3b. Design-storm volume: what the pit/trench must physically buffer
    # during one representative heavy rain event (it empties by infiltration
    # between storms, so this is independent of the annual total above).
    result.design_storm_volume_m3 = round(
        inputs.roof_area_sqm * (inputs.design_storm_mm / 1000.0) * result.runoff_coefficient, 3
    )

    # 4. Depth budget: structures must terminate >=3m above the seasonal GWT.
    available_depth = inputs.groundwater_depth_m - PIT_MIN_SEPARATION_ABOVE_GWT_M
    if available_depth < 1.0:
        if inputs.allow_shallow_override:
            available_depth = max(available_depth, 1.0)
            warnings.append(
                "Groundwater table is shallow enough that the standard 3.0 m separation leaves "
                "under 1.0 m of usable depth; proceeding only because allow_shallow_override was set. "
                "This configuration requires a site-specific hydrogeological assessment and regulatory sign-off."
            )
        else:
            available_depth = 1.0
            warnings.append(
                "Groundwater table is within ~4 m of the surface. The 3.0 m separation rule caps usable "
                "structure depth at ~1.0 m, which is impractical for a gravity recharge pit/trench alone — "
                "a site-specific hydrogeological assessment is required before construction."
            )

    # 5. Adaptive structure selection: pit for small roofs on free-draining
    #    soil, trench for larger catchments or where a single pit can't hold
    #    the target volume.
    if inputs.roof_area_sqm <= SMALL_ROOF_AREA_THRESHOLD_SQM and hsg in SMALL_ROOF_HSG:
        result.structure_type = "recharge_pit"
        result.pit = _design_pits(result.design_storm_volume_m3, available_depth, warnings)
        structure_volume_m3 = result.pit["total_volume_m3"]
        structure_count = result.pit["pit_count"]
    else:
        result.structure_type = "recharge_trench"
        result.trench = _design_trench(result.design_storm_volume_m3, available_depth, warnings)
        structure_volume_m3 = result.trench["total_volume_m3"]
        structure_count = result.trench["segment_count"]

    # 6. Injection borewell trigger (independent of the pit/trench recommendation —
    #    it supplements, rather than replaces, surface recharge when the soil/GW
    #    profile means gravity infiltration alone won't be effective).
    trigger_reasons = []
    if inputs.groundwater_depth_m > BOREWELL_GW_DEPTH_TRIGGER_M:
        trigger_reasons.append("groundwater_depth_gt_8m")
    if hsg in BOREWELL_HSG_TRIGGER:
        trigger_reasons.append("hydrologic_soil_group_c_or_d")
    if is_clayey(inputs.soil_type):
        trigger_reasons.append("clayey_soil")

    if trigger_reasons:
        result.injection_borewell = {
            "recommended": True,
            "trigger_reason": ", ".join(trigger_reasons),
            "conceptual_depth_m": round(inputs.groundwater_depth_m + 5.0, 1),
            "casing_zone_note": "Slotted casing opposite identified water-bearing zones only; finalize from bore log.",
            "gravel_pack_note": "Gravel pack (5-10 mm) around slotted casing zone, sized per screen slot width.",
            "warning_text": (
                "Bore depth, casing, and screen intervals must be finalized from site-specific "
                "geological logs and regulatory approval rather than these illustrative defaults."
            ),
        }
        warnings.append(
            f"Injection borewell recommended in addition to the {result.structure_type.replace('_', ' ')} "
            f"because: {', '.join(trigger_reasons)}. Treat the pit/trench as a pretreatment/silt-trap stage "
            "feeding the bore, not a replacement for it."
        )

    # 7. Filter media stack, sized against the structure volume.
    result.filter_media = _design_filter_media(structure_volume_m3)

    # 8. Hydraulic design: peak flow, pipe sizing, first flush, desilting,
    #    infiltration/emptying time, excavation, expected water-table rise.
    _compute_hydraulics(inputs, result, structure_volume_m3, structure_count)

    # 9. BOQ + indicative cost.
    result.boq = _build_boq(
        structure_type=result.structure_type,
        structure_volume_m3=structure_volume_m3,
        structure_count=structure_count,
        filter_media=result.filter_media,
        distance_to_inlet_m=inputs.distance_to_inlet_m,
        has_borewell=bool(result.injection_borewell),
        excavation_volume_m3=result.excavation_volume_m3,
        downpipe_count=result.downpipe_count,
        downpipe_diameter_mm=result.downpipe_diameter_mm,
    )
    result.estimated_cost_inr = round(sum(item["amount_inr"] for item in result.boq), 2)

    # 10. Assemble the show-your-working sheet last, so every figure it cites
    #     is already final.
    result.calculation_sheet = _build_calculation_sheet(inputs, result, structure_volume_m3)

    return result


def _compute_hydraulics(
    inputs: RwhDesignInput,
    result: RwhDesignResult,
    structure_volume_m3: float,
    structure_count: int,
) -> None:
    """Rational-method peak flow and the pipe/chamber sizing that follows."""
    # Rational method: Q = C x i x A, in litres/second.
    #   C  = runoff coefficient (dimensionless)
    #   i  = design intensity (mm/hr)
    #   A  = catchment area (m²)
    # (C x i[mm/hr] x A[m²]) / 3600 gives litres/second directly, since
    # 1 mm over 1 m² = 1 litre.
    intensity = DESIGN_RAINFALL_INTENSITY_MM_HR
    result.peak_rainfall_intensity_mm_hr = intensity
    peak_lps = (result.runoff_coefficient * intensity * inputs.roof_area_sqm) / 3600.0
    result.peak_discharge_lps = round(peak_lps, 3)

    # Downpipes: split the peak flow across enough pipes that each stays at a
    # sane commercial size rather than specifying one oversized stack.
    downpipe_count = max(1, math.ceil(inputs.roof_area_sqm / 100.0))
    per_pipe_lps = peak_lps / downpipe_count
    downpipe_mm, _req = _pipe_diameter_for_flow(per_pipe_lps)
    result.downpipe_count = downpipe_count
    result.downpipe_diameter_mm = downpipe_mm

    # The collection main carries the whole roof's flow to the structure.
    result.conveyance_pipe_diameter_mm, _ = _pipe_diameter_for_flow(peak_lps)
    # Overflow must pass the full peak with the structure already full.
    result.overflow_pipe_diameter_mm, _ = _pipe_diameter_for_flow(peak_lps)

    # First flush: FIRST_FLUSH_MM depth over the roof, in litres.
    result.first_flush_volume_l = round(inputs.roof_area_sqm * FIRST_FLUSH_MM, 1)

    # Desilting/settling chamber sized to hold ~10 minutes of peak flow so
    # silt drops out before water reaches the filter media.
    result.desilting_chamber_m3 = round((peak_lps * 60 * 10) / 1000.0, 3)

    # Infiltration capacity: soil permeability acting over the structure's
    # base/wetted footprint.
    if result.pit:
        base_area = math.pi / 4 * result.pit["diameter_m"] ** 2 * result.pit["pit_count"]
    elif result.trench:
        base_area = result.trench["width_m"] * result.trench["total_length_m"]
    else:
        base_area = 0.0
    infiltration_m3_hr = (result.permeability_mm_hr / 1000.0) * base_area
    result.infiltration_rate_m3_per_hr = round(infiltration_m3_hr, 3)

    # Emptying time: how long a full structure takes to drain. Uses the void
    # volume (media-filled, so only the pore space actually holds water).
    void_fraction = (
        sum(l["thickness_fraction"] * l["porosity"] for l in result.filter_media)
        if result.filter_media
        else 0.4
    )
    storable_m3 = structure_volume_m3 * void_fraction
    result.time_to_empty_hr = (
        round(storable_m3 / infiltration_m3_hr, 2) if infiltration_m3_hr > 0 else 0.0
    )

    result.excavation_volume_m3 = round(structure_volume_m3 * EXCAVATION_OVERBREAK_FACTOR, 2)

    # Expected water-table rise: recharged volume spread over the assumed
    # zone of influence and divided by specific yield.
    influence_area = math.pi * RECHARGE_INFLUENCE_RADIUS_M**2
    result.expected_gw_rise_m = round(
        result.annual_recharge_target_m3 / (influence_area * DEFAULT_SPECIFIC_YIELD), 3
    )


def _build_calculation_sheet(
    inputs: RwhDesignInput, r: RwhDesignResult, structure_volume_m3: float
) -> list[dict]:
    """The show-your-working sheet: every governing formula, the numbers
    substituted into it, and the result. This is what a reviewing engineer
    checks — a bare answer with no working is not a submission.
    """
    def row(step, quantity, formula, substitution, result_val, unit, reference):
        return {
            "step": step,
            "quantity": quantity,
            "formula": formula,
            "substitution": substitution,
            "result": result_val,
            "unit": unit,
            "reference": reference,
        }

    sheet = [
        row(
            1, "Catchment (roof plan) area", "A = plan area of roof polygon",
            "Geodesic area of drawn polygon (WGS84 ellipsoid)",
            round(inputs.roof_area_sqm, 2), "m²",
            "Computed from site polygon",
        ),
        row(
            2, "Runoff coefficient", "C = f(roof material, slope)",
            f"material = {inputs.roof_material}, slope = {inputs.roof_slope_percent}%",
            r.runoff_coefficient, "–",
            "CPHEEO Manual on Water Supply & Treatment",
        ),
        row(
            3, "Hydrologic soil group", "HSG = f(soil type)",
            f"soil = {inputs.soil_type}",
            f"{r.hydrologic_soil_group} (k = {r.permeability_mm_hr} mm/hr)", "–",
            "USDA/NRCS hydrologic soil classification",
        ),
        row(
            4, "Gross annual runoff", "V = A x R x C",
            f"{inputs.roof_area_sqm:.2f} x ({inputs.annual_rainfall_mm:.1f}/1000) x {r.runoff_coefficient}",
            r.gross_annual_runoff_m3, "m³/yr",
            "Standard rational water-balance",
        ),
        row(
            5, "Net annual harvest", "Vh = V x (1 - first-flush loss)",
            f"{r.gross_annual_runoff_m3} x (1 - {FIRST_FLUSH_LOSS_FRACTION})",
            r.annual_harvest_m3, "m³/yr",
            "First-flush diversion allowance",
        ),
        row(
            6, "Annual recharge target", "Vr = (Vh - storage) x efficiency",
            f"({r.annual_harvest_m3} - {r.storage_tank_m3 or 0}) x {RECHARGE_EFFICIENCY}",
            r.annual_recharge_target_m3, "m³/yr",
            "CGWB artificial-recharge efficiency allowance",
        ),
        row(
            7, "Design-storm runoff volume", "Vd = A x Rd x C",
            f"{inputs.roof_area_sqm:.2f} x ({inputs.design_storm_mm}/1000) x {r.runoff_coefficient}",
            r.design_storm_volume_m3, "m³/event",
            f"{inputs.design_storm_mm} mm design storm (structure sizing basis)",
        ),
        row(
            8, "Peak design discharge (rational method)", "Q = C x i x A / 3600",
            f"{r.runoff_coefficient} x {r.peak_rainfall_intensity_mm_hr} x {inputs.roof_area_sqm:.2f} / 3600",
            r.peak_discharge_lps, "L/s",
            f"Rational method, i = {r.peak_rainfall_intensity_mm_hr} mm/hr",
        ),
        row(
            9, "Rainwater downpipes", "D = sqrt(4Q / (pi x v)), one pipe per 100 m² roof",
            f"Q/pipe = {r.peak_discharge_lps}/{r.downpipe_count} L/s at v = {PIPE_DESIGN_VELOCITY_M_S} m/s",
            f"{r.downpipe_count} nos. x {r.downpipe_diameter_mm} mm dia", "mm",
            "Continuity equation; IS 1742 pipe sizes",
        ),
        row(
            10, "Collection main / conveyance pipe", "D = sqrt(4Q / (pi x v))",
            f"Q = {r.peak_discharge_lps} L/s at v = {PIPE_DESIGN_VELOCITY_M_S} m/s",
            r.conveyance_pipe_diameter_mm, "mm",
            "Continuity equation, full-bore gravity flow",
        ),
        row(
            11, "Overflow pipe", "Sized to pass full peak Q with structure full",
            f"Q = {r.peak_discharge_lps} L/s",
            r.overflow_pipe_diameter_mm, "mm",
            "Safe disposal of excess to storm drain",
        ),
        row(
            12, "First-flush diversion volume", "Vff = A x depth",
            f"{inputs.roof_area_sqm:.2f} m² x {FIRST_FLUSH_MM} mm",
            r.first_flush_volume_l, "litres",
            "IS 15797 / CGWB first-flush practice",
        ),
        row(
            13, "Desilting / settling chamber", "Vs = Q x 10 min detention",
            f"{r.peak_discharge_lps} L/s x 600 s / 1000",
            r.desilting_chamber_m3, "m³",
            "Silt trap ahead of filter media",
        ),
    ]

    if r.pit:
        sheet.append(
            row(
                14, "Recharge pit sizing", "V = (pi/4) x D² x d, split into N pits",
                f"(pi/4) x {r.pit['diameter_m']}² x {r.pit['depth_m']} x {r.pit['pit_count']} pit(s)",
                f"{r.pit['pit_count']} x Ø{r.pit['diameter_m']} m x {r.pit['depth_m']} m deep "
                f"= {r.pit['total_volume_m3']} m³",
                "m³",
                "CGWB Master Plan for Artificial Recharge",
            )
        )
    if r.trench:
        sheet.append(
            row(
                14, "Recharge trench sizing", "L = Vd / (W x d), split at 12 m max per segment",
                f"{r.design_storm_volume_m3} / ({r.trench['width_m']} x {r.trench['depth_m']})",
                f"{r.trench['segment_count']} segment(s) x {r.trench['segment_length_m']} m "
                f"(total {r.trench['total_length_m']} m, {r.trench['total_volume_m3']} m³)",
                "m",
                "CGWB Master Plan for Artificial Recharge",
            )
        )

    sheet.extend(
        [
            row(
                15, "Depth available above water table",
                "d_avail = GW depth - minimum separation",
                f"{inputs.groundwater_depth_m} - {PIT_MIN_SEPARATION_ABOVE_GWT_M}",
                round(inputs.groundwater_depth_m - PIT_MIN_SEPARATION_ABOVE_GWT_M, 2), "m",
                "3.0 m minimum unsaturated separation",
            ),
            row(
                16, "Infiltration capacity", "q = k x A_base",
                f"({r.permeability_mm_hr}/1000) m/hr x base area",
                r.infiltration_rate_m3_per_hr, "m³/hr",
                "Darcy infiltration through structure base",
            ),
            row(
                17, "Time to empty when full", "t = stored volume / q",
                f"void volume of {structure_volume_m3:.2f} m³ media / {r.infiltration_rate_m3_per_hr} m³/hr",
                r.time_to_empty_hr, "hours",
                "Structure must drain between storms",
            ),
            row(
                18, "Excavation quantity", "Ve = V x overbreak factor",
                f"{structure_volume_m3:.2f} x {EXCAVATION_OVERBREAK_FACTOR}",
                r.excavation_volume_m3, "m³",
                "Working space + side batter allowance",
            ),
            row(
                19, "Expected water-table rise",
                "h = Vr / (A_influence x Sy)",
                f"{r.annual_recharge_target_m3} / (pi x {RECHARGE_INFLUENCE_RADIUS_M}² x {DEFAULT_SPECIFIC_YIELD})",
                r.expected_gw_rise_m, "m/yr",
                f"Sy = {DEFAULT_SPECIFIC_YIELD} assumed — replace with pumping-test value",
            ),
            row(
                20, "Estimated project cost", "Sum of BOQ line amounts",
                f"{len(r.boq)} BOQ items at indicative rates",
                r.estimated_cost_inr, "INR",
                "Indicative only — substitute current PWD/CPWD SoR",
            ),
        ]
    )

    return sheet


def _next_standard_pipe(required_mm: float) -> int:
    """Rounds a computed bore up to the next commercially available size."""
    for size in STANDARD_PIPE_SIZES_MM:
        if size >= required_mm:
            return size
    return STANDARD_PIPE_SIZES_MM[-1]


def _pipe_diameter_for_flow(flow_lps: float, velocity_m_s: float = PIPE_DESIGN_VELOCITY_M_S) -> tuple[int, float]:
    """Continuity equation: A = Q / v, then D = sqrt(4A / pi).

    Returns (selected standard size mm, theoretical required mm).
    """
    if flow_lps <= 0:
        return STANDARD_PIPE_SIZES_MM[0], 0.0
    q_m3_s = flow_lps / 1000.0
    area_m2 = q_m3_s / velocity_m_s
    diameter_m = math.sqrt(4 * area_m2 / math.pi)
    required_mm = diameter_m * 1000.0
    return _next_standard_pipe(required_mm), round(required_mm, 1)


def _design_pits(target_volume_m3: float, available_depth_m: float, warnings: list[str]) -> dict:
    depth = round(min(available_depth_m, PIT_PRACTICAL_MAX_DEPTH_M) - PIT_FREEBOARD_M, 2)
    depth = max(depth, 0.5)
    max_single_volume = math.pi / 4 * PIT_MAX_DIAMETER_M**2 * depth
    min_single_volume = math.pi / 4 * PIT_MIN_DIAMETER_M**2 * depth

    if target_volume_m3 <= min_single_volume:
        diameter = PIT_MIN_DIAMETER_M
        pit_count = 1
    elif target_volume_m3 <= max_single_volume:
        diameter = round(math.sqrt(4 * target_volume_m3 / (math.pi * depth)), 2)
        diameter = min(max(diameter, PIT_MIN_DIAMETER_M), PIT_MAX_DIAMETER_M)
        pit_count = 1
    else:
        diameter = PIT_MAX_DIAMETER_M
        pit_count = max(1, math.ceil(target_volume_m3 / max_single_volume))
        warnings.append(
            f"Target recharge volume ({target_volume_m3:.1f} m3) exceeds one pit's capacity at the max "
            f"2.5 m diameter and available depth; split across {pit_count} pits."
        )

    single_volume = round(math.pi / 4 * diameter**2 * depth, 3)
    return {
        "pit_count": pit_count,
        "diameter_m": diameter,
        "depth_m": depth,
        "freeboard_m": PIT_FREEBOARD_M,
        "single_pit_volume_m3": single_volume,
        "total_volume_m3": round(single_volume * pit_count, 3),
    }


def _design_trench(target_volume_m3: float, available_depth_m: float, warnings: list[str]) -> dict:
    depth = round(min(available_depth_m, TRENCH_PRACTICAL_MAX_DEPTH_M), 2)
    depth = max(depth, 0.5)
    total_length = target_volume_m3 / (TRENCH_WIDTH_M * depth) if depth > 0 else 0.0
    total_length = round(max(total_length, TRENCH_MAX_SEGMENT_LENGTH_M), 2)
    segment_count = max(1, math.ceil(total_length / TRENCH_MAX_SEGMENT_LENGTH_M))
    segment_length = round(total_length / segment_count, 2)

    if segment_count > 1:
        warnings.append(
            f"Required trench length ({total_length:.1f} m) exceeds the 12 m single-segment maximum; "
            f"laid out as {segment_count} connected trenches of ~{segment_length:.1f} m each."
        )

    return {
        "width_m": TRENCH_WIDTH_M,
        "depth_m": depth,
        "total_length_m": total_length,
        "segment_count": segment_count,
        "segment_length_m": segment_length,
        "total_volume_m3": round(TRENCH_WIDTH_M * depth * total_length, 3),
    }


def _design_filter_media(structure_volume_m3: float) -> list[dict]:
    layers = []
    for spec in FILTER_MEDIA_STACK:
        volume = round(structure_volume_m3 * spec["thickness_fraction"], 3)
        porosity = spec["porosity"]
        layers.append(
            {
                "layer_order": spec["layer_order"],
                "material": spec["material"],
                "thickness_fraction": spec["thickness_fraction"],
                "particle_size_note": spec["particle_size_note"],
                "volume_m3": volume,
                "weight_kg": round(volume * spec["bulk_density_kg_m3"], 1),
                "porosity": porosity,
                "hydraulic_conductivity_mm_hr": spec["hydraulic_conductivity_mm_hr"],
                "void_ratio": round(porosity / (1 - porosity), 3),
                "infiltration_contribution_pct": round(spec["thickness_fraction"] * 100, 1),
            }
        )
    return layers


def _build_boq(
    structure_type: str,
    structure_volume_m3: float,
    structure_count: int,
    filter_media: list[dict],
    distance_to_inlet_m: float,
    has_borewell: bool,
    excavation_volume_m3: float,
    downpipe_count: int,
    downpipe_diameter_mm: int,
) -> list[dict]:
    def item(name: str, unit: str, quantity: float, rate_key: str) -> dict:
        rate = UNIT_RATES_INR[rate_key]
        qty = round(quantity, 3)
        return {"item": name, "unit": unit, "quantity": qty, "unit_rate_inr": rate, "amount_inr": round(qty * rate, 2)}

    boq = [
        item(
            f"Earthwork excavation for {structure_type.replace('_', ' ')}, incl. side batter",
            "m3", excavation_volume_m3, "excavation_m3",
        ),
    ]
    for layer in filter_media:
        rate_key = {
            "Coarse sand": "coarse_sand_m3",
            "Graded gravel": "graded_gravel_m3",
            "Coarse aggregate / boulders": "boulders_m3",
        }[layer["material"]]
        boq.append(item(f"Filter media — {layer['material']} ({layer['particle_size_note']})", "m3", layer["volume_m3"], rate_key))

    # Downpipes: assume a nominal 4 m fall per pipe from roof to ground level.
    boq.append(
        item(
            f"uPVC rainwater downpipe, {downpipe_diameter_mm} mm dia ({downpipe_count} nos. x 4 m)",
            "m", downpipe_count * 4.0, "pvc_inlet_pipe_m",
        )
    )
    boq.append(item("uPVC collection main from downpipes to structure", "m", distance_to_inlet_m, "pvc_inlet_pipe_m"))
    boq.append(item("Overflow pipe to storm drain", "m", 5.0, "overflow_pipe_m"))
    boq.append(item("RCC perforated cover slab over structure", "no", float(structure_count), "rcc_cover_slab_no"))
    boq.append(item("Desilting / inspection chamber with removable screen", "no", 1.0, "inspection_chamber_no"))
    boq.append(item("First-flush diverter assembly", "no", 1.0, "first_flush_diverter_no"))
    boq.append(item("Mesh / leaf screen at each downpipe inlet", "no", float(downpipe_count), "leaf_screen_no"))

    if has_borewell:
        boq.append(item("Brick masonry sanitary seal at injection bore head", "m3", 0.8, "brick_masonry_lining_m3"))
        boq.append(item("Slotted PVC casing for injection bore (provisional)", "m", 12.0, "slotted_casing_m"))

    return boq
