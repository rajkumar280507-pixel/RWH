import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, TrendingDown, TrendingUp, Minus, ShieldCheck, AlertTriangle, MapPin } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import TimeSeriesChart from "../charts/TimeSeriesChart.jsx";
import StatCard from "../components/StatCard.jsx";
import { getGroundwaterTrends, getStationSeries } from "../services/api.js";

const CONFIDENCE_STYLES = {
  high: "text-success",
  moderate: "text-warning",
  low: "text-danger",
};

const TREND_BADGE = {
  falling: { icon: TrendingDown, className: "border-danger/30 bg-danger/10 text-danger" },
  rising: { icon: TrendingUp, className: "border-success/30 bg-success/10 text-success" },
  stable: { icon: Minus, className: "border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400" },
};

export default function PredictionsPage() {
  const [selectedId, setSelectedId] = useState(null);

  const trends = useQuery({ queryKey: ["gw-trends"], queryFn: () => getGroundwaterTrends() });
  const series = useQuery({
    queryKey: ["station-series", selectedId],
    queryFn: () => getStationSeries(selectedId),
    enabled: !!selectedId,
  });

  const summary = trends.data?.summary;

  const chartSeries = series.data?.series?.length
    ? [
        {
          name: "Observed level",
          color: "#0ea5e9",
          area: true,
          data: series.data.series.map((r) => [new Date(r.recorded_at).getTime(), Math.abs(r.water_level_m)]),
        },
        ...(series.data.trend
          ? [
              {
                name: "Fitted trend",
                color: "#f59e0b",
                dashed: true,
                width: 2,
                data: buildTrendLine(series.data.series, series.data.trend),
              },
            ]
          : []),
      ]
    : [];

  return (
    <DashboardLayout
      title="Groundwater Trend Analysis"
      subtitle={
        trends.data?.method ??
        "Least-squares regression over each station's synced CGWB reading history."
      }
    >
      {trends.isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Activity size={14} className="animate-pulse text-accent" />
          Fitting trends across stations…
        </div>
      )}

      {summary && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard icon={<Activity size={13} />} label="Stations Analysed" value={summary.stations_analysed} tone="accent" />
            <StatCard icon={<TrendingDown size={13} />} label="Falling" value={summary.falling} tone="danger" />
            <StatCard icon={<TrendingUp size={13} />} label="Rising" value={summary.rising} tone="success" />
            <StatCard icon={<Minus size={13} />} label="Stable" value={summary.stable} tone="info" />
            <StatCard icon={<ShieldCheck size={13} />} label="High Confidence" value={summary.high_confidence} tone="warning" />
          </div>

          {trends.data?.limitation && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[11px] text-warning">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">Read this before using these numbers: </span>
                {trends.data.limitation}
              </span>
            </div>
          )}

          <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-panel/40 p-3 text-[11px] text-slate-500 dark:text-slate-400">
            {summary.excluded_note}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Stations ranked by rate of decline
              </h3>
              <p className="mb-2 text-[10px] text-slate-500">
                Depth below ground — a positive slope means the water table is getting deeper.
              </p>
              <div className="max-h-[460px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-panel text-slate-500 dark:text-slate-400">
                    <tr className="text-left">
                      <th className="py-1">Station</th>
                      <th>District</th>
                      <th className="text-right">m/yr</th>
                      <th className="text-right">R²</th>
                      <th className="text-right">n</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.data.trends.map((t) => {
                      const badge = TREND_BADGE[t.trend];
                      return (
                        <tr
                          key={t.station_id}
                          onClick={() => setSelectedId(t.station_id)}
                          className={`cursor-pointer border-t border-slate-200 dark:border-slate-800 transition hover:bg-slate-100 dark:hover:bg-slate-800/50 ${
                            selectedId === t.station_id ? "bg-accent/10" : ""
                          }`}
                        >
                          <td className="py-1.5 pr-2 font-medium text-slate-800 dark:text-slate-200">
                            {t.station_name || t.station_code}
                          </td>
                          <td className="text-slate-400">{t.district}</td>
                          <td className="text-right tabular-nums">{t.slope_m_per_year.toFixed(2)}</td>
                          <td className={`text-right tabular-nums ${CONFIDENCE_STYLES[t.confidence]}`}>
                            {t.r_squared.toFixed(2)}
                          </td>
                          <td className="text-right tabular-nums text-slate-500">{t.sample_size}</td>
                          <td className="py-1">
                            {badge && (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${badge.className}`}>
                                <badge.icon size={10} />
                                {t.trend}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {trends.data.trends.length === 0 && (
                  <div className="py-4 text-xs text-slate-500">
                    No station yet has enough history to fit a trend. This fills in as the hourly
                    sync accumulates readings.
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              {series.data ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <MapPin size={13} className="text-accent" />
                    {series.data.station.station_name || series.data.station.station_code}
                  </h3>
                  <div className="mb-2 text-[11px] text-slate-500">{series.data.station.district}</div>

                  {series.data.trend && (
                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                      <Metric label="Slope" value={`${series.data.trend.slope_m_per_year} m/yr`} />
                      <Metric label="R²" value={series.data.trend.r_squared} />
                      <Metric label="Readings" value={series.data.trend.sample_size} />
                      <Metric label="Span" value={`${series.data.trend.days_span} d`} />
                      <Metric label="Latest" value={`${series.data.trend.latest_level_m} m`} />
                      <Metric
                        label="Projected +1yr"
                        value={`${series.data.trend.projected_level_1y_m} m`}
                      />
                      <Metric
                        label="Confidence"
                        value={series.data.trend.confidence}
                        className={CONFIDENCE_STYLES[series.data.trend.confidence]}
                      />
                      <Metric
                        label="Trend"
                        value={series.data.trend.trend}
                        className={TREND_BADGE[series.data.trend.trend]?.className.match(/text-\S+/)?.[0]}
                      />
                    </div>
                  )}

                  {series.data.trend?.caveat && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {series.data.trend.caveat}
                    </div>
                  )}

                  {chartSeries.length > 0 && (
                    <TimeSeriesChart series={chartSeries} yLabel="m" height={260} />
                  )}
                </motion.div>
              ) : (
                <div className="flex h-full min-h-[200px] items-center justify-center text-center text-xs text-slate-500">
                  Select a station from the table to see its observed series and fitted trend.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

/** Renders the fitted regression as two endpoints — the API returns the slope
 * and latest value, so the line is reconstructed from the observed span. */
function buildTrendLine(observed, trend) {
  if (!observed || !observed.length) return [];
  // Defensive sort: the backend's /station/{id}/series currently orders
  // ASC, but this function shouldn't silently draw the line backwards if
  // that ever changes (or another caller passes unsorted data) — chronology
  // is enforced here rather than assumed from array order.
  const sorted = [...observed].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const firstTs = new Date(sorted[0].recorded_at).getTime();
  const lastTs = new Date(sorted[sorted.length - 1].recorded_at).getTime();
  const years = (lastTs - firstTs) / (365.25 * 24 * 3600 * 1000);
  if (years <= 0) return [];
  const endValue = trend.latest_level_m;
  const startValue = endValue - trend.slope_m_per_year * years;
  return [
    [firstTs, Number(startValue.toFixed(3))],
    [lastTs, Number(endValue.toFixed(3))],
  ];
}

function Metric({ label, value, className = "" }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-surface/60 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100 ${className}`}>{value}</div>
    </div>
  );
}
