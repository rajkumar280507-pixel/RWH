"""ORM models for database/recharge.sql — persisted output of the RWH design
engine (app/services/rwh_design_engine.py). MySQL: no PostGIS, so pit/borewell
points are plain lat/lon columns and the trench alignment is GeoJSON.
"""
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class RwhDesign(Base):
    __tablename__ = "rwh_designs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    building_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("buildings.id"))
    roof_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("roofs.id"), nullable=True)
    design_version: Mapped[int] = mapped_column(Integer, default=1)
    annual_rainfall_mm: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    runoff_coefficient: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    catchment_area_sqm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    annual_harvest_m3: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    annual_recharge_m3: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    groundwater_depth_m: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    hydrologic_soil_group: Mapped[str | None] = mapped_column(String(1), nullable=True)
    structure_type: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    pits: Mapped[list["RechargePit"]] = relationship(back_populates="design", cascade="all, delete-orphan")
    trenches: Mapped[list["RechargeTrench"]] = relationship(back_populates="design", cascade="all, delete-orphan")
    borewells: Mapped[list["InjectionBorewell"]] = relationship(back_populates="design", cascade="all, delete-orphan")
    filter_layers: Mapped[list["FilterMediaLayer"]] = relationship(back_populates="design", cascade="all, delete-orphan")
    boq_items: Mapped[list["BoqItem"]] = relationship(back_populates="design", cascade="all, delete-orphan")


class RechargePit(Base):
    __tablename__ = "recharge_pits"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    design_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("rwh_designs.id"))
    diameter_m: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    depth_m: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    volume_m3: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False)
    freeboard_m: Mapped[float] = mapped_column(Numeric(4, 2), default=0.3)
    lat: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    lon: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)

    design: Mapped["RwhDesign"] = relationship(back_populates="pits")


class RechargeTrench(Base):
    __tablename__ = "recharge_trenches"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    design_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("rwh_designs.id"))
    width_m: Mapped[float] = mapped_column(Numeric(5, 2), default=1.0)
    depth_m: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    total_length_m: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    segment_count: Mapped[int] = mapped_column(Integer, nullable=False)
    segment_length_m: Mapped[float] = mapped_column(Numeric(5, 2), default=12.0)
    volume_m3: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False)
    alignment_geojson: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    design: Mapped["RwhDesign"] = relationship(back_populates="trenches")


class InjectionBorewell(Base):
    __tablename__ = "injection_borewells"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    design_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("rwh_designs.id"))
    recommended: Mapped[bool] = mapped_column(Boolean, default=True)
    trigger_reason: Mapped[str] = mapped_column(String(255), nullable=False)
    conceptual_depth_m: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    casing_zone_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    gravel_pack_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    warning_text: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    lon: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)

    design: Mapped["RwhDesign"] = relationship(back_populates="borewells")


class FilterMediaLayer(Base):
    __tablename__ = "filter_media_layers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    design_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("rwh_designs.id"))
    layer_order: Mapped[int] = mapped_column(Integer, nullable=False)
    material: Mapped[str] = mapped_column(String(120), nullable=False)
    thickness_fraction: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    particle_size_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    volume_m3: Mapped[float | None] = mapped_column(Numeric(8, 3), nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    porosity: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    hydraulic_conductivity_mm_hr: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    void_ratio: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)

    design: Mapped["RwhDesign"] = relationship(back_populates="filter_layers")


class BoqItem(Base):
    __tablename__ = "boq_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    design_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("rwh_designs.id"))
    item: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    unit_rate_inr: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    # STORED generated column in MySQL — Computed() keeps SQLAlchemy from
    # including it in INSERT/UPDATE, which MySQL rejects outright (err 3105).
    amount_inr: Mapped[float | None] = mapped_column(
        Numeric(14, 2),
        Computed("quantity * COALESCE(unit_rate_inr, 0)", persisted=True),
        nullable=True,
    )

    design: Mapped["RwhDesign"] = relationship(back_populates="boq_items")
