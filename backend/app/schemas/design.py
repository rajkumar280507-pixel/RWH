"""Pydantic I/O models for the RWH design API."""
from typing import Any, Literal

from pydantic import BaseModel, Field


class GeoJsonPolygon(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]


class RwhDesignRequest(BaseModel):
    building_id: int | None = Field(default=None, description="Reuse an existing building; omit to create one")
    building_name: str | None = None
    building_type: str | None = "residential"
    footprint: GeoJsonPolygon = Field(description="Building footprint polygon, WGS84 lon/lat")
    roof: GeoJsonPolygon | None = Field(default=None, description="Roof polygon; defaults to the footprint if omitted")
    roof_type: str | None = "flat"
    roof_material: str = "rcc_flat"
    roof_slope_percent: float | None = 2.0
    annual_rainfall_mm: float | None = Field(
        default=None, description="Omit to auto-derive from the nearest live CGWB rainfall station"
    )
    groundwater_depth_m: float | None = Field(
        default=None, description="Omit to auto-derive from the nearest live CGWB groundwater station"
    )
    soil_type: str
    available_open_area_sqm: float | None = None
    population: int | None = None
    per_capita_demand_lpd: float = 135.0
    storage_days: float = 2.0
    distance_to_inlet_m: float = 10.0
    design_storm_mm: float | None = None
    allow_shallow_override: bool = False
    persist: bool = True


class BoqItemOut(BaseModel):
    item: str
    unit: str
    quantity: float
    unit_rate_inr: float
    amount_inr: float


class FilterLayerOut(BaseModel):
    layer_order: int
    material: str
    thickness_fraction: float
    particle_size_note: str
    volume_m3: float
    weight_kg: float
    porosity: float
    hydraulic_conductivity_mm_hr: float
    void_ratio: float
    infiltration_contribution_pct: float


class LiveDataSource(BaseModel):
    used: bool
    station_code: str | None = None
    station_name: str | None = None
    distance_km: float | None = None
    recorded_at: str | None = None
    days_covered: int | None = None
    extrapolated: bool | None = None
    note: str


class RwhDesignResponse(BaseModel):
    design_id: int | None = None
    building_id: int | None = None
    roof_id: int | None = None
    annual_rainfall_mm: float
    groundwater_depth_m: float
    groundwater_source: LiveDataSource
    rainfall_source: LiveDataSource
    runoff_coefficient: float
    hydrologic_soil_group: str
    permeability_mm_hr: float
    catchment_area_sqm: float
    gross_annual_runoff_m3: float
    annual_harvest_m3: float
    annual_recharge_target_m3: float
    design_storm_volume_m3: float
    storage_tank_m3: float | None
    structure_type: str
    pit: dict[str, Any] | None
    trench: dict[str, Any] | None
    injection_borewell: dict[str, Any] | None
    filter_media: list[FilterLayerOut]
    boq: list[BoqItemOut]
    estimated_cost_inr: float
    warnings: list[str]
    # Hydraulic design
    peak_rainfall_intensity_mm_hr: float
    peak_discharge_lps: float
    downpipe_count: int
    downpipe_diameter_mm: int
    conveyance_pipe_diameter_mm: int
    overflow_pipe_diameter_mm: int
    first_flush_volume_l: float
    desilting_chamber_m3: float
    infiltration_rate_m3_per_hr: float
    time_to_empty_hr: float
    excavation_volume_m3: float
    expected_gw_rise_m: float
    calculation_sheet: list[dict[str, Any]]
