import { useQuery } from "@tanstack/react-query";
import { CloudRain, Droplets } from "lucide-react";
import { getWeatherForecast } from "../../services/api.js";
import { WeatherIcon } from "./weatherIcons.jsx";
import Skeleton from "../ui/Skeleton.jsx";

const n = (v, d = 0) => (v == null ? "—" : Number(v).toFixed(d));

function dayLabel(dateStr, i) {
  if (i === 0) return "Today";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

/** 7-day forecast strip — one card per day, real numbers from the same
 * `getWeatherForecast` response the dashboard card uses. */
export default function WeatherForecastPanel({ lat, lon }) {
  const q = useQuery({
    queryKey: ["weather-forecast", Math.round(lat * 100) / 100, Math.round(lon * 100) / 100],
    queryFn: () => getWeatherForecast(lat, lon),
    enabled: lat != null && lon != null,
    staleTime: 30 * 60_000,
    retry: 1,
  });

  return (
    <div className="glass-panel rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <CloudRain size={14} className="text-info" />
        7-Day Forecast
      </h3>

      {q.isLoading ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : q.data?.unavailable || !q.data?.daily?.length ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Weather information temporarily unavailable.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {q.data.daily.map((d, i) => (
            <div
              key={d.date}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-surface/50 p-2 text-center transition hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-800"
            >
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{dayLabel(d.date, i)}</span>
              <WeatherIcon icon={d.icon} size={18} className="text-info" />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {n(d.temp_max_c)}° <span className="font-normal text-slate-500">{n(d.temp_min_c)}°</span>
              </span>
              <span className="flex items-center gap-0.5 text-[9px] text-sky-600 dark:text-sky-400">
                <Droplets size={9} /> {n(d.rain_probability_pct)}%
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400">{n(d.rainfall_mm, 1)}mm</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
