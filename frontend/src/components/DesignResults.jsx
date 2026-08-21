import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  PencilRuler,
  Box,
  Building,
  Waves,
  Calculator,
  Receipt,
  Wrench,
  Printer,
  AlertTriangle,
  Satellite,
  PenLine,
} from "lucide-react";
import EmptyState from "./ui/EmptyState.jsx";
import EngineeringDrawings2D from "./EngineeringDrawings2D.jsx";
import RechargeStructureScene from "./three/RechargeStructureScene.jsx";

const n = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));
const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);

const TABS = [
  { id: "summary", label: "Summary", icon: LayoutGrid },
  { id: "drawings_2d", label: "2D CAD Drawings", icon: PencilRuler },
  { id: "vis_3d", label: "3D Flow Model", icon: Box },
  { id: "structure", label: "Structure Specs", icon: Building },
  { id: "hydraulics", label: "Hydraulics & Equations", icon: Waves },
  { id: "calculations", label: "Worked Sheet & Math", icon: Calculator },
  { id: "boq", label: "BOQ & Cost Estimate", icon: Receipt },
  { id: "construction_guide", label: "Construction & Maintenance", icon: Wrench },
];

export default function DesignResults({ result }) {
  const [tab, setTab] = useState("summary");

  if (!result) {
    return (
      <EmptyState
        icon={<PenLine size={20} />}
        title="Your design will appear here"
        description="Fill in the rooftop catchment and design inputs on the left, then submit — the engineering-grade design (2D CAD drawings, 3D model, hydraulics, BOQ, and construction guide) populates this panel once generated."
        className="min-h-[480px]"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 print:p-0">
      <div className="flex items-center justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
          <DataSourceBanner label="Rainfall" source={result.rainfall_source} value={`${n(result.annual_rainfall_mm, 1)} mm/yr`} />
          <DataSourceBanner label="Groundwater" source={result.groundwater_source} value={`${n(result.groundwater_depth_m)} m below ground`} />
        </div>
        <button
          onClick={() => window.print()}
          className="ml-3 flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 print:hidden"
        >
          <Printer size={13} />
          Printable Report
        </button>
      </div>

      {result.warnings?.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-warning/40 bg-warning/10 p-4 text-xs text-warning">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="glass-panel flex gap-1 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 p-1 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-medium transition ${
              tab === t.id
                ? "text-accent"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tab === t.id && (
              <motion.span
                layoutId="design-results-tab-highlight"
                className="absolute inset-0 rounded-md bg-accent/15"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <t.icon size={13} className="relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {tab === "summary" && <SummaryTab r={result} />}
          {tab === "drawings_2d" && <EngineeringDrawings2D result={result} />}
          {tab === "vis_3d" && <RechargeStructureScene result={result} />}
          {tab === "structure" && <StructureTab r={result} />}
          {tab === "hydraulics" && <HydraulicsTab r={result} />}
          {tab === "calculations" && <CalculationSheet rows={result.calculation_sheet ?? []} r={result} />}
          {tab === "boq" && <BoqTab r={result} />}
          {tab === "construction_guide" && <ConstructionGuideTab r={result} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SummaryTab({ r }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Catchment & Water Balance">
        <MetricGrid>
          <Metric label="Catchment area" value={n(r.catchment_area_sqm)} unit="m²" />
          <Metric label="Runoff coefficient" value={n(r.runoff_coefficient, 3)} />
          <Metric label="Hydrologic soil group" value={r.hydrologic_soil_group} />
          <Metric label="Permeability" value={n(r.permeability_mm_hr, 1)} unit="mm/hr" />
          <Metric label="Gross annual runoff" value={n(r.gross_annual_runoff_m3)} unit="m³/yr" />
          <Metric label="Net annual harvest" value={n(r.annual_harvest_m3)} unit="m³/yr" highlight />
          <Metric label="Annual recharge target" value={n(r.annual_recharge_target_m3)} unit="m³/yr" highlight />
          <Metric label="Design-storm volume" value={n(r.design_storm_volume_m3, 3)} unit="m³" />
          {r.storage_tank_m3 != null && (
            <Metric label="Storage tank" value={n(r.storage_tank_m3)} unit="m³" />
          )}
          <Metric label="Expected GW rise" value={n(r.expected_gw_rise_m, 3)} unit="m/yr" />
          <Metric label="Excavation" value={n(r.excavation_volume_m3)} unit="m³" />
          <Metric label="Estimated cost" value={inr(r.estimated_cost_inr)} highlight />
        </MetricGrid>
      </Panel>
    </div>
  );
}

function StructureTab({ r }) {
  return (
    <div className="flex flex-col gap-4">
      {r.pit && (
        <Panel title={`Recharge Pit${r.pit.pit_count > 1 ? `s — ${r.pit.pit_count} nos.` : ""}`}>
          <MetricGrid>
            <Metric label="Number of pits" value={r.pit.pit_count} />
            <Metric label="Diameter" value={n(r.pit.diameter_m)} unit="m" />
            <Metric label="Effective depth" value={n(r.pit.depth_m)} unit="m" />
            <Metric label="Freeboard" value={n(r.pit.freeboard_m)} unit="m" />
            <Metric label="Volume per pit" value={n(r.pit.single_pit_volume_m3, 3)} unit="m³" />
            <Metric label="Total volume" value={n(r.pit.total_volume_m3, 3)} unit="m³" highlight />
          </MetricGrid>
        </Panel>
      )}

      {r.trench && (
        <Panel title="Recharge Trench">
          <MetricGrid>
            <Metric label="Width" value={n(r.trench.width_m)} unit="m" />
            <Metric label="Depth" value={n(r.trench.depth_m)} unit="m" />
            <Metric label="Total length" value={n(r.trench.total_length_m)} unit="m" />
            <Metric label="Segments" value={`${r.trench.segment_count} × ${n(r.trench.segment_length_m)} m`} />
            <Metric label="Total volume" value={n(r.trench.total_volume_m3, 3)} unit="m³" highlight />
          </MetricGrid>
        </Panel>
      )}

      {r.injection_borewell && (
        <Panel title="Injection Borewell — Conceptual Only" tone="danger">
          <MetricGrid>
            <Metric label="Trigger" value={r.injection_borewell.trigger_reason} />
            <Metric label="Conceptual depth" value={n(r.injection_borewell.conceptual_depth_m, 1)} unit="m" />
          </MetricGrid>
          <div className="mt-3 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div>• {r.injection_borewell.casing_zone_note}</div>
            <div>• {r.injection_borewell.gravel_pack_note}</div>
          </div>
          <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-[11px] text-danger">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>{r.injection_borewell.warning_text}</span>
          </div>
        </Panel>
      )}

      <Panel title="Filter Media Stack">
        <DataTable
          head={["Layer", "Material", "Particle size", "Vol (m³)", "Weight (kg)", "Porosity", "Void ratio", "K (mm/hr)"]}
          rows={r.filter_media.map((l) => [
            l.layer_order,
            l.material,
            l.particle_size_note,
            n(l.volume_m3, 3),
            n(l.weight_kg, 1),
            n(l.porosity, 2),
            n(l.void_ratio, 3),
            n(l.hydraulic_conductivity_mm_hr, 0),
          ])}
        />
        <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
          Layers listed top to bottom. Coarsest material sits at the base to maintain infiltration
          capacity; the sand layer at top does the filtering and is the serviceable element.
        </p>
      </Panel>
    </div>
  );
}

function HydraulicsTab({ r }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Peak Flow & Conveyance">
        <MetricGrid>
          <Metric label="Design intensity" value={n(r.peak_rainfall_intensity_mm_hr, 0)} unit="mm/hr" />
          <Metric label="Peak discharge" value={n(r.peak_discharge_lps, 2)} unit="L/s" highlight />
          <Metric label="Downpipes" value={`${r.downpipe_count} × ${r.downpipe_diameter_mm} mm`} />
          <Metric label="Collection main" value={r.conveyance_pipe_diameter_mm} unit="mm" />
          <Metric label="Overflow pipe" value={r.overflow_pipe_diameter_mm} unit="mm" />
        </MetricGrid>
      </Panel>

      <Panel title="Pretreatment">
        <MetricGrid>
          <Metric label="First-flush volume" value={n(r.first_flush_volume_l, 1)} unit="litres" />
          <Metric label="Desilting chamber" value={n(r.desilting_chamber_m3, 3)} unit="m³" />
        </MetricGrid>
      </Panel>

      <Panel title="Infiltration Performance">
        <MetricGrid>
          <Metric label="Infiltration capacity" value={n(r.infiltration_rate_m3_per_hr, 3)} unit="m³/hr" />
          <Metric label="Time to empty when full" value={n(r.time_to_empty_hr, 1)} unit="hours" highlight />
          <Metric label="Expected water-table rise" value={n(r.expected_gw_rise_m, 3)} unit="m/yr" />
        </MetricGrid>
        <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
          The structure must fully drain between storm events to be available for the next one. An
          emptying time beyond roughly 48 hours indicates the base area should be increased or the
          soil's infiltration capacity re-verified by a field percolation test.
        </p>
      </Panel>
    </div>
  );
}

function CalculationSheet({ rows }) {
  return (
    <Panel title="Design Calculation Sheet">
      <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
        Every governing formula with the values substituted into it, in design sequence — the working
        a reviewing engineer would check.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-slate-500 dark:text-slate-400">
            <tr className="border-b border-slate-300 dark:border-slate-700 text-left">
              <th className="w-8 py-2">#</th>
              <th className="py-2">Quantity</th>
              <th className="py-2">Formula</th>
              <th className="py-2">Substitution</th>
              <th className="py-2 text-right">Result</th>
              <th className="py-2">Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={i} className="border-b border-slate-200/70 align-top hover:bg-slate-100 dark:border-slate-800/70 dark:hover:bg-slate-800/30">
                <td className="py-2 text-slate-500 dark:text-slate-400">{s.step}</td>
                <td className="py-2 font-medium text-slate-900 dark:text-slate-100">{s.quantity}</td>
                <td className="py-2 font-mono text-[10px] text-accent">{s.formula}</td>
                <td className="py-2 font-mono text-[10px] text-slate-500 dark:text-slate-400">{s.substitution}</td>
                <td className="py-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                  {s.result} <span className="font-normal text-slate-500 dark:text-slate-400">{s.unit}</span>
                </td>
                <td className="py-2 text-[10px] text-slate-500 dark:text-slate-400">{s.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function BoqTab({ r }) {
  return (
    <Panel title="Bill of Quantities">
      <DataTable
        head={["Item", "Unit", "Quantity", "Rate (₹)", "Amount (₹)"]}
        rows={r.boq.map((i) => [
          i.item,
          i.unit,
          n(i.quantity, 2),
          Number(i.unit_rate_inr ?? 0).toLocaleString("en-IN"),
          Number(i.amount_inr ?? 0).toLocaleString("en-IN"),
        ])}
        footer={["Total (indicative)", "", "", "", `₹${Number(r.estimated_cost_inr).toLocaleString("en-IN")}`]}
        alignRight={[2, 3, 4]}
      />
      <p className="mt-3 rounded-lg border border-slate-300 bg-surface/60 p-2.5 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Rates are illustrative placeholders. Substitute the current state PWD / CPWD Schedule of Rates
        before this figure is used for a tender or budget submission. Quantities exclude contingency,
        labour escalation, and GST.
      </p>
    </Panel>
  );
}

/* ---------- shared presentational pieces ---------- */

function Panel({ title, tone = "accent", children }) {
  const border = tone === "danger" ? "border-danger/30" : "border-slate-200 dark:border-slate-800";
  return (
    <section className={`glass-panel rounded-xl border ${border} bg-panel/50 p-4`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

function MetricGrid({ children }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function Metric({ label, value, unit, highlight = false }) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
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

function DataTable({ head, rows, footer, alignRight = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="text-slate-500 dark:text-slate-400">
          <tr className="border-b border-slate-300 dark:border-slate-700 text-left">
            {head.map((h, i) => (
              <th key={h} className={`py-2 ${alignRight.includes(i) ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200/70 hover:bg-slate-100 dark:border-slate-800/70 dark:hover:bg-slate-800/30">
              {r.map((c, j) => (
                <td key={j} className={`py-2 ${alignRight.includes(j) ? "text-right" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-slate-300 font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">
              {footer.map((c, i) => (
                <td key={i} className={`py-2.5 ${alignRight.includes(i) ? "text-right" : ""}`}>{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function DataSourceBanner({ label, source, value }) {
  const live = source?.used;
  return (
    <div className="glass-panel flex items-center justify-between rounded-xl border border-slate-200 bg-panel/40 px-4 py-3 text-xs dark:border-slate-800">
      <div>
        <div className="font-semibold text-slate-900 dark:text-slate-100">{label}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {live ? (
            <span className="flex items-center gap-1 font-medium text-success">
              <Satellite size={11} className="shrink-0" />
              Live {source.kind} telemetry ({source.station_name ?? source.station_code}, {n(source.distance_km, 1)} km)
            </span>
          ) : (
            <span className="font-medium text-warning">Manual / default override</span>
          )}
        </div>
      </div>
      <div className="text-right font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function ConstructionGuideTab({ r }) {
  return (
    <div className="flex flex-col gap-4 text-xs">
      <Panel title="Step-by-Step Construction Procedure">
        <ol className="flex flex-col gap-2 text-slate-700 dark:text-slate-300 list-decimal pl-4">
          <li>
            <strong className="text-slate-900 dark:text-slate-100">Site Excavation:</strong> Excavate to specified depth ({n(r.pit?.depth_m || r.trench?.depth_m || 2.5)}m) maintaining 1:0.5 safe side slopes. Keep at least 3.0m clearance above seasonal high groundwater table.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">Bottom Preparation & Deep Bore (if applicable):</strong> Level bottom. If deep injection bore is recommended, drill 150mm Ø borewell, insert slotted PVC casing with 3mm slots, and pack with 2-5mm pea gravel around casing.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">Filter Layer 3 Placement (Bottom 50%):</strong> Lay coarse boulders/aggregates (50–200 mm particle size) to a depth of {n((r.pit?.depth_m || 2.5) * 0.5)}m.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">Filter Layer 2 Placement (Middle 25%):</strong> Lay graded gravel (5–10 mm particle size) to a depth of {n((r.pit?.depth_m || 2.5) * 0.25)}m.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">Filter Layer 1 Placement (Top 25%):</strong> Lay coarse river sand (1.5–2.0 mm particle size) to a depth of {n((r.pit?.depth_m || 2.5) * 0.25)}m.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">First Flush & Silt Trap Chamber:</strong> Construct 230mm brickwork Inspection Chamber (600×600mm) with 0.5mm first-flush bypass valve before pit inlet.
          </li>
        </ol>
      </Panel>

      <Panel title="Operation & Preventive Maintenance Schedule">
        <DataTable
          head={["Frequency", "Component", "Maintenance Action Required"]}
          rows={[
            ["Pre-Monsoon (Annual)", "Roof Catchment & Gutters", "Clean leaves, dust, and debris. Inspect roof slope and sealant."],
            ["Monthly (Monsoon)", "First Flush Diverter", "Drain settled silt after every major storm event. Verify bypass valve."],
            ["Quarterly", "Filter Coarse Sand", "Scrape top 50mm clogged sand layer, wash with clean water, and replace."],
            ["Bi-Annually", "Inspection Chamber & Silt Trap", "De-silt bottom chamber. Clean baffle screens and check inlet pipes."],
            ["Every 3 Years", "Gravel & Boulder Layers", "Excavate, wash, and re-lay gravel and boulder media to restore porosity."],
          ]}
        />
      </Panel>
    </div>
  );
}
