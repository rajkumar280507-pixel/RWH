import { useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { GW_BANDS, RAIN_BANDS } from "../GisMap.jsx";

/**
 * Static colour-key for the marker/heatmap layers. Imports the same
 * `GW_BANDS`/`RAIN_BANDS` arrays that `maps/GisMap.jsx`'s `gwColor`/
 * `rainColor` are built from, so the thresholds shown here can never drift
 * out of sync with what's actually drawn on the map.
 */
export default function LegendPanel({ className = "" }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`glass-panel w-56 rounded-xl border border-slate-800/70 shadow-lg dark:border-slate-800/70 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-200"
      >
        <span className="flex items-center gap-1.5">
          <Layers size={12} className="text-accent" />
          Legend
        </span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="space-y-2 border-t border-slate-800/70 px-3 py-2.5 text-[11px] dark:border-slate-800/70">
          <div>
            <div className="mb-1 font-medium text-slate-400">Groundwater depth</div>
            <div className="flex flex-col gap-1">
              {GW_BANDS.map((b) => (
                <Swatch key={b.label} color={b.color} label={b.label} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 font-medium text-slate-400">Rainfall</div>
            <div className="flex flex-col gap-1">
              {RAIN_BANDS.filter((b) => b.max !== 0).map((b) => (
                <Swatch key={b.label} color={b.color} label={b.label} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Swatch({ color, label }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-300">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
