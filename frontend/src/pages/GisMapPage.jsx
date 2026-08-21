import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import GisMap, { ageLabel } from "../maps/GisMap.jsx";
import FilterBar, { EMPTY_FILTERS } from "../components/FilterBar.jsx";
import TimeSeriesChart from "../charts/TimeSeriesChart.jsx";
import LegendPanel from "../maps/controls/LegendPanel.jsx";
import LayerManagerPanel from "../maps/controls/LayerManagerPanel.jsx";
import MiniMap from "../maps/controls/MiniMap.jsx";
import CompassControl from "../maps/controls/CompassControl.jsx";
import CoordinateReadout from "../maps/controls/CoordinateReadout.jsx";
import MeasureTool from "../maps/controls/MeasureTool.jsx";
import SearchControl from "../maps/controls/SearchControl.jsx";
import OpacitySliders from "../maps/controls/OpacitySliders.jsx";
import TerrainToggle from "../maps/controls/TerrainToggle.jsx";
import LocateControl from "../maps/controls/LocateControl.jsx";
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
  const [map, setMap] = useState(null);
  const [showHillshade, setShowHillshade] = useState(false);
  const [opacity, setOpacity] = useState({ groundwaterOpacity: 1, rainfallOpacity: 1, heatmapOpacity: 1 });
  const params = toParams(filters);

  // Callback ref (rather than a plain useRef) so the moment GisMap's
  // <MapContainer> hands back the real Leaflet `Map` instance we re-render
  // with it — the new floating controls (MiniMap, CoordinateReadout,
  // MeasureTool, SearchControl) all drive the map imperatively through this
  // instance instead of needing to live inside <MapContainer>'s own React
  // children tree.
  const handleMapRef = useCallback((instance) => {
    if (instance) setMap(instance);
  }, []);

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

  // Combined, tagged station list for SearchControl's client-side substring
  // search — no separate endpoint, just the data GisMap is already rendering.
  const allStations = useMemo(() => {
    const gw = (groundwater.data ?? []).map((s) => ({ ...s, kind: "groundwater" }));
    const rf = (rainfall.data ?? []).map((s) => ({ ...s, kind: "rainfall" }));
    return [...gw, ...rf];
  }, [groundwater.data, rainfall.data]);

  return (
    <DashboardLayout
      title="GIS Map"
      subtitle="Live CGWB station network. Each marker is a station's most recent reading — use the freshness filter to exclude stations that stopped reporting. Click a marker for its history."
    >
      <div className="mb-4">
        <FilterBar filters={filters} onChange={setFilters} showLayers />
      </div>

      {(groundwater.isError || rainfall.isError) && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-xs text-danger">
          <span>⚠ Couldn't load station data from the server. Check the backend is running.</span>
          <button
            type="button"
            onClick={() => {
              groundwater.refetch();
              rainfall.refetch();
            }}
            className="rounded-lg border border-danger/40 px-3 py-1 font-medium transition hover:bg-danger/20"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="relative h-[75vh] max-h-[900px] min-h-[460px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 xl:col-span-3">
          <GisMap
            groundwater={groundwater.data ?? []}
            rainfall={rainfall.data ?? []}
            showGroundwater={filters.showGroundwater}
            showRainfall={filters.showRainfall}
            showHeatmap={!!filters.showHeatmap}
            showHillshade={showHillshade}
            groundwaterOpacity={opacity.groundwaterOpacity}
            rainfallOpacity={opacity.rainfallOpacity}
            heatmapOpacity={opacity.heatmapOpacity}
            onSelectStation={setSelected}
            mapRef={handleMapRef}
          />

          {/* Floating premium chrome — pointer-events are disabled on this
              wrapper and re-enabled per panel group so the map underneath
              stays fully pannable/zoomable everywhere else. */}
          <div className="pointer-events-none absolute inset-0 z-[900] flex flex-col justify-between p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="pointer-events-auto flex max-w-[16rem] flex-col gap-2">
                <SearchControl stations={allStations} map={map} onSelect={setSelected} />
                <CompassControl />
                <LegendPanel />
              </div>

              {/* Offset down to clear react-leaflet's native, built-in
                  top-right LayersControl (basemap switcher) rather than
                  reimplementing it. */}
              <div className="pointer-events-auto mt-14 flex flex-col items-end gap-2">
                <TerrainToggle active={showHillshade} onToggle={setShowHillshade} />
                <LayerManagerPanel filters={filters} onChange={setFilters} />
                <OpacitySliders
                  groundwaterOpacity={opacity.groundwaterOpacity}
                  rainfallOpacity={opacity.rainfallOpacity}
                  heatmapOpacity={opacity.heatmapOpacity}
                  showHeatmap={!!filters.showHeatmap}
                  onChange={(patch) => setOpacity((o) => ({ ...o, ...patch }))}
                />
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="pointer-events-auto">
                <CoordinateReadout map={map} />
              </div>
              <div className="pointer-events-auto flex flex-col items-end gap-2">
                <MeasureTool map={map} />
                <LocateControl map={map} />
                <MiniMap map={map} />
              </div>
            </div>
          </div>

          {!groundwater.isLoading &&
            !rainfall.isLoading &&
            !groundwater.isError &&
            !rainfall.isError &&
            (groundwater.data?.length ?? 0) === 0 &&
            (rainfall.data?.length ?? 0) === 0 && (
              <div className="pointer-events-none absolute inset-0 z-[950] flex items-center justify-center">
                <div className="glass-panel pointer-events-auto rounded-xl border border-slate-300 px-5 py-4 text-center shadow-lg dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">No stations match these filters</div>
                  <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
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
          <div className="glass-panel rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-800/70">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Visible stations</div>
            <Row label="Groundwater" value={filters.showGroundwater ? groundwater.data?.length ?? 0 : "hidden"} />
            <Row label="Rainfall" value={filters.showRainfall ? rainfall.data?.length ?? 0 : "hidden"} />
            {(groundwater.isFetching || rainfall.isFetching) && (
              <div className="mt-2 text-[10px] text-accent">Loading…</div>
            )}
          </div>

          <div className="glass-panel flex-1 rounded-xl border border-slate-200 p-4 dark:border-slate-800/70">
            {selected ? (
              <>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selected.station_name || selected.station_code}
                </div>
                <div className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {selected.district} · {selected.kind} · last reading {ageLabel(selected.age_hours)}
                </div>
                {history.isLoading ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">Loading history…</div>
                ) : chartSeries[0]?.data.length ? (
                  <TimeSeriesChart
                    series={chartSeries}
                    yLabel={selected.kind === "groundwater" ? "m" : "mm"}
                    height={220}
                  />
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">No readings in the last year.</div>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">Click a station on the map to see its history.</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

export { DEFAULT_FILTERS, toParams };
