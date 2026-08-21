/**
 * customPitQuantities.js — pure geometry helpers for the user-custom pit
 * sketch tool (circular or rectangular recharge pit with user-entered
 * dimensions, independent of any backend design).
 *
 * These are basic mensuration formulas only (footprint area, excavation
 * volume, per-layer filter volume from the standard IS 15797 thickness
 * split). They are NOT a re-implementation of the backend design engine —
 * there is no runoff/recharge-capacity/BOQ computation here, only "how big
 * is the hole the user just sketched." Every consumer of this module labels
 * its output as indicative, not an engineered design.
 */

export const CUSTOM_PIT_LIMITS = {
  diameterM: { min: 0.3, max: 6, step: 0.05 },
  lengthM: { min: 0.3, max: 8, step: 0.05 },
  widthM: { min: 0.3, max: 8, step: 0.05 },
  depthM: { min: 0.3, max: 8, step: 0.05 },
  freeboardM: { min: 0, max: 1, step: 0.05 },
};

export function defaultCustomPit(shape = "circular") {
  return shape === "rectangular"
    ? { shape: "rectangular", lengthM: 2, widthM: 1.5, depthM: 2.5, freeboardM: 0.3 }
    : { shape: "circular", diameterM: 1.5, depthM: 2.5, freeboardM: 0.3 };
}

export function clampCustomPit(pit) {
  const clamp = (v, key) => {
    const { min, max } = CUSTOM_PIT_LIMITS[key];
    const num = Number(v);
    if (Number.isNaN(num)) return min;
    return Math.min(max, Math.max(min, num));
  };
  if (pit.shape === "rectangular") {
    return {
      shape: "rectangular",
      lengthM: clamp(pit.lengthM, "lengthM"),
      widthM: clamp(pit.widthM, "widthM"),
      depthM: clamp(pit.depthM, "depthM"),
      freeboardM: clamp(pit.freeboardM, "freeboardM"),
    };
  }
  return {
    shape: "circular",
    diameterM: clamp(pit.diameterM, "diameterM"),
    depthM: clamp(pit.depthM, "depthM"),
    freeboardM: clamp(pit.freeboardM, "freeboardM"),
  };
}

/**
 * The same three-layer filter stack the backend design engine uses
 * (backend/app/services/rwh_design_engine.py FILTER_MEDIA_STACK), kept in
 * sync by hand since there is no API endpoint that returns just the layer
 * recipe independent of a full design computation. Used as the fallback
 * when no backend `result.filter_media` is available to reuse.
 */
export const STANDARD_FILTER_STACK = [
  { layer_order: 1, material: "Coarse sand", thickness_fraction: 0.25, particle_size_note: "1.5-2.0 mm", porosity: 0.35 },
  { layer_order: 2, material: "Graded gravel", thickness_fraction: 0.25, particle_size_note: "5-10 mm", porosity: 0.4 },
  { layer_order: 3, material: "Coarse aggregate / boulders", thickness_fraction: 0.5, particle_size_note: "50-200 mm, clean and durable", porosity: 0.45 },
];

/** Footprint area, excavation volume, and per-layer filter volumes for a user-sketched pit. Indicative only. */
export function computeCustomPitQuantities(pit, filterStack = STANDARD_FILTER_STACK) {
  const p = clampCustomPit(pit);
  const footprintAreaM2 =
    p.shape === "rectangular" ? p.lengthM * p.widthM : (Math.PI / 4) * p.diameterM ** 2;
  const totalDepthM = p.depthM + p.freeboardM;
  const excavationVolumeM3 = footprintAreaM2 * totalDepthM;
  const layers = filterStack.map((l) => ({
    ...l,
    volumeM3: Math.round(footprintAreaM2 * p.depthM * l.thickness_fraction * 1000) / 1000,
  }));
  return {
    footprintAreaM2: Math.round(footprintAreaM2 * 100) / 100,
    excavationVolumeM3: Math.round(excavationVolumeM3 * 100) / 100,
    layers,
  };
}
