/**
 * Small geodesy helpers for the RWH design wizard. No external dependency —
 * these are intentionally simple (equirectangular-projected Shoelace area,
 * planar centroid) since they only feed a client-side area *estimate* and a
 * synthetic footprint for manual entry; the backend recomputes the
 * authoritative area/geometry itself from whatever footprint is submitted.
 */

const EARTH_RADIUS_M = 6371000;

/** Default anchor point (Tamil Nadu centroid) used when no polygon has been
 * drawn yet and the operator is in manual roof-area entry mode. */
export const TN_CENTER = { lat: 11.1271, lon: 78.6569 };

/**
 * Shoelace-formula area of a GeoJSON Polygon's outer ring, in square
 * metres. Coordinates are projected with a local equirectangular
 * approximation (flat-earth, scaled by cos(latitude)) around the ring's
 * mean latitude — accurate to well under 1% for rooftop-scale footprints.
 */
export function polygonAreaSqm(geojson) {
  const ring = geojson?.coordinates?.[0];
  if (!ring || ring.length < 3) return 0;

  const meanLat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180) || 1;

  const pts = ring.map(([lon, lat]) => [
    ((lon * Math.PI) / 180) * EARTH_RADIUS_M * cosLat,
    ((lat * Math.PI) / 180) * EARTH_RADIUS_M,
  ]);

  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

/** Plain average (lon, lat) of a Polygon's outer ring — good enough for
 * picking the nearest live telemetry station and centering a synthetic
 * footprint; not a true geodesic/area centroid. */
export function polygonCentroid(geojson) {
  const ring = geojson?.coordinates?.[0];
  if (!ring || ring.length < 2) return TN_CENTER;

  // The ring's last point repeats the first (GeoJSON closed-ring rule).
  const pts = ring.slice(0, -1);
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { lat, lon };
}

/**
 * Synthesizes a square GeoJSON Polygon footprint of the given area, centered
 * at (lat, lon). Used for the manual roof-area-entry fallback, where the
 * operator supplies a number instead of drawing a shape — the backend design
 * engine requires a footprint polygon either way.
 */
export function squareFootprint(lat, lon, areaSqm) {
  const side = Math.sqrt(Math.max(areaSqm, 1));
  const half = side / 2;
  const dLat = half / 111320;
  const dLon = half / (111320 * Math.cos((lat * Math.PI) / 180) || 1);

  return {
    type: "Polygon",
    coordinates: [
      [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ],
    ],
  };
}
