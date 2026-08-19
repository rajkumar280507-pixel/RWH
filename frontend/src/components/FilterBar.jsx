import { useQuery } from "@tanstack/react-query";
import { getFilterOptions } from "../services/api.js";

/**
 * Shared filter controls for the telemetry views. Freshness defaults to 30
 * days because the CGWB feed contains years of history — showing every
 * station's "latest" reading without a freshness bound mixes live telemetry
 * with stations that stopped reporting long ago.
 */
export const FRESHNESS_OPTIONS = [
  { value: 2, label: "Last 48 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 365, label: "Last year" },
  { value: "", label: "All time" },
];

export const EMPTY_FILTERS = {
  state: "",
  district: "",
  taluk: "",
  maxAgeDays: 365,
  search: "",
  showGroundwater: true,
  showRainfall: true,
};

export default function FilterBar({ filters, onChange, showLayers = false }) {
  const options = useQuery({ queryKey: ["filter-options"], queryFn: getFilterOptions, staleTime: 300_000 });

  const districts = filters.state
    ? options.data?.districts_by_state?.[filters.state] ?? []
    : options.data?.all_districts ?? [];

  const taluks = filters.district
    ? options.data?.taluks_by_district?.[filters.district] ?? []
    : options.data?.all_taluks ?? [];

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    let extra = {};
    if (key === "state") {
      extra = { district: "", taluk: "" };
    } else if (key === "district") {
      extra = { taluk: "" };
    } else if (key === "taluk" && value && !filters.district && options.data?.taluks_by_district) {
      for (const [dist, tList] of Object.entries(options.data.taluks_by_district)) {
        if (tList.includes(value)) {
          extra = { district: dist };
          break;
        }
      }
    }

    onChange({
      ...filters,
      [key]: value,
      ...extra,
    });
  };

  const activeCount = [filters.state, filters.district, filters.taluk, filters.search].filter(Boolean).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-panel/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Filters</h3>
          {activeCount > 0 && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent">
              {activeCount} active
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_FILTERS })}
          className="rounded-lg border border-slate-700 px-3 py-1 text-[11px] text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Control label="State">
          <select className="filter-input" value={filters.state ?? ""} onChange={set("state")}>
            <option value="">All states</option>
            {(options.data?.states ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Control>

        <Control label="District">
          <select className="filter-input" value={filters.district ?? ""} onChange={set("district")}>
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Control>

        <Control label="Taluk">
          <select
            className="filter-input"
            value={filters.taluk ?? ""}
            onChange={set("taluk")}
          >
            <option value="">All taluks</option>
            {taluks.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Control>

        <Control label="Data freshness">
          <select className="filter-input" value={filters.maxAgeDays ?? ""} onChange={set("maxAgeDays")}>
            {FRESHNESS_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Control>

        <Control label="Station name">
          <input
            className="filter-input"
            placeholder="Search…"
            value={filters.search ?? ""}
            onChange={set("search")}
          />
        </Control>

        {showLayers && (
          <div className="flex flex-wrap items-center gap-4 pb-1.5">
            <Toggle
              label="GW Wells"
              color="bg-accent"
              checked={filters.showGroundwater !== false}
              onChange={(v) => onChange({ ...filters, showGroundwater: v })}
            />
            <Toggle
              label="Rainfall Stations"
              color="bg-accent-blue"
              checked={filters.showRainfall !== false}
              onChange={(v) => onChange({ ...filters, showRainfall: v })}
            />
            <Toggle
              label="Recharge Heatmap"
              color="bg-amber-400"
              checked={filters.showHeatmap === true}
              onChange={(v) => onChange({ ...filters, showHeatmap: v })}
            />
            <Toggle
              label="Recharge Zones"
              color="bg-emerald-400"
              checked={filters.showRechargeZones === true}
              onChange={(v) => onChange({ ...filters, showRechargeZones: v })}
            />
          </div>
        )}
      </div>

      <style>{`
        .filter-input {
          background: rgba(11, 18, 32, 0.9);
          border: 1px solid rgb(51 65 85 / 0.8);
          border-radius: 0.5rem;
          padding: 0.45rem 0.7rem;
          color: rgb(241 245 249);
          font-size: 0.8rem;
          min-width: 10rem;
          transition: border-color .15s ease;
        }
        .filter-input:hover:not(:disabled) { border-color: rgb(100 116 139); }
        .filter-input:focus { outline: none; border-color: #2dd4bf; box-shadow: 0 0 0 2px rgb(45 212 191 / 0.15); }
        .filter-input:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Control({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, color, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-teal-400"
      />
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </label>
  );
}
