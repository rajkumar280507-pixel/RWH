"""ORM models for database/building.sql — buildings and rooftops captured by
the RWH design module's polygon-draw UI. Footprints are stored as GeoJSON
(JSON column) plus a plain lat/lon centroid for distance queries (MySQL).
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class District(Base):
    """Mirrors database/schema.sql's `districts` table. Minimal for now —
    only referenced by buildings.district_id; boundary polygons aren't
    loaded or queried by the backend yet.
    """

    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    state: Mapped[str] = mapped_column(String(120), nullable=False)
    district: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    building_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    occupancy: Mapped[int | None] = mapped_column(Integer, nullable=True)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    district_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("districts.id"), nullable=True)
    footprint_geojson: Mapped[dict] = mapped_column(JSON, nullable=False)
    centroid_lat: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    centroid_lon: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    open_area_sqm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    roofs: Mapped[list["Roof"]] = relationship(back_populates="building")


class Roof(Base):
    __tablename__ = "roofs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    building_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("buildings.id"))
    roof_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    roof_material: Mapped[str | None] = mapped_column(String(60), nullable=True)
    slope_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    footprint_geojson: Mapped[dict] = mapped_column(JSON, nullable=False)
    area_sqm: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    runoff_coefficient: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    building: Mapped["Building"] = relationship(back_populates="roofs")
