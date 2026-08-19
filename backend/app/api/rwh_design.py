"""RWH design endpoints: draw a rooftop, get a full recharge structure
design (pit/trench/borewell sizing, filter media, BOQ) computed by
app/services/rwh_design_engine.py, optionally persisted to MySQL.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.gis.geometry import polygon_area_sqm_and_centroid
from app.repositories import design_repository
from app.schemas.design import LiveDataSource, RwhDesignRequest, RwhDesignResponse
from app.services import live_data_service
from app.services.rwh_design_engine import DEFAULT_DESIGN_STORM_MM, RwhDesignInput, compute_design

router = APIRouter(prefix="/api/rwh", tags=["rwh-design"])


@router.post("/design", response_model=RwhDesignResponse)
def create_design(payload: RwhDesignRequest, db: Session = Depends(get_db)):
    roof_geojson = payload.roof.model_dump() if payload.roof else payload.footprint.model_dump()

    area_sqm, lon, lat = polygon_area_sqm_and_centroid(roof_geojson)
    if area_sqm <= 0:
        raise HTTPException(400, "Roof polygon has zero or invalid area")

    # -----------------------------------------------------------------
    # Pull real numbers from the live CGWB telemetry (synced hourly by
    # app/scheduler/jobs.py) whenever the operator didn't type one in.
    # -----------------------------------------------------------------
    annual_rainfall_mm = payload.annual_rainfall_mm
    rainfall_source = LiveDataSource(used=False, note="Manually entered by operator")
    if annual_rainfall_mm is None:
        live_rainfall = live_data_service.get_live_annual_rainfall(db, lon, lat)
        if live_rainfall is None:
            raise HTTPException(
                422,
                "No live rainfall station with sufficient data was found near this rooftop "
                "(within 75 km, at least 30 days of readings in the last year). Provide "
                "annual_rainfall_mm manually.",
            )
        annual_rainfall_mm = live_rainfall.annual_rainfall_mm
        rainfall_source = LiveDataSource(
            used=True,
            station_code=live_rainfall.station_code,
            station_name=live_rainfall.station_name,
            distance_km=live_rainfall.distance_km,
            days_covered=live_rainfall.days_covered,
            extrapolated=live_rainfall.extrapolated,
            note=(
                f"Nearest CGWB rainfall station, {live_rainfall.distance_km} km away"
                + (f" (extrapolated from {live_rainfall.days_covered} days of data)" if live_rainfall.extrapolated else "")
            ),
        )

    groundwater_depth_m = payload.groundwater_depth_m
    groundwater_source = LiveDataSource(used=False, note="Manually entered by operator")
    if groundwater_depth_m is None:
        live_gw = live_data_service.get_nearest_groundwater_reading(db, lon, lat)
        if live_gw is None:
            raise HTTPException(
                422,
                "No live groundwater station with a recent reading was found near this rooftop "
                "(within 75 km). Provide groundwater_depth_m manually.",
            )
        groundwater_depth_m = live_gw.water_level_m
        groundwater_source = LiveDataSource(
            used=True,
            station_code=live_gw.station_code,
            station_name=live_gw.station_name,
            distance_km=live_gw.distance_km,
            recorded_at=live_gw.recorded_at,
            note=(
                f"Nearest CGWB groundwater station, {live_gw.distance_km} km away, "
                f"last reading {live_gw.recorded_at} (raw feed value {live_gw.raw_value}, "
                f"normalized to {live_gw.water_level_m} m below ground)"
            ),
        )

    inputs = RwhDesignInput(
        roof_area_sqm=round(area_sqm, 2),
        roof_material=payload.roof_material,
        roof_slope_percent=payload.roof_slope_percent,
        annual_rainfall_mm=annual_rainfall_mm,
        groundwater_depth_m=groundwater_depth_m,
        soil_type=payload.soil_type,
        available_open_area_sqm=payload.available_open_area_sqm,
        population=payload.population,
        per_capita_demand_lpd=payload.per_capita_demand_lpd,
        storage_days=payload.storage_days,
        distance_to_inlet_m=payload.distance_to_inlet_m,
        allow_shallow_override=payload.allow_shallow_override,
        design_storm_mm=payload.design_storm_mm or DEFAULT_DESIGN_STORM_MM,
    )

    result = compute_design(inputs)

    building_id = None
    roof_id = None
    design_id = None

    if payload.persist:
        building = design_repository.get_or_create_building(
            db,
            building_id=payload.building_id,
            footprint_geojson=payload.footprint.model_dump(),
            building_type=payload.building_type,
            population=payload.population,
            open_area_sqm=payload.available_open_area_sqm,
            name=payload.building_name,
        )
        roof = design_repository.create_roof(
            db,
            building_id=building.id,
            roof_geojson=roof_geojson,
            roof_type=payload.roof_type,
            roof_material=payload.roof_material,
            slope_percent=payload.roof_slope_percent,
            area_sqm=inputs.roof_area_sqm,
            runoff_coefficient=result.runoff_coefficient,
        )
        design = design_repository.save_design(
            db, building_id=building.id, roof_id=roof.id, inputs=inputs, result=result
        )
        building_id, roof_id, design_id = building.id, roof.id, design.id

    return RwhDesignResponse(
        design_id=design_id,
        building_id=building_id,
        roof_id=roof_id,
        annual_rainfall_mm=annual_rainfall_mm,
        groundwater_depth_m=groundwater_depth_m,
        groundwater_source=groundwater_source,
        rainfall_source=rainfall_source,
        runoff_coefficient=result.runoff_coefficient,
        hydrologic_soil_group=result.hydrologic_soil_group,
        permeability_mm_hr=result.permeability_mm_hr,
        catchment_area_sqm=result.catchment_area_sqm,
        gross_annual_runoff_m3=result.gross_annual_runoff_m3,
        annual_harvest_m3=result.annual_harvest_m3,
        annual_recharge_target_m3=result.annual_recharge_target_m3,
        design_storm_volume_m3=result.design_storm_volume_m3,
        storage_tank_m3=result.storage_tank_m3,
        structure_type=result.structure_type,
        pit=result.pit,
        trench=result.trench,
        injection_borewell=result.injection_borewell,
        filter_media=result.filter_media,
        boq=result.boq,
        estimated_cost_inr=result.estimated_cost_inr,
        warnings=result.warnings,
        peak_rainfall_intensity_mm_hr=result.peak_rainfall_intensity_mm_hr,
        peak_discharge_lps=result.peak_discharge_lps,
        downpipe_count=result.downpipe_count,
        downpipe_diameter_mm=result.downpipe_diameter_mm,
        conveyance_pipe_diameter_mm=result.conveyance_pipe_diameter_mm,
        overflow_pipe_diameter_mm=result.overflow_pipe_diameter_mm,
        first_flush_volume_l=result.first_flush_volume_l,
        desilting_chamber_m3=result.desilting_chamber_m3,
        infiltration_rate_m3_per_hr=result.infiltration_rate_m3_per_hr,
        time_to_empty_hr=result.time_to_empty_hr,
        excavation_volume_m3=result.excavation_volume_m3,
        expected_gw_rise_m=result.expected_gw_rise_m,
        calculation_sheet=result.calculation_sheet,
    )


@router.get("/design/{design_id}")
def get_design(design_id: int, db: Session = Depends(get_db)):
    design = db.execute(
        text("SELECT * FROM rwh_designs WHERE id = :id"), {"id": design_id}
    ).mappings().one_or_none()
    if not design:
        raise HTTPException(404, "Design not found")

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
    boq = db.execute(
        text("SELECT * FROM boq_items WHERE design_id = :id"), {"id": design_id}
    ).mappings().all()

    return {
        "design": dict(design),
        "pits": [dict(r) for r in pits],
        "trenches": [dict(r) for r in trenches],
        "borewells": [dict(r) for r in borewells],
        "filter_media": [dict(r) for r in filter_media],
        "boq": [dict(r) for r in boq],
    }


@router.delete("/design/{design_id}")
def delete_design(design_id: int, db: Session = Depends(get_db)):
    """Deletes a saved design; child rows (pits/trenches/borewells/filter
    media/BOQ) cascade via FK ON DELETE CASCADE."""
    result = db.execute(text("DELETE FROM rwh_designs WHERE id = :id"), {"id": design_id})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "Design not found")
    return {"deleted": design_id}


@router.get("/designs")
def list_designs(db: Session = Depends(get_db)):
    """All persisted designs, newest first — backs the Reports module list."""
    rows = db.execute(
        text(
            """
            SELECT d.id, d.building_id, d.structure_type, d.status, d.created_at,
                   d.catchment_area_sqm, d.annual_harvest_m3, d.annual_recharge_m3,
                   d.annual_rainfall_mm, d.groundwater_depth_m, d.hydrologic_soil_group,
                   b.name AS building_name, b.building_type,
                   b.centroid_lat AS latitude, b.centroid_lon AS longitude,
                   (SELECT COALESCE(SUM(amount_inr), 0) FROM boq_items q WHERE q.design_id = d.id)
                       AS estimated_cost_inr,
                   EXISTS(SELECT 1 FROM injection_borewells w WHERE w.design_id = d.id)
                       AS has_injection_borewell
            FROM rwh_designs d
            JOIN buildings b ON b.id = d.building_id
            ORDER BY d.created_at DESC
            LIMIT 200
            """
        )
    ).mappings().all()
    return [dict(r) for r in rows]


@router.get("/buildings")
def list_buildings(db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT b.id, b.name, b.building_type, b.population,
                   b.centroid_lat AS latitude, b.centroid_lon AS longitude,
                   b.created_at,
                   (SELECT COUNT(*) FROM rwh_designs d WHERE d.building_id = b.id) AS design_count
            FROM buildings b
            ORDER BY b.created_at DESC
            LIMIT 200
            """
        )
    ).mappings().all()
    return [dict(r) for r in rows]


