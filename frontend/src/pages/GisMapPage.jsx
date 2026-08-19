import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import GisMap, { ageLabel } from "../maps/GisMap.jsx";
import FilterBar, { EMPTY_FILTERS } from "../components/FilterBar.jsx";
import TimeSeriesChart from "../charts/TimeSeriesChart.jsx";
import {
  getGwHistory,
  getLatestGroundwater,
  getLatestRainfall,
  getRainfallHistory,
} from "../services/api.js";

const DEFAULT_FILTERS = { ...EMPTY_FILTERS };

/** Turns the UI filter object into the query params the API expects,
 * dropping empties so the backend's "IS NULL means no filter" branches fire. */
function toParams(filters) {
  const p = {};
  if (filters.state) p.state = filters.state;
  if (filters.district) p.district = filters.district;
  if (filters.taluk) p.taluk = filters.taluk;
  if (filters.maxAgeDays) p.max_age_days = Number(filters.maxAgeDays);
  if (filters.search) p.search = filters.search;
  return p;
}

export default function GisMapPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selected, setSelected] = useState(null);
  const params = toParams(filters);

  const groundwater = useQuery({
    queryKey: ["gw-latest", params],
    queryFn: () => getLatestGroundwater(params),
  });
  const rainfall = useQuery({
    queryKey: ["rf-latest", params],
    queryFn: () => getLatestRainfall(params),
  });

  const history = useQuery({
    queryKey: ["station-history", selected?.kind, selected?.station_id],
    queryFn: () =>
      selected.kind === "groundwater"
        ? getGwHistory(selected.station_id, 365)
        : getRainfallHistory(selected.station_id, 365),
    enabled: !!selected,
  });

  const chartSeries = history.data
    ? [
        {
          name: selected.kind === "groundwater" ? "Water level (m)" : "Rainfall (mm)",
          color: selected.kind === "groundwater" ? "#2dd4bf" : "#3b82f6",
          area: true,
          data: history.data.map((r) => [
            new Date(r.recorded_at).getTime(),
            Number(selected.kind === "groundwater" ? r.water_level_m : r.rainfall_mm),
          ]),
        },
      ]
    : [];

  return (
    <DashboardLayout
      title="GIS Map"
      subtitle="Live CGWB station network. Each marker is a station's most recent reading — use the freshness filter to exclude stations that stopped reporting. Click a marker for its history."
    >
      <div className="mb-4">
        <FilterBar filters={filters} onChange={setFilters} showLayers />
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-300">Groundwater depth:</span>
        <Legend color="#22c55e" label="0–5 m" />
        <Legend color="#2dd4bf" label="5–10 m" />
        <Legend color="#f59e0b" label="10–20 m" />
        <Legend color="#f43f5e" label="> 20 m" />
        <span className="ml-4 font-semibold text-slate-300">Rainfall:</span>
        <Legend color="#93c5fd" label="0–10 mm" />
        <Legend color="#3b82f6" label="10–50 mm" />
        <Legend color="#1d4ed8" label="> 50 mm" />
      </div>

      {(groundwater.isError || rainfall.isError) && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          <span>⚠ Couldn't load station data from the server. Check the backend is running.</span>
          <button
            type="button"
            onClick={() => {
              groundwater.refetch();
              rainfall.refetch();
            }}
            className="rounded-lg border border-rose-400/40 px-3 py-1 font-medium text-rose-100 transition hover:bg-rose-500/20"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-slate-800 xl:col-span-3" style={{ height: 620 }}>
          <GisMap
            groundwater={groundwater.data ?? []}
            rainfall={rainfall.data ?? []}
            showGroundwater={filters.showGroundwater}
            showRainfall={filters.showRainfall}
            onSelectStation={setSelected}
          />
          {!groundwater.isLoading &&
            !rainfall.isLoading &&
            !groundwater.isError &&
            !rainfall.isError &&
            (groundwater.data?.length ?? 0) === 0 &&
            (rainfall.data?.length ?? 0) === 0 && (
              <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
                <div className="pointer-events-auto rounded-xl border border-slate-700 bg-slate-950/95 px-5 py-4 text-center shadow-lg">
                  <div className="text-sm font-semibold text-slate-200">No stations match these filters</div>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Try widening the data-freshness window or clearing the state/district/taluk filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                    className="mt-3 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-800 bg-panel/50 p-4 text-xs">
            <div className="mb-2 text-sm font-semibold text-slate-200">Visible stations</div>
            <Row label="Groundwater" value={filters.showGroundwater ? groundwater.data?.length ?? 0 : "hidden"} />
            <Row label="Rainfall" value={filters.showRainfall ? rainfall.data?.length ?? 0 : "hidden"} />
            {(groundwater.isFetching || rainfall.isFetching) && (
              <div className="mt-2 text-[10px] text-accent">Loading…</div>
            )}
          </div>

          <div className="flex-1 rounded-xl border border-slate-800 bg-panel/50 p-4">
            {selected ? (
              <>
                <div className="text-sm font-semibold text-slate-200">
                  {selected.station_name || selected.station_code}
                </div>
                <div className="mb-2 text-[11px] text-slate-500">
                  {selected.district} · {selected.kind} · last reading {ageLabel(selected.age_hours)}
                </div>
                {history.isLoading ? (
                  <div className="text-xs text-slate-500">Loading history…</div>
                ) : chartSeries[0]?.data.length ? (
                  <TimeSeriesChart
                    series={chartSeries}
                    yLabel={selected.kind === "groundwater" ? "m" : "mm"}
                    height={220}
                  />
                ) : (
                  <div className="text-xs text-slate-500">No readings in the last year.</div>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-500">Click a station on the map to see its history.</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

export { DEFAULT_FILTERS, toParams };
