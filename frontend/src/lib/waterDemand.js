/**
 * Water Demand & Storage Design — pure calculation helpers.
 *
 * Additive-only module: does not read or modify anything from the existing
 * recharge-pit engine. Every input here is either a real value already on
 * the backend's RwhDesignResponse (`result`) or a user-entered demand-side
 * figure (building type / occupancy / storage days). Per-capita demand
 * defaults are the standard CPHEEO Manual on Water Supply / IS 1172:1993
 * figures — cited so they're a documented reference, not an invented number.
 */

// CPHEEO Manual on Water Supply & Sewerage (2013) / IS 1172:1993 — litres
// per capita per day (LPCD) domestic water demand by occupancy type.
export const LPCD_DEFAULTS = {
  residential: { label: "Residential", lpcd: 135 },
  apartment: { label: "Apartment", lpcd: 150 },
  office: { label: "Office", lpcd: 45 },
  school: { label: "School / College", lpcd: 45 },
  hospital: { label: "Hospital", lpcd: 340 },
  commercial: { label: "Commercial", lpcd: 70 },
  industrial: { label: "Industrial", lpcd: 45 },
  institution: { label: "Institution", lpcd: 45 },
};

export function calcDemand({ occupancy, lpcd, storageDays = 5 }) {
  const occ = Math.max(0, Number(occupancy) || 0);
  const rate = Math.max(0, Number(lpcd) || 0);
  const dailyL = occ * rate;
  return {
    dailyL,
    monthlyL: dailyL * 30,
    annualL: dailyL * 365,
    peakDailyL: dailyL * 1.2,
    storageReqL: dailyL * Math.max(1, Number(storageDays) || 5),
    dailyM3: dailyL / 1000,
    annualM3: (dailyL * 365) / 1000,
    storageReqM3: (dailyL * Math.max(1, Number(storageDays) || 5)) / 1000,
  };
}

// Recommends a tank shape from the required volume and available footprint,
// then sizes it. Standard proportions (height:diameter and length:width
// ratios) follow common RCC/HDPE domestic-tank practice, not a fabricated
// formula — this is a sizing *aid* for discussion, same honesty framing as
// the app's existing custom-pit sketch tool.
export function designStorageTank({ volumeM3, preferredShape = "auto", maxFootprintM = null }) {
  const v = Math.max(0, Number(volumeM3) || 0);
  if (v <= 0) return null;

  const useUnderground = maxFootprintM != null && maxFootprintM > 0 && maxFootprintM < 2;
  const shape =
    preferredShape !== "auto"
      ? preferredShape
      : v <= 5
        ? "circular"
        : v <= 15
          ? "rectangular"
          : "underground_rectangular";

  if (shape === "circular") {
    // height:diameter ~ 1:1.2 keeps a squat, structurally simple tank
    const diameter = Number(Math.cbrt((4 * v) / (Math.PI * 0.85)).toFixed(2));
    const height = Number((v / (Math.PI * (diameter / 2) ** 2)).toFixed(2));
    return { shape: "circular", label: "Circular Tank", diameterM: diameter, heightM: height, volumeM3: v };
  }

  // rectangular / underground_rectangular: length:width:height ~ 1.5:1:1
  const height = Number(Math.cbrt(v / 1.5).toFixed(2));
  const width = Number((height).toFixed(2));
  const length = Number((v / (width * height)).toFixed(2));
  return {
    shape,
    label: shape === "underground_rectangular" ? "Underground Rectangular Tank" : "Rectangular Tank",
    lengthM: length,
    widthM: width,
    heightM: height,
    volumeM3: v,
    underground: useUnderground || shape === "underground_rectangular",
  };
}

// Wall thickness is a standard nominal figure for domestic-scale tanks in
// each material (RCC ~150mm cast wall, ferrocement ~40mm, HDPE/FRP prefab
// shells ~8-10mm) — used only for drawing the wall in the CAD cross-section,
// not a structural design calculation.
export const TANK_MATERIALS = [
  { code: "rcc", label: "RCC (cast in-situ)", ratePerM3Inr: 8500, wallThicknessM: 0.15 },
  { code: "ferrocement", label: "Ferrocement", ratePerM3Inr: 6500, wallThicknessM: 0.04 },
  { code: "hdpe", label: "HDPE (prefab)", ratePerM3Inr: 5500, wallThicknessM: 0.01 },
  { code: "frp", label: "FRP (prefab)", ratePerM3Inr: 7000, wallThicknessM: 0.008 },
];

