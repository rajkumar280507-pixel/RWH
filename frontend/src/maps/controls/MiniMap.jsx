import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Rectangle } from "react-leaflet";

const TN_CENTER = [11.1271, 78.6569];

/**
 * Small overview inset synced to the main map's viewport. Implemented as a
 * second, independent react-leaflet `MapContainer` (simplest robust
 * approach, no extra minimap plugin dependency) rather than a third-party
 * minimap control — it listens to the main map's `moveend` via the raw
 * Leaflet `Map` instance passed in as `map` (see GisMap.jsx's `mapRef` hook
 * point) and re-centers itself + redraws the viewport rectangle.
 */
export default function MiniMap({ map, className = "" }) {
  const miniMapRef = useRef(null);
  const [center, setCenter] = useState(TN_CENTER);
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    if (!map) return undefined;

    const sync = () => {
      const c = map.getCenter();
      setCenter(c);
      setBounds(map.getBounds());
      miniMapRef.current?.setView(c, Math.max(4, map.getZoom() - 5), { animate: false });
    };

    sync();
    map.on("moveend", sync);
    map.on("zoomend", sync);
    return () => {
      map.off("moveend", sync);
      map.off("zoomend", sync);
    };
  }, [map]);

  return (
    <div
      className={`glass-panel h-32 w-40 overflow-hidden rounded-lg border border-slate-200 shadow-lg dark:border-slate-800/70 ${className}`}
      title="Overview — drag or zoom the main map to move this"
    >
      <MapContainer
        ref={miniMapRef}
        center={center}
        zoom={5}
        zoomControl={false}
        dragging={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        {bounds && <Rectangle bounds={bounds} pathOptions={{ color: "#2dd4bf", weight: 1, fillOpacity: 0.08 }} />}
      </MapContainer>
    </div>
  );
}
