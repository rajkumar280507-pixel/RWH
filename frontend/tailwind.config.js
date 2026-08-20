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
        // --- Legacy tokens (kept as-is; still referenced across the app) ---
        surface: {
          DEFAULT: "#0b1220",
          light: "#ffffff",
        },
        panel: {
          DEFAULT: "#111a2e",
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
    },
  },
  plugins: [],
};
