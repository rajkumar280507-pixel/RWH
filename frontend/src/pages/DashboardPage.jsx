import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import GisMap from "../maps/GisMap.jsx";
import FilterBar from "../components/FilterBar.jsx";
import { useLiveSocket } from "../hooks/useLiveSocket.js";
import { DEFAULT_FILTERS, toParams } from "./GisMapPage.jsx";
import {
  getDashboardStats,
  getLatestGroundwater,
  getLatestRainfall,
  getFilterOptions,
} from "../services/api.js";

const ROOF_MATERIALS = [
  { label: "RCC Roof (Flat)", c: 0.85, code: "rcc" },
  { label: "Paved / Tiled Terrace", c: 0.90, code: "paved" },
  { label: "GI / Metal Sheet (Sloped)", c: 0.95, code: "gi_sheet" },
  { label: "Asphalt / Tar Paving", c: 0.80, code: "asphalt" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lastEvent } = useLiveSocket();
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

  useEffect(() => {
    if (lastEvent?.type === "sync_complete") {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["gw-latest"] });
      queryClient.invalidateQueries({ queryKey: ["rf-latest"] });
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

  return (
    <DashboardLayout
      title="RWH-DSS Main Dashboard"
      subtitle="Interactive Decision Support Platform — Realtime Telemetry, AI Spatial Groundwater Modeling & IS 15797:2008 Rooftop Harvest Sizing"
    >
      {/* 5 Realtime Statistics Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon="💧"
          label="Groundwater Card"
          value={`${fmt(avgGw)} m`}
          unit={`bgl (${gwCount} wells)`}
          tone={avgGw > 15 ? "rose" : avgGw > 8 ? "amber" : "accent"}
          loading={firstLoad}
        />
        <StatCard
          icon="🌧️"
          label="Rainfall Card"
          value={`${fmt(avgRf, 0)} mm`}
          unit={`/yr (${rfCount} stns)`}
          tone="blue"
          loading={firstLoad}
        />
        <StatCard
          icon="♻️"
          label="Recharge Card"
          value={`${rwhCalc.netHarvestM3} m³`}
          unit="annual yield"
          tone="accent"
          loading={firstLoad}
        />
        <StatCard
          icon="📈"
          label="Prediction Card"
          value={avgGw > 12 ? "Deepening" : "Stable"}
          unit={`trend (${rwhCalc.expectedGwRiseM}m rise)`}
          tone="purple"
          loading={firstLoad}
        />
        <StatCard
          icon="⛈️"
          label="Flood / Storm Card"
          value={`${rwhCalc.peak24hStormMm} mm`}
          unit="24h peak storm"
          tone={Number(rwhCalc.peak24hStormMm) > 120 ? "rose" : "amber"}
          loading={firstLoad}
        />
      </div>

      {/* Filter Controls */}
      <div className="mb-4">
        <FilterBar filters={filters} onChange={setFilters} showLayers />
      </div>

      {/* Main Grid Layout: GIS Map (Left 2 cols) & Taluk RWH Sizing Panel (Right 1 col) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Interactive GIS Map */}
        <div className="flex flex-col gap-2 xl:col-span-2">
          <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-slate-800 bg-panel/70 px-4 py-2 text-xs">
            <span className="font-semibold text-slate-200">
              Interactive GIS Map Layer — <span className="text-accent">{locTitle}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {gwCount} GW Wells · {rfCount} Rainfall Stations Active
            </span>
          </div>
          <div className="relative h-[560px] overflow-hidden rounded-b-xl border border-slate-800">
            {(groundwater.isError || rainfall.isError) && (
              <div className="absolute inset-x-0 top-0 z-[400] flex items-center justify-between bg-rose-500/90 px-4 py-2 text-xs font-medium text-white">
                <span>⚠ Couldn't load live station data — check the backend is running.</span>
                <button
                  type="button"
                  onClick={() => {
                    groundwater.refetch();
                    rainfall.refetch();
                  }}
                  className="rounded border border-white/40 px-2 py-0.5 transition hover:bg-white/10"
                >
                  Retry
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
                  <div className="pointer-events-auto rounded-xl border border-slate-700 bg-slate-950/95 px-5 py-4 text-center shadow-lg">
                    <div className="text-sm font-semibold text-slate-200">No stations match these filters</div>
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
        </div>

        {/* Taluk-based Rooftop Rainwater Harvesting & Recharge Pit Sizing Panel */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-panel/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span className="text-accent">◉</span> Taluk RWH & Recharge Pit Sizing
              </h3>
              <p className="text-[11px] text-slate-400">IS 15797:2008 & CGWB Guidelines</p>
            </div>

            {/* Shortcut into the same filters.taluk state driven by the Filters bar above */}
            <label className="flex flex-col items-start gap-0.5 sm:items-end">
              <span className="text-[9px] uppercase tracking-wider text-slate-500">Jump to taluk</span>
              <select
                value={filters.taluk || activeTaluk}
                onChange={(e) => setFilters({ ...filters, taluk: e.target.value })}
                className="w-full max-w-[180px] truncate rounded-lg border border-accent/40 bg-slate-900 px-2.5 py-1 text-xs font-bold text-accent focus:border-accent focus:outline-none"
              >
                {availableTaluks.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Location Telemetry Auto-Assigned */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5 text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-medium">Avg Rainfall ({activeTaluk})</span>
              <div className="font-semibold text-blue-400">{fmt(avgRf, 0)} mm/yr</div>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-medium">Water Table ({activeTaluk})</span>
              <div className="font-semibold text-amber-400">{fmt(avgGw)} m bgl</div>
            </div>
          </div>

          {/* User Input Form Controls */}
          <div className="flex flex-col gap-3 text-xs">
            <div>
              <label className="mb-1 block font-medium text-slate-300">
                Roof / Catchment Area (m²)
              </label>
              <input
                type="number"
                min="10"
                max="50000"
                value={roofArea}
                onChange={(e) => setRoofArea(Math.max(10, Number(e.target.value)))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-slate-100 focus:border-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-medium text-slate-300">Roof Surface</label>
                <select
                  value={roofMaterial}
                  onChange={(e) => setRoofMaterial(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 focus:border-accent focus:outline-none"
                >
                  {ROOF_MATERIALS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label} (C={m.c})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-300">Occupants</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={occupants}
                  onChange={(e) => setOccupants(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-slate-100 focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* RWH Yield & Storage Calculation Results */}
          <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex justify-between items-center">
              <span>Harvesting & Supply Assessment</span>
              <span className="text-[10px] text-accent font-normal">{activeTaluk}</span>
            </span>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <span className="text-[10px] text-slate-400">Annual Net Harvest</span>
                <div className="text-sm font-bold text-accent">{rwhCalc.netHarvestM3} m³/yr</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <span className="text-[10px] text-slate-400">Daily Average Supply</span>
                <div className="text-sm font-bold text-emerald-400">{rwhCalc.dailySupplyLiters} L/day</div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between rounded bg-slate-950/40 px-2.5 py-1.5 text-[11px] text-slate-300">
              <span>Emergency 5-Day Storage Tank:</span>
              <span className="font-semibold text-accent-blue">{rwhCalc.tankCapacityLiters} Liters</span>
            </div>
          </div>

          {/* Recommended Recharge Pit Dimensions */}
          <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs shadow-lg">
            <div className="flex items-center justify-between border-b border-accent/20 pb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                RECOMMENDED RECHARGE PIT
              </span>
              <span className="text-[10px] font-normal text-slate-400">IS 15797:2008</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
              <div className="rounded border border-slate-800 bg-slate-950/80 p-1.5">
                <span className="text-[9px] uppercase text-slate-500">Pit Count</span>
                <div className="font-bold text-slate-100">{rwhCalc.pitCount} Pit</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/80 p-1.5">
                <span className="text-[9px] uppercase text-slate-500">Diameter</span>
                <div className="font-bold text-accent">{rwhCalc.pitDiameterM} m</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/80 p-1.5">
                <span className="text-[9px] uppercase text-slate-500">Depth</span>
                <div className="font-bold text-amber-400">{rwhCalc.pitDepthM} m</div>
              </div>
            </div>

            <div className="mt-1 flex flex-col gap-1 rounded bg-slate-950/80 p-2 text-[10px] text-slate-400">
              <div className="flex justify-between">
                <span>Filter Packing:</span>
                <span className="text-slate-200">Sand (0.5m) · Gravel (0.5m) · Boulders (1.0m)</span>
              </div>
              <div className="flex justify-between">
                <span>Est. Construction Budget:</span>
                <span className="font-bold text-emerald-400">₹{rwhCalc.estCostINR}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleViewInRwh}
              className="mt-1.5 w-full rounded-lg bg-accent px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-accent/90 flex items-center justify-center gap-1.5 shadow"
            >
              <span>📐 Open Full 2D CAD Blueprint in RWH Designer ({activeTaluk})</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
