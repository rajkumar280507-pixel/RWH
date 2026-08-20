/**
 * threeColorTokens.js — literal RGB copies of the Phase 0 design tokens
 * (`src/styles/index.css`) for use as Three.js `Color`/hex values.
 *
 * Three.js materials can't consume Tailwind classes or `rgb(var(--x))` CSS
 * custom properties, so the light/dark triplets are duplicated here. Keep in
 * sync with `src/styles/index.css` if those tokens ever change.
 *
 * Material-name -> color resolution reuses `resolveMaterialKey` from
 * `materialPatterns.jsx` (the same function the 2D CAD drawings use) so the
 * 3D filter-stack colors match the 2D drawing's material fills exactly,
 * instead of inventing a second material/color mapping.
 */
import { resolveMaterialKey } from "./materialPatterns.jsx";

const LIGHT = {
  ground: [146, 64, 14],
  topsoil: [192, 133, 82],
  clay: [120, 53, 15],
  sand: [217, 119, 6],
  gravel: [107, 114, 128],
  aggregate: [55, 65, 81],
  rock: [71, 85, 105],
  groundwater: [37, 99, 235],
  rechargeWater: [8, 145, 178],
  rainfall: [59, 130, 246],
  warning: [245, 158, 11],
  danger: [239, 68, 68],
  success: [16, 185, 129],
  info: [14, 165, 233],
};

const DARK = {
  ground: [180, 83, 9],
  topsoil: [214, 160, 109],
  clay: [146, 64, 14],
  sand: [251, 191, 36],
  gravel: [156, 163, 175],
  aggregate: [75, 85, 99],
  rock: [100, 116, 139],
  groundwater: [96, 165, 250],
  rechargeWater: [34, 211, 238],
  rainfall: [96, 165, 250],
  warning: [251, 191, 36],
  danger: [248, 113, 113],
  success: [52, 211, 153],
  info: [56, 189, 248],
};

const toHexInt = ([r, g, b]) => (r << 16) | (g << 8) | b;
const toCss = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

/** Returns a hex-int color (e.g. for a `color={0x...}` / material prop) for a named token. */
export function tokenColorHex(name, isDark = true) {
  const rgb = (isDark ? DARK : LIGHT)[name] ?? DARK.gravel;
  return toHexInt(rgb);
}

/** Returns a CSS `rgb(r, g, b)` string for a named token (for 2D overlay UI). */
export function tokenColorCss(name, isDark = true) {
  const rgb = (isDark ? DARK : LIGHT)[name] ?? DARK.gravel;
  return toCss(rgb);
}

// Maps the 7 pattern keys `resolveMaterialKey` can return onto the closest
// engineering-domain token so filter-stack meshes read the same material at
// a glance as the 2D drawing's pattern fill.
const MATERIAL_KEY_TO_TOKEN = {
  sand: "sand",
  gravel: "gravel",
  aggregate: "aggregate",
  rock: "rock",
  clay: "clay",
  water: "rechargeWater",
  concrete: "ground",
};

/** Resolves a backend `filter_media[].material` string to a hex-int color. */
export function materialColorHex(materialName, isDark = true) {
  const key = resolveMaterialKey(materialName);
  const token = (key && MATERIAL_KEY_TO_TOKEN[key]) || "gravel";
  return tokenColorHex(token, isDark);
}
