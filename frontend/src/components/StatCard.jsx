import { useMemo } from "react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Skeleton from "./ui/Skeleton.jsx";
import { useCountUp } from "../hooks/useCountUp.js";

// Original tone map, kept intact for backward compatibility, extended with
// the Phase 0 semantic/engineering tokens. `hex` is a literal color (not a
// Tailwind class) for the echarts sparkline, which can't consume CSS vars
// through Tailwind's opacity-modifier pattern.
const TONES = {
  accent: { border: "border-accent/30", text: "text-accent", glow: "bg-accent/5", hex: "#2dd4bf" },
  blue: { border: "border-accent-blue/30", text: "text-accent-blue", glow: "bg-accent-blue/5", hex: "#3b82f6" },
  amber: { border: "border-amber-400/30", text: "text-amber-300", glow: "bg-amber-400/5", hex: "#fbbf24" },
  rose: { border: "border-rose-400/30", text: "text-rose-300", glow: "bg-rose-400/5", hex: "#f87171" },
  purple: { border: "border-purple-400/30", text: "text-purple-300", glow: "bg-purple-400/5", hex: "#c084fc" },
  slate: { border: "border-slate-700", text: "text-slate-300", glow: "bg-slate-500/5", hex: "#94a3b8" },
  // Phase 0 semantic + engineering-domain tokens
  success: { border: "border-success/30", text: "text-success", glow: "bg-success/5", hex: "#34d399" },
  warning: { border: "border-warning/30", text: "text-warning", glow: "bg-warning/5", hex: "#fbbf24" },
  danger: { border: "border-danger/30", text: "text-danger", glow: "bg-danger/5", hex: "#f87171" },
  info: { border: "border-info/30", text: "text-info", glow: "bg-info/5", hex: "#38bdf8" },
  groundwater: { border: "border-groundwater/30", text: "text-groundwater", glow: "bg-groundwater/5", hex: "#60a5fa" },
  rainfall: { border: "border-rainfall/30", text: "text-rainfall", glow: "bg-rainfall/5", hex: "#60a5fa" },
  rechargeWater: { border: "border-rechargeWater/30", text: "text-rechargeWater", glow: "bg-rechargeWater/5", hex: "#22d3ee" },
};

const STATUS_DOT = {
  normal: "bg-success",
  warning: "bg-warning",
  critical: "bg-danger",
};

const TREND_STYLES = {
  up: { icon: TrendingUp, className: "border-success/30 bg-success/10 text-success" },
  down: { icon: TrendingDown, className: "border-danger/30 bg-danger/10 text-danger" },
  flat: { icon: Minus, className: "border-slate-500/30 bg-slate-500/10 text-slate-400" },
};

function relativeTimeFrom(ts) {
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

// Accepts either a raw timestamp (number epoch-ms or Date / ISO string) and
// formats it as "Updated Xm ago", or an already-formatted string which is
// passed through unchanged.
function resolveLastUpdated(lastUpdated) {
  if (lastUpdated == null) return null;
  if (typeof lastUpdated === "number" && Number.isFinite(lastUpdated)) {
    return `Updated ${relativeTimeFrom(lastUpdated)}`;
  }
  if (lastUpdated instanceof Date) {
    return `Updated ${relativeTimeFrom(lastUpdated.getTime())}`;
  }
  if (typeof lastUpdated === "string") {
    const parsed = Date.parse(lastUpdated);
    if (!Number.isNaN(parsed) && /^\d{4}-\d{2}-\d{2}/.test(lastUpdated)) {
      return `Updated ${relativeTimeFrom(parsed)}`;
    }
    return lastUpdated;
  }
  return null;
}

function AnimatedValue({ value, decimals }) {
  const animated = useCountUp(value, { decimals });
  return (
    <>
      {animated.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  );
}

function Sparkline({ data, hex }) {
  const option = useMemo(
    () => ({
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: { type: "category", show: false, data: data.map((_, i) => i), boundaryGap: false },
      yAxis: { type: "value", show: false, min: "dataMin", max: "dataMax" },
      series: [
        {
          type: "line",
          data,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 1.5, color: hex },
          areaStyle: { color: hex, opacity: 0.12 },
        },
      ],
      tooltip: { show: false },
      animation: false,
    }),
    [data, hex]
  );

  if (!data || data.length < 2) return null;

  return (
    <ReactECharts
      option={option}
      style={{ height: 28, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
      lazyUpdate
    />
  );
}

/**
 * Props (all backward compatible — existing callers keep working unchanged):
 *  - label, value, unit, tone, subtext, loading, icon — original contract.
 *  - decimals: number of decimals for the animated counter (only applies
 *    when `value` is a real JS number; string values render as-is).
 *  - sparklineData: number[] rendered as a tiny inline echarts trend line.
 *  - trend: { direction: "up"|"down"|"flat", value: string } delta badge.
 *  - status: "normal"|"warning"|"critical" — small status dot.
 *  - tooltip: string shown via native title attribute.
 *  - lastUpdated: epoch-ms number, Date, ISO string, or pre-formatted text.
 *  - index: stagger index for the entrance animation when rendered in a list.
 */
export default function StatCard({
  label,
  value,
  unit,
  tone = "accent",
  subtext,
  loading = false,
  icon,
  decimals = 0,
  sparklineData,
  trend,
  status,
  tooltip,
  lastUpdated,
  index = 0,
}) {
  const t = TONES[tone] ?? TONES.accent;
  const isNumericValue = typeof value === "number" && Number.isFinite(value);
  const trendConf = trend?.direction ? TREND_STYLES[trend.direction] : null;
  const TrendIcon = trendConf?.icon;
  const lastUpdatedLabel = resolveLastUpdated(lastUpdated);
  const statusDotClass = status ? STATUS_DOT[status] ?? STATUS_DOT.normal : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.05, ease: "easeOut" }}
      title={tooltip || undefined}
      className={`relative overflow-hidden rounded-xl border ${t.border} bg-panel/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-opacity-60 hover:shadow-md dark:bg-panel/70`}
    >
      <div className={`pointer-events-none absolute inset-0 ${t.glow}`} />
      <div className="relative flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            {label}
            {tooltip && <Info size={10} className="shrink-0 text-slate-600" />}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {statusDotClass && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${statusDotClass} ${status === "critical" ? "animate-pulse" : ""}`}
                aria-label={`status: ${status}`}
              />
            )}
            {icon && (
              <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-slate-950/40 text-xs ${t.text}`}>
                {icon}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <span className="text-2xl font-semibold leading-none text-slate-50">
            {value == null ? (
              <span className="text-slate-600">—</span>
            ) : isNumericValue ? (
              <AnimatedValue value={value} decimals={decimals} />
            ) : (
              value
            )}
            {unit && value != null && <span className={`ml-1 text-sm font-normal ${t.text}`}>{unit}</span>}
          </span>
        )}

        {!loading && sparklineData?.length > 1 && <Sparkline data={sparklineData} hex={t.hex} />}

        {(subtext || trendConf || lastUpdatedLabel) && !loading && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {subtext && <span className="text-[10px] text-slate-500">{subtext}</span>}
            {trendConf && (
              <span
                className={`inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] font-semibold ${trendConf.className}`}
              >
                <TrendIcon size={9} />
                {trend.value}
              </span>
            )}
            {lastUpdatedLabel && (
              <span className="ml-auto whitespace-nowrap text-[9px] text-slate-600">{lastUpdatedLabel}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
