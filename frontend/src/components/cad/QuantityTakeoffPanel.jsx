import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shovel, Package, Layers3, Ruler, IndianRupee, Droplets, Leaf, Info, RefreshCw } from "lucide-react";
import useCountUp from "../../hooks/useCountUp.js";
import { extractTakeoff } from "../../lib/quantityTakeoff.js";
import Skeleton from "../ui/Skeleton.jsx";
import EmptyState from "../ui/EmptyState.jsx";

// Static class strings (never built dynamically) so Tailwind's content scan
// can see and keep every one of these utility classes.
const TONE = {
  ground: { chip: "border-ground/25 bg-ground/5", icon: "text-ground" },
  rock: { chip: "border-rock/25 bg-rock/5", icon: "text-rock" },
  sand: { chip: "border-sand/25 bg-sand/5", icon: "text-sand" },
  gravel: { chip: "border-gravel/25 bg-gravel/5", icon: "text-gravel" },
  aggregate: { chip: "border-aggregate/25 bg-aggregate/5", icon: "text-aggregate" },
  info: { chip: "border-info/25 bg-info/5", icon: "text-info" },
  accent: { chip: "border-accent/25 bg-accent/5", icon: "text-accent" },
  rechargeWater: { chip: "border-rechargeWater/25 bg-rechargeWater/5", icon: "text-rechargeWater" },
  success: { chip: "border-success/25 bg-success/5", icon: "text-success" },
};

const fmt = (v, decimals = 0) =>
  Number(v).toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

/**
 * Live-updating material/cost quantity-takeoff card grid, bound to a
 * `RwhDesignResponse`-shaped `result` via `extractTakeoff()`. Every figure
 * is either a real backend value or explicitly derived from one (see
 * `lib/quantityTakeoff.js`) — tiles for fields the backend didn't provide
 * are simply omitted, never shown as a fabricated 0.
 *
 * Props:
 *  - result: RwhDesignResponse | null — current (or last computed) design
 *  - loading: true while there is no `result` yet to show (first load) —
 *    renders a full skeleton grid.
 *  - recalculating: true while a *new* result is being fetched but a
 *    previous `result` is still on screen — keeps the existing tiles
 *    visible (with useCountUp animating to the new values on arrival)
 *    instead of blanking the panel, and shows a small "Recalculating…" badge.
 */
