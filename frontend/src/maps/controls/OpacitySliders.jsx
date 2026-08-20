import { SlidersHorizontal } from "lucide-react";

/**
 * Per-layer opacity sliders feeding GisMap.jsx's `groundwaterOpacity` /
 * `rainfallOpacity` / `heatmapOpacity` props. Controlled from GisMapPage.jsx
 * — this component is purely presentational.
 */
export default function OpacitySliders({
  groundwaterOpacity,
  rainfallOpacity,
  heatmapOpacity,
  showHeatmap,
  onChange,
  className = "",
}) {
  return (
    <div className={`glass-panel w-52 rounded-xl border border-slate-800/70 p-3 shadow-lg dark:border-slate-800/70 ${className}`}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-200">
        <SlidersHorizontal size={12} className="text-accent" />
        Layer opacity
      </div>
      <div className="flex flex-col gap-2.5">
        <Slider
          label="Groundwater"
          value={groundwaterOpacity}
          onChange={(v) => onChange({ groundwaterOpacity: v })}
        />
        <Slider label="Rainfall" value={rainfallOpacity} onChange={(v) => onChange({ rainfallOpacity: v })} />
        <Slider
          label="Heatmap"
          value={heatmapOpacity}
          disabled={!showHeatmap}
          onChange={(v) => onChange({ heatmapOpacity: v })}
        />
      </div>
    </div>
  );
}

function Slider({ label, value, onChange, disabled = false }) {
  return (
    <label className={`flex flex-col gap-1 text-[11px] ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-center justify-between text-slate-400">
        <span>{label}</span>
        <span className="tabular-nums text-slate-500">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0.1}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-400 disabled:cursor-not-allowed"
      />
    </label>
  );
}
