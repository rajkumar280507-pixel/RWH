import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, Tooltip, ScaleControl, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";

const TN_CENTER = [11.1271, 78.6569]; // Tamil Nadu centroid, sane default extent

/**
 * Threshold bands driving both the marker colours (`gwColor`/`rainColor`
 * below) and `maps/controls/LegendPanel.jsx`. Single source of truth so the
 * legend can never drift out of sync with what's actually drawn on the map —
 * it imports these arrays and `gwColor`/`rainColor` directly instead of
 * hand-copying the cutoffs/hex values into a second place.
 */
const GW_BANDS = [
  { max: 5, color: "#22c55e", label: "0–5 m" },
  { max: 10, color: "#2dd4bf", label: "5–10 m" },
  { max: 20, color: "#f59e0b", label: "10–20 m" },
  { max: Infinity, color: "#f43f5e", label: "> 20 m" },
];

const RAIN_BANDS = [
  { max: 0, color: "#475569", label: "No data" },
  { max: 10, color: "#93c5fd", label: "0–10 mm" },
  { max: 50, color: "#3b82f6", label: "10–50 mm" },
  { max: Infinity, color: "#1d4ed8", label: "> 50 mm" },
];

function bandColor(value, bands, fallback) {
  if (value == null) return fallback;
  const v = Number(value);
  const band = bands.find((b) => v <= b.max);
  return (band ?? bands[bands.length - 1]).color;
}

/** Colour-codes a groundwater marker by how deep the water table sits.
 * CGWB reports level as depth below ground and the feed uses negative values,
 * so deeper (more negative) = more stressed = warmer colour. */
function gwColor(level) {
  if (level == null) return "#64748b";
  return bandColor(Math.abs(Number(level)), GW_BANDS, "#64748b");
}

function rainColor(mm) {
  return bandColor(Number(mm ?? 0), RAIN_BANDS, "#475569");
}

function ageLabel(hours) {
  if (hours == null) return "unknown age";
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Free, no-API-key Esri hillshade tile set. This is a static shaded-relief
 * raster, not elevation-rendered 3D geometry — see TerrainToggle.jsx, which
 * is honest in its own UI copy about that distinction. */
const HILLSHADE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";

/** Renders (and tears down) a leaflet.heat canvas layer imperatively, since
 * leaflet.heat is a vanilla-Leaflet plugin with no react-leaflet wrapper.
 *
 * leaflet.heat's UMD build reads the *global* `L` rather than importing
 * "leaflet" itself, so it's dynamically imported here (after `window.L` is
 * set) rather than statically at module top — a static `import "leaflet.heat"`
 * would get hoisted and could run before `window.L` is assigned. Loading it
 * lazily also means the plugin's JS only ships to the browser once someone
 * actually turns the heatmap on. */
function HeatmapLayer({ points, opacity = 1 }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return undefined;
    let cancelled = false;
    let layer;

    (async () => {
      if (typeof window !== "undefined" && !window.L) window.L = L;
      await import("leaflet.heat");
      if (cancelled) return;
      layer = L.heatLayer(points, {
        radius: 26,
        blur: 22,
        maxZoom: 12,
        minOpacity: Math.max(0.08, 0.22 * opacity),
        max: 1,
        gradient: { 0.2: "#22c55e", 0.5: "#f59e0b", 0.8: "#f43f5e" },
      });
      layer.addTo(map);
    })();

    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, points, opacity]);

  return null;
}

