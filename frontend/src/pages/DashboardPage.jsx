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
import WeatherForecastCard from "../components/weather/WeatherForecastCard.jsx";
import { useLiveSocket } from "../hooks/useLiveSocket.js";
import { TN_CENTER } from "../lib/geo.js";
import { DEFAULT_FILTERS, toParams } from "./GisMapPage.jsx";
import {
  getDashboardStats,
  getLatestGroundwater,
  getLatestRainfall,
  getFilterOptions,
  getSyncRuns,
  getGroundwaterTrends,
  getGwHistory,
  getRainfallHistory,
} from "../services/api.js";

const ROOF_MATERIALS = [
  { label: "RCC Roof (Flat)", c: 0.85, code: "rcc" },
  { label: "Paved / Tiled Terrace", c: 0.90, code: "paved" },
  { label: "GI / Metal Sheet (Sloped)", c: 0.95, code: "gi_sheet" },
  { label: "Asphalt / Tar Paving", c: 0.80, code: "asphalt" },
];

// Real recent readings (not a fabricated shape): takes the /history rows for
// one representative station and maps them straight to sparkline values.
function realSpark(rows, field) {
  if (!rows || rows.length < 2) return undefined;
  return rows.slice(-14).map((r) => Math.abs(Number(r[field])));
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lastEvent, connected } = useLiveSocket();
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    district: localStorage.getItem("rwh_district") || "",
    taluk: localStorage.getItem("rwh_taluk") || "",
  }));
  const params = toParams(filters);

  // RWH Quick Calculation State
  const [roofArea, setRoofArea] = useState(150);
  const [roofMaterial, setRoofMaterial] = useState("rcc");
  const [occupants, setOccupants] = useState(5);

  const [selectedStation, setSelectedStation] = useState(null);

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

  const syncRuns = useQuery({
    queryKey: ["sync-runs"],
    queryFn: () => getSyncRuns(),
    staleTime: 30_000,
    retry: 1,
  });

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

  // Weather module location: updates dynamically on station click or filters
  const weatherCenter = useMemo(() => {
    if (selectedStation?.latitude && selectedStation?.longitude) {
      return {
        lat: Number(selectedStation.latitude),
        lon: Number(selectedStation.longitude),
        name: selectedStation.station_name || selectedStation.station_code || selectedStation.taluk || selectedStation.district || "Selected Station",
      };
    }
    const withCoords = [...gwData, ...rfData].filter((s) => s.latitude != null && s.longitude != null);
    if (!withCoords.length) return { ...TN_CENTER, name: filters.district || filters.taluk || "Tamil Nadu" };
    const lat = withCoords.reduce((sum, r) => sum + Number(r.latitude), 0) / withCoords.length;
    const lon = withCoords.reduce((sum, r) => sum + Number(r.longitude), 0) / withCoords.length;
    const name = filters.taluk
      ? `${filters.district ? filters.district + " › " : ""}${filters.taluk}`
      : filters.district
      ? `${filters.district} District`
      : "Tamil Nadu";
    return { lat, lon, name };
  }, [selectedStation, gwData, rfData, filters.district, filters.taluk]);

  // Representative station for each KPI's sparkline
  const gwSparkStationId = gwData[0]?.station_id ?? null;
  const rfSparkStationId = rfData[0]?.station_id ?? null;

  const gwHistoryQ = useQuery({
    queryKey: ["gw-history-spark", gwSparkStationId],
    queryFn: () => getGwHistory(gwSparkStationId, 90),
    enabled: gwSparkStationId != null,
    staleTime: 300_000,
  });
  const rfHistoryQ = useQuery({
    queryKey: ["rf-history-spark", rfSparkStationId],
    queryFn: () => getRainfallHistory(rfSparkStationId, 90),
    enabled: rfSparkStationId != null,
    staleTime: 300_000,
  });
  const isFiltered = Boolean(filters.state || filters.district || filters.taluk || filters.search);
  const firstLoad = (stats.isLoading && !stats.data) && (groundwater.isLoading && !groundwater.data);

  const gwCount = isFiltered ? gwData.length : (s?.gw_station_count ?? gwData.length);
  const rfCount = isFiltered ? rfData.length : (s?.rainfall_station_count ?? rfData.length);

  const calcAvgGw = () => {
    const valid = gwData.map((d) => Number(d.water_level_m)).filter((v) => !isNaN(v) && v != null);
    if (!valid.length) return null;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return Number(avg.toFixed(2));
  };

  const calcAvgRf = () => {
    const valid = rfData.map((d) => Number(d.rainfall_mm)).filter((v) => !isNaN(v) && v != null);
    if (!valid.length) return null;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return Number(avg.toFixed(2));
  };

  const avgGwRaw = isFiltered ? calcAvgGw() : (s?.avg_groundwater_level_m ?? calcAvgGw());
  const avgRfRaw = isFiltered ? calcAvgRf() : (s?.avg_rainfall_mm ?? calcAvgRf());

  const avgGw = avgGwRaw == null ? (s?.avg_groundwater_level_m ? Number(Math.abs(Number(s.avg_groundwater_level_m)).toFixed(2)) : null) : Number(Math.abs(Number(avgGwRaw)).toFixed(2));
  const avgRf = avgRfRaw == null ? (s?.avg_rainfall_mm ? Number(Number(s.avg_rainfall_mm).toFixed(2)) : null) : Number(Number(avgRfRaw).toFixed(2));

  const calcInputGw = avgGw ?? 12.5;
  const calcInputRf = avgRf ?? 950;

  const mat = ROOF_MATERIALS.find((m) => m.code === roofMaterial) || ROOF_MATERIALS[0];
  const runoffC = mat.c;

  // Live RWH Computations
  const rwhCalc = useMemo(() => {
    const grossRunoffM3 = (roofArea * (calcInputRf / 1000) * runoffC);
    const netHarvestM3 = grossRunoffM3 * 0.90;
    const dailySupplyLiters = (netHarvestM3 * 1000) / 365;
    const dailyDemandLiters = occupants * 135;
    const tankCapacityLiters = Math.round(dailyDemandLiters * 5);

    const peak24hStormMm = calcInputRf * 0.12;
    const stormVolumeM3 = (roofArea * (peak24hStormMm / 1000) * runoffC);

    const targetPitVolumeM3 = Math.max(1.5, stormVolumeM3 * 0.6);
    const pitDepthM = Math.min(3.0, Math.max(2.0, calcInputGw > 5 ? 2.5 : 1.8));
    const reqAreaSqm = targetPitVolumeM3 / pitDepthM;
    const pitDiameterM = Math.max(1.2, Math.min(3.5, Number(Math.sqrt((4 * reqAreaSqm) / Math.PI).toFixed(2))));
    const pitCount = stormVolumeM3 > 15 ? Math.ceil(stormVolumeM3 / 15) : 1;

    const expectedGwRiseM = (netHarvestM3 * 0.7) / (roofArea * 3 * 0.15);
    const estCostINR = Math.round(18000 + pitCount * 12000 + (roofArea * 45));

    return {
      grossRunoffM3: grossRunoffM3.toFixed(1),
      netHarvestM3: netHarvestM3.toFixed(1),
      dailySupplyLiters: Math.round(dailySupplyLiters),
      tankCapacityLitersRaw: tankCapacityLiters,
      tankCapacityLiters: tankCapacityLiters.toLocaleString(),
      peak24hStormMm: peak24hStormMm.toFixed(1),
      pitCount,
      pitDiameterM,
      pitDepthM,
      expectedGwRiseM: expectedGwRiseM.toFixed(3),
      estCostINR: estCostINR.toLocaleString("en-IN"),
    };
  }, [roofArea, calcInputRf, runoffC, occupants, calcInputGw]);

  const activeTaluk = filters.taluk || (availableTaluks.length ? availableTaluks[0] : "");
  const locTitle = selectedStation
    ? (selectedStation.station_name || selectedStation.station_code)
    : (filters.district
        ? (filters.taluk ? `${filters.district} › ${filters.taluk}` : `${filters.district} District`)
        : (filters.taluk ? filters.taluk : "Tamil Nadu (All Stations)"));

  const stormMm = Number(rwhCalc.peak24hStormMm);
  const dataUpdatedAt = groundwater.dataUpdatedAt || stats.dataUpdatedAt || null;
  const rfUpdatedAt = rainfall.dataUpdatedAt || stats.dataUpdatedAt || null;

  const trendSummary = trends.data?.summary;
  const highConfidencePct =
    trendSummary && trendSummary.stations_analysed > 0
      ? (trendSummary.high_confidence / trendSummary.stations_analysed) * 100
      : null;
  const showConfidenceCard = !trends.isError && highConfidencePct != null;
  const kpiCount = 7 + (showConfidenceCard ? 1 : 0);

  return (
    <DashboardLayout title="RWH-DSS Main Dashboard">
      {/* Hero KPI Row — 7 compact cards */}
      <div className="mb-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard
          index={0}
          icon={<Droplets size={13} />}
          label="Groundwater"
          value={avgGw}
          decimals={2}
          unit={`m bgl · ${gwCount} wells`}
          emptyLabel="No active wells"
          tone={avgGw == null ? "slate" : avgGw > 15 ? "danger" : avgGw > 8 ? "warning" : "accent"}
          status={avgGw == null ? undefined : avgGw > 15 ? "critical" : avgGw > 8 ? "warning" : "normal"}
          sparklineData={realSpark(gwHistoryQ.data, "water_level_m")}
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
          emptyLabel="No rainfall stations"
          tone="info"
          status={avgRf == null ? undefined : avgRf < 500 ? "warning" : "normal"}
          sparklineData={realSpark(rfHistoryQ.data, "rainfall_mm")}
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
          subtext={`${activeTaluk}`}
          loading={firstLoad}
        />
        <StatCard
          index={3}
          icon={<TrendingUp size={13} />}
          label="Water Table Outlook"
          value={avgGw == null ? null : avgGw > 12 ? "Deepening" : "Stable"}
          emptyLabel="No data"
          unit={`(+${rwhCalc.expectedGwRiseM}m/yr)`}
          tone="purple"
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
          loading={firstLoad}
        />
        <StatCard
          index={5}
          icon={<Warehouse size={13} />}
          label="Storage Capacity"
          value={Number(rwhCalc.tankCapacityLitersRaw)}
          decimals={0}
          unit="L reserve"
          tone="blue"
          loading={firstLoad}
        />
        <WeatherForecastCard lat={weatherCenter.lat} lon={weatherCenter.lon} locationName={weatherCenter.name} />
      </div>

      {/* Filter Controls */}
      <div className="mb-1.5">
        <FilterBar
          filters={filters}
          onChange={(newFilters) => {
            setSelectedStation(null);
            setFilters(newFilters);
          }}
          showLayers
        />
      </div>

      {/* Interactive GIS Telemetry Map Layer */}
      <div className="flex flex-col gap-1 mb-2">
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-1"
        >
          <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-slate-200 bg-panel/80 px-3 py-1.5 text-xs dark:border-slate-800">
            <span className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs">
              <Compass size={14} className="text-sky-500" />
              GIS Telemetry Map — <span className="text-sky-600 dark:text-sky-400 font-extrabold">{locTitle}</span>
            </span>
            <div className="flex items-center gap-2">
              {selectedStation && (
                <button
                  type="button"
                  onClick={() => setSelectedStation(null)}
                  className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 transition cursor-pointer"
                >
                  Clear station selection ✕
                </button>
              )}
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {gwCount} GW Wells · {rfCount} Rainfall Stations
              </span>
            </div>
          </div>
          <div className="relative h-[72vh] min-h-[480px] max-h-[850px] overflow-hidden rounded-b-xl border border-slate-200 dark:border-slate-800 shadow-md">
            {(groundwater.isError || rainfall.isError) && (
              <div className="absolute inset-x-0 top-0 z-[400] flex items-center justify-between bg-danger/90 px-4 py-2 text-xs font-medium text-white">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Couldn't load live station data — check backend.
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
                  <div className="pointer-events-auto rounded-xl border border-slate-300 bg-white/95 px-4 py-3 text-center shadow-lg dark:border-slate-700 dark:bg-slate-950/95">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">No stations match these filters</div>
                    <button
                      type="button"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="mt-2 rounded-lg border border-sky-500/40 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 transition hover:bg-sky-500/10"
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
              onSelectStation={(stn) => setSelectedStation(stn)}
            />
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
