"""Persists a computed RwhDesignResult (app/services/rwh_design_engine.py)
into buildings/roofs/rwh_designs and its child tables.

Note: `boq_items.amount_inr` is a MySQL GENERATED ALWAYS STORED column
(quantity * unit_rate_inr) — never set it explicitly on a BoqItem, the
database computes it, matching what the engine already computed in Python.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.gis.geometry import polygon_area_sqm_and_centroid
from app.models.building import Building, Roof
from app.models.design import (
    BoqItem,
    FilterMediaLayer,
    InjectionBorewell,
    RechargePit,
    RechargeTrench,
    RwhDesign,
)
from app.services.rwh_design_engine import RwhDesignInput, RwhDesignResult


def get_or_create_building(
    db: Session,
    *,
    building_id: int | None,
    footprint_geojson: dict,
    building_type: str | None,
    population: int | None,
    open_area_sqm: float | None,
    name: str | None = None,
) -> Building:
    _area_sqm, lon, lat = polygon_area_sqm_and_centroid(footprint_geojson)

    if building_id:
        building = db.get(Building, building_id)
        if building is not None:
            building.footprint_geojson = footprint_geojson
            building.centroid_lat = lat
            building.centroid_lon = lon
            building.building_type = building_type or building.building_type
            building.population = population if population is not None else building.population
            building.open_area_sqm = open_area_sqm if open_area_sqm is not None else building.open_area_sqm
            db.flush()
            return building

    building = Building(
        name=name,
        building_type=building_type,
        population=population,
        open_area_sqm=open_area_sqm,
        footprint_geojson=footprint_geojson,
        centroid_lat=lat,
        centroid_lon=lon,
    )
    db.add(building)
    db.flush()
    return building


def create_roof(
    db: Session,
    *,
    building_id: int,
    roof_geojson: dict,
    roof_type: str | None,
    roof_material: str,
    slope_percent: float | None,
    area_sqm: float,
    runoff_coefficient: float,
) -> Roof:
    roof = Roof(
        building_id=building_id,
        roof_type=roof_type,
        roof_material=roof_material,
        slope_percent=slope_percent,
        footprint_geojson=roof_geojson,
        area_sqm=area_sqm,
        runoff_coefficient=runoff_coefficient,
    )
    db.add(roof)
    db.flush()
    return roof


def save_design(
    db: Session,
    *,
    building_id: int,
    roof_id: int | None,
    inputs: RwhDesignInput,
    result: RwhDesignResult,
) -> RwhDesign:
    design = RwhDesign(
        building_id=building_id,
        roof_id=roof_id,
        annual_rainfall_mm=inputs.annual_rainfall_mm,
        runoff_coefficient=result.runoff_coefficient,
        catchment_area_sqm=result.catchment_area_sqm,
        annual_harvest_m3=result.annual_harvest_m3,
        annual_recharge_m3=result.annual_recharge_target_m3,
        groundwater_depth_m=inputs.groundwater_depth_m,
        hydrologic_soil_group=result.hydrologic_soil_group,
        structure_type=result.structure_type,
        status="draft",
    )
    db.add(design)
    db.flush()

    if result.pit:
        for _ in range(result.pit["pit_count"]):
            db.add(
                RechargePit(
                    design_id=design.id,
                    diameter_m=result.pit["diameter_m"],
                    depth_m=result.pit["depth_m"],
                    volume_m3=result.pit["single_pit_volume_m3"],
                    freeboard_m=result.pit["freeboard_m"],
                )
            )

    if result.trench:
        db.add(
            RechargeTrench(
                design_id=design.id,
                width_m=result.trench["width_m"],
                depth_m=result.trench["depth_m"],
                total_length_m=result.trench["total_length_m"],
                segment_count=result.trench["segment_count"],
                segment_length_m=result.trench["segment_length_m"],
                volume_m3=result.trench["total_volume_m3"],
            )
        )

    if result.injection_borewell:
        b = result.injection_borewell
        db.add(
            InjectionBorewell(
                design_id=design.id,
                recommended=b["recommended"],
                trigger_reason=b["trigger_reason"],
                conceptual_depth_m=b["conceptual_depth_m"],
                casing_zone_note=b["casing_zone_note"],
                gravel_pack_note=b["gravel_pack_note"],
                warning_text=b["warning_text"],
            )
        )

    for layer in result.filter_media:
        db.add(
            FilterMediaLayer(
                design_id=design.id,
                layer_order=layer["layer_order"],
                material=layer["material"],
                thickness_fraction=layer["thickness_fraction"],
                particle_size_note=layer["particle_size_note"],
                volume_m3=layer["volume_m3"],
                weight_kg=layer["weight_kg"],
                porosity=layer["porosity"],
                hydraulic_conductivity_mm_hr=layer["hydraulic_conductivity_mm_hr"],
                void_ratio=layer["void_ratio"],
            )
        )

    for boq_item in result.boq:
        # amount_inr is DB-generated (quantity * unit_rate_inr) — do not set it here.
        db.add(
            BoqItem(
                design_id=design.id,
                item=boq_item["item"],
                unit=boq_item["unit"],
                quantity=boq_item["quantity"],
                unit_rate_inr=boq_item["unit_rate_inr"],
            )
        )

    db.commit()
    db.refresh(design)
    return design
