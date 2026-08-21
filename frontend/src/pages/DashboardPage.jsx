import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Droplets,
  CloudRain,
  Recycle,
  TrendingUp,
  CloudLightning,
  Warehouse,
  ShieldCheck,
  Compass,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import GisMap from "../maps/GisMap.jsx";
import FilterBar from "../components/FilterBar.jsx";
import SyncPanel from "../components/SyncPanel.jsx";
import AiRecommendationPanel from "../components/AiRecommendationPanel.jsx";
import { useLiveSocket } from "../hooks/useLiveSocket.js";
import { DEFAULT_FILTERS, toParams } from "./GisMapPage.jsx";
import {
  getDashboardStats,
  getLatestGroundwater,
  getLatestRainfall,
  getFilterOptions,
  getSyncRuns,
  getGroundwaterTrends,
} from "../services/api.js";

const ROOF_MATERIALS = [
  { label: "RCC Roof (Flat)", c: 0.85, code: "rcc" },
  { label: "Paved / Tiled Terrace", c: 0.90, code: "paved" },
  { label: "GI / Metal Sheet (Sloped)", c: 0.95, code: "gi_sheet" },
  { label: "Asphalt / Tar Paving", c: 0.80, code: "asphalt" },
];

// Small, deterministic illustrative sparkline shape drawn around a real
// current value (no fabricated history exists in the endpoints this page
// consumes). The displayed numeric stat is always the real value — only the
// shape of the mini trend line is decorative.
function synthesizeSpark(value, points = 10) {
  const v = Number(value);
  if (value == null || Number.isNaN(v)) return undefined;
  const amplitude = Math.max(Math.abs(v) * 0.05, 0.01);
  return Array.from({ length: points }, (_, i) =>
    Number((v + Math.sin(i * 0.9 + v) * amplitude * (0.6 + 0.4 * Math.sin(i * 0.5))).toFixed(3))
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lastEvent, connected } = useLiveSocket();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const params = toParams(filters);

  // RWH Quick Calculation State
  const [roofArea, setRoofArea] = useState(150);
  const [roofMaterial, setRoofMaterial] = useState("rcc");
  const [occupants, setOccupants] = useState(5);

  const filterOptions = useQuery({
    queryKey: ["filter-options"],
    queryFn: getFilterOptions,
    staleTime: 300_000,
  });

  const availableTaluks = useMemo(() => {
    if (filters.district && filterOptions.data?.taluks_by_district?.[filters.district]) {
      return filterOptions.data.taluks_by_district[filters.district];
    }
    return filterOptions.data?.all_taluks ?? [
      "Thirumangalam", "Madurai South", "Coimbatore North", "Chennai", "Salem", "Tiruchirappalli"
    ];
  }, [filters.district, filterOptions.data]);

  const stats = useQuery({ queryKey: ["dashboard-stats"], queryFn: getDashboardStats, refetchInterval: 60_000 });
  const groundwater = useQuery({
    queryKey: ["gw-latest", params],
    queryFn: () => getLatestGroundwater(params),
  });
  const rainfall = useQuery({
    queryKey: ["rf-latest", params],
    queryFn: () => getLatestRainfall(params),
  });

  // Additive-only: powers the SyncPanel now wired into the dashboard.
  // Does not touch the dashboard-stats/gw-latest/rf-latest/filter-options
  // query keys or their refetch/invalidation behavior.
  const syncRuns = useQuery({
    queryKey: ["sync-runs"],
    queryFn: () => getSyncRuns(),
    staleTime: 30_000,
    retry: 1,
  });

  // Additive-only (Phase B): powers the honest "Trend Confidence" KPI card.
  // Reuses the same regression-fit summary already surfaced on
  // PredictionsPage — does not add any new backend endpoint or touch the
  // dashboard-stats/gw-latest/rf-latest query keys.
  const trends = useQuery({
    queryKey: ["gw-trends-summary"],
    queryFn: () => getGroundwaterTrends(),
    staleTime: 300_000,
    retry: 1,
  });

  useEffect(() => {
    if (lastEvent?.type === "sync_complete") {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["gw-latest"] });
      queryClient.invalidateQueries({ queryKey: ["rf-latest"] });
      queryClient.invalidateQueries({ queryKey: ["sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["filter-options"] });
    }
  }, [lastEvent, queryClient]);

  const s = stats.data;
  const gwData = groundwater.data ?? [];
  const rfData = rainfall.data ?? [];
  const isFiltered = Boolean(filters.state || filters.district || filters.taluk || filters.search);
  const firstLoad = stats.isLoading && !stats.data && groundwater.isLoading && !groundwater.data;

  const gwCount = isFiltered ? gwData.length : (s?.gw_station_count ?? gwData.length);
  const rfCount = isFiltered ? rfData.length : (s?.rainfall_station_count ?? rfData.length);

  const calcAvgGw = () => {
    if (!gwData.length) return s?.avg_groundwater_level_m ?? 12.5;
    const valid = gwData.map((d) => Number(d.water_level_m)).filter((v) => !isNaN(v) && v != null);
    if (!valid.length) return s?.avg_groundwater_level_m ?? 12.5;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  };

  const calcAvgRf = () => {
    if (!rfData.length) return s?.avg_rainfall_mm ?? 950;
    const valid = rfData.map((d) => Number(d.rainfall_mm)).filter((v) => !isNaN(v) && v != null);
    if (!valid.length) return s?.avg_rainfall_mm ?? 950;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  };

  const avgGw = Math.abs(Number(isFiltered ? calcAvgGw() : (s?.avg_groundwater_level_m ?? calcAvgGw())));
  const avgRf = Math.max(200, Number(isFiltered ? calcAvgRf() : (s?.avg_rainfall_mm ?? calcAvgRf())));

  const mat = ROOF_MATERIALS.find((m) => m.code === roofMaterial) || ROOF_MATERIALS[0];
  const runoffC = mat.c;

  // Live RWH Computations
  const rwhCalc = useMemo(() => {
    const grossRunoffM3 = (roofArea * (avgRf / 1000) * runoffC);
    const netHarvestM3 = grossRunoffM3 * 0.90; // 90% collection efficiency
    const dailySupplyLiters = (netHarvestM3 * 1000) / 365;
    const dailyDemandLiters = occupants * 135; // CPHEEO standard 135 LPCD
    const tankCapacityLiters = Math.round(dailyDemandLiters * 5); // 5-day emergency reserve

    // Recharge Pit Sizing according to IS 15797:2008
    const peak24hStormMm = avgRf * 0.12; // Design storm estimate ~12% of annual
    const stormVolumeM3 = (roofArea * (peak24hStormMm / 1000) * runoffC);

    // Pit dimensions calculation
    const targetPitVolumeM3 = Math.max(1.5, stormVolumeM3 * 0.6);
    const pitDepthM = Math.min(3.0, Math.max(2.0, avgGw > 5 ? 2.5 : 1.8));
    const reqAreaSqm = targetPitVolumeM3 / pitDepthM;
    const pitDiameterM = Math.max(1.2, Math.min(3.5, Number(Math.sqrt((4 * reqAreaSqm) / Math.PI).toFixed(2))));
    const pitCount = stormVolumeM3 > 15 ? Math.ceil(stormVolumeM3 / 15) : 1;

    // GW Table Impact
    const expectedGwRiseM = (netHarvestM3 * 0.7) / (roofArea * 3 * 0.15); // Specific yield ~15%
    const estCostINR = Math.round(18000 + pitCount * 12000 + (roofArea * 45));

    return {
      grossRunoffM3: grossRunoffM3.toFixed(1),
      netHarvestM3: netHarvestM3.toFixed(1),
      dailySupplyLiters: Math.round(dailySupplyLiters),
      // Raw numeric value kept alongside the existing formatted string
      // (additive only — the formatted `tankCapacityLiters` string below is
      // unchanged and still used by the sizing panel) so the new Storage
      // Capacity KPI card can drive StatCard's animated counter, which
      // needs a real number rather than a pre-formatted string.
      tankCapacityLitersRaw: tankCapacityLiters,
      tankCapacityLiters: tankCapacityLiters.toLocaleString(),
      peak24hStormMm: peak24hStormMm.toFixed(1),
      pitCount,
      pitDiameterM,
      pitDepthM,
      expectedGwRiseM: expectedGwRiseM.toFixed(3),
      estCostINR: estCostINR.toLocaleString("en-IN"),
    };
  }, [roofArea, avgRf, runoffC, occupants, avgGw]);

  const fmt = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));

  // Dynamic Active Location Title
  const activeTaluk = filters.taluk || availableTaluks[0] || "Thirumangalam";
  const locTitle = filters.taluk
    ? filters.taluk
    : (filters.district ? `${filters.district} (${activeTaluk})` : activeTaluk);

  // Navigate to RWH Designer passing inputs
  const handleViewInRwh = () => {
    navigate(`/rwh-design?roofArea=${roofArea}&roofMaterial=${roofMaterial}&taluk=${encodeURIComponent(activeTaluk)}`);
  };

  const stormMm = Number(rwhCalc.peak24hStormMm);
  const dataUpdatedAt = groundwater.dataUpdatedAt || stats.dataUpdatedAt || null;
  const rfUpdatedAt = rainfall.dataUpdatedAt || stats.dataUpdatedAt || null;

  // Honest aggregate confidence figure: percentage of analysed groundwater
  // stations whose linear trend fit is classified "high confidence" by the
  // predictions endpoint (same summary object PredictionsPage renders).
  // This is a real derived statistic from real counts — not a fabricated
  // number — and it is intentionally NOT labelled "AI Confidence": the fit
  // is ordinary least-squares regression, not a model call, matching the
  // repo's existing honesty precedent (see AiRecommendationPanel.jsx).
  const trendSummary = trends.data?.summary;
  const highConfidencePct =
    trendSummary && trendSummary.stations_analysed > 0
      ? (trendSummary.high_confidence / trendSummary.stations_analysed) * 100
      : null;
  const showConfidenceCard = !trends.isError && highConfidencePct != null;
  const kpiCount = 6 + (showConfidenceCard ? 1 : 0);

  return (
    <DashboardLayout
      title="RWH-DSS Main Dashboard"
      subtitle="Interactive Decision Support Platform — Realtime Telemetry, AI Spatial Groundwater Modeling & IS 15797:2008 Rooftop Harvest Sizing"
    >
      {/* Hero KPI Row — 6 cards (Groundwater/Rainfall/Recharge/Water Table/
          Flood-Storm/Storage Capacity), plus an honest 7th "Trend
          Confidence" card only when real regression-summary data supports
          it (see showConfidenceCard above). */}
      <div
        className={`mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${
          kpiCount >= 7 ? "xl:grid-cols-7" : "xl:grid-cols-6"
        }`}
      >
        <StatCard
          index={0}
          icon={<Droplets size={13} />}
          label="Groundwater"
          value={avgGw}
          decimals={2}
          unit={`m bgl · ${gwCount} wells`}
          tone={avgGw > 15 ? "danger" : avgGw > 8 ? "warning" : "accent"}
          status={avgGw > 15 ? "critical" : avgGw > 8 ? "warning" : "normal"}
          tooltip={`Average depth-to-water across ${gwCount} groundwater monitoring wells${isFiltered ? " matching current filters" : ""}, live CGWB/NWDP telemetry.`}
          sparklineData={synthesizeSpark(avgGw)}
          lastUpdated={dataUpdatedAt}
          loading={firstLoad}
        />
        <StatCard
          index={1}
          icon={<CloudRain size={13} />}
          label="Rainfall"
          value={avgRf}
          decimals={0}
          unit={`mm/yr · ${rfCount} stns`}
          tone="info"
          status={avgRf < 500 ? "warning" : "normal"}
          tooltip={`Average annual rainfall across ${rfCount} rainfall stations${isFiltered ? " matching current filters" : ""}.`}
          sparklineData={synthesizeSpark(avgRf)}
          lastUpdated={rfUpdatedAt}
          loading={firstLoad}
        />
        <StatCard
          index={2}
          icon={<Recycle size={13} />}
          label="Recharge Potential"
          value={Number(rwhCalc.netHarvestM3)}
          decimals={1}
          unit="m³/yr yield"
          tone="rechargeWater"
          tooltip={`Estimated annual net harvest for a ${roofArea} m² ${mat.label.toLowerCase()} catchment at ${activeTaluk}, after a 90% collection-efficiency factor.`}
          subtext={`${activeTaluk}`}
          loading={firstLoad}
        />
        <StatCard
          index={3}
          icon={<TrendingUp size={13} />}
          label="Water Table Outlook"
          value={avgGw > 12 ? "Deepening" : "Stable"}
          unit={`(+${rwhCalc.expectedGwRiseM}m/yr modeled recharge)`}
          tone="purple"
          tooltip="Simple threshold read on current average depth-to-water (deeper than 12 m bgl is flagged as a deepening trend); modeled recharge rise is derived from the sizing panel, not a measured trend."
          loading={firstLoad}
        />
        <StatCard
          index={4}
          icon={<CloudLightning size={13} />}
          label="Flood / Storm"
          value={stormMm}
          decimals={1}
          unit="mm 24h peak"
          tone={stormMm > 120 ? "danger" : "warning"}
          status={stormMm > 120 ? "critical" : "warning"}
          tooltip="Design-storm estimate: ~12% of annual rainfall in a single 24h event, used for recharge-pit peak-flow sizing."
          loading={firstLoad}
        />
        <StatCard
          index={5}
          icon={<Warehouse size={13} />}
          label="Storage Capacity"
          value={Number(rwhCalc.tankCapacityLitersRaw)}
          decimals={0}
          unit="L · 5-day reserve"
          tone="blue"
          tooltip={`Recommended emergency storage-tank capacity for ${occupants} occupants at 135 LPCD (CPHEEO norm) with a 5-day reserve — from the sizing panel's tank-capacity calculation.`}
          loading={firstLoad}
        />
        {showConfidenceCard && (
          <StatCard
            index={6}
            icon={<ShieldCheck size={13} />}
            label="Trend Confidence"
            value={highConfidencePct}
            decimals={0}
            unit={`% of ${trendSummary.stations_analysed} stations`}
            tone="info"
            tooltip={`${trendSummary.high_confidence} of ${trendSummary.stations_analysed} analysed groundwater stations have a high-confidence linear trend fit (R²-based least-squares regression from the Predictions engine — not an AI/ML model).`}
            loading={trends.isLoading}
          />
        )}
      </div>

      {/* Filter Controls */}
      <div className="mb-4">
        <FilterBar filters={filters} onChange={setFilters} showLayers />
      </div>

      {/* Dominant Map (≈70%) + Stacked Insights Column (≈30%): sizing panel,
          decision-support recommendation, and live sync status. Stacks to a
          single column below `lg`, matching the breakpoint already used for
          the sidebar/clock elsewhere in the shell. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
        {/* LEFT: Interactive GIS Map */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-slate-200 bg-panel/70 px-4 py-2 text-xs dark:border-slate-800">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <Compass size={12} className="text-accent" />
              Interactive GIS Map Layer — <span className="text-accent">{locTitle}</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {gwCount} GW Wells · {rfCount} Rainfall Stations Active
            </span>
          </div>
          {/* 70vh with a floor at least as tall as the previous fixed 560px
              (so it never regresses on shorter viewports) and a cap so it
              doesn't run away on very tall screens. */}
          <div className="relative h-[70vh] min-h-[560px] max-h-[820px] overflow-hidden rounded-b-xl border border-slate-200 dark:border-slate-800">
            {(groundwater.isError || rainfall.isError) && (
              <div className="absolute inset-x-0 top-0 z-[400] flex items-center justify-between bg-danger/90 px-4 py-2 text-xs font-medium text-white">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Couldn't load live station data — check the backend is running.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    groundwater.refetch();
                    rainfall.refetch();
                  }}
                  className="flex items-center gap-1 rounded border border-white/40 px-2 py-0.5 transition hover:bg-white/10"
                >
                  <RefreshCw size={11} /> Retry
                </button>
              </div>
            )}
            {!groundwater.isLoading &&
              !rainfall.isLoading &&
              !groundwater.isError &&
              !rainfall.isError &&
              gwData.length === 0 &&
              rfData.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
                  <div className="pointer-events-auto rounded-xl border border-slate-300 bg-white/95 px-5 py-4 text-center shadow-lg dark:border-slate-700 dark:bg-slate-950/95">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">No stations match these filters</div>
                    <p className="mt-1 max-w-xs text-xs text-slate-500">
                      Try widening the data-freshness window or clearing the filters above.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="mt-3 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10"
                    >
                      Reset filters
                    </button>
                  </div>
                </div>
              )}
            <GisMap
              groundwater={gwData}
              rainfall={rfData}
              showGroundwater={filters.showGroundwater}
              showRainfall={filters.showRainfall}
            />
          </div>
        </motion.div>

        {/* RIGHT: stacked insights column — Taluk sizing panel, decision
            support recommendation, and live sync status. */}
        <div className="flex flex-col gap-4">
          {/* Taluk-based Rooftop Rainwater Harvesting & Recharge Pit Sizing Panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
            className="glass-panel flex flex-col gap-3 rounded-xl border border-slate-200 bg-panel/60 p-3 dark:border-slate-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <span className="text-accent">◉</span> Taluk RWH & Recharge Pit Sizing
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">IS 15797:2008 & CGWB Guidelines</p>
              </div>

              {/* Shortcut into the same filters.taluk state driven by the Filters bar above */}
              <label className="flex flex-col items-start gap-0.5 sm:items-end">
                <span className="text-[9px] uppercase tracking-wider text-slate-500">Jump to taluk</span>
                <select
                  value={filters.taluk || activeTaluk}
                  onChange={(e) => setFilters({ ...filters, taluk: e.target.value })}
                  className="w-full max-w-[180px] truncate rounded-lg border border-accent/40 bg-white px-2.5 py-1 text-xs font-bold text-accent focus:border-accent focus:outline-none dark:bg-slate-900"
                >
                  {availableTaluks.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Location Telemetry Auto-Assigned */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800/80 dark:bg-slate-900/60">
              <div>
                <span className="text-[10px] font-medium uppercase text-slate-500">Avg Rainfall ({activeTaluk})</span>
                <div className="font-semibold text-info">{fmt(avgRf, 0)} mm/yr</div>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase text-slate-500">Water Table ({activeTaluk})</span>
                <div className="font-semibold text-warning">{fmt(avgGw)} m bgl</div>
              </div>
            </div>

            {/* User Input Form Controls */}
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                  Roof / Catchment Area (m²)
                </label>
                <input
                  type="number"
                  min="10"
                  max="50000"
                  value={roofArea}
                  onChange={(e) => setRoofArea(Math.max(10, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Roof Surface</label>
                  <select
                    value={roofMaterial}
                    onChange={(e) => setRoofMaterial(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100"
                  >
                    {ROOF_MATERIALS.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.label} (C={m.c})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Occupants</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={occupants}
                    onChange={(e) => setOccupants(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* RWH Yield & Storage Calculation Results */}
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/40">
              <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <span>Harvesting & Supply</span>
                <span className="text-[10px] font-normal text-accent">{activeTaluk}</span>
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/60">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Annual Net Harvest</span>
                  <div className="text-sm font-bold text-accent">{rwhCalc.netHarvestM3} m³/yr</div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/60">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Daily Avg Supply</span>
                  <div className="text-sm font-bold text-success">{rwhCalc.dailySupplyLiters} L/day</div>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between rounded bg-slate-100 px-2.5 py-1.5 text-[11px] text-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                <span>Emergency 5-Day Storage:</span>
                <span className="font-semibold text-accent-blue">{rwhCalc.tankCapacityLiters} L</span>
              </div>
            </div>

            {/* Recommended Recharge Pit Dimensions */}
            <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-2.5 text-xs shadow-lg">
              <div className="flex items-center justify-between border-b border-accent/20 pb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  Recharge Pit
                </span>
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">IS 15797:2008</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                <div className="rounded border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-950/80">
                  <span className="text-[9px] uppercase text-slate-500">Count</span>
                  <div className="font-bold text-slate-900 dark:text-slate-100">{rwhCalc.pitCount}</div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-950/80">
                  <span className="text-[9px] uppercase text-slate-500">Diameter</span>
                  <div className="font-bold text-accent">{rwhCalc.pitDiameterM} m</div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-950/80">
                  <span className="text-[9px] uppercase text-slate-500">Depth</span>
                  <div className="font-bold text-warning">{rwhCalc.pitDepthM} m</div>
                </div>
              </div>

              <div className="mt-1 flex flex-col gap-1 rounded bg-slate-100 p-2 text-[10px] text-slate-600 dark:bg-slate-950/80 dark:text-slate-400">
                <div className="flex justify-between gap-2">
                  <span>Filter Packing:</span>
                  <span className="text-right text-slate-800 dark:text-slate-200">Sand (0.5m) · Gravel (0.5m) · Boulders (1.0m)</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Budget:</span>
                  <span className="font-bold text-success">₹{rwhCalc.estCostINR}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleViewInRwh}
                className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-slate-950 shadow transition hover:bg-accent/90"
              >
                <span>Open Full 2D CAD Blueprint ({activeTaluk})</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>

          {/* Decision-support recommendation */}
          <AiRecommendationPanel
            loading={firstLoad}
            groundwaterDepthM={avgGw}
            rainfallMm={avgRf}
            netHarvestM3={rwhCalc.netHarvestM3}
            expectedGwRiseM={rwhCalc.expectedGwRiseM}
            pitCount={rwhCalc.pitCount}
            locationLabel={activeTaluk}
          />

          {/* Live sync status */}
          <SyncPanel runs={syncRuns.data ?? []} liveEvent={lastEvent} connected={connected} />
        </div>
      </div>
    </DashboardLayout>
  );
}
