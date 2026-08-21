import { useEffect, useState } from "react";

/**
 * Ticking wall-clock string for the top bar, updated once a second.
 * Purely presentational — no backend dependency.
 */
export function useClock(locale = undefined) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const date = now.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });

  return { now, time, date };
}

export default useClock;
