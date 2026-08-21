import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, LoaderCircle } from "lucide-react";

/**
 * GPS "locate me" control. Takes the raw Leaflet `Map` instance (the same
 * `mapRef` hook point every other floating control here uses — see
 * MiniMap.jsx/SearchControl.jsx) rather than living inside <MapContainer>'s
 * own react-leaflet children tree, so it can be composed as a sibling
 * overlay from GisMapPage.jsx.
 *
 * Uses the browser's native `navigator.geolocation` — no paid/external
 * geolocation API. Permission-denied, timeout, and unsupported-browser cases
 * all resolve to a small inline error message rather than throwing/crashing.
 */
export default function LocateControl({ map, className = "" }) {
  const [status, setStatus] = useState("idle"); // idle | locating | error
  const [error, setError] = useState("");
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Tear down the marker/accuracy-circle if the underlying map instance is
  // ever swapped/unmounted.
  useEffect(() => {
    return () => {
      if (map && markerRef.current) map.removeLayer(markerRef.current);
      if (map && circleRef.current) map.removeLayer(circleRef.current);
    };
  }, [map]);

  const locate = () => {
    if (!map) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setError("Geolocation isn't supported by this browser.");
      return;
    }

    setStatus("locating");
    setError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const latlng = [latitude, longitude];

        if (markerRef.current) map.removeLayer(markerRef.current);
        if (circleRef.current) map.removeLayer(circleRef.current);

        markerRef.current = L.circleMarker(latlng, {
          radius: 8,
          color: "#2563EB",
          fillColor: "#3B82F6",
          fillOpacity: 0.9,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip("You are here (approx.)");

        if (accuracy) {
          circleRef.current = L.circle(latlng, {
            radius: accuracy,
            color: "#2563EB",
            fillColor: "#2563EB",
            fillOpacity: 0.08,
            weight: 1,
          }).addTo(map);
        }

        map.flyTo(latlng, Math.max(map.getZoom(), 13), { duration: 0.75 });
        setStatus("idle");
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : err.code === err.TIMEOUT
              ? "Location request timed out."
              : "Couldn't determine your location."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={locate}
        disabled={!map || status === "locating"}
        title="Locate me"
        className="glass-panel flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700 shadow-lg transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800/70 dark:text-slate-300 dark:hover:text-brandCyan"
      >
        {status === "locating" ? (
          <LoaderCircle size={16} className="animate-spin text-brand" />
        ) : (
          <LocateFixed size={16} />
        )}
      </button>
      {status === "error" && (
        <div className="glass-panel max-w-[10rem] rounded-lg border border-danger/30 px-2 py-1 text-right text-[10px] leading-snug text-danger shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
