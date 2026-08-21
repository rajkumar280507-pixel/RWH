/**
 * CustomPitControls.jsx — shape + dimension inputs for the user-custom pit
 * sketch tool, shared by the 2D CAD tab (EngineeringDrawings2D) and the 3D
 * tab (RechargeStructureScene) so both render the same control UI. Purely
 * presentational + local numeric state; the caller owns the actual
 * `pit` value and receives updates via `onChange`.
 */
import { Circle, RectangleHorizontal } from "lucide-react";
import { CUSTOM_PIT_LIMITS, computeCustomPitQuantities } from "../../lib/customPitQuantities.js";

const n = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d));

function Field({ label, unit, value, limits, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
        {label} ({unit})
      </span>
      <input
        type="number"
        value={value}
        min={limits.min}
        max={limits.max}
        step={limits.step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-brand"
      />
    </label>
  );
}

export default function CustomPitControls({ pit, onChange, filterStack, compact = false }) {
  const setShape = (shape) => {
    if (shape === pit.shape) return;
    onChange(
      shape === "rectangular"
        ? { shape: "rectangular", lengthM: 2, widthM: 1.5, depthM: pit.depthM, freeboardM: pit.freeboardM }
        : { shape: "circular", diameterM: 1.5, depthM: pit.depthM, freeboardM: pit.freeboardM }
    );
  };
  const setField = (key) => (raw) => onChange({ ...pit, [key]: raw === "" ? "" : Number(raw) });

  const quantities = computeCustomPitQuantities(pit, filterStack);

  return (
    <div className={`flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 ${compact ? "text-[11px]" : "text-xs"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800 dark:text-slate-200">Custom Pit Sketch</span>
        <div className="flex gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-0.5">
          <button
            type="button"
            onClick={() => setShape("circular")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition ${
              pit.shape === "circular" ? "bg-brand/10 text-brand" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Circle size={11} /> Circular
          </button>
          <button
            type="button"
            onClick={() => setShape("rectangular")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition ${
              pit.shape === "rectangular" ? "bg-brand/10 text-brand" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <RectangleHorizontal size={11} /> Rectangular
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {pit.shape === "circular" ? (
          <Field label="Diameter" unit="m" value={pit.diameterM} limits={CUSTOM_PIT_LIMITS.diameterM} onChange={setField("diameterM")} />
        ) : (
          <>
            <Field label="Length" unit="m" value={pit.lengthM} limits={CUSTOM_PIT_LIMITS.lengthM} onChange={setField("lengthM")} />
            <Field label="Width" unit="m" value={pit.widthM} limits={CUSTOM_PIT_LIMITS.widthM} onChange={setField("widthM")} />
          </>
        )}
        <Field label="Depth" unit="m" value={pit.depthM} limits={CUSTOM_PIT_LIMITS.depthM} onChange={setField("depthM")} />
        <Field label="Freeboard" unit="m" value={pit.freeboardM} limits={CUSTOM_PIT_LIMITS.freeboardM} onChange={setField("freeboardM")} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 dark:border-slate-800 pt-2 text-slate-600 dark:text-slate-400">
        <span>
          Footprint: <b className="text-slate-800 dark:text-slate-200">{n(quantities.footprintAreaM2)} m²</b>
        </span>
        <span>
          Excavation: <b className="text-slate-800 dark:text-slate-200">{n(quantities.excavationVolumeM3)} m³</b>
        </span>
        <span className="text-[10px] italic text-slate-500 dark:text-slate-500">Indicative geometry only — not an engineered design or BOQ.</span>
      </div>
    </div>
  );
}
