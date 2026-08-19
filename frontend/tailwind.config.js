/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
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
      },
    },
  },
  plugins: [],
};