export default function GisMap({
  groundwater = [],
  rainfall = [],
  showGroundwater = true,
  showRainfall = true,
  onSelectStation,
  height = "100%",
  // --- Phase 2 additions (all optional/backward-compatible — existing
  // callers such as DashboardPage.jsx that don't pass these keep working
  // exactly as before) ---
  showHeatmap = false,
  showHillshade = false,
  groundwaterOpacity = 1,
  rainfallOpacity = 1,
  heatmapOpacity = 1,
  mapRef,
  children,
}) {
  // Groundwater-stress heatmap: deeper water table => hotter => higher
  // recharge priority. Built from the already-fetched station data, no
  // separate endpoint.
  const heatPoints = useMemo(() => {
    if (!showHeatmap) return [];
    return groundwater
      .filter((s) => s.latitude && s.longitude && s.water_level_m != null)
      .map((s) => {
        const depth = Math.abs(Number(s.water_level_m));
        const intensity = Math.max(0.15, Math.min(1, depth / 25));
        return [s.latitude, s.longitude, intensity];
      });
  }, [showHeatmap, groundwater]);

  return (
    <MapContainer ref={mapRef} center={TN_CENTER} zoom={7} className="rounded-xl" style={{ height, width: "100%" }}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Dark basemap">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Terrain">
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenTopoMap contributors"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {showHillshade && (
        <TileLayer url={HILLSHADE_URL} attribution="Hillshade &copy; Esri" opacity={0.55} zIndex={450} />
      )}

      {showHeatmap && heatPoints.length > 0 && <HeatmapLayer points={heatPoints} opacity={heatmapOpacity} />}

      {showGroundwater &&
        groundwater
          .filter((s) => s.latitude && s.longitude)
          .map((s) => {
            const locName = s.taluk || s.district || s.station_name || "Tamil Nadu";
            return (
              <CircleMarker
                key={`gw-${s.station_id}`}
                center={[s.latitude, s.longitude]}
                radius={6}
                pathOptions={{
                  color: gwColor(s.water_level_m),
                  fillColor: gwColor(s.water_level_m),
                  fillOpacity: 0.85 * groundwaterOpacity,
                  opacity: groundwaterOpacity,
                  weight: 1,
                }}
                eventHandlers={{ click: () => onSelectStation?.({ ...s, kind: "groundwater" }) }}
              >
                <Tooltip>{s.station_name || s.station_code}</Tooltip>
                <Popup>
                  <div className="text-xs font-sans text-slate-900 leading-relaxed">
                    <strong className="text-sm font-bold block text-slate-950">{s.station_name || s.station_code}</strong>
                    {s.district && <span className="text-slate-600 font-medium">{s.district} District<br /></span>}
                    <div className="my-1 rounded bg-amber-50 p-1.5 border border-amber-200">
                      <strong>Water Table:</strong> {s.water_level_m ? `${Math.abs(Number(s.water_level_m)).toFixed(2)} m bgl` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mb-2">
                      {new Date(s.recorded_at).toLocaleString()} ({ageLabel(s.age_hours)})
                    </span>
                    <Link
                      to={`/rwh-design?taluk=${encodeURIComponent(locName)}&lat=${s.latitude}&lng=${s.longitude}&gw=${s.water_level_m || ""}`}
                      className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-sky-700 shadow"
                    >
                      📐 Design RWH Pit →
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

      {showRainfall &&
        rainfall
          .filter((s) => s.latitude && s.longitude)
          .map((s) => {
            const locName = s.taluk || s.district || s.station_name || "Tamil Nadu";
            return (
              <CircleMarker
                key={`rf-${s.station_id}`}
                center={[s.latitude, s.longitude]}
                radius={5}
                pathOptions={{
                  color: rainColor(s.rainfall_mm),
                  fillColor: rainColor(s.rainfall_mm),
                  fillOpacity: 0.85 * rainfallOpacity,
                  opacity: rainfallOpacity,
                  weight: 1,
                }}
                eventHandlers={{ click: () => onSelectStation?.({ ...s, kind: "rainfall" }) }}
              >
                <Tooltip>{s.station_name || s.station_code}</Tooltip>
                <Popup>
                  <div className="text-xs font-sans text-slate-900 leading-relaxed">
                    <strong className="text-sm font-bold block text-slate-950">{s.station_name || s.station_code}</strong>
                    {s.district && <span className="text-slate-600 font-medium">{s.district} District<br /></span>}
                    <div className="my-1 rounded bg-blue-50 p-1.5 border border-blue-200">
                      <strong>Rainfall:</strong> {s.rainfall_mm ?? "—"} mm
                    </div>
                    <span className="text-[10px] text-slate-500 block mb-2">
                      {new Date(s.recorded_at).toLocaleString()} ({ageLabel(s.age_hours)})
                    </span>
                    <Link
                      to={`/rwh-design?taluk=${encodeURIComponent(locName)}&lat=${s.latitude}&lng=${s.longitude}&rf=${s.rainfall_mm || ""}`}
                      className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-blue-700 shadow"
                    >
                      📐 Design RWH Pit →
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

      <ScaleControl position="bottomleft" imperial={false} />

      {children}
    </MapContainer>
  );
}

export { gwColor, rainColor, ageLabel, GW_BANDS, RAIN_BANDS, HILLSHADE_URL };
