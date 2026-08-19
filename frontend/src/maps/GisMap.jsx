import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, Tooltip } from "react-leaflet";
import { Link } from "react-router-dom";

const TN_CENTER = [11.1271, 78.6569]; // Tamil Nadu centroid, sane default extent

/** Colour-codes a groundwater marker by how deep the water table sits.
 * CGWB reports level as depth below ground and the feed uses negative values,
 * so deeper (more negative) = more stressed = warmer colour. */
function gwColor(level) {
  if (level == null) return "#64748b";
  const depth = Math.abs(Number(level));
  if (depth > 20) return "#f43f5e";
  if (depth > 10) return "#f59e0b";
  if (depth > 5) return "#2dd4bf";
  return "#22c55e";
}

function rainColor(mm) {
  const v = Number(mm ?? 0);
  if (v > 50) return "#1d4ed8";
  if (v > 10) return "#3b82f6";
  if (v > 0) return "#93c5fd";
  return "#475569";
}

function ageLabel(hours) {
  if (hours == null) return "unknown age";
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function GisMap({
  groundwater = [],
  rainfall = [],
  showGroundwater = true,
  showRainfall = true,
  onSelectStation,
  height = "100%",
}) {
  return (
    <MapContainer center={TN_CENTER} zoom={7} className="rounded-xl" style={{ height, width: "100%" }}>
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
                pathOptions={{ color: gwColor(s.water_level_m), fillColor: gwColor(s.water_level_m), fillOpacity: 0.85, weight: 1 }}
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
                pathOptions={{ color: rainColor(s.rainfall_mm), fillColor: rainColor(s.rainfall_mm), fillOpacity: 0.85, weight: 1 }}
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
    </MapContainer>
  );
}

export { gwColor, rainColor, ageLabel };
