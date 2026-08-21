import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./styles/index.css";

// Apply the persisted theme (or the light default) to <html> synchronously,
// before React ever renders, so there's no flash of the wrong theme. This
// reads the same localStorage key that src/store/uiStore.js's zustand
// `persist` middleware writes to (JSON-shaped: {state:{theme}, version}) —
// keep the two in sync if the key or shape ever changes.
//
// Pass 2: default flipped from "dark" to "light" (light-first, matching
// enterprise engineering-software comparables — see the redesign plan).
// Existing users with an explicit persisted preference are unaffected;
// this only changes the fallback for no-preference/first-time visitors.
// uiStore.js's own `theme` initial state must stay in sync with this
// fallback, or zustand's rehydration will re-flip the class post-mount.
const THEME_STORAGE_KEY = "rwh-ui-theme";
function readPersistedTheme() {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return "light";
    const parsed = JSON.parse(raw);
    const theme = parsed?.state?.theme;
    return theme === "light" || theme === "dark" ? theme : "light";
  } catch {
    return "light";
  }
}
document.documentElement.classList.toggle("dark", readPersistedTheme() === "dark");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
