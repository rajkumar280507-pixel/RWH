"""Polygon area + centroid, computed in Python instead of via PostGIS
(MySQL has no geodesic ST_Area/ST_Centroid). Geodesic area uses pyproj's
WGS84 ellipsoid — accurate at building-footprint scale anywhere on Earth,
unlike a naive planar shoelace calculation on raw lon/lat degrees. Centroid
uses shapely's planar centroid, which is fine at this scale (a rooftop spans
meters, not degrees) even though it isn't geodesically exact.
"""
from __future__ import annotations

from pyproj import Geod
from shapely.geometry import shape as shapely_shape

_GEOD = Geod(ellps="WGS84")


def polygon_area_sqm_and_centroid(geojson_polygon: dict) -> tuple[float, float, float]:
    """Returns (area_sqm, centroid_lon, centroid_lat) for a GeoJSON Polygon."""
    geom = shapely_shape(geojson_polygon)
    area_sqm, _perimeter_m = _GEOD.geometry_area_perimeter(geom)
    centroid = geom.centroid
    return abs(area_sqm), centroid.x, centroid.y
