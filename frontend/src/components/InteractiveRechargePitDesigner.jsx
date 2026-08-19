import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getFilterOptions, getLatestGroundwater, getLatestRainfall, createRwhDesign } from "../services/api.js";

// This component's roof-material/soil presets are UI-friendly labels for a
// live client-side preview; the backend's persisted design uses its own
// authoritative IS-code lookup tables, so these just map to the closest key.
const ROOF_MATERIAL_TO_BACKEND = {
  paved: "tiled",
  rcc: "rcc_flat",
  gi_sheet: "gi_sheet",
  asphalt: "asbestos_sheet",
  gravel: "thatched",
  green_roof: "green_roof",
};

const SOIL_PRESET_TO_BACKEND = {
  sandy_clay: "sandy_clay_loam",
  clay_loam: "clay_loam",
  coarse_sand: "sandy",
  gravel_sand: "loamy_sand",
  basalt_rock: "clay",
};

/** Backend expects a rooftop footprint polygon (used to compute exact area
 * via geodesic geometry); this tool only collects a roof area number, so we
 * synthesize a square footprint of that area centered on the auto-assigned
 * station coordinates. */
function squareFootprintGeoJson(lat, lng, areaSqm) {
  const side = Math.sqrt(Math.max(areaSqm, 1));
  const half = side / 2;
  const dLat = half / 111320;
  const dLng = half / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng - dLng, lat - dLat],
        [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat],
        [lng - dLng, lat + dLat],
        [lng - dLng, lat - dLat],
      ],
    ],
  };
}

// Comprehensive Hydrogeological Soil Stratigraphy Presets
const SOIL_STRATIGRAPHY_PRESETS = {
  sandy_clay: {
    id: "sandy_clay",
    name: "Sandy Clay / Weathered Rock",
    hsg: "B",
    ksatMs: 3.47e-5,
    ksatMDayNum: 3.0,
    ksatMDay: "3.0 m/day",
    suitability: "Moderate Permeability — Standard Pit / Trench Suitable",
    layers: [
      { name: "Topsoil & Organic Loam", depthEnd: 1.0, color: "#fef3c7", opacity: 0.5, hatch: "url(#topsoilHatch)", textColor: "#b45309" },
      { name: "Sandy Clay Formation", depthEnd: 3.5, color: "#ffedd5", opacity: 0.45, hatch: "url(#clayHatch)", textColor: "#78350f" },
      { name: "Weathered Granitic Gneiss", depthEnd: 7.5, color: "#f1f5f9", opacity: 0.7, hatch: "url(#weatheredHatch)", textColor: "#475569" },
      { name: "Hard Bedrock Base", depthEnd: 15.0, color: "#e2e8f0", opacity: 0.9, hatch: null, textColor: "#1e293b" },
    ],
  },
  clay_loam: {
    id: "clay_loam",
    name: "Clay Loam / Impervious Clay",
    hsg: "D",
    ksatMs: 1.73e-6,
    ksatMDayNum: 0.15,
    ksatMDay: "0.15 m/day",
    suitability: "Low Permeability — Deep Injection Bore Recommended",
    layers: [
      { name: "Topsoil", depthEnd: 0.6, color: "#fef3c7", opacity: 0.5, hatch: "url(#topsoilHatch)", textColor: "#b45309" },
      { name: "Heavy Plastic Impervious Clay", depthEnd: 5.5, color: "#fed7aa", opacity: 0.6, hatch: "url(#denseClayHatch)", textColor: "#9a3412" },
      { name: "Compact Weathered Claystone", depthEnd: 9.0, color: "#e2e8f0", opacity: 0.8, hatch: "url(#clayHatch)", textColor: "#475569" },
      { name: "Hard Bedrock Base", depthEnd: 15.0, color: "#cbd5e1", opacity: 0.95, hatch: null, textColor: "#1e293b" },
    ],
  },
  coarse_sand: {
    id: "coarse_sand",
    name: "Coarse Sand / Alluvial Formation",
    hsg: "A",
    ksatMs: 9.25e-5,
    ksatMDayNum: 8.0,
    ksatMDay: "8.0 m/day",
    suitability: "High Permeability — Excellent Infiltration Rate",
    layers: [
      { name: "Topsoil", depthEnd: 0.5, color: "#fef3c7", opacity: 0.5, hatch: "url(#topsoilHatch)", textColor: "#b45309" },
      { name: "Coarse Alluvial Sand & Gravel", depthEnd: 6.5, color: "#fef08a", opacity: 0.65, hatch: "url(#alluvialHatch)", textColor: "#a16207" },
      { name: "Coarse River Gravel Strata", depthEnd: 10.0, color: "#e2e8f0", opacity: 0.8, hatch: "url(#cadGravel)", textColor: "#475569" },
      { name: "Deep Bedrock Base", depthEnd: 15.0, color: "#cbd5e1", opacity: 0.95, hatch: null, textColor: "#1e293b" },
    ],
  },
  gravel_sand: {
    id: "gravel_sand",
    name: "Gravelly Sand / Highly Permeable",
    hsg: "A",
    ksatMs: 1.38e-4,
    ksatMDayNum: 12.0,
    ksatMDay: "12.0 m/day",
    suitability: "Very High Permeability — Rapid Aquifer Recharge",
    layers: [
      { name: "Topsoil", depthEnd: 0.4, color: "#fef3c7", opacity: 0.5, hatch: "url(#topsoilHatch)", textColor: "#b45309" },
      { name: "Permeable Gravelly Sand", depthEnd: 7.0, color: "#fed7aa", opacity: 0.6, hatch: "url(#cadGravel)", textColor: "#c2410c" },
      { name: "Fissured Aquifer Bed", depthEnd: 11.0, color: "#e2e8f0", opacity: 0.8, hatch: "url(#weatheredHatch)", textColor: "#334155" },
      { name: "Bedrock Base", depthEnd: 15.0, color: "#cbd5e1", opacity: 0.95, hatch: null, textColor: "#1e293b" },
    ],
  },
  basalt_rock: {
    id: "basalt_rock",
    name: "Hard Basalt / Fissured Granitic",
    hsg: "C",
    ksatMs: 9.25e-6,
    ksatMDayNum: 0.8,
    ksatMDay: "0.8 m/day",
    suitability: "Medium/Low Permeability — Fractured Zone Target",
    layers: [
      { name: "Red Murrum / Topsoil", depthEnd: 0.8, color: "#fee2e2", opacity: 0.6, hatch: "url(#topsoilHatch)", textColor: "#991b1b" },
      { name: "Weathered Jointed Basalt", depthEnd: 4.5, color: "#e2e8f0", opacity: 0.8, hatch: "url(#weatheredHatch)", textColor: "#334155" },
      { name: "Fissured Hard Basalt Formations", depthEnd: 15.0, color: "#94a3b8", opacity: 0.95, hatch: "url(#denseClayHatch)", textColor: "#0f172a" },
    ],
  },
};

