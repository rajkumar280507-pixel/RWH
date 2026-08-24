import { create } from "zustand";
import { persist } from "zustand/middleware";

// Pass 3: committed to a single professional light theme — no user-facing
// toggle. `theme` stays in the store (read-only from the UI's perspective)
// purely because components like RechargeStructureScene.jsx check it to
// pick light-appropriate 3D lighting/background; it can never become
// anything but "light" now, so that check is effectively a no-op that's
// safe to leave rather than thread a boolean through every call site.
export const useUiStore = create(
  persist(
    (set) => ({
      theme: "light",

      commandPaletteOpen: false,
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

      // Desktop sidebar collapse state (icon-only rail vs full width).
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: "rwh-ui-theme",
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
