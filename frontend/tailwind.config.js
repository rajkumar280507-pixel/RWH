/** @type {import('tailwindcss').Config} */

// Helper: build a Tailwind color entry backed by an RGB-triplet CSS custom
// property, so opacity modifiers (bg-sand/50 etc.) keep working. The CSS
// vars themselves are defined in src/styles/index.css and flipped by the
// `.dark` class on <html>.
function withOpacity(varName) {
  return `rgb(var(${varName}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- Brand tokens (Pass 2 — Engineering Blue) ---
        // Fixed hex, not CSS-var-driven: these are the app's primary
        // interactive color (buttons/active-nav/focus/links) and should
        // stay constant across the light/dark toggle, matching the fixed
        // dark-navy sidebar decision below.
        brand: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: "#3B82F6",
        },
        brandCyan: "#06B6D4",

        // --- Legacy tokens (kept as-is; still referenced across the app) ---
        // `DEFAULT` is now CSS-var-driven (see src/styles/index.css) so
        // `bg-surface`/`bg-panel` actually respond to the light/dark toggle
        // instead of always resolving to the old hardcoded dark hex — the
        // `light` sub-keys below are kept for backward compatibility but
        // were never referenced anywhere in the app (verified via grep), so
        // this is the real fix for "does the background follow the theme".
        surface: {
          DEFAULT: withOpacity("--color-surface"),
          light: "#ffffff",
        },
        panel: {
          DEFAULT: withOpacity("--color-panel"),
          light: "#f4f6fb",
        },
        accent: {
          DEFAULT: "#2dd4bf",
          blue: "#3b82f6",
        },

        // --- Engineering-domain palette (CSS-variable driven, theme-aware) ---
        ground: withOpacity("--color-ground"),
        topsoil: withOpacity("--color-topsoil"),
        clay: withOpacity("--color-clay"),
        sand: withOpacity("--color-sand"),
        gravel: withOpacity("--color-gravel"),
        aggregate: withOpacity("--color-aggregate"),
        rock: withOpacity("--color-rock"),
        groundwater: withOpacity("--color-groundwater"),
        rechargeWater: withOpacity("--color-recharge-water"),
        rainfall: {
          light: withOpacity("--color-rainfall-light"),
          DEFAULT: withOpacity("--color-rainfall"),
          dark: withOpacity("--color-rainfall-dark"),
        },

        // --- Semantic status colors ---
        warning: withOpacity("--color-warning"),
        danger: withOpacity("--color-danger"),
        success: withOpacity("--color-success"),
        info: withOpacity("--color-info"),
      },
      backdropBlur: {
        glass: "16px",
      },
      fontFamily: {
        sans: ["Inter", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
