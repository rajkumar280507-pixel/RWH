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
      // Pass 2: defaults to "light" (light-first, matching the enterprise
      // engineering-software comparables in the redesign plan) — must stay
      // in sync with src/main.jsx's `readPersistedTheme()` fallback, since
      // that function paints <html> before this store ever rehydrates; a
      // mismatched default here would cause the class to flip back right
      // after mount. Only a manual toggle (or an explicit persisted
      // preference) should ever switch a user to dark.
      theme: "light",
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

      // Desktop sidebar collapse state (icon-only rail vs full width).
      // Persisted the same way theme is, so the user's preference survives
      // reloads.
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: THEME_STORAGE_KEY,
      // theme and sidebarCollapsed survive reloads; commandPaletteOpen is
      // transient UI state.
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        // Keep <html class="dark"> in sync with whatever theme was
        // rehydrated (main.jsx already set an initial guess pre-mount).
        if (state) applyThemeClass(state.theme);
      },
    }
  )
);
