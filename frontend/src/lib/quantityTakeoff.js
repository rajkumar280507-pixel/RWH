/**
 * quantityTakeoff.js
 *
 * Pure, side-effect-free helpers that turn a backend `RwhDesignResponse`
 * (see backend/app/schemas/design.py, returned by POST /api/rwh/design) into
 * a normalized "takeoff" object for `components/cad/QuantityTakeoffPanel.jsx`.
 *
 * Every quantity here is read directly off the authoritative backend
 * response — nothing is recomputed client-side (excavation, filter media
 * volumes/weights, and cost all come straight from
 * `backend/app/services/rwh_design_engine.py` via the response fields).
 * That's a deliberate constraint: re-deriving these numbers in the frontend
 * is exactly the anti-pattern this redesign is retiring from the old
 * `InteractiveRechargePitDesigner.jsx`, which kept its own diverging
 * constants and could silently disagree with the real engine.
 *
 * If a field genuinely isn't present/derivable from `result`, the
 * corresponding takeoff value is `null` — the panel omits that tile rather
 * than showing a fabricated "0" or made-up figure.
 */

const toNum = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function isVolumeUnit(unit) {
  if (!unit) return false;
  const u = String(unit).toLowerCase().replace(/[\s.]/g, "");
  return ["m3", "cum", "cum3", "cu.m", "cumtr", "m³"].includes(u);
}

/** Sums volume_m3 / weight_kg across filter_media[] entries whose `material`
 * name matches `pattern` (case-insensitive). Returns nulls if there's no
 * matching layer, rather than assuming a fixed 3-layer sand/gravel/aggregate
 * stack — the engine's layer list is iterated as-is. */
function sumFilterLayer(filterMedia, pattern) {
  if (!Array.isArray(filterMedia)) return { volumeM3: null, weightKg: null };
  const matches = filterMedia.filter(
    (l) => l && typeof l.material === "string" && pattern.test(l.material)
  );
  if (matches.length === 0) return { volumeM3: null, weightKg: null };
  return {
    volumeM3: matches.reduce((s, l) => s + (toNum(l.volume_m3) ?? 0), 0),
    weightKg: matches.reduce((s, l) => s + (toNum(l.weight_kg) ?? 0), 0),
  };
}

/** Sums BOQ line-item quantities whose `item` name matches `pattern`, but
 * only if every matching line is actually quantified in cubic metres — a
 * count ("no.") or length ("m") line matching the same name pattern must
 * not be added into a volume total. Returns null if there are no matches or
 * the matches use mixed/non-volume units, instead of guessing. */
function sumBoqVolume(boq, pattern) {
  if (!Array.isArray(boq)) return null;
  const matches = boq.filter((b) => b && typeof b.item === "string" && pattern.test(b.item));
  if (matches.length === 0) return null;
  if (!matches.every((b) => isVolumeUnit(b.unit))) return null;
  return matches.reduce((s, b) => s + (toNum(b.quantity) ?? 0), 0);
}

/** Finds a single BOQ line matching `pattern` whose unit is metres ("m"),
 * and returns its quantity as a length. Used for the conveyance pipe run,
 * since RwhDesignResponse only exposes `conveyance_pipe_diameter_mm` (a
 * diameter) at the top level, not a length field. */
function findBoqLengthM(boq, pattern) {
  if (!Array.isArray(boq)) return null;
  const match = boq.find(
    (b) =>
      b &&
      typeof b.item === "string" &&
      pattern.test(b.item) &&
      typeof b.unit === "string" &&
      b.unit.trim().toLowerCase() === "m"
  );
  return match ? toNum(match.quantity) : null;
}

/**
 * Extracts a normalized takeoff object from a `RwhDesignResponse`. Returns
 * `null` if `result` isn't a usable object (e.g. no design generated yet).
 */
export function extractTakeoff(result) {
  if (!result || typeof result !== "object") return null;

  const sand = sumFilterLayer(result.filter_media, /sand/i);
  const gravel = sumFilterLayer(result.filter_media, /gravel/i);
  const aggregate = sumFilterLayer(result.filter_media, /aggregate|boulder/i);

  // As of the current engine (rwh_design_engine.py `build_boq`), there is no
  // dedicated concrete/PCC BOQ line item quantified in m3 — the only "RCC"
  // line ("RCC perforated cover slab over structure") is quantified in
  // "no." (a count), not a volume. Summing a count into a m3 figure would be
  // a fabrication, so this resolves to null until the engine emits a real
  // concrete-volume line; sumBoqVolume enforces that by requiring every
  // matched line to actually be unit "m3".
  const concreteM3 = sumBoqVolume(result.boq, /concrete|\bpcc\b|\brcc\b/i);

  // The BOQ line "uPVC collection main from downpipes to structure" (unit
  // "m") is the real conveyance-pipe run length paired with
  // `conveyance_pipe_diameter_mm`'s diameter — read from the actual
  // response rather than left unavailable, but still gracefully null if a
  // future engine revision renames/removes that line.
  const pipeLengthM = findBoqLengthM(result.boq, /collection main|conveyance/i);

  return {
    excavationM3: toNum(result.excavation_volume_m3),
    concreteM3,
    sandM3: sand.volumeM3,
    sandKg: sand.weightKg,
    gravelM3: gravel.volumeM3,
    gravelKg: gravel.weightKg,
    aggregateM3: aggregate.volumeM3,
    aggregateKg: aggregate.weightKg,
    pipeLengthM,
    pipeDiameterMm: toNum(result.conveyance_pipe_diameter_mm),
    totalCostInr: toNum(result.estimated_cost_inr),
    annualWaterSavedM3: toNum(result.annual_harvest_m3),
    co2SavingsKg: estimateCo2Savings(toNum(result.annual_harvest_m3)),
  };
}

/**
 * Estimated CO2 savings (kg/yr) from rainwater recharge/harvest displacing
 * grid-pumped groundwater abstraction + basic treatment/distribution.
 *
 * *** THIS IS A UI-LAYER ESTIMATE, NOT A BACKEND-COMPUTED OR CERTIFIED
 * FIGURE. *** The design engine does not compute or return any CO2 number —
 * this is new arithmetic added purely for illustrative dashboard context.
 *
 * Factor derivation (order-of-magnitude, not audited):
 *   ~0.6 kWh/m3     — indicative Indian municipal borewell pumping + basic
 *                      treatment/distribution energy intensity (CPHEEO
 *                      Manual on Water Supply & Treatment cites comparable
 *                      ranges for groundwater-sourced schemes; actual value
 *                      varies substantially with pumping head and scheme).
 *   ~0.82 kgCO2/kWh — Central Electricity Authority (CEA) CO2 Baseline
 *                      Database, all-India average grid emission factor.
 *   0.6 * 0.82 ≈ 0.5 kgCO2 per m3 (rounded)
 *
 * Any UI surfacing this number MUST label it "Estimated" — never present it
 * as a certified/auditable carbon-credit figure.
 */
const CO2_KG_PER_M3 = 0.5;

export function estimateCo2Savings(annualWaterSavedM3) {
  const v = toNum(annualWaterSavedM3);
  if (v == null) return null;
  return v * CO2_KG_PER_M3;
}
