import { useMemo, useState } from "react";
import { Droplets, Warehouse, Scale, Lightbulb, IndianRupee, AlertTriangle, ChevronDown, Wallet } from "lucide-react";
import EmptyState from "../ui/EmptyState.jsx";
import StorageTankCAD from "./StorageTankCAD.jsx";
import WaterBalanceFlow from "./WaterBalanceFlow.jsx";
import {
  LPCD_DEFAULTS,
  calcDemand,
  designStorageTank,
  TANK_MATERIALS,
  estimateTankCost,
  calcWaterBalance,
  recommendStrategy,
  STRATEGY_LABELS,
  SIZE_GUIDANCE_LABELS,
  estimateFullSystemCost,
  estimateSavings,
  ASSUMED_WATER_COST_INR_PER_M3,
} from "../../lib/waterDemand.js";

const n = (v, d = 2) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);

/**
 * Water Demand & Storage Design — additive module bolted onto the existing
 * design-results view. Every figure either comes straight from the real
 * backend `result` (harvestable water, catchment area, groundwater depth,
 * annual rainfall) or is computed from user-entered demand inputs via
 * documented CPHEEO/IS 1172 defaults (see lib/waterDemand.js) — nothing here
 * is a fabricated placeholder number. This tab does not read from or write
 * to the recharge-pit calculation path at all.
 */