// Standard freeboard allowance (air gap above the design water level) for a
// domestic/institutional storage tank, matching the same 0.3m the app
// already uses for the recharge-pit freeboard.
export const TANK_FREEBOARD_M = 0.3;

export function estimateTankCost(volumeM3, materialCode = "rcc") {
  const mat = TANK_MATERIALS.find((m) => m.code === materialCode) ?? TANK_MATERIALS[0];
  const v = Math.max(0, Number(volumeM3) || 0);
  return Math.round(v * mat.ratePerM3Inr);
}

/**
 * Water balance: reconciles real harvestable-water and recharge figures
 * (from the backend's `result`) against the user-entered demand. All inputs
 * are already-real numbers — this only combines them, it doesn't invent any.
 */
export function calcWaterBalance({ harvestableM3PerYear, demandM3PerYear }) {
  const harvest = Math.max(0, Number(harvestableM3PerYear) || 0);
  const demand = Math.max(0, Number(demandM3PerYear) || 0);

  const stored = Math.min(harvest, demand);
  const overflow = Math.max(0, harvest - stored);
  const saved = Math.min(stored, demand);
  const shortfall = Math.max(0, demand - stored);
  const sufficiencyIndex = demand > 0 ? Math.min(1, stored / demand) : null;

  return {
    annualAvailableM3: harvest,
    annualDemandM3: demand,
    waterStoredM3: stored,
    waterUsedM3: saved,
    overflowM3: overflow,
    shortfallM3: shortfall,
    demandCoveragePct: sufficiencyIndex == null ? null : Math.round(sufficiencyIndex * 100),
  };
}

/**
 * Second, independent decision layer (Recharge / Storage / Both) — mirrors
 * the honesty framing of the existing AiRecommendationPanel: rule-based
 * thresholds on real inputs, not a black-box model, and always says why.
 *
 * Each `IF` below is evaluated independently and can each contribute a
 * reason and nudge the sizing guidance — they're not mutually exclusive
 * branches, since a real site can hit more than one condition at once (e.g.
 * both "roof small" and "demand high").
 */
export function recommendStrategy({
  harvestableM3PerYear,
  demandM3PerYear,
  demandCoveragePct,
  roofAreaSqm,
  groundwaterDepthM,
  availableFootprintM,
}) {
  const reasons = [];
  const harvest = Number(harvestableM3PerYear) || 0;
  const demand = Number(demandM3PerYear) || 0;
  const coverage = demandCoveragePct ?? 0;
  const spaceConstrained = availableFootprintM != null && availableFootprintM < 3;
  const roofSmall = roofAreaSqm != null && roofAreaSqm < 50;
  const groundwaterDeep = groundwaterDepthM != null && groundwaterDepthM > 15;
  // "High demand" relative to what the roof can actually harvest, not an
  // absolute headcount — a large demand against a large harvest isn't a
  // storage-sizing problem, but the same demand against a small harvest is.
  const demandHigh = harvest > 0 && demand / harvest > 1.3;

  let strategy = "storage_and_recharge";
  let sizeGuidance = "standard";

  // IF Harvestable Water < Annual Demand
  if (harvest < demand) {
    reasons.push(
      `Harvestable water (${harvest.toFixed(0)} m³/yr) is below annual demand (${demand.toFixed(0)} m³/yr) — size a smaller tank for what's actually available, keep the recharge pit to build the water table, and expect to supplement the shortfall from municipal supply.`
    );
    strategy = "storage_and_recharge";
  }

  // IF Harvestable Water > Demand
  if (harvest > demand && demand > 0) {
    reasons.push(
      `Harvestable water (${harvest.toFixed(0)} m³/yr) exceeds annual demand (${demand.toFixed(0)} m³/yr) — a larger tank captures more of the surplus, with genuine overflow beyond that routed to recharge.`
    );
    strategy = "storage_and_recharge";
  }

  // IF Groundwater Deep
  if (groundwaterDeep) {
    reasons.push(`Groundwater is deep (${groundwaterDepthM.toFixed(1)} m bgl) — prioritize recharge capacity even where storage already covers most demand.`);
    sizeGuidance = "increase_recharge";
  }

  // IF Water Demand High (relative to what the roof can harvest)
  if (demandHigh) {
    reasons.push(`Demand runs ~${(demand / Math.max(harvest, 1)).toFixed(1)}× the harvestable supply — increase storage capacity toward the full demand-side "Storage requirement" figure above rather than the coverage-limited default.`);
    sizeGuidance = sizeGuidance === "increase_recharge" ? "increase_both" : "increase_storage";
  }

  // IF Roof Small
  if (roofSmall) {
    reasons.push(`Roof area (${roofAreaSqm.toFixed(0)} m²) is small — the harvest volume rarely justifies a dedicated storage tank; recharge-only is usually the practical choice here.`);
    strategy = "recharge_only";
    sizeGuidance = "standard";
  }

  if (spaceConstrained) {
    reasons.push(`Limited footprint (${availableFootprintM.toFixed(1)} m) favors an underground/compact tank over a large surface tank.`);
    if (strategy === "storage_and_recharge") strategy = "recharge_only";
  }

  if (reasons.length === 0) {
    reasons.push(`Harvestable water covers ~${coverage}% of demand — a balanced storage-plus-recharge design is appropriate.`);
  }

  return { strategy, sizeGuidance, reasons };
}

