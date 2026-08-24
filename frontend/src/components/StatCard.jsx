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
  accent: { border: "border-accent/30", text: "text-accent", glow: "bg-accent/15", hex: "#2dd4bf" },
  blue: { border: "border-accent-blue/30", text: "text-accent-blue", glow: "bg-accent-blue/15", hex: "#3b82f6" },
  amber: { border: "border-amber-400/30", text: "text-amber-300", glow: "bg-amber-400/15", hex: "#fbbf24" },
  rose: { border: "border-rose-400/30", text: "text-rose-300", glow: "bg-rose-400/15", hex: "#f87171" },
  purple: { border: "border-purple-400/30", text: "text-purple-300", glow: "bg-purple-400/15", hex: "#c084fc" },
  slate: { border: "border-slate-700", text: "text-slate-300", glow: "bg-slate-500/15", hex: "#94a3b8" },
  // Phase 0 semantic + engineering-domain tokens
  success: { border: "border-success/30", text: "text-success", glow: "bg-success/15", hex: "#34d399" },
  warning: { border: "border-warning/30", text: "text-warning", glow: "bg-warning/15", hex: "#fbbf24" },
  danger: { border: "border-danger/30", text: "text-danger", glow: "bg-danger/15", hex: "#f87171" },
  info: { border: "border-info/30", text: "text-info", glow: "bg-info/15", hex: "#38bdf8" },
  groundwater: { border: "border-groundwater/30", text: "text-groundwater", glow: "bg-groundwater/15", hex: "#60a5fa" },
  rainfall: { border: "border-rainfall/30", text: "text-rainfall", glow: "bg-rainfall/15", hex: "#60a5fa" },
  rechargeWater: { border: "border-rechargeWater/30", text: "text-rechargeWater", glow: "bg-rechargeWater/15", hex: "#22d3ee" },
};

const STATUS_DOT = {
  normal: "bg-success",
  warning: "bg-warning",
  critical: "bg-danger",
};

const TREND_STYLES = {
  up: { icon: TrendingUp, className: "bg-success/15 text-success" },
  down: { icon: TrendingDown, className: "bg-danger/15 text-danger" },
  flat: { icon: Minus, className: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
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
  emptyLabel = "N/A",
}) {
  const t = TONES[tone] ?? TONES.accent;
  const isNumericValue = typeof value === "number" && Number.isFinite(value);
  const trendConf = trend?.direction ? TREND_STYLES[trend.direction] : null;
  const TrendIcon = trendConf?.icon;
  const lastUpdatedLabel = resolveLastUpdated(lastUpdated);
  const statusDotClass = status ? STATUS_DOT[status] ?? STATUS_DOT.normal : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04, ease: "easeOut" }}
      title={tooltip || undefined}
      className="glass-panel relative overflow-hidden rounded-xl p-2.5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-slate-500 truncate">
            {label}
            {tooltip && <Info size={9} className="shrink-0 text-slate-400" />}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {statusDotClass && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${statusDotClass} ${status === "critical" ? "animate-pulse" : ""}`}
                aria-label={`status: ${status}`}
              />
            )}
            {icon && (
              <span className={`flex h-5.5 w-5.5 items-center justify-center rounded-md ${t.glow} text-[10px] ${t.text}`}>
                {icon}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <div className="flex items-baseline gap-1 truncate text-lg font-bold leading-none text-slate-900 dark:text-slate-50 sm:text-xl">
            <span>
              {value == null ? (
                <span className="text-xs font-semibold text-slate-400">{emptyLabel}</span>
              ) : isNumericValue ? (
                <AnimatedValue value={value} decimals={decimals} />
              ) : (
                value
              )}
            </span>
            {unit && value != null && <span className={`text-xs font-semibold ${t.text} truncate`}>{unit}</span>}
          </div>
        )}

        {!loading && sparklineData?.length > 1 && (
          <div className="-my-0.5">
            <Sparkline data={sparklineData} hex={t.hex} />
          </div>
        )}

        {(subtext || trendConf || lastUpdatedLabel) && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] leading-none pt-0.5">
            {subtext && <span className="text-slate-500 truncate max-w-[130px]">{subtext}</span>}
            {trendConf && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold ${trendConf.className}`}
              >
                <TrendIcon size={8} />
                {trend.value}
              </span>
            )}
            {lastUpdatedLabel && (
              <span className="ml-auto whitespace-nowrap text-[8.5px] text-slate-400">{lastUpdatedLabel}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
