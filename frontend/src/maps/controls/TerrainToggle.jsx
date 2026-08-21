import { Mountain } from "lucide-react";

/**
 * Terrain toggle — HONESTY NOTE: true elevation-rendered 3D terrain is not
 * achievable while staying on react-leaflet (that needs MapLibre GL +
 * terrain-RGB tiles, out of scope for this project). What this actually
 * ships is a free, no-API-key Esri hillshade *raster* overlay
 * (`HILLSHADE_URL` in GisMap.jsx) layered on top of the current basemap —
 * a 2D shaded-relief image, not real 3D geometry. The label and tooltip
 * below say so explicitly rather than implying more than that.
 */
export default function TerrainToggle({ active, onToggle, className = "" }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      title="Shaded-relief overlay (2D hillshade raster) — not true 3D elevation terrain"
      className={`glass-panel flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium shadow-lg transition ${
        active
          ? "border-accent/50 bg-accent/15 text-accent"
          : "border-slate-200 text-slate-700 hover:text-slate-900 dark:border-slate-800/70 dark:text-slate-300 dark:hover:text-slate-100"
      } ${className}`}
    >
      <Mountain size={13} />
      <span className="flex flex-col items-start leading-tight">
        <span>Hillshade relief</span>
        <span className="text-[9px] font-normal text-slate-500 dark:text-slate-500">2D shading, not 3D terrain</span>
      </span>
    </button>
  );
}