export default function QuantityTakeoffPanel({ result, loading = false, recalculating = false, className = "" }) {
  const takeoff = useMemo(() => extractTakeoff(result), [result]);

  // Fixed set of hook calls regardless of which tiles end up visible —
  // useCountUp tolerates null/undefined targets by treating them as 0, so
  // it's safe to always call it and decide visibility from the raw value.
  const excavationM3 = useCountUp(takeoff?.excavationM3, { decimals: 2 });
  const concreteM3 = useCountUp(takeoff?.concreteM3, { decimals: 2 });
  const sandM3 = useCountUp(takeoff?.sandM3, { decimals: 2 });
  const sandKg = useCountUp(takeoff?.sandKg, { decimals: 0 });
  const gravelM3 = useCountUp(takeoff?.gravelM3, { decimals: 2 });
  const gravelKg = useCountUp(takeoff?.gravelKg, { decimals: 0 });
  const aggregateM3 = useCountUp(takeoff?.aggregateM3, { decimals: 2 });
  const aggregateKg = useCountUp(takeoff?.aggregateKg, { decimals: 0 });
  const pipeLengthM = useCountUp(takeoff?.pipeLengthM, { decimals: 1 });
  const totalCostInr = useCountUp(takeoff?.totalCostInr, { decimals: 0 });
  const annualWaterSavedM3 = useCountUp(takeoff?.annualWaterSavedM3, { decimals: 1 });
  const co2SavingsKg = useCountUp(takeoff?.co2SavingsKg, { decimals: 0 });

  if (loading) {
    return (
      <div className={`glass-panel rounded-xl border border-slate-800 p-4 ${className}`}>
        <Skeleton className="mb-3 h-4 w-40" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!takeoff) {
    return (
      <EmptyState
        icon={<Package size={18} />}
        title="No quantities yet"
        description="Capture a rooftop and fill in the design inputs to see a live material and cost takeoff."
        className={`h-40 ${className}`}
      />
    );
  }

  const tiles = [
    takeoff.excavationM3 != null && {
      key: "excavation",
      label: "Excavation",
      icon: Shovel,
      tone: "ground",
      value: `${fmt(excavationM3, 2)} m³`,
    },
    takeoff.concreteM3 != null && {
      key: "concrete",
      label: "Concrete / RCC",
      icon: Package,
      tone: "rock",
      value: `${fmt(concreteM3, 2)} m³`,
    },
    takeoff.sandM3 != null && {
      key: "sand",
      label: "Filter sand",
      icon: Layers3,
      tone: "sand",
      value: `${fmt(sandM3, 2)} m³`,
      sub: takeoff.sandKg != null ? `${fmt(sandKg)} kg` : null,
    },
    takeoff.gravelM3 != null && {
      key: "gravel",
      label: "Filter gravel",
      icon: Layers3,
      tone: "gravel",
      value: `${fmt(gravelM3, 2)} m³`,
      sub: takeoff.gravelKg != null ? `${fmt(gravelKg)} kg` : null,
    },
    takeoff.aggregateM3 != null && {
      key: "aggregate",
      label: "Filter aggregate",
      icon: Layers3,
      tone: "aggregate",
      value: `${fmt(aggregateM3, 2)} m³`,
      sub: takeoff.aggregateKg != null ? `${fmt(aggregateKg)} kg` : null,
    },
    takeoff.pipeLengthM != null && {
      key: "pipe",
      label: "Conveyance pipe",
      icon: Ruler,
      tone: "info",
      value: `${fmt(pipeLengthM, 1)} m`,
      sub: takeoff.pipeDiameterMm != null ? `Ø ${takeoff.pipeDiameterMm} mm` : null,
    },
    takeoff.totalCostInr != null && {
      key: "cost",
      label: "Estimated cost",
      icon: IndianRupee,
      tone: "accent",
      value: `₹${fmt(totalCostInr)}`,
    },
    takeoff.annualWaterSavedM3 != null && {
      key: "water",
      label: "Annual water saved",
      icon: Droplets,
      tone: "rechargeWater",
      value: `${fmt(annualWaterSavedM3, 1)} m³/yr`,
    },
    takeoff.co2SavingsKg != null && {
      key: "co2",
      label: "CO₂ avoided",
      icon: Leaf,
      tone: "success",
      value: `${fmt(co2SavingsKg)} kg/yr`,
      estimated: true,
    },
  ].filter(Boolean);

  if (tiles.length === 0) {
    return (
      <EmptyState
        icon={<Package size={18} />}
        title="No quantities available"
        description="The generated design didn't include any takeoff figures."
        className={`h-40 ${className}`}
      />
    );
  }

  return (
    <div className={`glass-panel rounded-xl border border-slate-800 p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Live Quantity Takeoff</h3>
        <AnimatePresence mode="wait">
          {recalculating ? (
            <motion.span
              key="recalculating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-[10px] font-medium text-accent"
            >
              <RefreshCw size={11} className="animate-spin" />
              Recalculating…
            </motion.span>
          ) : (
            <motion.span
              key="from-engine"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-[10px] text-slate-500"
            >
              <Info size={11} />
              From the backend design engine
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <AnimatePresence initial={false}>
          {tiles.map((t) => (
            <motion.div
              key={t.key}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={`rounded-lg border p-2.5 ${TONE[t.tone].chip}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                <t.icon size={12} className={`shrink-0 ${TONE[t.tone].icon}`} />
                <span className="truncate">{t.label}</span>
                {t.estimated && (
                  <span className="ml-auto shrink-0 rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[8px] font-semibold normal-case text-warning">
                    Estimated
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{t.value}</div>
              {t.sub && <div className="mt-0.5 text-[10px] text-slate-500">{t.sub}</div>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