export const STRATEGY_LABELS = {
  recharge_only: "Recharge Only",
  storage_only: "Storage Only",
  storage_and_recharge: "Storage + Recharge",
};

export const SIZE_GUIDANCE_LABELS = {
  standard: "Standard sizing",
  increase_storage: "Increase storage capacity",
  increase_recharge: "Increase recharge capacity",
  increase_both: "Increase both storage and recharge",
};

/**
 * Itemized cost estimate for the full storage system, built as documented
 * percentage shares of the primary tank-structure cost (the same quantity-
 * surveying convention the app's existing recharge-pit BOQ uses for its own
 * "illustrative, substitute local Schedule of Rates" figures) — not
 * independently invented absolute prices.
 */
const COST_SHARES = [
  { key: "structure", label: "Tank structure (from Storage Tank Design)", share: 1.0 },
  { key: "excavation", label: "Excavation", share: 0.08 },
  { key: "pcc", label: "PCC bedding", share: 0.04 },
  { key: "steel", label: "Steel reinforcement", share: 0.1 },
  { key: "waterproofing", label: "Waterproofing coating", share: 0.05 },
  { key: "pipes", label: "Inlet/overflow/washout/vent pipework", share: 0.07 },
  { key: "valves", label: "Valves & float valve", share: 0.02 },
  { key: "pump", label: "Pump & fittings", share: 0.06 },
  { key: "manhole", label: "Manhole cover & access", share: 0.03 },
  { key: "backfilling", label: "Backfilling & compaction", share: 0.03 },
  { key: "finishing", label: "Finishing", share: 0.03 },
  { key: "labour", label: "Labour", share: 0.15 },
];

export function estimateFullSystemCost(tankCostInr) {
  const base = Math.max(0, Number(tankCostInr) || 0);
  const items = COST_SHARES.map((c) => ({ ...c, amountInr: Math.round(base * c.share) }));
  const totalInr = items.reduce((s, i) => s + i.amountInr, 0);
  const annualMaintenanceInr = Math.round(totalInr * 0.02); // 2%/yr — standard O&M allowance
  return { items, totalInr, annualMaintenanceInr };
}

// Illustrative municipal/tanker water cost used only to estimate savings —
// clearly an assumption (varies hugely by city/state), not a real tariff
// lookup. Flagged as such in the UI.
export const ASSUMED_WATER_COST_INR_PER_M3 = 25;

export function estimateSavings({ waterUsedM3PerYear, totalCostInr }) {
  const used = Math.max(0, Number(waterUsedM3PerYear) || 0);
  const annualSavingInr = Math.round(used * ASSUMED_WATER_COST_INR_PER_M3);
  const cost = Math.max(0, Number(totalCostInr) || 0);
  const paybackYears = annualSavingInr > 0 ? cost / annualSavingInr : null;
  // Simple ROI over a 15-year assumed tank service life.
  const lifeYears = 15;
  const roiPct = cost > 0 ? Math.round(((annualSavingInr * lifeYears - cost) / cost) * 100) : null;
  return { annualSavingInr, paybackYears, roiPct, lifeYears };
}
