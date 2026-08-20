import { useQuery } from "@tanstack/react-query";
import { Filter, RotateCcw } from "lucide-react";
import { getFilterOptions } from "../services/api.js";

// Tailwind-utility equivalent of the old inline `.filter-input` class (kept
// as a shared constant instead of a second component so every <select>/
// <input> below stays byte-identical in behavior, just restyled).
const FILTER_INPUT_CLS =
  "min-w-[10rem] rounded-lg border border-slate-700/80 bg-surface/90 px-2.5 py-[0.45rem] text-[13px] text-slate-100 transition-colors hover:enabled:border-slate-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-45";

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
  maxAgeDays: 30,
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
    <div className="glass-panel rounded-xl border border-slate-800/70 p-4 shadow-sm dark:border-slate-800/70">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <Filter size={12} className="text-accent" />
            Filters
          </h3>
          {activeCount > 0 && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent">
              {activeCount} active
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_FILTERS })}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1 text-[11px] text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Control label="State">
          <select className={FILTER_INPUT_CLS} value={filters.state ?? ""} onChange={set("state")}>
            <option value="">All states</option>
            {(options.data?.states ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Control>

        <Control label="District">
          <select className={FILTER_INPUT_CLS} value={filters.district ?? ""} onChange={set("district")}>
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Control>

        <Control label="Taluk">
          <select
            className={FILTER_INPUT_CLS}
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
          <select className={FILTER_INPUT_CLS} value={filters.maxAgeDays ?? ""} onChange={set("maxAgeDays")}>
            {FRESHNESS_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Control>

        <Control label="Station name">
          <input
            className={FILTER_INPUT_CLS}
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
              checked={false}
              disabled
              tooltip="Requires zone-boundary geometry the API doesn't provide yet — not fabricated data"
              badge="no data"
            />
          </div>
        )}
      </div>
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

function Toggle({ label, color, checked, onChange, disabled = false, tooltip, badge }) {
  return (
    <label
      title={tooltip}
      className={`flex items-center gap-2 text-xs text-slate-300 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="accent-teal-400 disabled:cursor-not-allowed"
      />
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
      {badge && (
        <span className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
          {badge}
        </span>
      )}
    </label>
  );
}
