/**
 * materialPatterns.jsx — SVG `<pattern>` texture definitions for the 7
 * engineering material fills used across the 2D CAD drawings (and reused by
 * the Phase 5 3D scene's flat-shaded material colors for visual consistency).
 *
 * Colors are pulled from the Phase 0 design tokens (`--color-*` CSS custom
 * properties defined in `src/styles/index.css`) via `rgb(var(--color-x))`,
 * so patterns stay correct across the light/dark theme toggle without any
 * extra wiring here.
 *
 * Usage:
 *   <svg>
 *     <defs><MaterialPatternDefs /></defs>
 *     <rect fill={materialFill("Coarse sand")} ... />
 *   </svg>
 */

const PATTERN_IDS = {
  sand: "pattern-sand",
  gravel: "pattern-gravel",
  aggregate: "pattern-aggregate",
  rock: "pattern-rock",
  clay: "pattern-clay",
  water: "pattern-water",
  concrete: "pattern-concrete",
};

// Backend material strings (see FILTER_MEDIA_STACK in
// backend/app/services/rwh_design_engine.py: "Coarse sand", "Graded gravel",
// "Coarse aggregate / boulders") plus a few extra synonyms so this keeps
// working if the engine's wording drifts slightly. Matched case-insensitively.
const MATERIAL_KEYWORDS = [
  [/sand/i, "sand"],
  [/gravel/i, "gravel"],
  [/aggregate|boulder/i, "aggregate"],
  [/rock|stone|hardcore/i, "rock"],
  [/clay/i, "clay"],
  [/water/i, "water"],
  [/concrete|rcc|brick|masonry/i, "concrete"],
];

/**
 * Maps a backend `filter_media[].material` string (or any material label
 * used elsewhere in the drawings, e.g. "Native ground") to one of the 7
 * known pattern keys. Returns null if nothing matches.
 */
export function resolveMaterialKey(materialName) {
  if (!materialName) return null;
  for (const [re, key] of MATERIAL_KEYWORDS) {
    if (re.test(materialName)) return key;
  }
  return null;
}

const FALLBACK_FILL = "rgb(var(--color-gravel))";

/**
 * Returns a `fill` attribute value for a material name: `url(#pattern-x)`
 * for the 7 known materials, a sensible flat token color fallback otherwise.
 */
export function materialFill(materialName) {
  const key = resolveMaterialKey(materialName);
  if (key && PATTERN_IDS[key]) return `url(#${PATTERN_IDS[key]})`;
  return FALLBACK_FILL;
}

export function patternIdFor(materialName) {
  const key = resolveMaterialKey(materialName);
  return key ? PATTERN_IDS[key] : null;
}

/**
 * Renders all 7 `<pattern>` definitions once. Mount inside a `<defs>` block
 * near the top of each drawing's SVG.
 */
export default function MaterialPatternDefs() {
  return (
    <>
      {/* SAND — fine dot grid */}
      <pattern id={PATTERN_IDS.sand} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="rgb(var(--color-sand) / 0.12)" />
        <circle cx="1.5" cy="1.5" r="0.7" fill="rgb(var(--color-sand))" />
        <circle cx="4.5" cy="4" r="0.6" fill="rgb(var(--color-sand))" />
        <circle cx="4" cy="1" r="0.5" fill="rgb(var(--color-sand))" />
      </pattern>

      {/* GRAVEL — small scattered circles, larger + more irregular than sand */}
      <pattern id={PATTERN_IDS.gravel} width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="rgb(var(--color-gravel) / 0.10)" />
        <circle cx="3" cy="3" r="1.8" fill="rgb(var(--color-gravel))" />
        <circle cx="10" cy="5" r="1.3" fill="rgb(var(--color-gravel))" />
        <circle cx="6" cy="10" r="1.6" fill="rgb(var(--color-gravel))" />
        <circle cx="12" cy="12" r="1.1" fill="rgb(var(--color-gravel))" />
      </pattern>

      {/* AGGREGATE — larger irregular rounded stone shapes */}
      <pattern id={PATTERN_IDS.aggregate} width="26" height="26" patternUnits="userSpaceOnUse">
        <rect width="26" height="26" fill="rgb(var(--color-aggregate) / 0.12)" />
        <path d="M4 6 L9 3 L13 6 L11 11 L5 11 Z" fill="rgb(var(--color-aggregate))" />
        <path d="M17 14 L23 12 L25 18 L20 22 L15 19 Z" fill="rgb(var(--color-aggregate))" />
        <path d="M2 18 L7 16 L9 22 L4 25 Z" fill="rgb(var(--color-aggregate))" />
      </pattern>

      {/* ROCK — angular fractured polygon hatch (outline only, no fill) */}
      <pattern id={PATTERN_IDS.rock} width="30" height="30" patternUnits="userSpaceOnUse">
        <rect width="30" height="30" fill="rgb(var(--color-rock) / 0.10)" />
        <path
          d="M2 4 L11 1 L16 8 L10 14 L2 12 Z M18 2 L28 5 L26 13 L19 11 Z M4 16 L14 18 L11 27 L3 25 Z M18 16 L28 18 L27 28 L17 26 Z"
          fill="none"
          stroke="rgb(var(--color-rock))"
          strokeWidth="1"
        />
      </pattern>

      {/* CLAY — evenly spaced horizontal hatch lines */}
      <pattern id={PATTERN_IDS.clay} width="10" height="8" patternUnits="userSpaceOnUse">
        <rect width="10" height="8" fill="rgb(var(--color-clay) / 0.14)" />
        <line x1="0" y1="2" x2="10" y2="2" stroke="rgb(var(--color-clay))" strokeWidth="1.1" />
        <line x1="0" y1="6" x2="10" y2="6" stroke="rgb(var(--color-clay))" strokeWidth="1.1" />
      </pattern>

      {/* WATER — repeating sine-wave rows, cubic-bezier approximation */}
      <pattern id={PATTERN_IDS.water} width="20" height="12" patternUnits="userSpaceOnUse">
        <rect width="20" height="12" fill="rgb(var(--color-recharge-water) / 0.18)" />
        <path
          d="M0 4 C 5 0, 5 8, 10 4 C 15 0, 15 8, 20 4"
          fill="none"
          stroke="rgb(var(--color-recharge-water))"
          strokeWidth="1.2"
        />
        <path
          d="M0 10 C 5 6, 5 14, 10 10 C 15 6, 15 14, 20 10"
          fill="none"
          stroke="rgb(var(--color-recharge-water))"
          strokeWidth="1"
          opacity="0.6"
        />
      </pattern>

      {/* CONCRETE — standard 45-degree engineering hatch */}
      <pattern id={PATTERN_IDS.concrete} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="rgb(var(--color-ground) / 0.10)" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(var(--color-ground))" strokeWidth="1.4" />
      </pattern>
    </>
  );
}