@router.get("/live-context")
def live_context(lon: float, lat: float, db: Session = Depends(get_db)):
    """Preview which live CGWB stations would feed a design at this point,
    before the operator commits to drawing a rooftop and submitting — lets
    the design form show "using station X, 4.2 km away" up front.
    """
    gw = live_data_service.get_nearest_groundwater_reading(db, lon, lat)
    rainfall = live_data_service.get_live_annual_rainfall(db, lon, lat)
    return {
        "groundwater": None
        if gw is None
        else {
            "station_code": gw.station_code,
            "station_name": gw.station_name,
            "distance_km": gw.distance_km,
            "water_level_m": gw.water_level_m,
            "recorded_at": gw.recorded_at,
        },
        "rainfall": None
        if rainfall is None
        else {
            "station_code": rainfall.station_code,
            "station_name": rainfall.station_name,
            "distance_km": rainfall.distance_km,
            "annual_rainfall_mm": rainfall.annual_rainfall_mm,
            "days_covered": rainfall.days_covered,
            "extrapolated": rainfall.extrapolated,
        },
    }


@router.get("/roof-materials")
def roof_materials():
    """Lookup table the frontend form uses to populate the roof-material select."""
    from app.gis.runoff import ROOF_MATERIAL_RUNOFF_COEFFICIENTS

    return [
        {"value": key, "label": key.replace("_", " ").title(), "typical_runoff_coefficient": val[0]}
        for key, val in ROOF_MATERIAL_RUNOFF_COEFFICIENTS.items()
    ]


@router.get("/soil-types")
def soil_types():
    from app.gis.runoff import SOIL_TYPE_TO_HSG

    return [
        {"value": key, "label": key.replace("_", " ").title(), "hydrologic_group": hsg, "permeability_mm_hr": perm}
        for key, (hsg, perm) in SOIL_TYPE_TO_HSG.items()
    ]
