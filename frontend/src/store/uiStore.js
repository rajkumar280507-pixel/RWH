import { create } from "zustand";
import { persist } from "zustand/middleware";

// Same key src/main.jsx reads synchronously (before React mounts) to apply
// the `dark` class to <html> without a flash-of-wrong-theme. zustand's
// `persist` middleware stores JSON shaped like `{state:{theme}, version}` —
// main.jsx parses that same shape, so keep them in sync if this ever changes.
export const THEME_STORAGE_KEY = "rwh-ui-theme";

function applyThemeClass(theme) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

export const useUiStore = create(
  persist(
    (set, get) => ({
      // Defaults to "dark" to match the app's existing look — only a manual
      // toggle should ever switch a user to light.
      theme: "dark",
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        applyThemeClass(next);
        set({ theme: next });
      },
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },

      commandPaletteOpen: false,
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
    }),
    {
      name: THEME_STORAGE_KEY,
      // Only theme needs to survive reloads; commandPaletteOpen is
      // transient UI state.
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        // Keep <html class="dark"> in sync with whatever theme was
        // rehydrated (main.jsx already set an initial guess pre-mount).
        if (state) applyThemeClass(state.theme);
      },
    }
  )
);
