import { useQuery } from "@tanstack/react-query";
import { Droplets, Wind, RefreshCw } from "lucide-react";
import { getWeatherForecast } from "../../services/api.js";
import { WeatherIcon } from "./weatherIcons.jsx";
import Skeleton from "../ui/Skeleton.jsx";

const n = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));

/**
 * Dashboard "Weather Forecast" card — current conditions for a location
 * already chosen elsewhere (never prompts for one). Independent React Query
 * key/cache from every other dashboard query, so a weather failure can't
 * invalidate or block anything else on the page.
 */
export default function WeatherForecastCard({ lat, lon, locationName }) {
  const q = useQuery({
    queryKey: ["weather-forecast", Math.round(lat * 100) / 100, Math.round(lon * 100) / 100],
    queryFn: () => getWeatherForecast(lat, lon),
    enabled: lat != null && lon != null,
    staleTime: 30 * 60_000, // matches backend cache window
    retry: 1,
  });

  return (
    <div className="glass-panel relative overflow-hidden rounded-xl p-2.5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-1 text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
        <span className="truncate" title={locationName || "Weather"}>
          Weather {locationName ? `· ${locationName}` : ""}
        </span>
        {q.data?.current?.icon && (
          <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-500 text-[10px]">
            <WeatherIcon icon={q.data.current.icon} size={13} />
          </span>
        )}
      </div>

      {q.isLoading ? (
        <div className="mt-1 flex flex-col gap-1">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : q.data?.unavailable ? (
        <p className="mt-1 text-xs text-slate-400">Unavailable</p>
      ) : q.data?.current ? (
        <div className="flex flex-col gap-0.5 mt-0.5">
          <div className="flex items-baseline gap-1 truncate text-lg font-bold leading-none text-slate-900 dark:text-slate-50 sm:text-xl">
            <span>{n(q.data.current.temperature_c, 1)}°C</span>
            <span className="text-xs font-semibold text-slate-400">
              feels {n(q.data.current.feels_like_c, 0)}°
            </span>
          </div>
          <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 truncate">
            {q.data.current.weather_label}
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 pt-0.5">
            <span className="flex items-center gap-1">
              <Droplets size={10} className="text-sky-500" /> {n(q.data.current.humidity_pct, 0)}%
            </span>
            <span className="flex items-center gap-1">
              <Wind size={10} className="text-slate-400" /> {n(q.data.current.wind_speed_kmh, 0)} km/h
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
