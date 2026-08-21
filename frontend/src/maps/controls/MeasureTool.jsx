import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Ruler, Trash2 } from "lucide-react";

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lon points. Hand-rolled Haversine —
 * no turf/geo dependency needed just to sum a drawn line's segments. */
function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function totalDistance(latlngs) {
  let total = 0;
  for (let i = 1; i < latlngs.length; i++) total += haversineMeters(latlngs[i - 1], latlngs[i]);
  return total;
}

function formatDistance(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

/**
 * Distance-measurement tool. Reuses leaflet-draw's polyline draw interaction
 * (already an app dependency — react-leaflet-draw/leaflet-draw power the
 * rooftop-outline tool in DrawRoofMap.jsx) rather than pulling in a separate
 * measurement plugin. The distance total itself is a hand-rolled Haversine
 * sum over the drawn vertices.
 *
 * `leaflet-draw` is dynamically imported (it patches the global `L.Draw`
 * namespace) so this control works even on pages that never load
 * react-leaflet-draw's <EditControl/> some other way.
 */
export default function MeasureTool({ map, className = "" }) {
  const [active, setActive] = useState(false);
  const [distance, setDistance] = useState(null);
  const [ready, setReady] = useState(false);
  const drawerRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;
    let mounted = true;
    let onCreated;

    (async () => {
      await import("leaflet-draw");
      if (!mounted) return;
      setReady(true);
      onCreated = (e) => {
        if (layerRef.current) map.removeLayer(layerRef.current);
        layerRef.current = e.layer;
        layerRef.current.addTo(map);
        setDistance(totalDistance(e.layer.getLatLngs()));
        setActive(false);
      };
      map.on(L.Draw.Event.CREATED, onCreated);
    })();

    return () => {
      mounted = false;
      if (onCreated) map.off(L.Draw.Event.CREATED, onCreated);
    };
  }, [map]);

  const start = async () => {
    if (!map) return;
    await import("leaflet-draw");
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    setDistance(null);
    drawerRef.current = new L.Draw.Polyline(map, {
      shapeOptions: { color: "#2dd4bf", weight: 3 },
    });
    drawerRef.current.enable();
    setActive(true);
  };

  const stop = () => {
    drawerRef.current?.disable();
    setActive(false);
  };

  const clear = () => {
    stop();
    if (layerRef.current && map) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    setDistance(null);
  };

  return (
    <div className={`glass-panel w-48 rounded-xl border border-slate-200 p-2.5 text-xs shadow-lg dark:border-slate-800/70 ${className}`}>
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
        <Ruler size={13} className="text-accent" />
        Measure distance
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!ready}
          onClick={active ? stop : start}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
            active ? "bg-danger/20 text-danger" : "bg-accent/15 text-accent hover:bg-accent/25"
          }`}
        >
          {active ? "Click to finish…" : "Draw line"}
        </button>
        {(distance != null || layerRef.current) && (
          <button
            type="button"
            onClick={clear}
            title="Clear"
            className="rounded-lg border border-slate-300 p-1.5 text-slate-500 transition hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {distance != null && (
        <div className="mt-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          Length: <span className="font-semibold text-accent">{formatDistance(distance)}</span>
        </div>
      )}
      {active && (
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-500">
          Click the map to add points, double-click to finish.
        </p>
      )}
    </div>
  );
}
