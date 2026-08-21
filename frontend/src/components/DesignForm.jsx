import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  Layers,
  TrendingUp,
  CloudRain,
  Droplets,
  Mountain,
  Users,
  Milestone,
  ShieldAlert,
  Satellite,
  Sparkles,
} from "lucide-react";
import QuantityTakeoffPanel from "./cad/QuantityTakeoffPanel.jsx";
import { createRwhDesign } from "../services/api.js";

// How long to wait after the operator stops changing inputs before firing a
// live recompute. POST /rwh/design accepts `persist: false`, which runs the
// full engine (compute_design) but skips every DB write — so this debounced
// call is a genuine non-persisting "dry run", not a raw on-every-keystroke
// hit against the persisting create endpoint. See RwhDesignPage.jsx for the
// real, persisted submission path (persist defaults to true there).
const LIVE_PREVIEW_DEBOUNCE_MS = 700;

// Shared input styling — light-first with a dark-mode pair, matching the
// input pattern already established on DashboardPage.jsx's sizing panel.
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500";

const initialState = {
  building_name: "",
  building_type: "residential",
  roof_material: "rcc_flat",
  roof_slope_percent: 2,
  use_live_rainfall: true,
  annual_rainfall_mm: 1100,
  use_live_groundwater: true,
  groundwater_depth_m: 10,
  soil_type: "sandy_loam",
  population: "",
  distance_to_inlet_m: 10,
  allow_shallow_override: false,
};

const fieldVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

