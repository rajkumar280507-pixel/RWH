import { useQuery } from "@tanstack/react-query";
import { Filter, RotateCcw } from "lucide-react";
import { getFilterOptions } from "../services/api.js";

// Tailwind-utility equivalent of the old inline `.filter-input` class (kept
// as a shared constant instead of a second component so every <select>/
// <input> below stays byte-identical in behavior, just restyled).
const getFilterInputCls = (isSelected) =>
  `min-w-[8.5rem] rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all ${
    isSelected
      ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300 dark:bg-sky-500/20 dark:border-sky-400 hover:border-sky-600"
      : "border-slate-300 bg-white text-slate-900 hover:border-sky-400 focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-400"
  } focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer placeholder:text-slate-400 placeholder:font-normal dark:placeholder:text-slate-500`;

const optionCls = "bg-white text-slate-900 font-semibold dark:bg-slate-900 dark:text-slate-100";

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
  maxAgeDays: "",
  search: "",
  showGroundwater: true,
  showRainfall: true,
};

export default function FilterBar({ filters, onChange, showLayers = false }) {
  const options = useQuery({
    queryKey: ["filter-options"],
    queryFn: getFilterOptions,
    staleTime: 60_000,
    retry: 2,
  });

  const districts = filters.state
    ? options.data?.districts_by_state?.[filters.state] ?? []
    : options.data?.all_districts ?? [];

  const taluks = filters.district
    ? options.data?.taluks_by_district?.[filters.district] ?? []
    : options.data?.all_taluks ?? [];

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    let extra = {};
    if (key === "district") {
      localStorage.setItem("rwh_district", value || "");
      localStorage.setItem("rwh_taluk", "");
    } else if (key === "taluk") {
      localStorage.setItem("rwh_taluk", value || "");
      if (extra.district) {
        localStorage.setItem("rwh_district", extra.district);
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
    <div className="glass-panel rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-xs dark:border-slate-800">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Filter size={12} className="text-sky-500" />
            Filters
          </h3>
          {activeCount > 0 && (
            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
              {activeCount} active
            </span>
          )}
          {options.isError && (
            <button
              type="button"
              onClick={() => options.refetch()}
              className="text-[10px] font-medium text-rose-500 underline hover:text-rose-400"
            >
              ⚠ Retry options fetch
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_FILTERS })}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
        >
          <RotateCcw size={10} />
          Reset
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Control label="State">
          <select className={getFilterInputCls(Boolean(filters.state))} value={filters.state ?? ""} onChange={set("state")}>
            <option className={optionCls} value="">All states</option>
            {options.isLoading && <option className={optionCls} disabled value="">Loading states...</option>}
            {(options.data?.states ?? []).map((s) => (
              <option className={optionCls} key={s} value={s}>{s}</option>
            ))}
          </select>
        </Control>

        <Control label="District">
          <select className={getFilterInputCls(Boolean(filters.district))} value={filters.district ?? ""} onChange={set("district")}>
            <option className={optionCls} value="">All districts</option>
            {options.isLoading && <option className={optionCls} disabled value="">Loading districts...</option>}
            {districts.map((d) => (
              <option className={optionCls} key={d} value={d}>{d}</option>
            ))}
          </select>
        </Control>

        <Control label="Taluk">
          <select
            className={getFilterInputCls(Boolean(filters.taluk))}
            value={filters.taluk ?? ""}
            onChange={set("taluk")}
          >
            <option className={optionCls} value="">All taluks</option>
            {options.isLoading && <option className={optionCls} disabled value="">Loading taluks...</option>}
            {taluks.map((t) => (
              <option className={optionCls} key={t} value={t}>{t}</option>
            ))}
          </select>
        </Control>

        <Control label="Data freshness">
          <select className={getFilterInputCls(Boolean(filters.maxAgeDays))} value={filters.maxAgeDays ?? ""} onChange={set("maxAgeDays")}>
            {FRESHNESS_OPTIONS.map((o) => (
              <option className={optionCls} key={String(o.value)} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Control>

        <Control label="Station name">
          <input
            className={getFilterInputCls(Boolean(filters.search))}
            placeholder="Search station…"
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
    <button
      type="button"
      title={tooltip}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500"
          : checked
          ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-300 shadow-sm cursor-pointer"
          : "border-slate-300 bg-white text-slate-700 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${color} ${checked ? "animate-pulse shadow-sm" : "opacity-40"}`} />
      <span>{label}</span>
      {badge && (
        <span className="rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          {badge}
        </span>
      )}
    </button>
  );
}