// Comprehensive Roof Surface Material Standards & Runoff Coefficients (IS 15797 & CPHEEO)
const ROOF_SURFACE_TYPES = {
  paved: {
    id: "paved",
    name: "Paved / Tiled Terrace",
    cRunoff: 0.90,
    badge: "High Efficiency (C = 0.90)",
    desc: "Glazed/ceramic tiles, paved concrete terrace slab",
  },
  rcc: {
    id: "rcc",
    name: "Concrete Slab / RCC Roof",
    cRunoff: 0.85,
    badge: "Standard RCC (C = 0.85)",
    desc: "Flat RCC roof, smooth cement rendered slab",
  },
  gi_sheet: {
    id: "gi_sheet",
    name: "Corrugated GI / Metal Sheet",
    cRunoff: 0.95,
    badge: "Maximum Runoff (C = 0.95)",
    desc: "Galvanized iron / trapezoidal aluminum sheets",
  },
  asphalt: {
    id: "asphalt",
    name: "Asphalt / Bitumen Shingle",
    cRunoff: 0.80,
    badge: "Moderate Runoff (C = 0.80)",
    desc: "Bituminous membrane, felt waterproofing layer",
  },
  gravel: {
    id: "gravel",
    name: "Gravel / Cobble Cover",
    cRunoff: 0.60,
    badge: "Low Runoff (C = 0.60)",
    desc: "Loose gravel cover over waterproofing membrane",
  },
  green_roof: {
    id: "green_roof",
    name: "Green / Turf Eco-Roof",
    cRunoff: 0.50,
    badge: "Eco Retention (C = 0.50)",
    desc: "Vegetated eco-roof with substrate soil retention",
  },
};

const SQFT_PER_M2 = 10.7639;

