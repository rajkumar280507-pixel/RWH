import { useEffect, useRef, useState } from "react";

/**
 * Subscribes to the backend's /ws/live feed and keeps the most recent
 * sync-progress / sync-complete events, reconnecting with backoff on drop.
 */
export function useLiveSocket() {
  const [lastEvent, setLastEvent] = useState(null);
  const [connected, setConnected] = useState(false);
  const retryDelay = useRef(1000);

  useEffect(() => {
    let socket;
    let closedByUs = false;

    const connect = () => {
      // Same override as api.js: no dev proxy exists once this is statically
      // deployed, so fall back to VITE_API_URL for the WebSocket host too.
      const apiUrl = import.meta.env.VITE_API_URL;
      const wsUrl = apiUrl
        ? `${apiUrl.replace(/^http/, "ws")}/ws/live`
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/live`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setConnected(true);
        retryDelay.current = 1000;
      };
      socket.onmessage = (evt) => {
        try {
          setLastEvent(JSON.parse(evt.data));
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closedByUs) {
          setTimeout(connect, retryDelay.current);
          retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
        }
      };
      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      closedByUs = true;
      socket?.close();
    };
  }, []);

  return { lastEvent, connected };
}
