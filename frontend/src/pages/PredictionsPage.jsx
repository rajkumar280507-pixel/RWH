import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import TimeSeriesChart from "../charts/TimeSeriesChart.jsx";
import StatCard from "../components/StatCard.jsx";
import { getGroundwaterTrends, getStationSeries } from "../services/api.js";

const CONFIDENCE_STYLES = {
  high: "text-emerald-400",
  moderate: "text-amber-300",
  low: "text-rose-400",
};

const TREND_STYLES = {
  falling: "text-rose-400",
  rising: "text-emerald-400",
  stable: "text-slate-400",
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
          color: "#2dd4bf",
          area: true,
          data: series.data.series.map((r) => [new Date(r.recorded_at).getTime(), r.water_level_m]),
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
      {trends.isLoading && <div className="text-sm text-slate-500">Fitting trends across stations…</div>}

      {summary && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Stations Analysed" value={summary.stations_analysed} />
            <StatCard label="Falling" value={summary.falling} tone="rose" />
            <StatCard label="Rising" value={summary.rising} />
            <StatCard label="Stable" value={summary.stable} tone="blue" />
            <StatCard label="High Confidence" value={summary.high_confidence} tone="amber" />
          </div>

          {trends.data?.limitation && (
            <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-200">
              <span className="font-semibold">⚠ Read this before using these numbers: </span>
              {trends.data.limitation}
            </div>
          )}

          <div className="mb-4 rounded-lg border border-slate-700 bg-panel/40 p-3 text-[11px] text-slate-400">
            {summary.excluded_note}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-panel/50 p-4">
              <h3 className="text-sm font-semibold text-slate-200">
                Stations ranked by rate of decline
              </h3>
              <p className="mb-2 text-[10px] text-slate-500">
                Depth below ground — a positive slope means the water table is getting deeper.
              </p>
              <div className="max-h-[460px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-panel text-slate-400">
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
                    {trends.data.trends.map((t) => (
                      <tr
                        key={t.station_id}
                        onClick={() => setSelectedId(t.station_id)}
                        className={`cursor-pointer border-t border-slate-800 hover:bg-slate-800/50 ${
                          selectedId === t.station_id ? "bg-accent/10" : ""
                        }`}
                      >
                        <td className="py-1 pr-2">{t.station_name || t.station_code}</td>
                        <td className="text-slate-400">{t.district}</td>
                        <td className="text-right">{t.slope_m_per_year.toFixed(2)}</td>
                        <td className={`text-right ${CONFIDENCE_STYLES[t.confidence]}`}>
                          {t.r_squared.toFixed(2)}
                        </td>
                        <td className="text-right text-slate-500">{t.sample_size}</td>
                        <td className={TREND_STYLES[t.trend]}>{t.trend}</td>
                      </tr>
                    ))}
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

            <div className="rounded-xl border border-slate-800 bg-panel/50 p-4">
              {series.data ? (
                <>
                  <h3 className="text-sm font-semibold text-slate-200">
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
                        className={TREND_STYLES[series.data.trend.trend]}
                      />
                    </div>
                  )}

                  {series.data.trend?.caveat && (
                    <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                      ⚠ {series.data.trend.caveat}
                    </div>
                  )}

                  {chartSeries.length > 0 && (
                    <TimeSeriesChart series={chartSeries} yLabel="m" height={260} />
                  )}
                </>
              ) : (
                <div className="text-xs text-slate-500">
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
  if (!observed.length) return [];
  const firstTs = new Date(observed[0].recorded_at).getTime();
  const lastTs = new Date(observed[observed.length - 1].recorded_at).getTime();
  const years = (lastTs - firstTs) / (365.25 * 24 * 3600 * 1000);
  const endValue = trend.latest_level_m;
  const startValue = endValue - trend.slope_m_per_year * years;
  return [
    [firstTs, Number(startValue.toFixed(3))],
    [lastTs, Number(endValue.toFixed(3))],
  ];
}

function Metric({ label, value, className = "" }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-surface/60 p-2">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className={`text-sm font-semibold text-slate-100 ${className}`}>{value}</div>
    </div>
  );
}