export default function InteractiveRechargePitDesigner() {
  const [searchParams] = useSearchParams();

  // Location Auto-Assignment State
  const [selectedTaluk, setSelectedTaluk] = useState("Thirumangalam");
  const [isManualOverride, setIsManualOverride] = useState(false);

  // Roof Area Unit Toggle State
  const [areaUnit, setAreaUnit] = useState("m2"); // "m2" | "sqft"
  const [roofAreaInput, setRoofAreaInput] = useState(150);

  // Roof Surface Material State
  const [roofMaterialKey, setRoofMaterialKey] = useState("rcc"); // "paved" | "rcc" | "gi_sheet" | "asphalt" | "gravel" | "green_roof"

  // Auto-Sizing Flag
  const [isAutoSizing, setIsAutoSizing] = useState(true);

  // Form Inputs
  const [pitShape, setPitShape] = useState("circular"); // "circular" | "rectangular"
  const [diameter, setDiameter] = useState(2.0);
  const [depth, setDepth] = useState(3.0);
  const [length, setLength] = useState(3.0);
  const [width, setWidth] = useState(2.0);

  const [annualRainfall, setAnnualRainfall] = useState(950);
  const [gwDepth, setGwDepth] = useState(12.5);
  const [soilPresetKey, setSoilPresetKey] = useState("sandy_clay");
  const [pipeDiameterMm, setPipeDiameterMm] = useState(110);
  const [includePccFooting, setIncludePccFooting] = useState(true);
  const [includeFirstFlush, setIncludeFirstFlush] = useState(true);
  const [showSandLayer, setShowSandLayer] = useState(true);
  const [showGravelLayer, setShowGravelLayer] = useState(true);
  const [showAggregateLayer, setShowAggregateLayer] = useState(true);

  // Interactive CAD Hover State
  const [activeHoverLayer, setActiveHoverLayer] = useState(null);

  // Read URL search params from Dashboard or GIS Map navigation
  useEffect(() => {
    const paramTaluk = searchParams.get("taluk");
    const paramArea = searchParams.get("roofArea");
    const paramMaterial = searchParams.get("roofMaterial");

    if (paramTaluk) setSelectedTaluk(paramTaluk);
    if (paramArea && !isNaN(Number(paramArea))) setRoofAreaInput(Number(paramArea));
    if (paramMaterial && ROOF_SURFACE_TYPES[paramMaterial]) setRoofMaterialKey(paramMaterial);
  }, [searchParams]);

  const activeRoofMaterial = ROOF_SURFACE_TYPES[roofMaterialKey] || ROOF_SURFACE_TYPES.rcc;

  // Compute Effective Roof Area in m² for hydraulic equations
  const effectiveRoofAreaM2 = useMemo(() => {
    if (areaUnit === "sqft") {
      return roofAreaInput / SQFT_PER_M2;
    }
    return roofAreaInput;
  }, [roofAreaInput, areaUnit]);

  // DYNAMIC ROOF AREA-BASED PIT AUTO-SIZING ENGINE (IS 15797 & CGWB Norms)
  useEffect(() => {
    if (!isAutoSizing) return;
    const area = effectiveRoofAreaM2;

    if (area <= 100) {
      setPitShape("circular");
      setDiameter(1.5);
      setDepth(2.5);
      setPipeDiameterMm(90);
    } else if (area <= 180) {
      setPitShape("circular");
      setDiameter(2.0);
      setDepth(3.0);
      setPipeDiameterMm(110);
    } else if (area <= 300) {
      setPitShape("rectangular");
      setLength(3.5);
      setWidth(2.0);
      setDepth(3.0);
      setPipeDiameterMm(110);
    } else if (area <= 500) {
      setPitShape("rectangular");
      setLength(5.0);
      setWidth(2.5);
      setDepth(3.5);
      setPipeDiameterMm(160);
    } else {
      setPitShape("rectangular");
      setLength(7.5);
      setWidth(3.0);
      setDepth(4.0);
      setPipeDiameterMm(200);
    }
  }, [effectiveRoofAreaM2, isAutoSizing]);

  // Handle Unit Toggle Switch
  const handleUnitToggle = (newUnit) => {
    if (newUnit === areaUnit) return;
    if (newUnit === "sqft") {
      setRoofAreaInput(Math.round(roofAreaInput * SQFT_PER_M2));
    } else {
      setRoofAreaInput(Math.round(roofAreaInput / SQFT_PER_M2));
    }
    setAreaUnit(newUnit);
  };

  // Fetch Location & Telemetry Options
  const filterOptions = useQuery({
    queryKey: ["filter-options"],
    queryFn: getFilterOptions,
    staleTime: 300_000,
  });

  const talukList = filterOptions.data?.all_taluks ?? [
    "Thirumangalam", "Madurai South", "Coimbatore North", "Chennai", "Salem", "Tiruchirappalli"
  ];

  const gwQuery = useQuery({
    queryKey: ["gw-latest-taluk", selectedTaluk],
    queryFn: () => getLatestGroundwater({ taluk: selectedTaluk, limit: 1 }),
    enabled: !!selectedTaluk && !isManualOverride,
  });

  const rfQuery = useQuery({
    queryKey: ["rf-latest-taluk", selectedTaluk],
    queryFn: () => getLatestRainfall({ taluk: selectedTaluk, limit: 1 }),
    enabled: !!selectedTaluk && !isManualOverride,
  });

  // Station Metadata Extracted from Telemetry or Query Params
  const activeStationDistrict = gwQuery.data?.[0]?.district || "Tamil Nadu Region";
  const activeLat = gwQuery.data?.[0]?.latitude ?? (searchParams.get("lat") ? Number(searchParams.get("lat")) : 10.8523);
  const activeLng = gwQuery.data?.[0]?.longitude ?? (searchParams.get("lng") ? Number(searchParams.get("lng")) : 78.6942);

  // Auto-assign Rainfall & Water Table Depth when location changes
  useEffect(() => {
    if (isManualOverride) return;

    if (gwQuery.data && gwQuery.data.length > 0 && gwQuery.data[0].water_level_m != null) {
      const val = Math.abs(Number(gwQuery.data[0].water_level_m));
      if (!isNaN(val) && val > 0) setGwDepth(Number(val.toFixed(2)));
    } else {
      setGwDepth(12.5);
    }

    if (rfQuery.data && rfQuery.data.length > 0 && rfQuery.data[0].rainfall_mm != null) {
      const val = Number(rfQuery.data[0].rainfall_mm);
      if (!isNaN(val) && val > 0) setAnnualRainfall(Math.round(val));
    } else {
      setAnnualRainfall(950);
    }
  }, [selectedTaluk, gwQuery.data, rfQuery.data, isManualOverride]);

  const activeSoilPreset = SOIL_STRATIGRAPHY_PRESETS[soilPresetKey] || SOIL_STRATIGRAPHY_PRESETS.sandy_clay;

  // PRECISION HYDROGEOLOGICAL CALCULATIONS ENGINE (Factoring exact C_runoff)
  const calc = useMemo(() => {
    const isCirc = pitShape === "circular";
    const radius = diameter / 2;
    const pitArea = isCirc ? Math.PI * radius * radius : length * width;
    const pitPerimeter = isCirc ? Math.PI * diameter : 2 * (length + width);
    const pitVol = pitArea * depth;

    const cRunoff = activeRoofMaterial.cRunoff;

    // Filter volumes
    const sandVol = showSandLayer ? pitVol * 0.25 : 0;
    const gravelVol = showGravelLayer ? pitVol * 0.25 : 0;
    const aggVol = showAggregateLayer ? pitVol * 0.50 : 0;
    const totalFilterVol = sandVol + gravelVol + aggVol;

    // Void / Storage Volumes (Sand ~35%, Gravel ~40%, Boulders ~45%)
    const storageVol = (sandVol * 0.35) + (gravelVol * 0.40) + (aggVol * 0.45);
    const excavationVol = pitVol * 1.15; // 15% overbreak

    // Liters Conversions (1 m³ = 1000 Liters)
    const pitLiters = Math.round(pitVol * 1000);
    const storageLiters = Math.round(storageVol * 1000);

    // Weights (Tons)
    const sandTons = sandVol * 1.6;
    const gravelTons = gravelVol * 1.5;
    const aggTons = aggVol * 1.6;

    // Annual Runoff Captured (m³ and Liters) incorporating exact cRunoff
    const runoffCapturedM3 = effectiveRoofAreaM2 * (annualRainfall / 1000) * cRunoff * 0.90;
    const runoffCapturedLiters = Math.round(runoffCapturedM3 * 1000);

    // 15-Minute Peak Storm Surge Volume (Intensity = 50mm/hr)
    const peakStormRunoffM3 = effectiveRoofAreaM2 * (50 / 1000 * 0.25) * cRunoff;
    const peakStormLiters = Math.round(peakStormRunoffM3 * 1000);

    // Storm Retention Capacity Ratio
    const stormRetentionRatio = Math.min(999, Math.round((storageVol / (peakStormRunoffM3 || 1)) * 100));

    // Daily Recharge Capacity (m³/day & Liters/day)
    const kSat = activeSoilPreset.ksatMDayNum || 3.0;
    const wettedArea = pitArea + (pitPerimeter * (depth * 0.5));
    const rechargeCapacityM3Day = Math.min(runoffCapturedM3 / 30, wettedArea * kSat * 0.4);
    const rechargeCapacityLitersDay = Math.round(rechargeCapacityM3Day * 1000);

    const separationAboveGwt = gwDepth - depth;
    const isSeparationWarning = separationAboveGwt < 3.0;

    return {
      pitArea: pitArea.toFixed(2),
      pitVol: pitVol.toFixed(2),
      pitLiters,
      storageVol: storageVol.toFixed(2),
      storageLiters,
      totalFilterVol: totalFilterVol.toFixed(2),
      sandVol: sandVol.toFixed(2),
      gravelVol: gravelVol.toFixed(2),
      aggVol: aggVol.toFixed(2),
      sandTons: sandTons.toFixed(2),
      gravelTons: gravelTons.toFixed(2),
      aggTons: aggTons.toFixed(2),
      excavationVol: excavationVol.toFixed(2),
      runoffCapturedM3: runoffCapturedM3.toFixed(1),
      runoffCapturedLiters,
      rechargeCapacityM3Day: rechargeCapacityM3Day.toFixed(1),
      rechargeCapacityLitersDay,
      peakStormRunoffM3: peakStormRunoffM3.toFixed(2),
      peakStormLiters,
      stormRetentionRatio,
      separationAboveGwt: separationAboveGwt.toFixed(2),
      isSeparationWarning,
      cRunoff,
    };
  }, [
    pitShape,
    diameter,
    depth,
    length,
    width,
    effectiveRoofAreaM2,
    annualRainfall,
    gwDepth,
    activeRoofMaterial,
    activeSoilPreset,
    showSandLayer,
    showGravelLayer,
    showAggregateLayer,
  ]);

  const saveDesign = useMutation({
    mutationFn: () =>
      createRwhDesign({
        building_name: `${selectedTaluk} Recharge Structure`,
        building_type: "residential",
        footprint: squareFootprintGeoJson(activeLat, activeLng, effectiveRoofAreaM2),
        roof_material: ROOF_MATERIAL_TO_BACKEND[roofMaterialKey] || "rcc_flat",
        roof_slope_percent: 2.0,
        // Already resolved client-side (live nearest-station lookup, or manual entry) —
        // send it as-is rather than making the backend re-resolve a station for our
        // synthetic footprint point, which can miss even when the real one didn't.
        annual_rainfall_mm: annualRainfall,
        groundwater_depth_m: gwDepth,
        soil_type: SOIL_PRESET_TO_BACKEND[soilPresetKey] || "clay_loam",
        distance_to_inlet_m: 10.0,
        persist: true,
      }),
  });

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-panel/70 p-6 font-sans text-slate-100 shadow-2xl">
      {/* Top Banner & Location Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="text-accent">📐</span> Rooftop Rainwater Harvesting Recharge Pit Designer
          </h2>
          <p className="text-xs text-slate-400">
            Auto-Assigned Location Telemetry · GIS Station Metadata · 2D CAD Blueprint Engine
          </p>
        </div>

        {/* Location Selector & Auto-Sizing Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-slate-400 font-semibold">Target Location</span>
            <select
              value={selectedTaluk}
              onChange={(e) => setSelectedTaluk(e.target.value)}
              className="rounded-lg border border-accent/40 bg-slate-900 px-3 py-1 text-xs font-semibold text-accent focus:border-accent focus:outline-none"
            >
              {talukList.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsManualOverride(!isManualOverride)}
            className={`mt-3 rounded-lg border px-3 py-1 text-xs font-medium transition ${
              isManualOverride
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {isManualOverride ? "✏️ Manual Input Active" : "📡 Auto-Assigned Telemetry"}
          </button>

          <button
            type="button"
            onClick={() => saveDesign.mutate()}
            disabled={saveDesign.isPending}
            className="mt-3 rounded-lg border border-accent bg-accent px-3 py-1 text-xs font-bold text-slate-950 transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-60"
          >
            {saveDesign.isPending ? "Saving…" : "💾 Save Design to Reports"}
          </button>
        </div>
      </div>

      {saveDesign.isSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          <span>✓ Design saved (#{saveDesign.data.design_id}) — estimated cost ₹{Math.round(saveDesign.data.estimated_cost_inr).toLocaleString("en-IN")}.</span>
          <Link to="/reports" className="rounded border border-emerald-400/40 px-2 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-500/20">
            View in Reports →
          </Link>
        </div>
      )}
      {saveDesign.isError && (
        <div className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          <span>⚠ Couldn't save this design: {saveDesign.error?.response?.data?.detail || saveDesign.error?.message || "Unknown error"}</span>
          <button
            type="button"
            onClick={() => saveDesign.mutate()}
            className="rounded border border-rose-400/40 px-2 py-1 font-semibold text-rose-100 transition hover:bg-rose-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Split Screen Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT PANEL: Input Controls (5 Cols) */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-5 text-xs">
          
          {/* Target Location & GIS Telemetry Details Card */}
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center border-b border-accent/20 pb-1">
              <span className="font-bold text-accent flex items-center gap-1.5">
                <span>📍</span> Target Location & GIS Telemetry
              </span>
              <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                CGWB TELEMETRY LIVE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Taluk / Station:</span>
                <strong className="text-slate-100">{selectedTaluk}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">District:</span>
                <strong className="text-slate-100">{activeStationDistrict}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">GPS Coordinates:</span>
                <strong className="text-slate-200 font-mono">{activeLat.toFixed(4)}° N, {activeLng.toFixed(4)}° E</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Aquifer Formation:</span>
                <strong className="text-accent">{activeSoilPreset.name.split('/')[0]}</strong>
              </div>
            </div>
          </div>

          <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] text-accent flex items-center justify-between">
            <span>1. Site & Roof Hydrology</span>
            {isAutoSizing ? (
              <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent border border-accent/30 flex items-center gap-1">
                ⚡ IS 15797 AUTO-SIZED
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsAutoSizing(true)}
                className="text-[9px] text-amber-400 underline"
              >
                Reset Auto-Sizing
              </button>
            )}
          </h3>

          {/* Roof Area Input with Unit Toggle (m² / sq ft) */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-200 font-semibold text-xs flex items-center gap-1.5">
                <span>Roof Catchment Area</span>
                <span className="text-[10px] font-normal text-slate-400">(Drives Structure Sizing)</span>
              </label>
              {/* Unit Selector Toggle */}
              <div className="flex rounded border border-slate-700 bg-slate-900 p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleUnitToggle("m2")}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    areaUnit === "m2"
                      ? "bg-accent text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  m²
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitToggle("sqft")}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    areaUnit === "sqft"
                      ? "bg-accent text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  sq ft
                </button>
              </div>
            </div>

            <input
              type="number"
              min="10"
              max="100000"
              value={roofAreaInput}
              onChange={(e) => setRoofAreaInput(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-lg border border-accent/50 bg-slate-900 px-3 py-2 text-sm text-slate-100 font-bold focus:border-accent focus:outline-none"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              {areaUnit === "m2" ? (
                <span>Converted: <strong className="text-slate-200">{(roofAreaInput * SQFT_PER_M2).toFixed(0)} sq ft</strong></span>
              ) : (
                <span>Converted: <strong className="text-slate-200">{(roofAreaInput / SQFT_PER_M2).toFixed(1)} m²</strong></span>
              )}
              <span className="text-accent font-medium">Auto-Sizes Pit Geometry below ⚡</span>
            </div>

            {/* Roof Surface Material Selector */}
            <div className="pt-2 border-t border-slate-800">
              <label className="mb-1 block text-slate-300 font-medium">Roof Surface Material</label>
              <select
                value={roofMaterialKey}
                onChange={(e) => setRoofMaterialKey(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-semibold text-slate-100 focus:border-accent focus:outline-none"
              >
                {Object.values(ROOF_SURFACE_TYPES).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (C = {m.cRunoff})
                  </option>
                ))}
              </select>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">{activeRoofMaterial.desc}</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                  {activeRoofMaterial.badge}
                </span>
              </div>
            </div>
          </div>

          {/* Pit Shape Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="font-medium text-slate-300">Pit Structure Shape</label>
              {isAutoSizing && <span className="text-[9px] text-accent">Auto-Chosen for Area</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPitShape("circular");
                  setIsAutoSizing(false);
                }}
                className={`rounded-lg border px-3 py-2 font-medium transition ${
                  pitShape === "circular"
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                ● Circular Pit
              </button>
              <button
                type="button"
                onClick={() => {
                  setPitShape("rectangular");
                  setIsAutoSizing(false);
                }}
                className={`rounded-lg border px-3 py-2 font-medium transition ${
                  pitShape === "rectangular"
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                ■ Rectangular Pit
              </button>
            </div>
          </div>

          {/* Pit Dimensions Controls */}
          {pitShape === "circular" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-slate-300 font-medium">Diameter (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={diameter}
                  onChange={(e) => {
                    setDiameter(Math.max(1.0, Number(e.target.value)));
                    setIsAutoSizing(false);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-1.5 text-slate-100 focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300 font-medium">Pit Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="6.0"
                  value={depth}
                  onChange={(e) => {
                    setDepth(Math.max(1.0, Number(e.target.value)));
                    setIsAutoSizing(false);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-1.5 text-slate-100 focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-slate-300 font-medium">Length (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="12.0"
                  value={length}
                  onChange={(e) => {
                    setLength(Math.max(1.0, Number(e.target.value)));
                    setIsAutoSizing(false);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-1.5 text-slate-100 focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300 font-medium">Width (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={width}
                  onChange={(e) => {
                    setWidth(Math.max(1.0, Number(e.target.value)));
                    setIsAutoSizing(false);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-1.5 text-slate-100 focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300 font-medium">Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="6.0"
                  value={depth}
                  onChange={(e) => {
                    setDepth(Math.max(1.0, Number(e.target.value)));
                    setIsAutoSizing(false);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-1.5 text-slate-100 focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Hydrology & Auto-Assigned Location Fields */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="mb-1 flex items-center justify-between text-slate-300 font-medium">
                <span>Annual Rainfall (mm)</span>
                {!isManualOverride && <span className="text-[9px] text-emerald-400 font-bold">AUTO</span>}
              </label>
              <input
                type="number"
                min="200"
                max="4000"
                value={annualRainfall}
                readOnly={!isManualOverride}
                onChange={(e) => setAnnualRainfall(Math.max(200, Number(e.target.value)))}
                className={`w-full rounded-lg border px-3 py-1.5 text-slate-100 focus:outline-none ${
                  isManualOverride ? "border-amber-500/60 bg-slate-950/90" : "border-slate-700 bg-slate-900/80 text-emerald-300 font-semibold"
                }`}
              />
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-slate-300 font-medium">
                <span>Water Table Depth (m)</span>
                {!isManualOverride && <span className="text-[9px] text-amber-400 font-bold">AUTO</span>}
              </label>
              <input
                type="number"
                step="0.1"
                min="1.5"
                max="50.0"
                value={gwDepth}
                readOnly={!isManualOverride}
                onChange={(e) => setGwDepth(Math.max(1.5, Number(e.target.value)))}
                className={`w-full rounded-lg border px-3 py-1.5 text-slate-100 focus:outline-none ${
                  isManualOverride ? "border-amber-500/60 bg-slate-950/90" : "border-slate-700 bg-slate-900/80 text-amber-300 font-semibold"
                }`}
              />
            </div>
          </div>

          {/* Soil Stratigraphy Configurator */}
          <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] text-accent pt-2">
            2. Soil Stratigraphy Profile
          </h3>
          <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div>
              <label className="mb-1 block text-slate-300 font-medium">Subsurface Formation</label>
              <select
                value={soilPresetKey}
                onChange={(e) => setSoilPresetKey(e.target.value)}
                className="w-full rounded-lg border border-accent/40 bg-slate-900 px-2 py-1.5 text-xs text-accent font-semibold focus:border-accent focus:outline-none"
              >
                {Object.values(SOIL_STRATIGRAPHY_PRESETS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (HSG {p.hsg})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between pt-1 text-[11px]">
              <span className="text-slate-400">Permeability (K_sat): <strong className="text-slate-200">{activeSoilPreset.ksatMDay}</strong></span>
              <span className="rounded bg-accent/10 px-2 py-0.5 font-bold text-accent border border-accent/20">HSG {activeSoilPreset.hsg}</span>
            </div>
            <div className="text-[10px] italic text-slate-400">{activeSoilPreset.suitability}</div>
          </div>

          {/* Filter Media Toggles */}
          <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] text-accent pt-2">
            3. Filter Layer Configuration
          </h3>
          <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <label
              onMouseEnter={() => setActiveHoverLayer("sand")}
              onMouseLeave={() => setActiveHoverLayer(null)}
              className="flex items-center justify-between text-slate-300 cursor-pointer hover:text-amber-300 transition"
            >
              <span>Top Layer: Coarse Sand (25% thickness)</span>
              <input
                type="checkbox"
                checked={showSandLayer}
                onChange={(e) => setShowSandLayer(e.target.checked)}
                className="accent-accent"
              />
            </label>
            <label
              onMouseEnter={() => setActiveHoverLayer("gravel")}
              onMouseLeave={() => setActiveHoverLayer(null)}
              className="flex items-center justify-between text-slate-300 cursor-pointer hover:text-slate-100 transition"
            >
              <span>Middle Layer: Graded Gravel (25% thickness)</span>
              <input
                type="checkbox"
                checked={showGravelLayer}
                onChange={(e) => setShowGravelLayer(e.target.checked)}
                className="accent-accent"
              />
            </label>
            <label
              onMouseEnter={() => setActiveHoverLayer("boulder")}
              onMouseLeave={() => setActiveHoverLayer(null)}
              className="flex items-center justify-between text-slate-300 cursor-pointer hover:text-blue-300 transition"
            >
              <span>Bottom Layer: Coarse Boulders (50% thickness)</span>
              <input
                type="checkbox"
                checked={showAggregateLayer}
                onChange={(e) => setShowAggregateLayer(e.target.checked)}
                className="accent-accent"
              />
            </label>
          </div>

          {/* Separation Warning Banner */}
          {calc.isSeparationWarning && (
            <div className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-[11px] text-amber-200 flex gap-2 items-start">
              <span className="text-base leading-none">⚠️</span>
              <div>
                <strong>Water Table Separation Warning:</strong> Pit depth ({depth}m) is only {calc.separationAboveGwt}m above seasonal groundwater ({gwDepth}m bgl). Minimum recommended separation is 3.0m per CGWB norms.
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Live Engineering Drawing & Calculations (7 Cols) */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* Live CAD SVG Drawing Canvas */}
          <div className="relative flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white p-4 shadow-xl text-slate-900">
            {/* Drawing Title & Compass */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2 font-mono text-[11px]">
              <div>
                <span className="font-bold text-slate-900">2D ENGINEERING CROSS SECTION</span> — {pitShape === "circular" ? "CIRCULAR PIT" : "RECTANGULAR TRENCH"} ({selectedTaluk})
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-600">
                <span>SCALE 1:50</span>
                <span className="font-bold text-slate-900">▲ N</span>
              </div>
            </div>

            {/* SVG Drawing Engine with Subsurface Stratigraphy Ruler */}
            <div className="flex justify-center overflow-x-auto py-2">
              <SvgCadDrawing
                pitShape={pitShape}
                diameter={diameter}
                depth={depth}
                length={length}
                width={width}
                gwDepth={gwDepth}
                soilPreset={activeSoilPreset}
                showSandLayer={showSandLayer}
                showGravelLayer={showGravelLayer}
                showAggregateLayer={showAggregateLayer}
                includePccFooting={includePccFooting}
                includeFirstFlush={includeFirstFlush}
                pipeDiameterMm={pipeDiameterMm}
                activeHoverLayer={activeHoverLayer}
                setActiveHoverLayer={setActiveHoverLayer}
              />
            </div>

            {/* CAD Legend & Material Notes */}
            <div className="mt-2 grid grid-cols-4 gap-2 border-t border-slate-200 pt-2 text-[10px] font-mono text-slate-700">
              <div
                onMouseEnter={() => setActiveHoverLayer("sand")}
                onMouseLeave={() => setActiveHoverLayer(null)}
                className={`flex items-center gap-1.5 cursor-pointer rounded p-1 transition ${activeHoverLayer === "sand" ? "bg-amber-100 font-bold" : ""}`}
              >
                <span className="h-3 w-3 rounded border border-amber-400 bg-yellow-200" />
                <span>Sand (1.5-2mm)</span>
              </div>
              <div
                onMouseEnter={() => setActiveHoverLayer("gravel")}
                onMouseLeave={() => setActiveHoverLayer(null)}
                className={`flex items-center gap-1.5 cursor-pointer rounded p-1 transition ${activeHoverLayer === "gravel" ? "bg-slate-200 font-bold" : ""}`}
              >
                <span className="h-3 w-3 rounded border border-slate-400 bg-slate-300" />
                <span>Gravel (5-10mm)</span>
              </div>
              <div
                onMouseEnter={() => setActiveHoverLayer("boulder")}
                onMouseLeave={() => setActiveHoverLayer(null)}
                className={`flex items-center gap-1.5 cursor-pointer rounded p-1 transition ${activeHoverLayer === "boulder" ? "bg-slate-300 font-bold" : ""}`}
              >
                <span className="h-3 w-3 rounded border border-slate-600 bg-slate-500" />
                <span>Boulders (50-200mm)</span>
              </div>
              <div
                onMouseEnter={() => setActiveHoverLayer("gwt")}
                onMouseLeave={() => setActiveHoverLayer(null)}
                className={`flex items-center gap-1.5 cursor-pointer rounded p-1 transition ${activeHoverLayer === "gwt" ? "bg-sky-100 font-bold" : ""}`}
              >
                <span className="h-3 w-3 rounded border border-sky-400 bg-sky-200" />
                <span>Water Table</span>
              </div>
            </div>
          </div>

          {/* Dynamic Hydraulic & Material Calculations Readout with Dual Units */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <span>Dynamic Hydraulic & Material Calculations ({selectedTaluk})</span>
              </h3>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-400 border border-emerald-500/30">
                  ⚡ Storm Retention: {calc.stormRetentionRatio}% Surge ({calc.peakStormLiters.toLocaleString()} L)
                </span>
              </div>
            </div>

            {/* Main 4 Metric Cards with Dual m³ & Liters Readouts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block mb-0.5">Pit Volume</span>
                <div className="text-base font-bold text-accent">{calc.pitVol} m³</div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">({calc.pitLiters.toLocaleString()} Liters)</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block mb-0.5">Storage Void Vol</span>
                <div className="text-base font-bold text-emerald-400">{calc.storageVol} m³</div>
                <div className="text-[10px] font-mono text-emerald-300/80 mt-0.5">({calc.storageLiters.toLocaleString()} Liters)</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block mb-0.5">Recharge Capacity</span>
                <div className="text-base font-bold text-blue-400">{calc.rechargeCapacityM3Day} m³/day</div>
                <div className="text-[10px] font-mono text-blue-300/80 mt-0.5">({calc.rechargeCapacityLitersDay.toLocaleString()} L/day)</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block mb-0.5">
                  Captured Runoff (C = {calc.cRunoff})
                </span>
                <div className="text-base font-bold text-amber-400">{calc.runoffCapturedM3} m³/yr</div>
                <div className="text-[10px] font-mono text-amber-300/80 mt-0.5">({calc.runoffCapturedLiters.toLocaleString()} L/yr)</div>
              </div>
            </div>

            {/* Bill of Quantities Material Breakdown */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
              <div>• Excavation: <strong className="text-slate-100">{calc.excavationVol} m³</strong></div>
              <div>• Coarse Sand: <strong className="text-slate-100">{calc.sandVol} m³ ({calc.sandTons}t)</strong></div>
              <div>• Graded Gravel: <strong className="text-slate-100">{calc.gravelVol} m³ ({calc.gravelTons}t)</strong></div>
              <div>• Boulders: <strong className="text-slate-100">{calc.aggVol} m³ ({calc.aggTons}t)</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clean White Background CAD SVG Engine with Dynamic Stratigraphy & Depth Ruler
// ---------------------------------------------------------------------------

function SvgCadDrawing({
  pitShape,
  diameter,
  depth,
  length,
  width,
  gwDepth,
  soilPreset,
  showSandLayer,
  showGravelLayer,
  showAggregateLayer,
  includePccFooting,
  pipeDiameterMm,
  activeHoverLayer,
  setActiveHoverLayer,
}) {
  const isCirc = pitShape === "circular";
  const pitWidthPx = Math.min(260, Math.max(140, isCirc ? diameter * 60 : width * 60));
  const pitDepthPx = Math.min(220, Math.max(120, depth * 45));

  // Canvas Dimensions
  const canvasW = 680;
  const canvasH = 460;
  const pitCenter = 300;
  const pitLeft = pitCenter - pitWidthPx / 2;
  const pitRight = pitCenter + pitWidthPx / 2;

  // Key Y levels
  const glY = 95;
  const pitBottomY = glY + pitDepthPx;
  const gwY = Math.min(430, glY + (gwDepth * 35));

  const layers = soilPreset.layers;
  const topsoilDepth = layers[0]?.depthEnd ?? 1.0;
  const layer2Depth = layers[1]?.depthEnd ?? 3.5;

  // Compute Dynamic Soil Layer Y-boundaries from real meter depths
  const topsoilYEnd = Math.min(pitBottomY + 40, glY + topsoilDepth * 40);
  const layer2YEnd = Math.min(pitBottomY + 90, glY + layer2Depth * 40);
  const layer3YEnd = Math.min(410, glY + 7.5 * 35);

  return (
    <svg
      width={canvasW}
      height={canvasH}
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className="font-mono text-[10px]"
      style={{ width: canvasW, maxWidth: "none", flexShrink: 0 }}
    >
      <defs>
        {/* Material Hatches */}
        <pattern id="cadSand" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#d97706" />
          <circle cx="7" cy="7" r="1" fill="#b45309" />
        </pattern>
        <pattern id="cadGravel" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2.5" fill="#64748b" />
          <circle cx="10" cy="10" r="2" fill="#475569" />
        </pattern>
        <pattern id="cadBoulder" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="4" fill="#334155" />
          <circle cx="15" cy="15" r="3.5" fill="#1e293b" />
        </pattern>

        {/* Geological Soil Patterns */}
        <pattern id="topsoilHatch" width="12" height="12" patternUnits="userSpaceOnUse">
          <line x1="0" y1="12" x2="12" y2="0" stroke="#d97706" strokeWidth="0.8" opacity="0.35" />
        </pattern>
        <pattern id="clayHatch" width="10" height="10" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="10" y2="10" stroke="#78350f" strokeWidth="0.8" opacity="0.45" />
        </pattern>
        <pattern id="denseClayHatch" width="8" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="8" x2="8" y2="0" stroke="#9a3412" strokeWidth="1" opacity="0.5" />
          <line x1="0" y1="0" x2="8" y2="8" stroke="#9a3412" strokeWidth="1" opacity="0.5" />
        </pattern>
        <pattern id="weatheredHatch" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 0 8 Q 4 0 8 8 T 16 8" fill="none" stroke="#475569" strokeWidth="1" opacity="0.5" />
        </pattern>
        <pattern id="alluvialHatch" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.5" fill="#a16207" opacity="0.6" />
          <circle cx="9" cy="9" r="2" fill="#d97706" opacity="0.6" />
        </pattern>
        <pattern id="brickHatch" width="16" height="10" patternUnits="userSpaceOnUse">
          <rect width="16" height="10" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.8" />
          <line x1="0" y1="5" x2="16" y2="5" stroke="#94a3b8" strokeWidth="0.8" />
          <line x1="8" y1="0" x2="8" y2="5" stroke="#94a3b8" strokeWidth="0.8" />
          <line x1="16" y1="5" x2="16" y2="10" stroke="#94a3b8" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* Background White Canvas */}
      <rect width={canvasW} height={canvasH} fill="#ffffff" />

      {/* DYNAMIC SUBSURFACE SOIL STRATIGRAPHY LAYERS */}
      {/* Layer 1: Topsoil */}
      <g
        onMouseEnter={() => setActiveHoverLayer("soil_0")}
        onMouseLeave={() => setActiveHoverLayer(null)}
        className="cursor-pointer"
      >
        <rect x="20" y={glY} width="580" height={topsoilYEnd - glY} fill={layers[0]?.color || "#fef3c7"} opacity={layers[0]?.opacity || 0.5} />
        {layers[0]?.hatch && <rect x="20" y={glY} width="580" height={topsoilYEnd - glY} fill={layers[0].hatch} />}
        <text x="30" y={glY + Math.min(22, (topsoilYEnd - glY) / 2 + 5)} fill={layers[0]?.textColor || "#b45309"} fontWeight="bold" fontSize="9.5" paintOrder="stroke" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
          1. {layers[0]?.name || "TOPSOIL STRATA"}
        </text>
      </g>

      {/* Layer 2: Primary Soil / Clay / Sand Formation */}
      <g
        onMouseEnter={() => setActiveHoverLayer("soil_1")}
        onMouseLeave={() => setActiveHoverLayer(null)}
        className="cursor-pointer"
      >
        <rect x="20" y={topsoilYEnd} width="580" height={layer2YEnd - topsoilYEnd} fill={layers[1]?.color || "#ffedd5"} opacity={layers[1]?.opacity || 0.45} />
        {layers[1]?.hatch && <rect x="20" y={topsoilYEnd} width="580" height={layer2YEnd - topsoilYEnd} fill={layers[1].hatch} />}
        <text x="30" y={topsoilYEnd + 25} fill={layers[1]?.textColor || "#78350f"} fontWeight="bold" fontSize="9.5" paintOrder="stroke" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
          2. {layers[1]?.name || "SANDY CLAY FORMATION"}
        </text>
      </g>

      {/* Layer 3: Weathered Rock / Aquifer Bed */}
      <g
        onMouseEnter={() => setActiveHoverLayer("soil_2")}
        onMouseLeave={() => setActiveHoverLayer(null)}
        className="cursor-pointer"
      >
        <rect x="20" y={layer2YEnd} width="580" height={layer3YEnd - layer2YEnd} fill={layers[2]?.color || "#f1f5f9"} opacity={layers[2]?.opacity || 0.7} />
        {layers[2]?.hatch && <rect x="20" y={layer2YEnd} width="580" height={layer3YEnd - layer2YEnd} fill={layers[2].hatch} />}
        <text x="30" y={layer2YEnd + 25} fill={layers[2]?.textColor || "#475569"} fontWeight="bold" fontSize="9.5" paintOrder="stroke" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
          3. {layers[2]?.name || "WEATHERED ROCK / AQUIFER"}
        </text>
      </g>

      {/* Layer 4: Bedrock Base */}
      <rect x="20" y={layer3YEnd} width="580" height={canvasH - layer3YEnd} fill={layers[3]?.color || "#cbd5e1"} opacity={layers[3]?.opacity || 0.9} />
      <text x="30" y={layer3YEnd + 25} fill={layers[3]?.textColor || "#1e293b"} fontWeight="bold" fontSize="9.5" paintOrder="stroke" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
        4. {layers[3]?.name || "HARD BEDROCK BASE"}
      </text>

      {/* RIGHT-SIDE SUBSURFACE SOIL DEPTH RULER */}
      <g transform="translate(605, 0)">
        <line x1="0" y1={glY} x2="0" y2="430" stroke="#475569" strokeWidth="2" />
        <line x1="-5" y1={glY} x2="5" y2={glY} stroke="#000000" strokeWidth="2" />
        <text x="10" y={glY + 4} fill="#000000" fontWeight="bold">0.0m</text>

        <line x1="-5" y1={topsoilYEnd} x2="5" y2={topsoilYEnd} stroke="#b45309" strokeWidth="2" />
        <text x="10" y={topsoilYEnd + 4} fill="#b45309" fontWeight="bold">{topsoilDepth}m</text>

        <line x1="-5" y1={layer2YEnd} x2="5" y2={layer2YEnd} stroke="#78350f" strokeWidth="2" />
        <text x="10" y={layer2YEnd + 4} fill="#78350f" fontWeight="bold">{layer2Depth}m</text>

        <line x1="-5" y1={layer3YEnd} x2="5" y2={layer3YEnd} stroke="#334155" strokeWidth="2" />
        <text x="10" y={layer3YEnd + 4} fill="#334155" fontWeight="bold">7.5m</text>
      </g>

      {/* Ground Surface (GL Line) */}
      <line x1="20" y1={glY} x2="600" y2={glY} stroke="#000000" strokeWidth="2" />
      <text x="30" y={glY - 10} fill="#000000" fontWeight="bold" paintOrder="stroke" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
        ▼ GL (GROUND LEVEL 0.00m)
      </text>

      {/* Roof Pipe */}
      <path d={`M 30 42 L ${pitLeft - 65} 42`} fill="none" stroke="#0284c7" strokeWidth="4" />
      <text x="30" y="28" fill="#0284c7" fontWeight="bold" paintOrder="stroke" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
        ROOF PIPE ({pipeDiameterMm}mm PVC)
      </text>

      {/* Inspection Chamber */}
      <g
        onMouseEnter={() => setActiveHoverLayer("chamber")}
        onMouseLeave={() => setActiveHoverLayer(null)}
        className="cursor-pointer"
      >
        <rect
          x={pitLeft - 65}
          y="45"
          width="50"
          height="50"
          fill={activeHoverLayer === "chamber" ? "#e0f2fe" : "#ffffff"}
          stroke={activeHoverLayer === "chamber" ? "#0284c7" : "#000000"}
          strokeWidth={activeHoverLayer === "chamber" ? "2.5" : "1.5"}
        />
        <text x={pitLeft - 40} y="44" textAnchor="middle" fill="#000000" fontWeight="bold" fontSize="9" paintOrder="stroke" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
          INSPECTION CHAMBER
        </text>
        <path d={`M ${pitLeft - 15} 70 L ${pitLeft + 15} 70`} fill="none" stroke="#0284c7" strokeWidth="3" />
      </g>

      {/* PIT STRUCTURE CUTAWAY: CIRCULAR vs RECTANGULAR GEOMETRY */}
      {isCirc ? (
        <polygon
          points={`${pitLeft},${glY} ${pitLeft + 10},${pitBottomY} ${pitRight - 10},${pitBottomY} ${pitRight},${glY}`}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="2"
        />
      ) : (
        <g>
          {/* Left Brickwork Wall (230mm) */}
          <rect x={pitLeft - 14} y={glY} width="14" height={pitDepthPx} fill="url(#brickHatch)" stroke="#000000" strokeWidth="1.5" />
          <line x1={pitLeft} y1={glY} x2={pitLeft} y2={pitBottomY} stroke="#000000" strokeWidth="2" />

          {/* Right Brickwork Wall (230mm) */}
          <rect x={pitRight} y={glY} width="14" height={pitDepthPx} fill="url(#brickHatch)" stroke="#000000" strokeWidth="1.5" />
          <line x1={pitRight} y1={glY} x2={pitRight} y2={pitBottomY} stroke="#000000" strokeWidth="2" />

          {/* Rectangular Pit Interior */}
          <rect x={pitLeft} y={glY} width={pitWidthPx} height={pitDepthPx} fill="#ffffff" stroke="none" />
          <line x1={pitLeft} y1={pitBottomY} x2={pitRight} y2={pitBottomY} stroke="#000000" strokeWidth="2" />
        </g>
      )}

      {/* 3D Isometric Geometry Inset Diagram */}
      <g transform="translate(470, 15)">
        <rect x="0" y="0" width="125" height="60" fill="#f8fafc" stroke="#64748b" strokeWidth="1" rx="4" />
        <text x="62" y="13" textAnchor="middle" fill="#0f172a" fontWeight="bold" style={{ fontSize: "9px" }}>
          {isCirc ? "● 3D CYLINDER MODEL" : "■ 3D TRENCH BOX"}
        </text>

        {isCirc ? (
          <g transform="translate(42, 18)">
            <ellipse cx="20" cy="8" rx="18" ry="6" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
            <line x1="2" y1="8" x2="2" y2="32" stroke="#0284c7" strokeWidth="1.5" />
            <line x1="38" y1="8" x2="38" y2="32" stroke="#0284c7" strokeWidth="1.5" />
            <ellipse cx="20" cy="32" rx="18" ry="6" fill="none" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="3 2" />
          </g>
        ) : (
          <g transform="translate(32, 16)">
            <polygon points="10,12 35,5 55,12 30,19" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.2" />
            <polygon points="10,12 30,19 30,36 10,29" fill="#bae6fd" stroke="#0284c7" strokeWidth="1.2" />
            <polygon points="30,19 55,12 55,29 30,36" fill="#7dd3fc" stroke="#0284c7" strokeWidth="1.2" />
          </g>
        )}
      </g>

      {/* PCC Footing Base (if selected) */}
      {includePccFooting && (
        <rect
          x={pitLeft + (isCirc ? 5 : 0)}
          y={pitBottomY - 14}
          width={pitWidthPx - (isCirc ? 10 : 0)}
          height="14"
          fill="#cbd5e1"
          stroke="#000000"
          strokeWidth="1.5"
        />
      )}

      {/* Filter Media Layers inside Pit */}
      {/* Bottom Layer: Boulders (50%) */}
      {showAggregateLayer && (
        <g
          onMouseEnter={() => setActiveHoverLayer("boulder")}
          onMouseLeave={() => setActiveHoverLayer(null)}
          className="cursor-pointer"
        >
          {isCirc ? (
            <polygon
              points={`${pitLeft + 7},${glY + pitDepthPx * 0.5} ${pitLeft + 10},${pitBottomY - (includePccFooting ? 14 : 0)} ${pitRight - 10},${pitBottomY - (includePccFooting ? 14 : 0)} ${pitRight - 7},${glY + pitDepthPx * 0.5}`}
              fill={activeHoverLayer === "boulder" ? "#cbd5e1" : "#e2e8f0"}
              stroke="#000000"
              strokeWidth={activeHoverLayer === "boulder" ? "2.5" : "1"}
            />
          ) : (
            <rect
              x={pitLeft}
              y={glY + pitDepthPx * 0.5}
              width={pitWidthPx}
              height={pitDepthPx * 0.5 - (includePccFooting ? 14 : 0)}
              fill={activeHoverLayer === "boulder" ? "#cbd5e1" : "#e2e8f0"}
              stroke="#000000"
              strokeWidth={activeHoverLayer === "boulder" ? "2.5" : "1"}
            />
          )}
          <rect
            x={pitLeft}
            y={glY + pitDepthPx * 0.5}
            width={pitWidthPx}
            height={pitDepthPx * 0.5 - (includePccFooting ? 14 : 0)}
            fill="url(#cadBoulder)"
          />
        </g>
      )}

      {/* Middle Layer: Gravel (25%) */}
      {showGravelLayer && (
        <g
          onMouseEnter={() => setActiveHoverLayer("gravel")}
          onMouseLeave={() => setActiveHoverLayer(null)}
          className="cursor-pointer"
        >
          {isCirc ? (
            <polygon
              points={`${pitLeft + 3.5},${glY + pitDepthPx * 0.25} ${pitLeft + 7},${glY + pitDepthPx * 0.5} ${pitRight - 7},${glY + pitDepthPx * 0.5} ${pitRight - 3.5},${glY + pitDepthPx * 0.25}`}
              fill={activeHoverLayer === "gravel" ? "#f1f5f9" : "#e2e8f0"}
              stroke="#000000"
              strokeWidth={activeHoverLayer === "gravel" ? "2.5" : "1"}
            />
          ) : (
            <rect
              x={pitLeft}
              y={glY + pitDepthPx * 0.25}
              width={pitWidthPx}
              height={pitDepthPx * 0.25}
              fill={activeHoverLayer === "gravel" ? "#f1f5f9" : "#e2e8f0"}
              stroke="#000000"
              strokeWidth={activeHoverLayer === "gravel" ? "2.5" : "1"}
            />
          )}
          <rect
            x={pitLeft}
            y={glY + pitDepthPx * 0.25}
            width={pitWidthPx}
            height={pitDepthPx * 0.25}
            fill="url(#cadGravel)"
          />
        </g>
      )}

      {/* Top Layer: Coarse Sand (25%) */}
      {showSandLayer && (
        <g
          onMouseEnter={() => setActiveHoverLayer("sand")}
          onMouseLeave={() => setActiveHoverLayer(null)}
          className="cursor-pointer"
        >
          {isCirc ? (
            <polygon
              points={`${pitLeft},${glY} ${pitLeft + 3.5},${glY + pitDepthPx * 0.25} ${pitRight - 3.5},${glY + pitDepthPx * 0.25} ${pitRight},${glY}`}
              fill={activeHoverLayer === "sand" ? "#fef9c3" : "#fef08a"}
              stroke="#000000"
              strokeWidth={activeHoverLayer === "sand" ? "2.5" : "1"}
            />
          ) : (
            <rect
              x={pitLeft}
              y={glY}
              width={pitWidthPx}
              height={pitDepthPx * 0.25}
              fill={activeHoverLayer === "sand" ? "#fef9c3" : "#fef08a"}
              stroke="#000000"
              strokeWidth={activeHoverLayer === "sand" ? "2.5" : "1"}
            />
          )}
          <rect
            x={pitLeft}
            y={glY}
            width={pitWidthPx}
            height={pitDepthPx * 0.25}
            fill="url(#cadSand)"
          />
        </g>
      )}

      {/* Water Flow Vectors */}
      <path d={`M ${pitCenter - 30} ${glY + 10} L ${pitCenter - 30} ${glY + 45}`} fill="none" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 2" />
      <path d={`M ${pitCenter} ${glY + 10} L ${pitCenter} ${glY + 45}`} fill="none" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 2" />
      <path d={`M ${pitCenter + 30} ${glY + 10} L ${pitCenter + 30} ${glY + 45}`} fill="none" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 2" />

      {/* Groundwater Table Line */}
      <g
        onMouseEnter={() => setActiveHoverLayer("gwt")}
        onMouseLeave={() => setActiveHoverLayer(null)}
        className="cursor-pointer"
      >
        <line
          x1="20"
          y1={gwY}
          x2="600"
          y2={gwY}
          stroke="#0284c7"
          strokeWidth={activeHoverLayer === "gwt" ? "3" : "2"}
          strokeDasharray="8 4"
        />
        <text x="410" y={gwY - 8} fill="#0284c7" fontWeight="bold" paintOrder="stroke" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
          ▼ GROUNDWATER TABLE ({gwDepth}m bgl)
        </text>
      </g>

      {/* CAD DIMENSION LINES */}
      {/* 1. Depth Dimension (Left) */}
      <g>
        <line x1={pitLeft - (isCirc ? 30 : 40)} y1={glY} x2={pitLeft - (isCirc ? 30 : 40)} y2={pitBottomY} stroke="#000000" strokeWidth="1.5" />
        <line x1={pitLeft - (isCirc ? 36 : 46)} y1={glY} x2={pitLeft - (isCirc ? 24 : 34)} y2={glY} stroke="#000000" strokeWidth="1.5" />
        <line x1={pitLeft - (isCirc ? 36 : 46)} y1={pitBottomY} x2={pitLeft - (isCirc ? 24 : 34)} y2={pitBottomY} stroke="#000000" strokeWidth="1.5" />
        <text
          x={pitLeft - (isCirc ? 40 : 50)}
          y={glY + pitDepthPx / 2}
          textAnchor="middle"
          fill="#000000"
          fontWeight="bold"
          fontSize="9.5"
          paintOrder="stroke"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinejoin="round"
          transform={`rotate(-90, ${pitLeft - (isCirc ? 40 : 50)}, ${glY + pitDepthPx / 2})`}
        >
          DEPTH={depth}m
        </text>
      </g>

      {/* 2. Diameter / Width Dimension (Bottom) */}
      <g>
        <line x1={pitLeft} y1={pitBottomY + 25} x2={pitRight} y2={pitBottomY + 25} stroke="#000000" strokeWidth="1.5" />
        <line x1={pitLeft} y1={pitBottomY + 18} x2={pitLeft} y2={pitBottomY + 32} stroke="#000000" strokeWidth="1.5" />
        <line x1={pitRight} y1={pitBottomY + 18} x2={pitRight} y2={pitBottomY + 32} stroke="#000000" strokeWidth="1.5" />
        <text
          x={pitCenter}
          y={pitBottomY + 40}
          textAnchor="middle"
          fill="#000000"
          fontWeight="bold"
          paintOrder="stroke"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinejoin="round"
        >
          {isCirc ? `DIAMETER = ${diameter}m` : `WIDTH = ${width}m × LENGTH = ${length}m`}
        </text>
      </g>
    </svg>
  );
}
