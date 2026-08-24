import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { getWeatherForecast } from "../../services/api.js";
import { deriveAlerts, ALERT_COLORS } from "../../lib/weatherInsights.js";

/** Threshold-based weather alert banner — derived from the forecast using
 * IMD's published rainfall/wind severity bands, but explicitly NOT presented
 * as an official IMD warning bulletin (we don't have access to that feed).
 * Renders nothing when there's nothing above threshold — silence is the
 * correct "all clear" state, not an empty placeholder. */
export default function WeatherAlert({ lat, lon }) {
  const q = useQuery({
    queryKey: ["weather-forecast", Math.round(lat * 100) / 100, Math.round(lon * 100) / 100],
    queryFn: () => getWeatherForecast(lat, lon),
    enabled: lat != null && lon != null,
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const alerts = deriveAlerts(q.data?.daily);
  if (!alerts.length) return null;

  const worst = alerts.reduce((a, b) => (["green", "yellow", "orange", "red"].indexOf(b.level) > ["green", "yellow", "orange", "red"].indexOf(a.level) ? b : a));
  const c = ALERT_COLORS[worst.level];

  return (
    <div className={`flex flex-col gap-1.5 rounded-xl border ${c.border} ${c.bg} p-3 text-xs ${c.text}`}>
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={14} />
        Weather Watch — forecast-threshold alert (not an official IMD bulletin)
      </div>
      {alerts.slice(0, 4).map((a, i) => (
        <div key={i} className="flex items-center justify-between gap-2 pl-5">
          <span>{a.label}</span>
          <span className="text-[10px] opacity-80">
            {new Date(a.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} · {a.detail}
          </span>
        </div>
      ))}
    </div>
  );
}
