import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // 127.0.0.1 rather than "localhost": Node resolves localhost to ::1 first,
    // but uvicorn binds IPv4 only, which silently breaks the WebSocket upgrade.
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            if (err.code === "ECONNRESET" || err.code === "ECONNREFUSED") return;
            console.error("Vite WS proxy error:", err);
          });
          proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
            const originalEmit = socket.emit;
            socket.emit = function (event, ...args) {
              if (event === "error") {
                const err = args[0];
                if (err && (err.code === "ECONNRESET" || err.code === "ECONNREFUSED")) {
                  return false;
                }
              }
              return originalEmit.apply(this, [event, ...args]);
            };
          });
        },
      },
      // Phase 7: generated PDF reports + QR codes are served by the backend's
      // /static mount (backend/static/reports/), outside the /api prefix.
      "/static": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