export default function DesignForm({
  roofMaterials,
  soilTypes,
  hasPolygon,
  submitting,
  liveContext,
  roofAreaSqm,
  footprint,
  onSubmit,
}) {
  const [form, setForm] = useState(initialState);
  const lastPreviewKeyRef = useRef(null);

  // If a live station later turns out to be unavailable at this point,
  // fall back to manual entry automatically rather than letting the
  // operator submit a request that's guaranteed to 422.
  useEffect(() => {
    if (liveContext && liveContext.rainfall === null && form.use_live_rainfall) {
      setForm((f) => ({ ...f, use_live_rainfall: false }));
    }
    if (liveContext && liveContext.groundwater === null && form.use_live_groundwater) {
      setForm((f) => ({ ...f, use_live_groundwater: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveContext]);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Shared with both the real submit and the live-preview dry run so the
  // two never diverge in how form state is turned into a request body.
  const buildPayload = (f) => ({
    ...f,
    roof_slope_percent: Number(f.roof_slope_percent),
    annual_rainfall_mm: f.use_live_rainfall ? null : Number(f.annual_rainfall_mm),
    groundwater_depth_m: f.use_live_groundwater ? null : Number(f.groundwater_depth_m),
    distance_to_inlet_m: Number(f.distance_to_inlet_m),
    population: f.population ? Number(f.population) : null,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(buildPayload(form));
  };

  // --- Live quantity-takeoff preview -------------------------------------
  // Debounced, non-persisting recompute against the real backend engine
  // (POST /rwh/design with persist: false) so the QuantityTakeoffPanel
  // below tracks the actual inputs as the operator edits them, without
  // duplicating the engine's math client-side and without writing a new
  // `rwh_designs` row on every keystroke.
  const previewMutation = useMutation({ mutationFn: createRwhDesign });

  useEffect(() => {
    if (!footprint) return undefined;
    const payload = { ...buildPayload(form), footprint, persist: false };
    const key = JSON.stringify(payload);
    if (key === lastPreviewKeyRef.current) return undefined;

    const timer = setTimeout(() => {
      lastPreviewKeyRef.current = key;
      previewMutation.mutate(payload);
    }, LIVE_PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, footprint]);

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2.5 text-sm"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.035 } } }}
    >
      {roofAreaSqm > 0 && <QuickEstimateCard roofAreaSqm={roofAreaSqm} />}

      <Field label="Building name" icon={Building2}>
        <input className={inputClass} value={form.building_name} onChange={set("building_name")} placeholder="Optional" />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Building type" icon={Building2}>
          <select className={inputClass} value={form.building_type} onChange={set("building_type")}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="institutional">Institutional</option>
            <option value="industrial">Industrial</option>
          </select>
        </Field>

        <Field label="Roof slope (%)" icon={TrendingUp}>
          <input type="number" step="0.1" className={inputClass} value={form.roof_slope_percent} onChange={set("roof_slope_percent")} />
        </Field>
      </div>

      <Field label="Roof material" icon={Layers}>
        <select className={inputClass} value={form.roof_material} onChange={set("roof_material")}>
          {(roofMaterials ?? []).map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} (Cr ≈ {m.typical_runoff_coefficient})
            </option>
          ))}
        </select>
      </Field>

      <LiveOrManualField
        label="Annual rainfall"
        icon={CloudRain}
        useLive={form.use_live_rainfall}
        onToggle={(v) => setForm((f) => ({ ...f, use_live_rainfall: v }))}
        liveAvailable={!!liveContext?.rainfall}
        liveSummary={
          liveContext?.rainfall &&
          `${liveContext.rainfall.annual_rainfall_mm} mm/yr — ${liveContext.rainfall.station_name ?? liveContext.rainfall.station_code} (${liveContext.rainfall.distance_km} km)${liveContext.rainfall.extrapolated ? `, extrapolated from ${liveContext.rainfall.days_covered}d` : ""}`
        }
      >
        <input type="number" className={inputClass} value={form.annual_rainfall_mm} onChange={set("annual_rainfall_mm")} />
      </LiveOrManualField>

      <LiveOrManualField
        label="Groundwater depth"
        icon={Droplets}
        useLive={form.use_live_groundwater}
        onToggle={(v) => setForm((f) => ({ ...f, use_live_groundwater: v }))}
        liveAvailable={!!liveContext?.groundwater}
        liveSummary={
          liveContext?.groundwater &&
          `${liveContext.groundwater.water_level_m} m bgl — ${liveContext.groundwater.station_name ?? liveContext.groundwater.station_code} (${liveContext.groundwater.distance_km} km)`
        }
      >
        <input type="number" step="0.1" className={inputClass} value={form.groundwater_depth_m} onChange={set("groundwater_depth_m")} />
      </LiveOrManualField>

      <Field label="Soil type" icon={Mountain}>
        <select className={inputClass} value={form.soil_type} onChange={set("soil_type")}>
          {(soilTypes ?? []).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} (HSG {s.hydrologic_group})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Population (optional)" icon={Users}>
          <input type="number" className={inputClass} value={form.population} onChange={set("population")} placeholder="LPCD sizing" />
        </Field>

        <Field label="Dist. to inlet (m)" icon={Milestone}>
          <input type="number" step="0.5" className={inputClass} value={form.distance_to_inlet_m} onChange={set("distance_to_inlet_m")} />
        </Field>
      </div>

      <motion.label
        variants={fieldVariants}
        className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 px-2.5 py-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400"
      >
        <ShieldAlert size={14} className="shrink-0 text-warning" />
        Override 3.0 m groundwater separation rule (requires site-specific hydrogeological sign-off)
        <input type="checkbox" className="ml-auto shrink-0" checked={form.allow_shallow_override} onChange={set("allow_shallow_override")} />
      </motion.label>

      <motion.div variants={fieldVariants}>
        <QuantityTakeoffPanel
          result={previewMutation.data}
          loading={!previewMutation.data && previewMutation.isPending}
          recalculating={!!previewMutation.data && previewMutation.isPending}
          className="!p-3"
        />
        {previewMutation.isError && (
          <p className="mt-1.5 text-[10px] text-warning">
            Live recalculation is unavailable for the current inputs — this won't block the final
            submit, just the preview above.
          </p>
        )}
      </motion.div>

      <motion.button
        variants={fieldVariants}
        type="submit"
        disabled={!hasPolygon || submitting}
        whileTap={hasPolygon && !submitting ? { scale: 0.98 } : {}}
        className="mt-1 rounded-lg bg-accent py-2 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Designing…" : hasPolygon ? "Generate Design" : "Capture a rooftop area first"}
      </motion.button>
    </motion.form>
  );
}

/**
 * Purely informational pre-fill hint — ports the 5-bucket roof-area →
 * structure-size heuristic from the retired InteractiveRechargePitDesigner
 * so operators get a sense of the likely structure before submitting. It
 * never feeds the actual request: the backend engine (via POST /rwh/design)
 * remains the sole source of the real, authoritative sizing.
 */
function estimateStructure(areaSqm) {
  if (areaSqm <= 100) return { shape: "Circular pit", dims: "Ø1.5m × 2.5m deep", pipe: "90mm" };
  if (areaSqm <= 180) return { shape: "Circular pit", dims: "Ø2.0m × 3.0m deep", pipe: "110mm" };
  if (areaSqm <= 300) return { shape: "Rectangular pit", dims: "3.5m × 2.0m × 3.0m deep", pipe: "110mm" };
  if (areaSqm <= 500) return { shape: "Rectangular pit", dims: "5.0m × 2.5m × 3.5m deep", pipe: "160mm" };
  return { shape: "Rectangular pit", dims: "7.5m × 3.0m × 4.0m deep", pipe: "200mm" };
}

function QuickEstimateCard({ roofAreaSqm }) {
  const est = estimateStructure(roofAreaSqm);
  return (
    <motion.div
      variants={fieldVariants}
      className="flex items-start gap-2 rounded-lg border border-info/20 bg-info/5 px-2.5 py-2 text-[11px] text-slate-700 dark:text-slate-300"
    >
      <Sparkles size={13} className="mt-0.5 shrink-0 text-info" />
      <div>
        <div className="font-semibold text-slate-900 dark:text-slate-100">Quick estimate — {est.shape}</div>
        <div className="mt-0.5 text-slate-500 dark:text-slate-400">
          Ballpark {est.dims}, {est.pipe} inlet pipe, for {roofAreaSqm.toFixed(0)} m² of catchment. Indicative only —
          the generated design below is computed from the real engine and governs.
        </div>
      </div>
    </motion.div>
  );
}

function LiveOrManualField({ label, icon: Icon, useLive, onToggle, liveAvailable, liveSummary, children }) {
  return (
    <motion.div variants={fieldVariants} className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {Icon && <Icon size={12} className="text-slate-400 dark:text-slate-500" />}
          {label}
        </span>
        <label className="flex shrink-0 items-center gap-1 text-[10px] text-accent cursor-pointer">
          <input type="checkbox" checked={useLive} onChange={(e) => onToggle(e.target.checked)} />
          Live CGWB
        </label>
      </div>
      {useLive ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-300">
          {liveAvailable ? (
            <span className="flex items-center gap-1.5">
              <Satellite size={12} className="shrink-0 text-accent" />
              {liveSummary}
            </span>
          ) : (
            <span className="text-warning">No live station within range — draw the rooftop to check, or switch to manual entry.</span>
          )}
        </div>
      ) : (
        children
      )}
    </motion.div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <motion.label variants={fieldVariants} className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {Icon && <Icon size={12} className="text-slate-400 dark:text-slate-500" />}
        {label}
      </span>
      {children}
    </motion.label>
  );
}
