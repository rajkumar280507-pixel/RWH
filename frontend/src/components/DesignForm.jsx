import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  Layers,
  CloudRain,
  Droplets,
  Mountain,
  Sparkles,
} from "lucide-react";
import { createRwhDesign } from "../services/api.js";

const LIVE_PREVIEW_DEBOUNCE_MS = 700;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-sky-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-sky-400";

const initialState = {
  building_name: "",
  building_type: "residential",
  roof_material: "rcc_flat",
  roof_slope_percent: 2,
  annual_rainfall_mm: 1100,
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
  initialGw,
  initialRf,
  initialRoofMaterial,
  onSubmit,
}) {
  const round2 = (val) => {
    if (val == null || val === "" || isNaN(val)) return val;
    return Number(Number(val).toFixed(2));
  };

  const [form, setForm] = useState(() => ({
    ...initialState,
    ...(initialGw ? { groundwater_depth_m: round2(Math.abs(Number(initialGw))) } : {}),
    ...(initialRf ? { annual_rainfall_mm: round2(Number(initialRf)) } : {}),
    ...(initialRoofMaterial ? { roof_material: initialRoofMaterial } : {}),
  }));
  const lastPreviewKeyRef = useRef(null);

  // Auto-populate rainfall and groundwater level into numeric inputs directly from live telemetry or initial props
  useEffect(() => {
    if (initialGw != null) {
      setForm((f) => ({ ...f, groundwater_depth_m: round2(Math.abs(Number(initialGw))) }));
    } else if (liveContext?.groundwater?.water_level_m != null) {
      setForm((f) => ({ ...f, groundwater_depth_m: round2(Math.abs(Number(liveContext.groundwater.water_level_m))) }));
    }

    if (initialRf != null) {
      setForm((f) => ({ ...f, annual_rainfall_mm: round2(Number(initialRf)) }));
    } else if (liveContext?.rainfall?.annual_rainfall_mm != null) {
      setForm((f) => ({ ...f, annual_rainfall_mm: round2(Number(liveContext.rainfall.annual_rainfall_mm)) }));
    }
  }, [liveContext, initialGw, initialRf]);

  const hasLiveRf = Boolean(initialRf != null || liveContext?.rainfall?.annual_rainfall_mm != null);
  const hasLiveGw = Boolean(initialGw != null || liveContext?.groundwater?.water_level_m != null);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const buildPayload = (f) => ({
    ...f,
    roof_slope_percent: Number(f.roof_slope_percent || 2),
    annual_rainfall_mm: f.annual_rainfall_mm ? Number(f.annual_rainfall_mm) : null,
    groundwater_depth_m: f.groundwater_depth_m ? Number(f.groundwater_depth_m) : null,
    distance_to_inlet_m: Number(f.distance_to_inlet_m || 10),
    population: f.population ? Number(f.population) : null,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(buildPayload(form));
  };

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
  }, [form, footprint]);

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 text-sm"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.035 } } }}
    >
      <Field label="Building name" icon={Building2}>
        <input className={inputClass} value={form.building_name} onChange={set("building_name")} placeholder="Optional" />
      </Field>

      <Field label="Roof material" icon={Layers}>
        <select className={inputClass} value={form.roof_material} onChange={set("roof_material")}>
          {(roofMaterials ?? []).map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} (Cr ≈ {m.typical_runoff_coefficient})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Annual rainfall (mm/yr)" icon={CloudRain}>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            className={inputClass}
            value={form.annual_rainfall_mm ?? ""}
            onChange={set("annual_rainfall_mm")}
          />
          {hasLiveRf && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          )}
        </div>
      </Field>

      <Field label="Groundwater depth (m bgl)" icon={Droplets}>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            className={inputClass}
            value={form.groundwater_depth_m ?? ""}
            onChange={set("groundwater_depth_m")}
          />
          {hasLiveGw && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          )}
        </div>
      </Field>

      <Field label="Soil type" icon={Mountain}>
        <select className={inputClass} value={form.soil_type} onChange={set("soil_type")}>
          {(soilTypes ?? []).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} (HSG {s.hydrologic_group})
            </option>
          ))}
        </select>
      </Field>

      <motion.button
        variants={fieldVariants}
        type="submit"
        disabled={!hasPolygon || submitting}
        whileTap={hasPolygon && !submitting ? { scale: 0.98 } : {}}
        className="mt-2.5 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition-all hover:shadow-sky-500/40 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
      >
        <Sparkles size={16} />
        {submitting ? "Designing…" : hasPolygon ? "Generate Design" : "Capture a rooftop area first"}
      </motion.button>
    </motion.form>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <motion.label variants={fieldVariants} className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
        {Icon && <Icon size={13} className="text-sky-500" />}
        {label}
      </span>
      {children}
    </motion.label>
  );
}
