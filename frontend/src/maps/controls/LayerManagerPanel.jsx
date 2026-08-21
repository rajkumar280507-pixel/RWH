import { useState } from "react";
import { Layers, ChevronDown, ChevronUp, Info } from "lucide-react";

/**
 * Floating layer-manager panel: overlay toggles (bound to the same
 * `filters.showGroundwater`/`showRainfall`/`showHeatmap`/`showRechargeZones`
 * state that drives FilterBar.jsx's inline toggle row — this panel is a
 * convenience duplicate for when the filter bar has scrolled out of view,
 * not a second source of truth).
 *
 * Basemap switching (Dark / Satellite / Terrain) intentionally stays on
 * react-leaflet's built-in `<LayersControl>` (top-right, native Leaflet UI)
 * rather than being reimplemented here — reusing Leaflet's own control is
 * more reliable than duplicating its state machine.
 */
export default function LayerManagerPanel({ filters, onChange, className = "" }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`glass-panel w-56 rounded-xl border border-slate-200 shadow-lg dark:border-slate-800/70 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200"
      >
        <span className="flex items-center gap-1.5">
          <Layers size={12} className="text-accent" />
          Layers
        </span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-800/70">
          <Row
            label="Groundwater wells"
            dot="bg-accent"
            checked={filters.showGroundwater !== false}
            onChange={(v) => onChange({ ...filters, showGroundwater: v })}
          />
          <Row
            label="Rainfall stations"
            dot="bg-accent-blue"
            checked={filters.showRainfall !== false}
            onChange={(v) => onChange({ ...filters, showRainfall: v })}
          />
          <Row
            label="Recharge heatmap"
            dot="bg-amber-400"
            checked={filters.showHeatmap === true}
            onChange={(v) => onChange({ ...filters, showHeatmap: v })}
          />
          <Row
            label="Recharge zones"
            dot="bg-emerald-400"
            checked={false}
            disabled
            tooltip="Requires zone-boundary geometry that the API doesn't provide yet"
          />
          <p className="mt-0.5 flex items-start gap-1 text-[10px] leading-snug text-slate-500 dark:text-slate-500">
            <Info size={11} className="mt-0.5 shrink-0" />
            Basemap (street / satellite / terrain / dark) switches via the
            layers icon in the top-right corner of the map.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, dot, checked, onChange, disabled = false, tooltip }) {
  return (
    <label
      title={tooltip}
      className={`flex cursor-pointer items-center justify-between gap-2 text-[11px] text-slate-700 dark:text-slate-300 ${
        disabled ? "cursor-not-allowed opacity-45" : ""
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="accent-teal-400 disabled:cursor-not-allowed"
      />
    </label>
  );
}
