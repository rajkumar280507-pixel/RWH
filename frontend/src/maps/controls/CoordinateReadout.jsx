import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";

/**
 * Small floating badge showing the live lat/lon under the cursor.
 *
 * Takes the raw Leaflet `Map` instance (not a react-leaflet child) so it can
 * be composed as a sibling overlay around <GisMap /> from GisMapPage.jsx
 * without needing to live inside <MapContainer>'s own children tree — see
 * the `mapRef` hook point GisMap.jsx exposes.
 */
export default function CoordinateReadout({ map, className = "" }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!map) return undefined;
    const onMove = (e) => setPos(e.latlng);
    const onOut = () => setPos(null);
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
    };
  }, [map]);

  return (
    <div
      className={`glass-panel flex items-center gap-1.5 rounded-lg border border-slate-800/70 px-2.5 py-1.5 text-[10px] tabular-nums text-slate-300 shadow-lg dark:border-slate-800/70 ${className}`}
    >
      <Crosshair size={11} className="text-accent" />
      {pos ? (
        <span>
          {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
        </span>
      ) : (
        <span className="text-slate-500">Hover the map…</span>
      )}
    </div>
  );
}