export default function WaterDemandTab({ result }) {
  const [buildingType, setBuildingType] = useState("residential");
  const [occupancy, setOccupancy] = useState(5);
  const [lpcdOverride, setLpcdOverride] = useState(null);
  const [storageDays, setStorageDays] = useState(5);
  const [materialCode, setMaterialCode] = useState("rcc");
  const [preferredShape, setPreferredShape] = useState("auto");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const lpcd = lpcdOverride ?? LPCD_DEFAULTS[buildingType]?.lpcd ?? 135;

  const demand = useMemo(
    () => calcDemand({ occupancy, lpcd, storageDays }),
    [occupancy, lpcd, storageDays]
  );

  const harvestableM3PerYear = result?.annual_harvest_m3 ?? null;
  const tank = useMemo(
    () => (demand.storageReqM3 > 0 ? designStorageTank({ volumeM3: demand.storageReqM3, preferredShape }) : null),
    [demand.storageReqM3, preferredShape]
  );
  const tankCostInr = tank ? estimateTankCost(tank.volumeM3, materialCode) : null;

  const balance = useMemo(
    () =>
      calcWaterBalance({
        harvestableM3PerYear,
        demandM3PerYear: demand.annualM3,
      }),
    [harvestableM3PerYear, demand.annualM3]
  );

  const recommendation = useMemo(
    () =>
      recommendStrategy({
        harvestableM3PerYear,
        demandM3PerYear: demand.annualM3,
        demandCoveragePct: balance.demandCoveragePct,
        roofAreaSqm: result?.catchment_area_sqm ?? null,
        groundwaterDepthM: result?.groundwater_depth_m ?? null,
        availableFootprintM: null,
      }),
    [harvestableM3PerYear, demand.annualM3, balance.demandCoveragePct, result]
  );

  const systemCost = useMemo(() => (tankCostInr != null ? estimateFullSystemCost(tankCostInr) : null), [tankCostInr]);
  const savings = useMemo(
    () => (systemCost ? estimateSavings({ waterUsedM3PerYear: balance.waterUsedM3, totalCostInr: systemCost.totalInr }) : null),
    [systemCost, balance.waterUsedM3]
  );

  if (!result) {
    return (
      <EmptyState
        icon={<Droplets size={20} />}
        title="Generate a recharge design first"
        description="Water demand is compared against the harvestable-water figure from a generated design — fill in the inputs and generate a design, then come back to this tab."
        className="min-h-[320px]"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-lg border border-info/30 bg-info/10 p-2.5 text-[11px] text-info">
        Independent from the recharge-pit design above — this tab estimates household/facility water demand and
        checks it against the same design's real harvestable-water and groundwater figures. It doesn't change the
        recharge pit's sizing.
      </div>

      <Panel title="Water Demand & Tank Sizing" icon={Droplets}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Building type
            <select
              value={buildingType}
              onChange={(e) => {
                setBuildingType(e.target.value);
                setLpcdOverride(null);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            >
              {Object.entries(LPCD_DEFAULTS).map(([code, def]) => (
                <option key={code} value={code}>
                  {def.label} ({def.lpcd} LPCD)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Occupancy (users)
            <input
              type="number"
              min="0"
              value={occupancy}
              onChange={(e) => setOccupancy(Math.max(0, Number(e.target.value)))}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Tank Shape
            <select
              value={preferredShape}
              onChange={(e) => setPreferredShape(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            >
              <option value="auto">Auto (Recommended)</option>
              <option value="circular">Circular Tank</option>
              <option value="rectangular">Rectangular Tank</option>
              <option value="underground_rectangular">Underground Sump / Tank</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Tank Material
            <select
              value={materialCode}
              onChange={(e) => setMaterialCode(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            >
              {TANK_MATERIALS.map((m) => (
                <option key={m.code} value={m.code}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
        >
          <ChevronDown size={13} className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          Advanced — override LPCD / storage buffer days
        </button>
        {advancedOpen && (
          <div className="mt-2 grid grid-cols-1 gap-2.5 rounded-lg border border-dashed border-slate-300 p-2 sm:grid-cols-2 dark:border-slate-700">
            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Per-capita demand (LPCD)
              <input
                type="number"
                min="0"
                value={lpcd}
                onChange={(e) => setLpcdOverride(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Storage buffer (days) — default 5
              <input
                type="range"
                min="1"
                max="15"
                value={storageDays}
                onChange={(e) => setStorageDays(Number(e.target.value))}
                className="accent-accent"
              />
              <span className="text-[11px] text-slate-600 dark:text-slate-300">{storageDays} days</span>
            </label>
          </div>
        )}

        <MetricGrid className="mt-2.5">
          <Metric label="Daily demand" value={n(demand.dailyM3, 2)} unit="m³/day" />
          <Metric label="Annual demand" value={n(demand.annualM3, 1)} unit="m³/yr" highlight />
          <Metric label="Storage requirement" value={n(demand.storageReqM3, 2)} unit="m³" highlight />
          {tank && <Metric label="Selected Tank" value={tank.label} highlight />}
          {tank?.diameterM != null && <Metric label="Diameter" value={n(tank.diameterM)} unit="m" />}
          {tank?.lengthM != null && <Metric label="Length" value={n(tank.lengthM)} unit="m" />}
          {tank?.widthM != null && <Metric label="Width" value={n(tank.widthM)} unit="m" />}
          {tank?.heightM != null && <Metric label="Height" value={n(tank.heightM)} unit="m" />}
          {tankCostInr != null && <Metric label="Estimated cost" value={inr(tankCostInr)} highlight icon={IndianRupee} />}
        </MetricGrid>
      </Panel>

      {tank && (
        <details className="glass-panel rounded-xl border border-slate-200 bg-panel/50 p-2.5 text-xs dark:border-slate-800">
          <summary className="cursor-pointer font-bold text-slate-800 hover:text-sky-600 dark:text-slate-200 dark:hover:text-sky-400">
            📐 Storage Tank — 2D Drawing ({tank.label})
          </summary>
          <div className="mt-2">
            <StorageTankCAD tank={tank} materialCode={materialCode} />
          </div>
        </details>
      )}

      <Panel title="Water Balance" icon={Scale}>
        <WaterBalanceFlow balance={balance} />
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <Metric
            label="Demand coverage"
            value={balance.demandCoveragePct == null ? "—" : `${balance.demandCoveragePct}%`}
            highlight
          />
          <Metric label="Shortfall" value={n(balance.shortfallM3, 1)} unit="m³/yr" />
          <Metric label="Overflow to recharge" value={n(balance.overflowM3, 1)} unit="m³/yr" />
        </div>
      </Panel>

      <Panel title="Recommendation" icon={Lightbulb} tone="accent">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-accent/40 bg-accent/15 px-3 py-1.5 text-sm font-bold text-accent">
            {STRATEGY_LABELS[recommendation.strategy]}
          </span>
          {recommendation.sizeGuidance !== "standard" && (
            <span className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
              {SIZE_GUIDANCE_LABELS[recommendation.sizeGuidance]}
            </span>
          )}
        </div>
        <ul className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          {recommendation.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-slate-400" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {systemCost && savings && (
        <Panel title="Cost Estimation & Savings" icon={Wallet}>
          <MetricGrid>
            <Metric label="Total system cost" value={inr(systemCost.totalInr)} highlight />
            <Metric label="Annual saving" value={inr(savings.annualSavingInr)} highlight />
            <Metric label="Payback period" value={savings.paybackYears == null ? "—" : `${n(savings.paybackYears, 1)} yrs`} highlight />
            <Metric label={`ROI (${savings.lifeYears}-yr life)`} value={savings.roiPct == null ? "—" : `${savings.roiPct}%`} />
          </MetricGrid>

          <details className="mt-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 p-2 text-xs dark:border-slate-800 dark:bg-slate-900/40">
            <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
              View itemized breakdown ({systemCost.items.length} items)
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-slate-300 text-left dark:border-slate-700">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {systemCost.items.map((it) => (
                    <tr key={it.key} className="border-b border-slate-200/70 dark:border-slate-800/70">
                      <td className="py-1 text-slate-700 dark:text-slate-300">{it.label}</td>
                      <td className="py-1 text-right font-medium text-slate-900 dark:text-slate-100">{inr(it.amountInr)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-300 font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">
                    <td className="py-1.5">Total system cost</td>
                    <td className="py-1.5 text-right">{inr(systemCost.totalInr)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
        </Panel>
      )}
    </div>
  );
}

/* ---------- local presentational pieces (mirrors DesignResults.jsx's Panel/MetricGrid/Metric) ---------- */

function Panel({ title, icon: Icon, tone = "default", children }) {
  const border = tone === "accent" ? "border-accent/30" : "border-slate-200 dark:border-slate-800";
  return (
    <section className={`glass-panel rounded-xl border ${border} bg-panel/50 p-3`}>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {Icon && <Icon size={14} className="text-accent" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetricGrid({ children, className = "" }) {
  return <div className={`grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-4 ${className}`}>{children}</div>;
}

function Metric({ label, value, unit, highlight = false }) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        highlight ? "border-accent/30 bg-accent/5" : "border-slate-200 bg-surface/50 dark:border-slate-800"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}
