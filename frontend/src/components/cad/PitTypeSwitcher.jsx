import { motion } from "framer-motion";
import { Circle, RectangleHorizontal, Rows3, ArrowDownToLine, Container, MoveDown, Info, PencilRuler } from "lucide-react";

/**
 * Structure-type visualization switcher for the 2D CAD tab.
 *
 * Backend-support reality (verified against backend/app/schemas/design.py +
 * backend/app/services/rwh_design_engine.py, and the `chk_rwh_designs_structure`
 * constraint in database/recharge.sql): `structure_type` is only ever set to
 * "recharge_pit" (circular, sized by `pit.diameter_m`/`pit.depth_m`) or
 * "recharge_trench" (`trench.width_m`/`depth_m`/`total_length_m`).
 * `injection_borewell` is a separate, independently-triggered supplementary
 * dict that can appear alongside either — it is never itself the primary
 * `structure_type`. There is no backend concept of a rectangular pit,
 * percolation tank, or recharge shaft.
 *
 * So three of these six options are REAL (backed by actual computed
 * dimensions for this design) and three are FRONTEND-ONLY visual variants
 * that reuse the pit/trench dimensions the engine did compute, with a
 * clearly-labeled preset transform (e.g. "recharge shaft" = the same pit
 * diameter/depth redrawn narrow-and-deep). Types with no underlying
 * dimension data for this design are disabled with an explanatory tooltip.
 */
export const STRUCTURE_VIEWS = [
  {
    id: "circular_pit",
    label: "Circular Pit",
    icon: Circle,
    real: (r) => Boolean(r?.pit),
    tooltip: "Backend-computed circular recharge pit geometry.",
  },
  {
    id: "rectangular_pit",
    label: "Rectangular Pit",
    icon: RectangleHorizontal,
    real: () => false,
    tooltip: "Frontend-only variant — visualized using the pit's diameter/depth reshaped as an equal-area square footprint. The engine does not compute rectangular pit geometry.",
    requires: (r) => Boolean(r?.pit),
  },
  {
    id: "trench",
    label: "Trench",
    icon: Rows3,
    real: (r) => Boolean(r?.trench),
    tooltip: "Backend-computed recharge trench geometry.",
    requires: (r) => Boolean(r?.trench),
  },
  {
    id: "injection_well",
    label: "Injection Well",
    icon: ArrowDownToLine,
    real: (r) => Boolean(r?.injection_borewell),
    tooltip: "Backend-computed conceptual injection borewell (triggered by groundwater depth / soil group).",
    requires: (r) => Boolean(r?.injection_borewell),
  },
  {
    id: "percolation_tank",
    label: "Percolation Tank",
    icon: Container,
    real: () => false,
    tooltip: "Frontend-only variant — visualized using pit/trench dimensions redrawn as a shallow wide tank. The engine does not compute a separate percolation-tank design.",
    requires: (r) => Boolean(r?.pit || r?.trench),
  },
  {
    id: "recharge_shaft",
    label: "Recharge Shaft",
    icon: MoveDown,
    real: () => false,
    tooltip: "Frontend-only variant — visualized using the pit's dimensions redrawn narrow and deep. The engine does not compute a separate recharge-shaft design.",
    requires: (r) => Boolean(r?.pit),
  },
  {
    id: "custom",
    label: "Custom Design",
    icon: PencilRuler,
    real: () => false,
    tooltip: "Sketch your own circular or rectangular pit with dimensions you enter — always available, independent of this design's computed result.",
    requires: () => true,
  },
];

/**
 * Given the current `result`, returns the structure-view id that best
 * matches what the backend actually computed for this design (used as the
 * switcher's initial selection).
 */
export function defaultStructureView(result) {
  if (result?.structure_type === "recharge_trench" || result?.trench) return "trench";
  if (result?.pit) return "circular_pit";
  if (result?.injection_borewell) return "injection_well";
  return "circular_pit";
}

export default function PitTypeSwitcher({ result, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-1">
      {STRUCTURE_VIEWS.map((v) => {
        const isReal = v.real(result);
        const available = v.requires ? v.requires(result) : isReal;
        const active = value === v.id;
        const Icon = v.icon;
        return (
          <button
            key={v.id}
            type="button"
            disabled={!available}
            onClick={() => available && onChange(v.id)}
            title={v.tooltip}
            className={`group relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${
              !available
                ? "cursor-not-allowed text-slate-600"
                : active
                ? "text-accent"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {active && available && (
              <motion.span
                layoutId="pit-type-switcher-highlight"
                className="absolute inset-0 rounded-md bg-accent/15 ring-1 ring-accent/30"
                transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
              />
            )}
            <Icon size={12} className="relative z-10 shrink-0" />
            <span className="relative z-10 whitespace-nowrap">{v.label}</span>
            {!isReal && available && (
              <Info size={10} className="relative z-10 shrink-0 text-slate-500" aria-label="Frontend-only visual variant" />
            )}
          </button>
        );
      })}
    </div>
  );
}
