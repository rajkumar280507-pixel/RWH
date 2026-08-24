import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { getWeatherForecast } from "../../services/api.js";
import { deriveEngineeringInsight } from "../../lib/weatherInsights.js";
import Skeleton from "../ui/Skeleton.jsx";

const TONE_CLASS = {
  info: "border-info/30 bg-info/10 text-info",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

/** AI Weather Insight card — informational guidance only, derived from the
 * forecast and (optionally) a generated design's real catchment/runoff
 * figures. Never writes back to or recalculates the recharge/storage
 * design itself. `designContext` is optional — omit it (e.g. on the
 * dashboard, with no design generated yet) and the insight still works,
 * just without the roof-specific inflow-volume estimate. */
export default function WeatherInsights({ lat, lon, designContext }) {
  const q = useQuery({
    queryKey: ["weather-forecast", Math.round(lat * 100) / 100, Math.round(lon * 100) / 100],
    queryFn: () => getWeatherForecast(lat, lon),
    enabled: lat != null && lon != null,
    staleTime: 30 * 60_000,
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (!q.data?.daily?.length) return null;

  const insight = deriveEngineeringInsight({
    daily: q.data.daily,
    catchmentAreaSqm: designContext?.catchmentAreaSqm ?? null,
    runoffCoefficient: designContext?.runoffCoefficient ?? null,
  });

  return (
    <div className={`flex gap-2.5 rounded-xl border p-3 text-xs ${TONE_CLASS[insight.tone]}`}>
      <Lightbulb size={16} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold">{insight.headline}</div>
        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{insight.detail}</p>
        <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          Guidance derived from the weather forecast — does not modify the recharge or storage design's own
          calculations.
        </p>
      </div>
    </div>
  );
}
