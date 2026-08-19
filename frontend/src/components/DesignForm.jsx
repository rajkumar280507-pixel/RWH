import { useEffect, useState } from "react";

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

export default function DesignForm({ roofMaterials, soilTypes, hasPolygon, submitting, liveContext, onSubmit }) {
  const [form, setForm] = useState(initialState);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      roof_slope_percent: Number(form.roof_slope_percent),
      annual_rainfall_mm: form.use_live_rainfall ? null : Number(form.annual_rainfall_mm),
      groundwater_depth_m: form.use_live_groundwater ? null : Number(form.groundwater_depth_m),
      distance_to_inlet_m: Number(form.distance_to_inlet_m),
      population: form.population ? Number(form.population) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
      <Field label="Building name">
        <input className="input" value={form.building_name} onChange={set("building_name")} placeholder="Optional" />
      </Field>

      <Field label="Building type">
        <select className="input" value={form.building_type} onChange={set("building_type")}>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="institutional">Institutional</option>
          <option value="industrial">Industrial</option>
        </select>
      </Field>

      <Field label="Roof material">
        <select className="input" value={form.roof_material} onChange={set("roof_material")}>
          {(roofMaterials ?? []).map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} (Cr ≈ {m.typical_runoff_coefficient})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Roof slope (%)">
        <input type="number" step="0.1" className="input" value={form.roof_slope_percent} onChange={set("roof_slope_percent")} />
      </Field>

      <LiveOrManualField
        label="Annual rainfall"
        useLive={form.use_live_rainfall}
        onToggle={(v) => setForm((f) => ({ ...f, use_live_rainfall: v }))}
        liveAvailable={!!liveContext?.rainfall}
        liveSummary={
          liveContext?.rainfall &&
          `${liveContext.rainfall.annual_rainfall_mm} mm/yr — ${liveContext.rainfall.station_name ?? liveContext.rainfall.station_code} (${liveContext.rainfall.distance_km} km)${liveContext.rainfall.extrapolated ? `, extrapolated from ${liveContext.rainfall.days_covered}d` : ""}`
        }
      >
        <input type="number" className="input" value={form.annual_rainfall_mm} onChange={set("annual_rainfall_mm")} />
      </LiveOrManualField>

      <LiveOrManualField
        label="Groundwater depth"
        useLive={form.use_live_groundwater}
        onToggle={(v) => setForm((f) => ({ ...f, use_live_groundwater: v }))}
        liveAvailable={!!liveContext?.groundwater}
        liveSummary={
          liveContext?.groundwater &&
          `${liveContext.groundwater.water_level_m} m bgl — ${liveContext.groundwater.station_name ?? liveContext.groundwater.station_code} (${liveContext.groundwater.distance_km} km)`
        }
      >
        <input type="number" step="0.1" className="input" value={form.groundwater_depth_m} onChange={set("groundwater_depth_m")} />
      </LiveOrManualField>

      <Field label="Soil type">
        <select className="input" value={form.soil_type} onChange={set("soil_type")}>
          {(soilTypes ?? []).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} (HSG {s.hydrologic_group})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Population served (optional)">
        <input type="number" className="input" value={form.population} onChange={set("population")} placeholder="For storage tank sizing" />
      </Field>

      <Field label="Distance to inlet (m)">
        <input type="number" step="0.5" className="input" value={form.distance_to_inlet_m} onChange={set("distance_to_inlet_m")} />
      </Field>

      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input type="checkbox" checked={form.allow_shallow_override} onChange={set("allow_shallow_override")} />
        Override 3.0 m groundwater separation rule (requires site-specific hydrogeological sign-off)
      </label>

      <button
        type="submit"
        disabled={!hasPolygon || submitting}
        className="mt-2 rounded-lg bg-accent text-surface font-semibold py-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? "Designing…" : hasPolygon ? "Generate Design" : "Draw a rooftop polygon first"}
      </button>

      <style>{`
        .input {
          background: rgba(17, 26, 46, 0.6);
          border: 1px solid rgb(51 65 85 / 0.6);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: rgb(241 245 249);
          width: 100%;
        }
        .input:focus { outline: none; border-color: #2dd4bf; }
        .input:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </form>
  );
}

function LiveOrManualField({ label, useLive, onToggle, liveAvailable, liveSummary, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <label className="flex items-center gap-1 text-[10px] text-accent cursor-pointer">
          <input type="checkbox" checked={useLive} onChange={(e) => onToggle(e.target.checked)} />
          Use live CGWB data
        </label>
      </div>
      {useLive ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-slate-300">
          {liveAvailable ? (
            <>📡 {liveSummary}</>
          ) : (
            <span className="text-amber-300">No live station within range — draw the rooftop to check, or switch to manual entry.</span>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}
